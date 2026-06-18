// ============================================================
// prompt-builder.js — Prompt 构建器
// 根据对话状态、已收集信息、用户输入，构建发送给 LLM 的 Prompt
// ============================================================

import { getStep } from '../data/intake-script.js';
import { directions } from '../data/career-mapping.js';

// ---------- 状态 → 步骤 ID ----------
const STATE_TO_STEP = {
  Q1_STAGE: 'stage',
  Q2_EXPERIENCE: 'experience',
  Q3_MOTIVATION: 'motivation',
  Q4_CONSTRAINT: 'constraints',
  Q5_PAST_TRY: 'pastTry',
};

// ---------- 步骤标签 ----------
const STEP_LABELS = {
  stage: '现状与触发事件',
  experience: '经验资产与高光时刻',
  motivation: '内在驱动力',
  constraints: '现实约束与优先级',
  pastTry: '过往探索方法',
};

/**
 * 构建对话 Prompt
 * @param {object} stateMachine - ConversationStateMachine 实例
 * @param {string} userInput - 用户当前输入
 * @returns {Array} messages 数组 [{role, content}]
 */
export function buildPrompt(stateMachine, userInput) {
  const { state, collected, hasProfile, profileSummary, history } = stateMachine;

  const systemContent = _buildSystemPrompt(stateMachine);
  const userContent = userInput || '';

  // 构建完整的 messages，包含最近的对话历史（做上下文窗口管理）
  const messages = [{ role: 'system', content: systemContent }];

  // 加入最近 4 轮对话历史作为上下文
  const recentHistory = history.slice(-8); // 最近 8 条（4 轮）
  recentHistory.forEach(h => {
    messages.push({ role: h.role, content: h.content });
  });

  // 加入当前用户输入
  if (userContent) {
    messages.push({ role: 'user', content: userContent });
  }

  return messages;
}

/**
 * 构建最终结果生成 Prompt
 * @param {object} collected - 已收集信息
 * @param {object} profileSummary - 画像摘要
 * @returns {string} 完整 Prompt 文本
 */
export function buildResultPrompt(collected, profileSummary) {
  const parts = [];

  // ---- 角色设定 ----
  parts.push('你是一位资深的职业规划师，拥有10年以上的职业咨询经验。你擅长结合心理学测评数据和真实对话，为用户提供个性化的职业方向建议。');

  // ---- 任务 ----
  parts.push('');
  parts.push('## 任务');
  parts.push('根据以下用户访谈数据和测评画像，生成一份结构化的职业方向报告。');

  // ---- 用户数据 ----
  parts.push('');
  parts.push('## 用户访谈数据');
  const order = ['stage', 'experience', 'motivation', 'constraints', 'pastTry'];
  order.forEach(id => {
    if (collected[id]) {
      parts.push(`### ${STEP_LABELS[id]}`);
      parts.push(collected[id].answer);
      parts.push('');
    }
  });

  // ---- 测评画像 ----
  if (profileSummary) {
    parts.push('## 测评画像');
    parts.push(`核心特质：${profileSummary.topNames}`);
    parts.push(`完成游戏数：${profileSummary.completedCount}/4`);
    if (profileSummary.topDims.length > 0) {
      parts.push('维度得分（百分制）：');
      profileSummary.topDims.forEach(d => {
        parts.push(`- ${d.name}: ${d.score}`);
      });
    }
  }

  // ---- 输出格式 ----
  parts.push('');
  parts.push('## 输出要求');
  parts.push('请严格按照以下 JSON 格式输出，不要添加任何额外的解释文字：');
  parts.push('');
  parts.push('```json');
  parts.push('{');
  parts.push('  "selfAwareness": {');
  parts.push('    "coreTension": "一句话描述用户内心的核心张力——比如「追求稳定但又渴望创造」",');
  parts.push('    "strengths": ["3个具体优势"],');
  parts.push('    "blindSpots": ["2个可能的盲区"]');
  parts.push('  },');
  parts.push('  "directions": [');
  parts.push('    {');
  parts.push('      "name": "方向名称（中文，具体）",');
  parts.push('      "feasibility": "高/中/低",');
  parts.push('      "why": "为什么适合这个用户（结合访谈和测评）",');
  parts.push('      "risk": "需要注意的风险",');
  parts.push('      "typicalRoles": ["2-3个典型岗位"]');
  parts.push('    }');
  parts.push('  ],');
  parts.push('  "verification": [');
  parts.push('    {');
  parts.push('      "type": "行动/阅读/对话",');
  parts.push('      "action": "具体的验证步骤（可执行）",');
  parts.push('      "why": "为什么要做这个验证"');
  parts.push('    }');
  parts.push('  ],');
  parts.push('  "growthPath": {');
  parts.push('    "direction": "推荐的优先探索方向",');
  parts.push('    "firstStep": {');
  parts.push('      "skill": "建议优先学习的技能",');
  parts.push('      "action": "具体的入门行动（可72小时内执行）",');
  parts.push('      "timeEstimate": "预计需要多长时间看到初步进展"');
  parts.push('    },');
  parts.push('    "behavioralHabit": "一个可培养的日常习惯"');
  parts.push('  }');
  parts.push('}');
  parts.push('```');

  parts.push('');
  parts.push('要求：');
  parts.push('1. directions 数组包含2-3个方向，按匹配度排序');
  parts.push('2. 每个方向必须具体（如"B端产品经理"而非"产品经理"）');
  parts.push('3. verification 必须包含2-3个可执行的验证行动');
  parts.push('4. firstStep 必须是具体行动而非抽象建议');

  return parts.join('\n');
}

