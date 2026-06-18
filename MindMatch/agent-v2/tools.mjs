// ============================================================
// agent-v2/tools.js — 工具声明 + 注册表
// 注册表模式：新增工具只需加一条 TOOL_REGISTRY 条目
// ============================================================

import { STAGES, ALL_COLLECT_FIELDS, TOTAL_STAGES } from './stages.mjs';

/**
 * 工具注册表
 * 每个条目 = { schema: DeepSeek function calling 格式, dynamicEnum(ctx): 修改枚举, enabled(ctx): 是否启用 }
 */
export const TOOL_REGISTRY = {
  advance_phase: {
    schema: {
      type: 'function',
      function: {
        name: 'advance_phase',
        description: '推进到下一个对话阶段并更新前端进度条。只能在当前阶段+1，不能跳阶段。',
        parameters: {
          type: 'object',
          properties: {
            phase: { type: 'number', description: '目标阶段号' },
            label: { type: 'string', description: '阶段中文标签' },
          },
          required: ['phase', 'label'],
          additionalProperties: false,
        },
      },
    },
    dynamicEnum(ctx) {
      const nextPhase = ctx.phase + 1;
      const nextStage = STAGES.find(s => s.id === nextPhase);
      return {
        phase: [nextPhase],
        label: nextStage ? [nextStage.label] : [`阶段 ${nextPhase}`],
        description: `推进到阶段 ${nextPhase}（${nextStage ? nextStage.label : ''}）。当前阶段 ${ctx.phase}，最多 ${ctx.maxTurns} 轮，第 ${ctx.maxTurns} 轮必须推进。`,
      };
    },
    enabled(ctx) {
      return ctx.phase < TOTAL_STAGES;
    },
  },

  save_collected: {
    schema: {
      type: 'function',
      function: {
        name: 'save_collected',
        description: '从用户回答中提取关键信息并保存。只需提取核心事实，不过度解读。同时判断信息深度。',
        parameters: {
          type: 'object',
          properties: {
            field: { type: 'string', description: '信息类别' },
            value: { type: 'string', description: '核心信息（1-2句事实）' },
            depth: {
              type: 'string',
              enum: ['shallow', 'adequate', 'deep'],
              description: '深度：shallow=模糊需追问 adequate=有信息可追问一次 deep=清晰可过渡',
            },
          },
          required: ['field', 'value', 'depth'],
          additionalProperties: false,
        },
      },
    },
    dynamicEnum(ctx) {
      return {
        field: ALL_COLLECT_FIELDS,
      };
    },
    enabled() { return true; },
  },

  finish_conversation: {
    schema: {
      type: 'function',
      function: {
        name: 'finish_conversation',
        description: '结束对话。只能在阶段 4（行动地图）输出完整建议后调用。调用后用户无法继续发消息。',
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: '最终建议摘要（2-3句话）' },
          },
          required: ['summary'],
          additionalProperties: false,
        },
      },
    },
    dynamicEnum() { return {}; },
    enabled(ctx) {
      return ctx.phase === TOTAL_STAGES;
    },
  },
};

/**
 * 获取当前可用的工具列表（含动态枚举）
 * @param {object} ctx - { phase, maxTurns, phaseTurns }
 * @returns {Array} DeepSeek function calling 格式
 */
export function getTools(ctx) {
  const tools = [];

  for (const [name, entry] of Object.entries(TOOL_REGISTRY)) {
    // 检查是否启用
    if (!entry.enabled(ctx)) continue;

    // 深拷贝 schema
    const tool = JSON.parse(JSON.stringify(entry.schema));

    // 应用动态枚举
    const dynamic = entry.dynamicEnum(ctx);
    if (dynamic.description) {
      tool.function.description = dynamic.description;
    }
    if (dynamic.phase) {
      tool.function.parameters.properties.phase.enum = dynamic.phase;
    }
    if (dynamic.label) {
      tool.function.parameters.properties.label.enum = dynamic.label;
    }
    if (dynamic.field) {
      tool.function.parameters.properties.field.enum = dynamic.field;
    }

    tools.push(tool);
  }

  return tools;
}
