// ============================================================
// agent-v2/handler.js — 6 步编排主流程
//
// Step 1: ensureSession()     — 创建/校验/已完成拒绝
// Step 2: advanceIfNeeded()   — 轮次超限自动推进
// Step 3: injectAntiDup()     — 防重复指令注入到 system prompt
// Step 4: callLLM()           — DeepSeek API 调用
// Step 5: handleToolCalls()    — 工具执行 + follow-up 补全
// Step 6: postprocess()       — 问句补全 + fallback
// ============================================================

import * as session from './session.mjs';
import { checkAndAdvance, checkTermination, initStageState } from './state.mjs';
import { getStage } from './stages.mjs';
import { getTools } from './tools.mjs';
import { executeTool } from './tool-executor.mjs';
import { buildSystemPrompt } from './prompt/index.mjs';
import { buildAntiDupBlock } from './prompt/anti-dup.mjs';
import {
  extractAskedQuestions, extractRecentKeywords, getDiscussedTopics,
} from './dedup.mjs';
import { shouldTriggerFollowUp, ensureEndsWithQuestion } from './postprocess.mjs';
import {
  getFallbackReplyText, COMPLETED_REPLY, ERROR_REPLIES,
} from './replies.mjs';
import { callDeepSeek, callFollowUp, callHunyuan } from './llm.mjs';
import { getApiKey, getHunyuanApiKey } from './config.mjs';

/**
 * 处理一次对话请求
 * @param {string} sessionId
 * @param {string} userMessage
 * @param {object} [profile]
 * @returns {Promise<object>} { reply, toolCalls, phase, label, status, sessionId, error? }
 */
export async function handleChat(sessionId, userMessage, profile) {
  // ---- Step 1: ensureSession ----
  const step1 = ensureSession(sessionId, userMessage, profile);
  if (step1.error) return step1;

  sessionId = step1.sessionId;
  const sess = step1.session;

  // ---- Step 2: advanceIfNeeded ----
  advanceIfNeeded(sessionId);

  // ---- Step 3: injectAntiDup ----
  injectAntiDup(sessionId);

  // ---- Step 4: callLLM ----
  const key = getApiKey();
  if (!key) {
    return buildErrorResponse(sessionId, 'NO_API_KEY');
  }

  const stage = getStage(sess.phase);
  const tools = getTools({
    phase: sess.phase,
    maxTurns: stage ? stage.maxTurns : 3,
    phaseTurns: sess.phaseTurns,
  });

  // 调试：打印完整 prompt
  if (process.env.DEBUG_PROMPT === '1') {
    const sysMsg = sess.messages.find(m => m.role === 'system');
    console.log(`[Agent v2 ${sessionId}] === FULL PROMPT START ===`);
    console.log(sysMsg ? sysMsg.content : '(no system message)');
    console.log(`[Agent v2 ${sessionId}] === FULL PROMPT END ===`);
    console.log(`[Agent v2 ${sessionId}] tools:`, JSON.stringify(tools, null, 2));
  }

  console.log(`[Agent v2 ${sessionId}] phase=${sess.phase} turn=${sess.phaseTurns}/${stage ? stage.maxTurns : '?'}`);

  const apiResult = await callDeepSeek({
    messages: sess.messages,
    tools,
    apiKey: key,
  });

  // DeepSeek 失败 → 尝试混元 fallback
  if (apiResult.error) {
    const hunyuanKey = getHunyuanApiKey();
    if (hunyuanKey) {
      console.log(`[Agent v2 ${sessionId}] DeepSeek 失败(${apiResult.errorCode})，尝试混元 fallback...`);
      const hyResult = await callHunyuan({
        messages: sess.messages,
        apiKey: hunyuanKey,
      });
      if (!hyResult.error && hyResult.reply) {
        console.log(`[Agent v2 ${sessionId}] 混元 fallback 成功`);
        const reply = hyResult.reply;
        session.addMessage(sessionId, 'assistant', reply);
        return {
          reply,
          toolCalls: [],
          phase: sess.phase,
          label: sess.phaseLabel,
          status: sess.status,
          sessionId,
        };
      }
      console.log(`[Agent v2 ${sessionId}] 混元 fallback 也失败: ${hyResult.errorCode}`);
    }
    return buildErrorResponse(sessionId, apiResult.errorCode);
  }

  const { reply, rawToolCalls } = apiResult;

  // ---- Step 5: handleToolCalls ----
  let result;
  if (rawToolCalls.length > 0) {
    result = await handleToolCalls(sessionId, rawToolCalls, reply, key);
  } else {
    result = buildSuccessReply(sessionId, reply);
  }

  // ---- Step 6: postprocess ----
  if (result && result.reply && result.status !== 'completed') {
    const fallback = getFallbackReplyText(sess.phase, rawToolCalls[0]?.function?.name);
    result.reply = ensureEndsWithQuestion(result.reply, sess.phase, fallback);
  }

  return result;
}

