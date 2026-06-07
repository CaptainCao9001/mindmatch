// ============================================================
// agent/tools.js — DeepSeek Function Calling 工具定义
// 4 个 tool：advance_phase / save_collected / show_hint / finish_conversation
// ============================================================

/**
 * DeepSeek Function Calling 工具列表
 * AI 在对话中自行判断何时调用哪个工具
 */
export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'advance_phase',
      description: `推进到下一个对话阶段并更新前端进度条。
调用时机：当用户对当前话题的探索已经足够深入，你需要自然过渡到下一个话题时。
例如：用户已充分说明了自己的经历和感受，可以过渡到"内在驱动"话题。
注意：每个阶段最多 4 轮对话，第 4 轮时你必须调用这个工具过渡。
重要：只能顺序推进到下一个阶段（当前阶段+1），不能跳阶段。`,
      parameters: {
        type: 'object',
        properties: {
          phase: {
            type: 'number',
            enum: [1, 2, 3, 4, 5, 6, 7],
            description: '阶段号：1=现状了解 2=经验盘点 3=内在驱动 4=现实考量 5=过往探索 6=总结确认 7=生成建议',
          },
          label: {
            type: 'string',
            enum: ['现状了解', '经验盘点', '内在驱动', '现实考量', '过往探索', '总结确认', '生成建议'],
            description: '阶段中文标签，用于前端进度条显示',
          },
        },
        required: ['phase', 'label'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_collected',
      description: `从用户的回答中提取关键信息并保存到会话。
调用时机：当用户在对话中提供了关于自身情况的明确信息时。
只需要提取核心事实，不要过度解读。
同时判断这条信息的深度，这会影响你是否需要继续追问。`,
      parameters: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            enum: ['stage', 'experience', 'motivation', 'constraints', 'pastTry', 'summaryResponse'],
            description: '信息类别：stage=当前阶段 experience=经验 highlight=高光时刻 motivation=内在驱动 constraints=现实约束 pastTry=过往尝试',
          },
          value: {
            type: 'string',
            description: '从用户回答中提取的核心信息（1-2 句话，只包含事实）',
          },
          depth: {
            type: 'string',
            enum: ['shallow', 'adequate', 'deep'],
            description: `信息深度判断：
- shallow：用户回答模糊、简短、缺乏具体信息（如"不确定"、"还行"），你需要继续追问
- adequate：有具体信息但还不够深入（如"做了半年产品实习"），可以追问一次
- deep：清晰、具体、有场景和感受（如"做产品实习时帮团队理清了需求优先级，特别有成就感"），可以过渡到下一阶段`,
          },
        },
        required: ['field', 'value', 'depth'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_hint',
      description: `在对话中给用户展示一个方向提示或建议卡片。
调用时机：当你有足够信息可以初步判断用户可能适合的方向，但尚未到最终总结阶段时。
只给线索，不给结论。
仅在阶段 3（内在驱动）之后才可调用，整个对话最多调用 1-2 次。`,
      parameters: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['系统建构者', '深度解读者', '创意塑造者', '人际联结者', '价值驱动者', '赋能陪伴者'],
            description: '初步判断的方向名称',
          },
          hint: {
            type: 'string',
            description: '一句简短的方向提示（不超过 30 字），如"你似乎很适合需要系统化思维的工作"',
          },
        },
        required: ['direction', 'hint'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish_conversation',
      description: `结束对话。当你在阶段 7（生成建议）生成了完整的职业方向建议后，必须调用此工具关闭对话。
这是对话的终点，调用后用户将无法继续发消息。
请确保你已经给出了完整、有价值的建议后再调用。`,
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: '最终建议摘要（2-3 句话，概括你给出的核心方向建议）',
          },
        },
        required: ['summary'],
        additionalProperties: false,
      },
    },
  },
];

/**
 * 工具执行器
 * @param {string} toolName - 工具名
 * @param {object} args - 工具参数
 * @param {object} session - 当前会话对象（会被修改）
 * @returns {object} 执行结果
 */
export function executeTool(toolName, args, session) {
  switch (toolName) {
    case 'advance_phase': {
      // 顺序校验：只允许推进到当前阶段 +1
      const currentPhase = session.phase || 1;
      if (args.phase !== currentPhase + 1) {
        return {
          ok: false,
          error: `阶段只能顺序推进：当前阶段=` + currentPhase + `，目标阶段=` + args.phase + ` 不合法，应推进到阶段 ` + (currentPhase + 1),
        };
      }
      session.phase = args.phase;
      session.phaseLabel = args.label;
      session.phaseTurns = 0; // 重置阶段轮次
      session.phaseDepth = null; // 重置深度
      session.state = _phaseToState(args.phase);
      return { ok: true, phase: args.phase, label: args.label };
    }

    case 'save_collected': {
      if (!session.collected) session.collected = {};
      session.collected[args.field] = { value: args.value, depth: args.depth || 'adequate' };
      // 记录当前阶段深度（供服务端判断是否需要强制推进）
      session.phaseDepth = args.depth || 'adequate';
      return { ok: true, field: args.field, depth: args.depth };
    }

    case 'show_hint':
      if (!session.hints) session.hints = [];
      session.hints.push({ direction: args.direction, hint: args.hint, time: Date.now() });
      return { ok: true, hint: args.hint };

    case 'finish_conversation':
      session.status = 'completed';
      session.completedAt = Date.now();
      session.finalSummary = args.summary || '';
      return { ok: true, summary: args.summary };

    default:
      return { ok: false, error: `未知工具: ` + toolName };
  }
}

/**
 * phase → state 映射
 */
function _phaseToState(phase) {
  const map = {
    1: 'Q1_STAGE', 2: 'Q2_EXPERIENCE',
    3: 'Q3_MOTIVATION', 4: 'Q4_CONSTRAINT',
    5: 'Q5_PAST_TRY', 6: 'SUMMARY_CONFIRM',
    7: 'GENERATE_RESULT',
  };
  return map[phase] || 'COMPLETE';
}
