// ============================================================
// agent-v2/dedup.js — 防重复提取
// 从消息历史中提取已问问题、话题关键词、已讨论话题
// ============================================================

/** 话题关键词白名单 */
const TOPIC_WORDS = [
  '专业', '年级', '实习', '项目', '社团', '城市', '薪资', '工资',
  '稳定', '成长', '发展', '考研', '工作', '岗位', '行业', '待遇',
  '成就感', '意义', '价值', '兴趣', '方向', '规划', '选择', '纠结',
  '探索', '尝试', '测评', '测试', '驱动力', '动机', '约束', '现实',
  '技能', '能力', '经验', '经历',
];

/** collected 字段名 → 人类可读的话题 */
const FIELD_TOPIC_MAP = {
  resonance:           ['测评结果', '认同度', '核心特质'],
  directionPreference: ['方向偏好', '建造vs理解', '创造vs连接'],
  keyExperience:       ['关键经历', '高光时刻', '实习', '项目'],
  innerDrive:          ['内在驱动', '价值观', '成就感来源'],
  constraints:         ['现实约束', '城市', '薪资', '稳定', '成长空间'],
  tradeoffs:           ['妥协', '过渡', '优先级'],
  actionPlan:          ['行动计划', '第一步', '行动地图'],
};

/**
 * 从消息历史中提取最近问句
 * @param {Array} messages
 * @param {number} [maxCount=8]
 * @returns {string[]}
 */
export function extractAskedQuestions(messages, maxCount = 8) {
  const questions = [];
  const seen = new Set();

  for (const m of messages) {
    if (m.role !== 'assistant' || !m.content) continue;
    const parts = m.content.split(/[。！!\n]/);
    for (const p of parts) {
      if (p.includes('？') || p.includes('?')) {
        const q = p.split(/[？?]/)[0].trim().slice(-50);
        if (q.length >= 8 && !seen.has(q)) {
          seen.add(q);
          questions.push(q);
        }
      }
    }
    if (questions.length >= maxCount) break;
  }
  return questions;
}

/**
 * 从最近 assistant 消息中提取话题关键词
 * @param {Array} messages
 * @param {number} [maxCount=10]
 * @returns {string[]}
 */
export function extractRecentKeywords(messages, maxCount = 10) {
  const keywords = [];
  const seen = new Set();

  for (let i = messages.length - 1; i >= 0 && keywords.length < maxCount; i--) {
    const m = messages[i];
    if (m.role !== 'assistant' || !m.content) continue;
    for (const w of TOPIC_WORDS) {
      if (m.content.includes(w) && !seen.has(w)) {
        seen.add(w);
        keywords.push(w);
      }
    }
  }
  return keywords;
}

/**
 * 从 collected 字段推断已讨论话题
 * @param {object} collected - session.collected
 * @returns {string[]}
 */
export function getDiscussedTopics(collected) {
  const topics = [];
  const seen = new Set();

  for (const field of Object.keys(collected || {})) {
    const mapped = FIELD_TOPIC_MAP[field] || [field];
    for (const t of mapped) {
      if (!seen.has(t)) {
        seen.add(t);
        topics.push(t);
      }
    }
  }
  return topics;
}
