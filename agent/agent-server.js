// ============================================================
// agent/agent-server.js — 职业规划对话智能体服务（重构版）
// 本地：Node.js HTTP server (port 8101)
// 线上：CloudBase SCF handler
//
// 结构：
//   1. 配置 & 工具函数
//   2. 核心：handleChat（主流程，清晰分步）
//   3. 辅助函数（ensureSession / checkTurnLimits / injectCollectedFields / callDeepSeek / handleToolCalls）
//   4. HTTP Server（本地）
//   5. SCF Handler（线上）
// ============================================================

import { createServer } from 'http';
import { TOOLS, executeTool } from './tools.js';
import { buildSystemPrompt } from './prompt.js';
import * as session from './session.js';

// ==================== 配置 ====================

const PORT = 8101;
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MAX_TOTAL_TURNS = 28;

let API_KEY = process.env.DEEPSEEK_API_KEY || '';

function getApiKey() {
  if (!API_KEY) {
    API_KEY = process.env.DEEPSEEK_API_KEY || globalThis.__DEEPSEEK_KEY__ || '';
  }
  if (!API_KEY) {
    console.warn('[Agent] DEEPSEEK_API_KEY 未设置，API 调用将失败');
  }
  return API_KEY;
}

// ==================== 主流程 ====================

/**
 * 处理一次对话请求
 * @param {string} sessionId - 会话 ID
 * @param {string} userMessage - 用户输入
 * @param {object} [profile] - 画像摘要（首次创建时传入）
 * @returns {object} { reply, toolCalls, phase, label, error, status, sessionId }
 */
async function handleChat(sessionId, userMessage, profile) {
  // Step 1: 确保 session 有效
  const sessResult = ensureSession(sessionId, userMessage, profile);
  if (sessResult.error) return sessResult;

  // Step 2: 检查轮次限制（超限自动推进阶段）
  checkTurnLimits(sessResult.sess, sessionId);

  // Step 3: 注入已收集字段到系统消息（避免重复提问）
  injectCollectedFields(sessionId);

  // Step 4: 调用 DeepSeek API
  const key = getApiKey();
  if (!key) {
    return buildErrorReply(sessResult.sess, 'NO_API_KEY', '抱歉，AI 服务暂时不可用。请稍后再试。');
  }

  const apiResult = await callDeepSeek(sessionId, key);
  if (apiResult.error) return apiResult;

  const { reply, rawToolCalls } = apiResult;

  // Step 5: 处理工具调用（如有）
  if (rawToolCalls.length > 0) {
    const toolResult = await handleToolCalls(sessionId, rawToolCalls, reply, key);
    return toolResult;
  }

  // Step 6: 普通文本回复
  return buildSuccessReply(sessionId, reply);
}

// ==================== Session 管理 ====================

/**
 * 确保 session 存在且可接收新消息
 * @returns {object} { sess, error } — error 时返回错误回复对象
 */
function ensureSession(sessionId, userMessage, profile) {
  let sess = session.getSession(sessionId);

  if (!sess) {
    // 首次对话：创建会话
    const systemPrompt = buildSystemPrompt(profile);
    sess = session.createSession({ systemPrompt, profile });
    sessionId = sess.id;
    session.addMessage(sessionId, 'user', userMessage);
    console.log(`[Agent] 新会话创建: ${sessionId}`);
  } else {
    // 已存在的会话
    if (sess.status === 'completed') {
      return {
        error: {
          reply: '对话已完成。如需重新探索，请刷新页面开始新的对话。',
          toolCalls: [],
          phase: sess.phase,
          label: sess.phaseLabel,
          status: 'completed',
          sessionId,
        },
      };
    }
    session.addMessage(sessionId, 'user', userMessage);
  }

  return { sess, sessionId };
}

// ==================== 轮次限制 ====================

/**
 * 检查阶段轮次和全局轮次，超限则自动推进
 */