// ============================================================
// Step 1: Session 管理
// ============================================================

function ensureSession(sessionId, userMessage, profile) {
  let sess = session.getSession(sessionId);

  if (!sess) {
    const systemPrompt = buildSystemPrompt(profile);
    sess = session.createSession({ systemPrompt, profile });
    sessionId = sess.id;
    initStageState(sess);
    session.updateSession(sessionId, {
      phase: sess.phase,
      phaseLabel: sess.phaseLabel,
    });
    session.addMessage(sessionId, 'user', userMessage);
    console.log(`[Agent v2] 新会话: ${sessionId}`);
    return { sessionId, session: sess, error: null };
  }

  if (sess.status === 'completed') {
    return {
      sessionId,
      reply: COMPLETED_REPLY,
      toolCalls: [],
      phase: sess.phase,
      label: sess.phaseLabel,
      status: 'completed',
    };
  }

  // 检查终止条件
  const term = checkTermination(sess);
  if (term.terminated) {
    session.updateSession(sessionId, { status: 'completed' });
    return {
      sessionId,
      reply: COMPLETED_REPLY,
      toolCalls: [],
      phase: sess.phase,
      label: sess.phaseLabel,
      status: 'completed',
    };
  }

  session.addMessage(sessionId, 'user', userMessage);
  return { sessionId, session: sess, error: null };
}

// ============================================================
// Step 2: 轮次超限自动推进
// ============================================================

function advanceIfNeeded(sessionId) {
  const sess = session.getSession(sessionId);
  if (!sess) return;

  // 递增阶段轮次
  const phaseTurns = (sess.phaseTurns || 0) + 1;
  session.updateSession(sessionId, { phaseTurns: phaseTurns });

  // 检查是否需要推进
  const result = checkAndAdvance(sess);
  if (result.advanced) {
    session.updateSession(sessionId, {
      phase: result.newPhase,
      phaseLabel: getStage(result.newPhase)?.label || `阶段 ${result.newPhase}`,
      phaseTurns: 0,
      phaseDepth: null,
    });
  }
}

// ============================================================
// Step 3: 防重复注入
// ============================================================

function injectAntiDup(sessionId) {
  const sess = session.getSession(sessionId);
  if (!sess) return;

  const sysIdx = sess.messages.findIndex(m => m.role === 'system');
  if (sysIdx < 0) return;

  let content = sess.messages[sysIdx].content || '';

  // 移除旧的防重复区块
  const cutIdx = content.indexOf('\n\n[已讨论话题');
  if (cutIdx >= 0) {
    content = content.substring(0, cutIdx);
  }

  // 提取防重复数据
  const askedQuestions = extractAskedQuestions(sess.messages);
  const recentKeywords = extractRecentKeywords(sess.messages);
  const discussedTopics = getDiscussedTopics(sess.collected);

  // 追加防重复指令
  const antiDupText = buildAntiDupBlock(askedQuestions, recentKeywords, discussedTopics);
  if (antiDupText) {
    content += antiDupText;
  }

  sess.messages[sysIdx].content = content;
}

