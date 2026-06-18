// ============================================================
// agent-v2/state.js — 状态机 / 阶段推进
// 管理阶段转换、轮次计数、终止条件
// ============================================================

import { STAGES, getStage, getStageLabel } from './stages.mjs';
import { MAX_TOTAL_TURNS } from './config.mjs';

/**
 * 检查并执行阶段推进（轮次超限时自动推进）
 * @param {object} session - 当前会话
 * @returns {{ advanced: boolean, newPhase: number|null, reason: string }}
 */
export function checkAndAdvance(session) {
  const stage = getStage(session.phase);
  if (!stage) return { advanced: false, newPhase: null, reason: '无效阶段' };

  // 阶段轮次超限检查
  if (session.phaseTurns >= stage.maxTurns && session.phase < STAGES.length) {
    const nextPhase = session.phase + 1;
    const nextLabel = getStageLabel(nextPhase);
    console.log(`[State] 阶段 ${session.phase} 轮次超限 (${session.phaseTurns}/${stage.maxTurns})，自动推进到 ${nextPhase}（${nextLabel}）`);
    return { advanced: true, newPhase: nextPhase, reason: `阶段 ${session.phase} 轮次超限` };
  }

  // 全局轮次超限检查
  const totalUserTurns = (session.messages || []).filter(m => m.role === 'user').length;
  if (totalUserTurns >= MAX_TOTAL_TURNS && session.phase < STAGES.length) {
    // 强制跳到最后一个阶段
    const lastPhase = STAGES.length;
    console.log(`[State] 全局轮次超限 (${totalUserTurns}/${MAX_TOTAL_TURNS})，强制进入阶段 ${lastPhase}`);
    return { advanced: true, newPhase: lastPhase, reason: '全局轮次超限' };
  }

  return { advanced: false, newPhase: null, reason: '' };
}

/**
 * 检查终止条件
 * @param {object} session
 * @returns {{ terminated: boolean, reason: string }}
 */
export function checkTermination(session) {
  if (session.status === 'completed') {
    return { terminated: true, reason: '会话已结束' };
  }
  // 超过最后阶段的 maxTurns + 2 轮缓冲
  const lastStage = STAGES[STAGES.length - 1];
  if (session.phase > STAGES.length || (session.phase === STAGES.length && session.phaseTurns > lastStage.maxTurns + 2)) {
    return { terminated: true, reason: '超出最大轮次' };
  }
  return { terminated: false, reason: '' };
}

/**
 * 初始化会话的阶段状态
 * @param {object} session
 */
export function initStageState(session) {
  const firstStage = STAGES[0];
  session.phase = firstStage.id;
  session.phaseLabel = firstStage.label;
  session.phaseTurns = 0;
  session.phaseDepth = null;
}

/**
 * 推进阶段（更新 session）
 * @param {object} session - 会话对象（会被修改）
 * @param {number} targetPhase - 目标阶段
 * @param {string} [targetLabel] - 目标标签（可选，自动推断）
 */
export function advanceTo(session, targetPhase, targetLabel) {
  const stage = getStage(targetPhase);
  session.phase = targetPhase;
  session.phaseLabel = targetLabel || (stage ? stage.label : `阶段 ${targetPhase}`);
  session.phaseTurns = 0;
  session.phaseDepth = null;
}

/**
 * 获取阶段进度信息（供前端显示）
 * @param {object} session
 * @returns {{ phase: number, label: string, turn: number, maxTurns: number, totalStages: number }}
 */
export function getProgress(session) {
  const stage = getStage(session.phase);
  return {
    phase: session.phase,
    label: session.phaseLabel,
    turn: session.phaseTurns,
    maxTurns: stage ? stage.maxTurns : 3,
    totalStages: STAGES.length,
  };
}