function checkTurnLimits(sess, sessionId) {
  // 阶段轮次
  let phaseTurns = (sess.phaseTurns || 0) + 1;
  const maxPhaseTurns = sess.maxPhaseTurns || 4;

  if (phaseTurns > maxPhaseTurns && sess.phase < 6) {
    const nextPhase = sess.phase + 1;
    const phaseLabels = {
      1: '现状了解', 2: '经验盘点', 3: '内在驱动',
      4: '现实考量', 5: '过往探索', 6: '总结确认', 7: '生成建议',
    };
    console.log(`[Agent] 阶段 ${sess.phase} 轮次超限 (${phaseTurns}/${maxPhaseTurns})，自动推进到阶段 ${nextPhase}`);
    session.updateSession(sessionId, {
      phase: nextPhase,
      phaseLabel: phaseLabels[nextPhase],
      phaseTurns: 0,
      phaseDepth: null,
      state: phaseToState(nextPhase),
    });
    sess = session.getSession(sessionId);
    phaseTurns = 1;
  }

  // 全局轮次
  const totalTurns = sess.messages.filter(m => m.role === 'user').length;
  if (totalTurns > MAX_TOTAL_TURNS && sess.phase < 6) {
    console.log(`[Agent] 全局轮次超限 (${totalTurns}/${MAX_TOTAL_TURNS})，强制进入总结`);
    session.updateSession(sessionId, {
      phase: 6,
      phaseLabel: '总结确认',
      phaseTurns: 0,
      state: 'SUMMARY_CONFIRM',
    });
    sess = session.getSession(sessionId);
  }

  // 更新阶段轮次
  session.updateSession(sessionId, { phaseTurns });
}

// ==================== 已收集字段注入 ====================

/**
 * 把 session.collected 中的字段注入系统消息
 * 让 AI 知道已问过什么，避免重复提问
 */
function injectCollectedFields(sessionId) {
  const sess = session.getSession(sessionId);
  const collected = sess.collected || {};

  // 只保留有实际内容的字段
  const entries = Object.entries(collected).filter(([k, v]) => v && typeof v === 'string' && v.trim());

  const sysIdx = sess.messages.findIndex(m => m.role === 'system');
  if (sysIdx < 0) return;

  let oldContent = sess.messages[sysIdx].content || '';

  // 移除旧的 [已收集信息] 区块
  const tagIdx = oldContent.indexOf('\n\n[已收集信息');
  if (tagIdx >= 0) {
    oldContent = oldContent.substring(0, tagIdx);
  }

  // 追加新的区块
  if (entries.length > 0) {
    const summary = entries.map(([k, v]) => `${k}=${v}`).join('，');
    sess.messages[sysIdx].content = oldContent + '\n\n[已收集信息，请勿重复询问：' + summary + ']';
  } else {
    sess.messages[sysIdx].content = oldContent;
  }

  session.updateSession(sessionId, { messages: sess.messages });
}

// ==================== DeepSeek API 调用 ====================

/**
 * 调用 DeepSeek API
 * @returns {object} { reply, rawToolCalls, error }
 */
