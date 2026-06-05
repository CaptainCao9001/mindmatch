// ============================================================
// M: experiment.js — 方向探索 AI 层
// 职责: 构建 Prompt + 调用混元 API，返回结构化实验结果
// 模式: 镜像 insight.js（Prompt 构建 + API 调用 + 缓存）
// ============================================================

import { log, logWarn, logError } from '../core/utils.js?v=20260602e';

// 动态加载 api.js（带版本号防缓存）
let _apiMod = null;
async function getApi() {
  if (_apiMod) return _apiMod;
  const ver = (typeof window !== 'undefined' && window.__MM_VER__) ? `?v=${window.__MM_VER__}` : '';
  _apiMod = await import(`../core/api.js${ver}`);
  return _apiMod;
}

// ---------- Prompt 模板 ----------

/**
 * 构建方向探索的 Prompt
 * @param {object} profile           - UnifiedProfile（14 维）
 * @param {Array}  directionReport   - directionMatch() 的输出（方向排名数组）
 * @param {string} translationText   - translator 翻译文本
 * @param {string} behaviorNarrative - 行为叙事文本
 * @returns {string}
 */
function buildExperimentPrompt(profile, directionReport, translationText, behaviorNarrative) {
  if (!Array.isArray(directionReport) || directionReport.length === 0) {
    throw new Error('directionReport 为空，无法构建实验 Prompt');
  }
  const topDir = directionReport[0];
  const top2 = directionReport[1] || topDir;
  const top3 = directionReport[2] || top2;

  const dimSummary = Object.entries(profile.dimensions)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');

  return `你是 MindMatch 的职业方向验证顾问。你的任务是帮用户设计 4 个可执行的微型实验，让他们在现实生活中验证"这个方向是否适合我"。

## 用户的测试画像

### Top 方向
- 第1: ${topDir.directionName}（匹配 ${topDir.score}%）
- 第2: ${top2.directionName}（匹配 ${top2.score}%）
- 第3: ${top3.directionName}（匹配 ${top3.score}%）

### 14 维分数
${dimSummary}

### 人格翻译
${translationText || '（无翻译结果）'}

### 行为叙事
${behaviorNarrative || '（无行为叙事数据）'}

---

## 4 个实验的设计要求

你必须生成 4 个实验，每个实验必须在 80-120 字之间，用第二人称「你」，语气像朋友给你出主意。每个实验必须包含：
1. 「做什么」——具体、可执行、3-7 天内能完成
2. 「观察什么」——做完后关注什么信号
3. 「为什么能验证」——这个实验和方向的关系

### 实验类型（必须各一个）

🧪 行为实验 — 做一件模拟该方向核心活动的事。例：如果你的方向是「创意塑造者」，试着在 48 小时内从零完成一个小创作。观察你在过程中是感到心流还是煎熬。

📝 观察实验 — 记录/觉察一个模式。例：接下来 5 天，每次感到「想做点什么」或「不想做什么」时记下来。看这些冲动的方向和频率是否符合该方向的特征。

💬 对话实验 — 找一个该方向的从业者聊 30 分钟。不要问「这工作好不好」，要问「你一个典型周二下午在做什么」。观察你对 Ta 描述的那些琐碎日常是觉得「有意思」还是「好无聊」。

❓ 否定实验 — 刻意停止做一件该方向相关的事一周。例：如果你是「人际联结者」，试试一周不主动组局——看你会觉得「终于清净了」还是「缺了点什么」。缺失感就是方向信号。

### 约束
- 每个实验引用至少一个用户的具体数据（维度分数、行为叙事中的秒数或锚点、Top 方向名称）
- 不夸「你很适合」「你很优秀」
- 不做职业规划建议（如「去学 XX 技能」「去投 XX 岗位」）
- 只说「你可以试着做什么来验证」

---

## 输出格式

严格按以下 JSON 输出，不要输出任何 JSON 以外的内容：

{
  "directionName": "创意塑造者",
  "directionMatch": 85,
  "experiments": [
    {
      "type": "act",
      "icon": "🧪",
      "title": "10-15字的标题，用动词开头的祈使句",
      "body": "80-120字的实验描述，包含做什么、观察什么、为什么能验证。引用具体数据。用第二人称「你」。"
    },
    {
      "type": "observe",
      "icon": "📝",
      "title": "同上",
      "body": "同上"
    },
    {
      "type": "connect",
      "icon": "💬",
      "title": "同上",
      "body": "同上"
    },
    {
      "type": "negate",
      "icon": "❓",
      "title": "同上",
      "body": "同上"
    }
  ],
  "closingNote": "30-40字的收尾语，鼓励用户不要把匹配当结论，而是当探索的起点。"
}`;
}