// ---------- 内部：构建 System Prompt ----------

function _buildSystemPrompt(stateMachine) {
  const { state, collected, hasProfile, profileSummary, history } = stateMachine;
  const parts = [];

  // ---- 角色定位（温暖 + 专业）----
  parts.push('你是一位温暖、专业、善于倾听的职业规划师。');
  parts.push('');
  parts.push('## 你的对话风格');
  parts.push('1. **先回应用户，再发问**：每次用户回答后，先用1-2句话对ta说的内容表示理解和回应——"听得出来你对这点很在意""这个经历确实很特别"——然后再自然引出下一个问题或追问。');
  parts.push('2. **用例子降低理解门槛**：提问题时附1个具体例子帮助用户理解，如"比如有些人很在意每天几点下班，有些人更在意做的事有没有意义——你呢？"');
  parts.push('3. **告诉用户为什么问这个**：简短说明问题的目的，如"我想了解这个是因为它会帮你过滤掉不适合的方向"。');
  parts.push('4. **语言口语化、有温度**：像和一个朋友聊天，不是在做问卷调查。用"你"而非"您"。');
  parts.push('5. **永远不要连续问两个问题**：每次只问一件事。');

  // ---- 当前阶段信息 ----
  const stepId = STATE_TO_STEP[state];
  const phaseInfo = stateMachine.getPhaseTurnInfo ? stateMachine.getPhaseTurnInfo() : null;

  if (stepId) {
    const step = getStep(stepId);
    if (step) {
      parts.push('');
      parts.push('## 当前阶段');
      parts.push(`任务：${step.purpose}`);
      parts.push(`需要了解的关键信息：${step.extractFields.join('、')}`);

      if (phaseInfo) {
        parts.push(`本轮是当前阶段的第 ${phaseInfo.turn} 轮（最多 ${phaseInfo.max} 轮）`);
        if (phaseInfo.remaining === 0) {
          parts.push('⚠️ 这是当前阶段的最后一轮。你的回复必须：①简短总结用户刚才说的内容 ②自然地过渡到下一个阶段。不要停留在当前话题。');
          parts.push(`下一阶段是：${_getNextPhaseLabel(state)}`);
        } else if (phaseInfo.turn === 1) {
          parts.push('这是本阶段第一轮。先确认你理解了用户的基本情况，然后追问一个具体细节，帮助用户深入思考。');
        } else {
          parts.push(`还剩 ${phaseInfo.remaining} 轮。可以追问更深，或如果信息已经足够，本轮过渡到下一阶段。`);
          parts.push(`下一阶段是：${_getNextPhaseLabel(state)}`);
        }
      }

      if (step.followupCondition && step.followupQuestion) {
        parts.push(`追问线索：${step.followupCondition} → 可以用："${step.followupQuestion}"`);
      }
    }
  }

  // ---- SUMMARY_CONFIRM 特殊处理 ----
  if (state === 'SUMMARY_CONFIRM') {
    parts.push('');
    parts.push('## 当前阶段：总结确认');
    parts.push('根据已收集的信息，用3-5句话向用户复述你理解到的关键信息。');
    parts.push('总结完后，询问用户是否准确，或者有无补充。');
  }

  // ---- 已收集信息摘要 ----
  parts.push('');
  parts.push('## 已了解到的信息');
  const order = ['stage', 'experience', 'motivation', 'constraints', 'pastTry'];
  let hasAny = false;
  order.forEach(id => {
    if (collected[id]) {
      hasAny = true;
      const label = STEP_LABELS[id] || id;
      // 显示完整答案（含追问追加内容）
      const text = collected[id].answer.replace(/\n\[追问回答\]/g, '；追问：');
      parts.push(`- ${label}：${text}`);
    }
  });
  if (!hasAny) {
    parts.push('（尚未收集任何信息）');
  }

  // ---- 画像摘要 ----
  if (hasProfile && profileSummary) {
    parts.push('');
    parts.push('## 用户测评画像');
    parts.push(`核心特质：${profileSummary.topNames}`);
    if (profileSummary.topDims.length > 0) {
      parts.push('突出维度：');
      profileSummary.topDims.forEach(d => {
        parts.push(`- ${d.name}: ${d.score}分`);
      });
    }
    parts.push('画像只是参考——对话中用户自己说的比测评结果更重要。如果你发现用户说的和画像有矛盾，相信用户说的。');
  }

  // ---- 方向知识库 ----
  parts.push('');
  parts.push('## 参考方向（对话阶段只需了解，不要主动推荐）');
  directions.forEach(d => {
    parts.push(`- ${d.icon || ''} ${d.name}：${d.tagline}`);
  });

  return parts.join('\n');
}

/**
 * 获取下一个阶段的标签（供 phase transition 提示使用）
 */
function _getNextPhaseLabel(state) {
  const map = {
    Q1_STAGE: '经验盘点——你做过哪些事、有什么高光时刻',
    Q2_EXPERIENCE: '内在驱动——什么事让你觉得"这就是我该做的"',
    Q3_MOTIVATION: '现实考量——你在意什么（薪资/城市/WLB等）',
    Q4_CONSTRAINT: '过往探索——你之前试过什么方法',
    Q5_PAST_TRY: '我们来总结一下你刚才聊的内容',
  };
  return map[state] || '下一个话题';
}