async function callDeepSeek(sessionId, key) {
  const sess = session.getSession(sessionId);

  const requestBody = {
    model: 'deepseek-chat',
    messages: sess.messages,
    tools: TOOLS,
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 1024,
  };

  console.log(`[Agent] 请求 session=${sessionId} phase=${sess.phase} turn=${sess.phaseTurns}/${sess.maxPhaseTurns}`);

  let response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[Agent] API 错误 ${response.status}: ${errText.slice(0, 200)}`);
      return {
        error: buildErrorReply(sess, `API_${response.status}`, '抱歉，AI 服务暂时不可用。请稍后再试。'),
      };
    }
  } catch (err) {
    console.error('[Agent] 网络错误:', err.message);
    const errorType = err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
    return {
      error: buildErrorReply(sess, errorType, '抱歉，网络好像出了点问题。请稍后再试。'),
    };
  }

  // 解析响应
  let data;
  try {
    data = await response.json();
  } catch (e) {
    console.error('[Agent] JSON 解析失败:', e.message);
    return {
      error: buildErrorReply(sess, 'JSON_PARSE', '抱歉，AI 服务暂时不可用。请稍后再试。'),
    };
  }

  const choice = data.choices?.[0];
  if (!choice) {
    console.error('[Agent] 无有效回复:', JSON.stringify(data).slice(0, 200));
    return {
      error: buildErrorReply(sess, 'EMPTY_RESPONSE', '抱歉，AI 没有返回有效回复。'),
    };
  }

  const msg = choice.message;
  const reply = msg.content || '';
  const rawToolCalls = msg.tool_calls || [];

  return { reply, rawToolCalls };
}

// ==================== 工具调用处理 ====================

/**
 * 处理 AI 返回的工具调用
 */
async function handleToolCalls(sessionId, rawToolCalls, reply, key) {
  const sess = session.getSession(sessionId);
  const toolResults = [];

  console.log(`[Agent] AI 调用了 ${rawToolCalls.length} 个工具:`, rawToolCalls.map(t => t.function?.name).join(', '));

  // 记录 assistant 的 tool_calls 到消息历史
  session.addToolCalls(sessionId, rawToolCalls);

  // 执行每个工具
  for (const tc of rawToolCalls) {
    const fn = tc.function;
    if (!fn) continue;

    let args = {};
    try {
      args = JSON.parse(fn.arguments);
    } catch {
      console.warn(`[Agent] 解析 tool 参数失败: ${fn.arguments}`);
      continue;
    }

    const result = executeTool(fn.name, args, sess);
    toolResults.push({ name: fn.name, args, result });

    // 工具结果回传给 DeepSeek
    session.addToolResult(sessionId, tc.id, JSON.stringify(result));
    console.log(`[Agent] 工具 ${fn.name}(${JSON.stringify(args)}) → ${JSON.stringify(result)}`);

    // 如果 finish_conversation 成功，直接返回
    if (fn.name === 'finish_conversation' && result.ok) {
      const finalReply = reply || '感谢你的信任，祝你找到心仪的职业方向！';
      session.addMessage(sessionId, 'assistant', finalReply);
      return {
        reply: finalReply,
        toolCalls: toolResults,
        phase: 7,
        label: '生成建议',
        status: 'completed',
        sessionId,
      };
    }
  }

  // 检查是否需要 follow-up（AI 调了工具但文字回复过短/不完整）
  const isShortReply = !reply || reply.trim().length < 30 || /[—–-]\s*$/.test(reply.trim());
  if (isShortReply && rawToolCalls.length > 0) {
    const followUpResult = await tryFollowUp(sessionId, key);
    if (followUpResult) {
      return followUpResult;
    }
  }

  // 兜底：如果还是没有文字回复，生成阶段敏感的过渡语
  if (!reply) {
    const fallback = buildFallbackReply(sess, rawToolCalls);
    session.addMessage(sessionId, 'assistant', fallback);
    return {
      reply: fallback,
      toolCalls: toolResults,
      phase: sess.phase,
      label: sess.phaseLabel,
      sessionId,
    };
  }

  // 正常情况：有文字回复
  session.addMessage(sessionId, 'assistant', reply);
  return {
    reply,
    toolCalls: toolResults,
    phase: sess.phase,
    label: sess.phaseLabel,
    sessionId,
  };
}

/**
 * 尝试 follow-up 调用，让 AI 补全回复
 */
async function tryFollowUp(sessionId, key) {
  const sess = session.getSession(sessionId);

  // 如果对话已结束，不再 follow-up
  if (sess.status === 'completed') {
    return {
      reply: '对话已完成。如需重新探索，请刷新页面开始新的对话。',
      toolCalls: [],
      phase: 7,
      label: '生成建议',
      status: 'completed',
      sessionId,
    };
  }

  // follow-up：强制 AI 输出非空回复
  const followUpMessages = [
    { role: 'system', content: '你必须输出完整的回复内容，绝对不能为空。即使用户消息很短，你也要给出有信息量的回复。用中文回答。' },
    ...sess.messages,
  ];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const followUp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: followUpMessages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.8,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (followUp.ok) {
      const followData = await followUp.json();
      const followMsg = followData.choices?.[0]?.message;
      if (followMsg?.content) {
        session.addMessage(sessionId, 'assistant', followMsg.content);
        return {
          reply: followMsg.content,
          toolCalls: [],
          phase: sess.phase,
          label: sess.phaseLabel,
          sessionId,
        };
      }
    }
  } catch {
    // fall through to fallback
  }

  return null; // 让调用者处理兜底
}

/**
 * 生成阶段敏感的兜底过渡语
 */
function buildFallbackReply(sess, rawToolCalls) {
  const didAdvance = rawToolCalls.some(tc => tc.function?.name === 'advance_phase');
  const didFinish = rawToolCalls.some(tc => tc.function?.name === 'finish_conversation');
  const didSave = rawToolCalls.some(tc => tc.function?.name === 'save_collected');

  if (didFinish) {
    return '以上就是我为你整理的方向建议。如果你还有其他问题，随时欢迎再来聊聊！';
  }

  if (didAdvance) {
    const prompts = {
      2: '来说说你做过哪些事情——实习、项目、社团，哪一段让你觉得"这可能是我想做的"？',
      3: '聊一下你内心觉得"这就是我该做的事"的时刻？',
      4: '现实层面你最在意什么？城市、薪资、稳定、成长——如果只能保一个，你选哪个？',
      5: '你之前试过哪些方法来确定方向？做测评、跟人聊、尝试实习——效果怎么样？',
      6: '我先帮你理一下我们聊到的关键信息。',
      7: '根据我们聊的内容和你的测评数据，你的方向大概是这样——',
    };
    return prompts[sess.phase] || `好了，我们聊聊下一个话题。`;
  }

  if (didSave) {
    return '了解了，继续聊。';
  }

  return '嗯，我记下了。';
}

// ==================== 回复构建辅助 ====================

function buildSuccessReply(sessionId, reply) {
  const sess = session.getSession(sessionId);
  if (reply) {
    session.addMessage(sessionId, 'assistant', reply);
  }
  return {
    reply,
    toolCalls: [],
    phase: sess.phase,
    label: sess.phaseLabel,
    status: sess.status || 'active',
    sessionId,
  };
}

function buildErrorReply(sess, errorCode, errorMessage) {
  return {
    reply: errorMessage,
    toolCalls: [],
    phase: sess.phase,
    label: sess.phaseLabel,
    error: errorCode,
  };
}

// ==================== 阶段工具函数 ====================

function phaseToState(phase) {
  const map = {
    1: 'Q1_STAGE', 2: 'Q2_EXPERIENCE',
    3: 'Q3_MOTIVATION', 4: 'Q4_CONSTRAINT',
    5: 'Q5_PAST_TRY', 6: 'SUMMARY_CONFIRM',
    7: 'GENERATE_RESULT',
  };
  return map[phase] || 'COMPLETE';
}

// ==================== HTTP Server（本地调试） ====================

function startLocalServer() {
  const server = createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // POST /api/agent/chat
    if (req.method === 'POST' && req.url === '/api/agent/chat') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { sessionId, message, profile } = JSON.parse(body);
          if (!message) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'message 必填' }));
            return;
          }
          const result = await handleChat(sessionId, message, profile);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // GET /health
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', hasKey: !!getApiKey() }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.listen(PORT, () => {
    console.log(`[Agent] 本地服务已启动 → http://localhost:${PORT}`);
    console.log(`[Agent] API Key: ${getApiKey() ? '已设置' : '❌ 未设置'}`);
    console.log(`[Agent] 健康检查: http://localhost:${PORT}/health`);
    console.log(`[Agent] 阶段轮次上限: 4 | 全局轮次上限: ${MAX_TOTAL_TURNS}`);
  });
}

// ==================== SCF Handler（线上） ====================

/**
 * CloudBase SCF 入口
 * @param {object} event - SCF 事件对象 {body: "{\"sessionId\":\"...\",\"message\":\"...\"}"}
 * @param {object} context
 */
export async function main_handler(event, context) {
  try {
    const { sessionId, message, profile } = JSON.parse(event.body || '{}');
    if (!message) {
      return { statusCode: 400, body: JSON.stringify({ error: 'message 必填' }) };
    }
    const result = await handleChat(sessionId, message, profile);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}

// ==================== 全局错误捕获 ====================

process.on('unhandledRejection', (err) => {
  console.error('[Agent] Unhandled Rejection:', err?.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('[Agent] Uncaught Exception:', err?.message || err);
});

// ==================== 启动 ====================

// 检测运行环境
const isSCF = !!process.env.TENCENTCLOUD_RUNENV || !!process.env.SCF_RUNTIME;

if (!isSCF) {
  startLocalServer();
}