// ---------- 核心函数 ----------

/**
 * 生成 profile + directionReport 的 hash，用于缓存
 * @param {object} profile
 * @param {Array}  directionReport
 * @returns {string}
 */
function getExperimentHash(profile, directionReport) {
  const dims = JSON.stringify(profile.dimensions || {});
  const topDir = directionReport && directionReport[0]
    ? `${directionReport[0].directionId}_${directionReport[0].score}`
    : '';
  const seed = dims + '|exp|' + topDir;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `experiment_${Math.abs(hash).toString(36)}`;
}

/**
 * 调用 AI 生成方向探索
 * @param {object} profile           - UnifiedProfile
 * @param {Array}  directionReport   - directionMatch() 输出
 * @param {string} translationText   - 翻译文本
 * @param {string} behaviorNarrative - 行为叙事文本
 * @param {object} [options]
 * @param {boolean} [options.skipCache=false]
 * @returns {Promise<object|null>}
 */
export async function generateExperiments(profile, directionReport, translationText, behaviorNarrative, options = {}) {
  const { skipCache = false } = options;

  // 1. 检查缓存
  if (!skipCache) {
    const hash = getExperimentHash(profile, directionReport);
    try {
      const cached = localStorage.getItem(hash);
      if (cached) {
        log('[Experiment] 命中缓存，直接返回');
        return JSON.parse(cached);
      }
    } catch { /* ignore */ }
  }

  // 2. 构建 Prompt
  const prompt = buildExperimentPrompt(profile, directionReport, translationText, behaviorNarrative);

  // 3. 调用 API
  log('[Experiment] 正在调用 AI...');
  const api = await getApi();
  const raw = await api.callWithFallback(prompt, {
    temperature: 0.8,
    maxTokens: 2048,
    timeout: 35000,
    preferredProvider: 'deepseek',
  });

  if (!raw) {
    logWarn('[Experiment] API 调用失败，无返回');
    return null;
  }

  // 4. 解析 JSON
  let result = null;
  try {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;
    result = JSON.parse(jsonStr);

    // 验证必要字段
    if (!result.experiments || !Array.isArray(result.experiments) || !result.closingNote) {
      logWarn('[Experiment] API 返回格式不完整，尝试补全');
      result = {
        directionName: result.directionName || directionReport[0]?.directionName || '',
        directionMatch: result.directionMatch || directionReport[0]?.score || 0,
        experiments: result.experiments || [],
        closingNote: result.closingNote || '匹配不是终点，是你开始验证自己的起点。',
      };
    }
  } catch (err) {
    logError('[Experiment] JSON 解析失败:', err.message);
    logWarn('[Experiment] 原始返回:', raw.slice(0, 200));
    return null;
  }

  // 5. 写入缓存
  try {
    const hash = getExperimentHash(profile, directionReport);
    localStorage.setItem(hash, JSON.stringify(result));
  } catch { /* ignore */ }

  log('[Experiment] 生成成功');
  return result;
}

/**
 * 清除指定 profile + directionReport 的实验缓存
 */
export function clearExperimentCache(profile, directionReport) {
  try {
    const hash = getExperimentHash(profile, directionReport);
    localStorage.removeItem(hash);
    log('[Experiment] 缓存已清除:', hash);
  } catch { /* ignore */ }
}

/**
 * 检查是否有缓存
 */
export function hasExperimentCache(profile, directionReport) {
  try {
    const hash = getExperimentHash(profile, directionReport);
    return !!localStorage.getItem(hash);
  } catch {
    return false;
  }
}
