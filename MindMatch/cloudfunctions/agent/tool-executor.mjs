// ============================================================
// agent-v2/tool-executor.js — 工具执行逻辑
// 每个 tool 的实际副作用（修改 session）
// ============================================================

import { getStage, getStageLabel } from './stages.mjs';
import { advanceTo } from './state.mjs';

/**
 * 执行一个工具调用
 * @param {string} name - 工具名
 * @param {object} args - 工具参数
 * @param {object} session - 当前会话（会被修改）
 * @returns {object} 执行结果
 */
export function executeTool(name, args, session) {
  switch (name) {
    case 'advance_phase':
      return _advancePhase(args, session);

    case 'save_collected':
      return _saveCollected(args, session);

    case 'finish_conversation':
      return _finishConversation(args, session);

    default:
      return { ok: false, error: `未知工具: ${name}` };
  }
}

// ---- 内部实现 ----

function _advancePhase(args, session) {
  const currentPhase = session.phase;
  const correctNext = currentPhase + 1;

  // 自动愈合：AI 填错阶段号时修正（不报错）
  if (args.phase !== correctNext) {
    console.warn(`[Tool] advance_phase 自动愈合：请求=${args.phase}，正确=${correctNext}`);
    args.phase = correctNext;
    args.label = getStageLabel(correctNext) || args.label;
  }

  advanceTo(session, args.phase, args.label);
  return { ok: true, phase: args.phase, label: args.label };
}

function _saveCollected(args, session) {
  if (!session.collected) session.collected = {};
  session.collected[args.field] = { value: args.value, depth: args.depth || 'adequate' };
  session.phaseDepth = args.depth || 'adequate';
  return { ok: true, field: args.field, depth: args.depth };
}

function _finishConversation(args, session) {
  session.status = 'completed';
  session.completedAt = Date.now();
  session.finalSummary = args.summary || '';
  return { ok: true, summary: args.summary };
}