// ============================================================
// Step 5: 工具调用处理
// ============================================================

async function handleToolCalls(sessionId, rawToolCalls, reply, key) {
  const sess = session.getSession(sessionId);
  if (!sess) return buildErrorResponse(sessionId, 'SESSION_NOT_FOUND');

  const toolResults = [];
  console.log(`[Agent v2 ${sessionId}] ${rawToolCalls.length} 工具调用:`, rawToolCalls.map(t => t.function?.name).join(', '));

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
      console.warn(`[Agent v2] 解析工具参数失败: ${fn.arguments}`);
      continue;
    }

    const result = executeTool(fn.name, args, sess);
    toolResults.push({ name: fn.name, args, result });

    // 工具结果回传给 LLM
    session.addToolResult(sessionId, tc.id, JSON.stringify(result));
    console.log(`[Agent v2 ${sessionId}] ${fn.name}(${JSON.stringify(args)}) → ${JSON.stringify(result)}`);

    // finish_conversation → 直接返回
    if (fn.name === 'finish_conversation' && result.ok) {
      const finalReply = reply || '以上就是为你整理的方向建议。';
      session.addMessage(sessionId, 'assistant', finalReply);
      return {
        reply: finalReply,
        toolCalls: toolResults,
        phase: sess.phase,
        label: sess.phaseLabel,
        status: 'completed',
        sessionId,
      };
    }
  }

  // Follow-up 检测：AI 调了工具但回复过短
  if (shouldTriggerFollowUp(reply, rawToolCalls)) {
    const followUpResult = await tryFollowUp(sessionId, key);
    if (followUpResult) return followUpResult;

    // Follow-up 也失败 → 用兜底回复
    const lastToolName = rawToolCalls[rawToolCalls.length - 1]?.function?.name || '';
    reply = getFallbackReplyText(sess.phase, lastToolName);
  }

  // 完全无文字回复 → 兜底
  if (!reply || reply.trim().length === 0) {
    const lastToolName = rawToolCalls[rawToolCalls.length - 1]?.function?.name || '';
    reply = getFallbackReplyText(sess.phase, lastToolName);
  }

  session.addMessage(sessionId, 'assistant', reply);
  return {
    reply,
    toolCalls: toolResults,
    phase: sess.phase,
    label: sess.phaseLabel,
    status: sess.status,
    sessionId,
  };
}

/**
 * Follow-up 调用
 */
async function tryFollowUp(sessionId, key) {
  const sess = session.getSession(sessionId);
  if (!sess || sess.status === 'completed') return null;

  const collected = sess.collected || {};
  const recentQuestions = extractAskedQuestions(sess.messages, 3);

  const result = await callFollowUp(sess.messages, {
    phase: sess.phase,
    phaseLabel: sess.phaseLabel,
    collected,
    recentQuestions,
  }, key);

  if (result?.reply) {
    session.addMessage(sessionId, 'assistant', result.reply);
    return {
      reply: result.reply,
      toolCalls: [],
      phase: sess.phase,
      label: sess.phaseLabel,
      sessionId,
    };
  }

  return null;
}

// ============================================================
// 辅助函数
// ============================================================

function buildSuccessReply(sessionId, reply) {
  const sess = session.getSession(sessionId);
  if (!sess) return buildErrorResponse(sessionId, 'SESSION_NOT_FOUND');

  if (reply) {
    session.addMessage(sessionId, 'assistant', reply);
  }

  return {
    reply: reply || '',
    toolCalls: [],
    phase: sess.phase,
    label: sess.phaseLabel,
    status: sess.status || 'active',
    sessionId,
  };
}

function buildErrorResponse(sessionId, errorCode) {
  const sess = session.getSession(sessionId) || { phase: 0, phaseLabel: '', status: 'error' };
  return {
    reply: ERROR_REPLIES[errorCode] || ERROR_REPLIES.NETWORK,
    toolCalls: [],
    phase: sess.phase,
    label: sess.phaseLabel,
    error: errorCode,
    status: sess.status,
    sessionId,
  };
}
