// ============================================================
// agent-v2/prompt/index.js — Prompt 组装入口
// 将各模块组装成完整的 system prompt
// ============================================================

import { buildRoleBlock } from './role.mjs';
import { buildStyleBlock } from './style.mjs';
import { buildStagesBlock, buildExamplesBlock } from './stages-prompts.mjs';
import { buildProfileContext } from './profile-context.mjs';

/**
 * 构建完整的 system prompt（创建会话时调用一次）
 * @param {object} [profile] - 用户画像（可选）
 * @returns {string}
 */
export function buildSystemPrompt(profile) {
  const blocks = [
    buildRoleBlock(),
    buildStyleBlock(),
    buildStagesBlock(),
    buildExamplesBlock(),
    buildProfileContext(profile),
  ];

  return blocks.filter(Boolean).join('\n');
}
