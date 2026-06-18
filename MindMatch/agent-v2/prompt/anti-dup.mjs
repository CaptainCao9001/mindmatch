// ============================================================
// agent-v2/prompt/anti-dup.js — 防重复指令格式化
// 将 dedup.js 的输出格式化为 prompt 注入文本
// ============================================================

/**
 * 构建防重复指令文本
 * @param {Array<string>} askedQuestions - 已问过的问题
 * @param {Array<string>} recentKeywords - 最近话题关键词
 * @param {Array<string>} discussedTopics - 已讨论话题
 * @returns {string} 追加到 system prompt 末尾的文本
 */
export function buildAntiDupBlock(askedQuestions, recentKeywords, discussedTopics) {
  const parts = [];

  if (discussedTopics && discussedTopics.length > 0) {
    parts.push(`[已讨论话题，禁止以任何方式重新询问（换说法也不行）：\n${discussedTopics.map(t => `- ${t}`).join('\n')}\n]`);
  }

  if (askedQuestions && askedQuestions.length > 0) {
    parts.push(`[已问过的问题，请勿重复：\n${askedQuestions.map(q => `- ${q}`).join('\n')}\n]`);
  }

  if (recentKeywords && recentKeywords.length > 0) {
    parts.push(`[禁止在本轮重复提及以下话题关键词：\n${recentKeywords.map(k => `- ${k}`).join('\n')}\n]`);
  }

  if (parts.length === 0) return '';

  return '\n\n' + parts.join('\n\n');
}
