// ============================================================
// agent-v2/replies.js — 兜底回复模板
// 所有硬编码回复集中管理，阶段敏感
// ============================================================

/**
 * 阶段推进时的过渡语（仅在 AI 完全无文字回复时兜底使用）
 */
export const ADVANCE_FALLBACKS = {
  2: '聊了测评结果，我想更深入地了解你。你更喜欢"从零搭一个系统"还是"研究透一个现象"？',
  3: '了解了你的方向偏好。现实层面你最在意什么？城市、薪资、稳定、成长——如果只能保一个，你选哪个？',
  4: '结合我们聊的，我觉得你最适合的方向是——让我帮你整理一下。',
};

/**
 * save_collected 后的追问（避免"了解了，继续聊"）
 */
export const SAVE_FALLBACKS = {
  1: [
    '我记下了。测评结果里有没有哪个让你觉得"嗯？是这样的吗？"',
    '了解。有没有哪个维度你觉得不准，想纠正一下？',
  ],
  2: [
    '这段经历我记下了。当时你最在意的是哪个部分——做的事本身、还是一起的人、还是别的？',
    '了解。你觉得这个方向和你测评里显示的倾向一致吗？',
  ],
  3: [
    '我记下了。如果只能保一个条件，你会选哪个？',
    '了解。如果理想和现实差距大，你愿意走一条过渡路径吗？',
  ],
  4: [
    '我记下了。你觉得我整理的这个方向合理吗？有没有想调整的地方？',
    '了解。有没有什么你担心的事，想先说清楚的？',
  ],
};

/**
 * 阶段敏感的兜底追问（用于问句补全）
 */
export function getRandomFallback(phase) {
  const fallbacks = SAVE_FALLBACKS[phase] || SAVE_FALLBACKS[1];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

/**
 * 生成阶段敏感的兜底回复文本
 * @param {number} phase
 * @param {string} toolName - 刚执行的工具名
 * @returns {string}
 */
export function getFallbackReplyText(phase, toolName) {
  if (toolName === 'finish_conversation') {
    return '以上就是为你整理的方向建议。如果你还有其他问题，随时欢迎再来聊聊！';
  }
  if (toolName === 'advance_phase') {
    return ADVANCE_FALLBACKS[phase] || '好了，我们聊聊下一个话题。';
  }
  if (toolName === 'save_collected') {
    return getRandomFallback(phase);
  }
  return '我在听，你继续说？';
}

/** 错误信息 */
export const ERROR_REPLIES = {
  NO_API_KEY: '抱歉，AI 服务暂时不可用。请稍后再试。',
  TIMEOUT: '抱歉，网络好像出了点问题。请稍后再试。',
  NETWORK: '抱歉，网络好像出了点问题。请稍后再试。',
  JSON_PARSE: '抱歉，AI 服务暂时不可用。请稍后再试。',
  EMPTY_RESPONSE: '抱歉，AI 没有返回有效回复。',
};

/** 对话已完成 */
export const COMPLETED_REPLY = '对话已完成。如需重新探索，请刷新页面开始新的对话。';
