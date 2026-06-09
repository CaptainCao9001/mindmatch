// ============================================================
// agent-v2/prompt/stages-prompts.js — 阶段特定指令
// 数据驱动：从 stages.js 遍历生成，不硬编码阶段内容
// ============================================================

import { STAGES, TOTAL_STAGES } from '../stages.mjs';

/**
 * 生成所有阶段的指令文本
 * @returns {string}
 */
export function buildStagesBlock() {
  const lines = [];

  lines.push(`## 对话流程（${TOTAL_STAGES} 个阶段）`);
  lines.push('你需要依次引导以下阶段。每个阶段有清晰的目标和推进条件。');
  lines.push('');

  for (let i = 0; i < STAGES.length; i++) {
    const s = STAGES[i];
    const next = i < STAGES.length - 1 ? STAGES[i + 1] : null;

    lines.push(`### 阶段 ${s.id}：${s.label}`);
    lines.push(`**目标**：${s.goal}`);
    lines.push(`**推进条件**：当 ${s.advanceWhen}，调用 advance_phase 推进到阶段 ${next ? next.id + '（' + next.label + '）' : '结束'}`);
    lines.push(`**轮次**：最少 ${s.minTurns} 轮，最多 ${s.maxTurns} 轮。第 ${s.maxTurns} 轮时必须推进。`);
    lines.push('**追问方向**：');
    s.followupHints.forEach(h => lines.push(`- ${h}`));
    lines.push('');
  }

  // 工具调用规则
  lines.push('### 工具调用规则');
  lines.push('- 只能顺序推进到下一个阶段（当前阶段 +1），不能跳阶段');
  lines.push('- 如果信息已足够深入，可以提前推进');
  lines.push('- 如果轮次已用完但信息不够，也必须推进——不卡住');
  lines.push('');

  return lines.join('\n');
}

/**
 * 生成每个阶段的 Good/Bad 对话示例
 * @returns {string}
 */
export function buildExamplesBlock() {
  const lines = [];

  lines.push('## 对话示例（每个阶段 1 组 Good/Bad）');
  lines.push('');

  for (const stage of STAGES) {
    if (!stage.example) continue;
    lines.push(`### 阶段 ${stage.id}（${stage.label}）`);
    lines.push('');
    lines.push('✅ **好的回复**：');
    lines.push(`- 用户："${stage.example.good.user}"`);
    lines.push(`- 你："${stage.example.good.ai}"`);
    lines.push('');
    lines.push('❌ **不好的回复**（不要这样）：');
    lines.push(`- 用户："${stage.example.bad.user}"`);
    lines.push(`- 你："${stage.example.bad.ai}"`);
    lines.push('');
  }

  return lines.join('\n');
}
