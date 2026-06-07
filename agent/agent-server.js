// ============================================================
// agent/agent-server.js — 职业规划对话智能体服务
// 本地：Node.js HTTP server (port 8101)
// 线上：CloudBase SCF handler
// ============================================================

import { createServer } from 'http';
import { TOOLS, executeTool } from './tools.js';
import { buildSystemPrompt } from './prompt.js';
import * as session from './session.js';

// ============ 配置 ============
const PORT = 8101;
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MAX_TOTAL_TURNS = 28;

// 密钥：本地从环境变量读取，线上 SCF 从环境变量读取
let API_KEY = process.env.DEEPSEEK_API_KEY || '';

function getApiKey() {
  if (!API_KEY) {
    // 尝试从 SCF 环境变量或全局变量读取
    API_KEY = process.env.DEEPSEEK_API_KEY || globalThis.__DEEPSEEK_KEY__ || '';
  }
  if (!API_KEY) {
    console.warn('[Agent] DEEPSEEK_API_KEY 未设置，API 调用将失败');
  }
  return API_KEY;
}

// ============ 核心：处理一次对话请求 ============

/**
 * @param {string} sessionId - 会话 ID
 * @param {string} userMessage - 用户输入
 * @param {object} [profile] - 画像摘要（首次创建时传入）
 * @returns {object} { reply, toolCalls, phase, label, error }
 */
async function handleChat(sessionId, userMessage, profile) {
  let sess = session.getSession(sessionId);

  // 首次对话：创建会话
  if (!sess) {
    const systemPrompt = buildSystemPrompt(profile);
    sess = session.createSession({ systemPrompt, profile });
    sessionId = sess.id;
    // 添加第一条用户消息
    session.addMessage(sessionId, 'user', userMessage);
  } else {
    // 已完成的会话：拒绝新消息
    if (sess.status === 'completed') {
      return {
        reply: '对话已完成。如需重新探索，请刷新页面开始新的对话。',
        toolCalls: [],
        phase: sess.phase,
        label: sess.phaseLabel,
        status: 'completed',
        sessionId,
      };
    }
    session.addMessage(sessionId, 'user', userMessage);
  }

  // 检查当前阶段的轮次
  let phaseTurns = (sess.phaseTurns || 0) + 1;
  const maxPhaseTurns = sess.maxPhaseTurns || 4;

  // 超限自动推进：如果 phaseTurns 超过上限，强制推进到下一阶段
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
      state: _phaseToState(nextPhase),
    });
    sess = session.getSession(sessionId);
    phaseTurns = 1;
  }

  // 全局轮次上限
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

  session.updateSession(sessionId, { phaseTurns });

  // 构建 API 请求
  const key = getApiKey();
  if (!key) {
    return {
      reply: '抱歉，AI 服务暂时不可用。请稍后再试。',
      toolCalls: [],
      phase: sess.phase,
      label: sess.phaseLabel,
      error: 'NO_API_KEY',
    };
  }

  sess = session.getSession(sessionId); // 刷新
  const requestBody = {
    model: 'deepseek-chat',
    messages: sess.messages,
    tools: TOOLS,
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 1024,
  };

  console.log(`[Agent] 请求 session=${sessionId} phase=${sess.phase} turn=${phaseTurns}/${sess.maxPhaseTurns}`);

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
        reply: '抱歉，AI 服务暂时不可用。请稍后再试。',
        toolCalls: [],
        phase: sess.phase,
        label: sess.phaseLabel,
        error: `API_${response.status}`,
      };
    }
  } catch (err) {
    console.error('[Agent] 网络错误:', err.message);
    return {
      reply: '抱歉，网络好像出了点问题。请稍后再试。',
      toolCalls: [],
      phase: sess.phase,
      label: sess.phaseLabel,
      error: err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK',
    };
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice) {
    console.error('[Agent] 无有效回复:', JSON.stringify(data).slice(0, 200));
    return { reply: '抱歉，AI 没有返回有效回复。', toolCalls: [], phase: sess.phase, label: sess.phaseLabel, error: 'EMPTY_RESPONSE' };
  }

  const msg = choice.message;
  const reply = msg.content || '';
  const rawToolCalls = msg.tool_calls || [];
  const toolResults = [];

  // 处理 tool_calls
  if (rawToolCalls.length > 0) {
    console.log(`[Agent] AI 调用了 ${rawToolCalls.length} 个工具:`, rawToolCalls.map(t => t.function?.name).join(', '));

    // 记录 assistant 的 tool_calls 到消息历史
    session.addToolCalls(sessionId, rawToolCalls);

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
        if (reply) session.addMessage(sessionId, 'assistant', reply);
        return {
          reply,
          toolCalls: toolResults,
          phase: 7,
          label: '生成建议',
          status: 'completed',
          sessionId,
        };
      }
    }

    // 如果 AI 调用了工具但没有文字回复，再调一次让 AI 生成回复
    if (!reply && rawToolCalls.length > 0) {
      sess = session.getSession(sessionId);

      // 如果对话已结束，不再 follow-up
      if (sess.status === 'completed') {
        return {
          reply: '对话已完成。如需重新探索，请刷新页面开始新的对话。',
          toolCalls: toolResults,
          phase: 7,
          label: '生成建议',
          status: 'completed',
          sessionId,
        };
      }

      const followUpBody = {
        model: 'deepseek-chat',
        messages: sess.messages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1024,
      };

      try {
        const followUp = await fetch(DEEPSEEK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify(followUpBody),
          signal: AbortSignal.timeout(30000),
        });

        if (followUp.ok) {
          const followData = await followUp.json();
          const followMsg = followData.choices?.[0]?.message;
          if (followMsg?.content) {
            // 把 follow-up 回复也追加到历史
            session.addMessage(sessionId, 'assistant', followMsg.content);
            return {
              reply: followMsg.content,
              toolCalls: toolResults,
              phase: sess.phase,
              label: sess.phaseLabel,
              sessionId,
            };
          }
        }
      } catch { /* fall through */ }
    }
  }

  // 追加 AI 回复到历史
  if (reply) {
    session.addMessage(sessionId, 'assistant', reply);
  }

  // 刷新 session 获取最新状态
  sess = session.getSession(sessionId);

  return {
    reply,
    toolCalls: toolResults,
    phase: sess.phase,
    label: sess.phaseLabel,
    status: sess.status || 'active',
    sessionId,
  };
}

// ============ HTTP Server（本地调试） ============

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

// ============ SCF Handler（线上） ============

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

// ============ 辅助 ============

function _phaseToState(phase) {
  const map = {
    1: 'Q1_STAGE', 2: 'Q2_EXPERIENCE',
    3: 'Q3_MOTIVATION', 4: 'Q4_CONSTRAINT',
    5: 'Q5_PAST_TRY', 6: 'SUMMARY_CONFIRM',
    7: 'GENERATE_RESULT',
  };
  return map[phase] || 'COMPLETE';
}

// ============ 启动 ============

// 检测运行环境
const isSCF = !!process.env.TENCENTCLOUD_RUNENV || !!process.env.SCF_RUNTIME;

if (!isSCF) {
  startLocalServer();
}
