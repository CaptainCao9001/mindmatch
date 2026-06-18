// ============================================================
// agent-v2/postprocess.js — 后处理
// 问句补全 + 短回复 fallback
// ============================================================

import { STAGES } from './stages.mjs';

/**
 * 确保回复以问句结尾（最后阶段除外）
 * @param {string} reply
 * @param {number} phase
 * @param {string} [fallback] - 阶段敏感的兜底追问
 * @returns {string}
 */
export function ensureEndsWithQuestion(reply, phase, fallback) {
  if (!reply) return fallback || '';
  if (phase >= STAGES.length) return reply; // 最后阶段不需要问句

  const trimmed = reply.trim();
  if (/[？?]\s*$/.test(trimmed)) return reply;

  // 没有兜底追问 → 直接返回
  if (!fallback) return reply;

  // 短回复 → 直接替换
  if (trimmed.length < 20) return fallback;

  // 长回复但无问句 → 去掉末尾标点，拼上追问
  return trimmed.replace(/[。！!，、\s]+$/, '') + ' ' + fallback;
}

/**
 * 判断是否需要 follow-up（补全短回复）
 * @param {string} reply - AI 回复
 * @param {Array} rawToolCalls - 工具调用列表
 * @returns {boolean}
 */
export function shouldTriggerFollowUp(reply, rawToolCalls) {
  if (rawToolCalls.length === 0) return false;

  const hasQuestion = /[？?]/.test(reply || '');
  const hasAdvance = rawToolCalls.some(tc => tc.function?.name === 'advance_phase');
  const isShort = !reply
    || (reply.trim().length < 10 && !hasQuestion)
    || /^[—–\-\.\s，。！？、：；]+$/.test(reply.trim());

  // 只在：调了工具 + 回复短/空 + 没有推进阶段 → 需要 follow-up
  return isShort && !hasAdvance;
}
