// ============================================================
// M2: insight.js — AI 人格洞察层
// 职责: 构建 Prompt + 调用混元 API，返回结构化洞察结果
// 注意: api.js 用动态导入（带版本号），避免浏览器缓存旧版
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
 * 构建 AI 解读 Prompt
 * @param {object} profile      - UnifiedProfile（integrator.js 输出）
 * @param {object} translation  - translator.js 输出
 * @param {string} [behaviorNarrative=''] - behavior-narrative.js 的叙事文本
 * @returns {string}
 */
function buildInsightPrompt(profile, translation, behaviorNarrative = '') {
  const { dimensions, meta } = profile;

  // 维度分数摘要（取前 6 高 + 前 2 低）
  const dimEntries = Object.entries(dimensions).sort((a, b) => b[1] - a[1]);
  const topDims = dimEntries.slice(0, 6).map(([k, v]) => `${k}:${v}`).join('、');
  const lowDims = dimEntries.slice(-2).map(([k, v]) => `${k}:${v}`).join('、');

  // 规则翻译摘要
  const transSummary = translation && translation.sections
    ? translation.sections.map((t) => `【${t.gameName || t.gameId}】${t.summary || ''}`).join('\n')
    : '（无翻译结果）';

  return `你是 MindMatch 的 AI 解读引擎。你的任务不是生成测评报告，而是帮用户「看到自己不曾察觉的地方」。

## 输入数据

### 14 维人格画像分数（0-10）
${Object.entries(dimensions).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

### 高分维度（Top 6）
${topDims}

### 低分维度（Bottom 2）
${lowDims}

### 规则翻译摘要
${transSummary}

### 行为叙事——你如何与游戏互动
${behaviorNarrative || '（无行为叙事数据）'}

---

## 输出要求

严格按以下 JSON 格式输出，不要输出任何 JSON 以外的内容：

{
  "gameBehaviors": [
    {
      "game": "G1 核心驱动力",
      "behavior": "先描述玩家做了什么（引用行为叙事中的具体数据：几秒、几张卡、哪个场景等），40-60 字，用第二人称「你」",
      "comment": "再评价这个行为意味着什么（分析背后的心理模式：为什么快/慢、为什么翻多/翻少），40-60 字，用第二人称「你」"
    },
    {
      "game": "G2 职业锚",
      "behavior": "同上：描述浏览查看行为和锚点选择",
      "comment": "同上：评价探索风格和锚点组合的含义"
    },
    {
      "game": "G3 认知风格",
      "behavior": "同上：描述分组/排序节奏和结果",
      "comment": "同上：评价认知节奏和自知程度"
    },
    {
      "game": "G4 意义建构",
      "behavior": "同上：描述临在感和追寻感的模式",
      "comment": "同上：评价意义唤起模式的含义"
    }
  ],
  "summary": "跨游戏总结，120-150 字，用第二人称「你」。不重复各段 behavior/comment 已经说过的话，而是提炼贯穿四个游戏的核心模式——这些行为共同揭示了一个什么样的人。不要堆砌维度标签，要说这个人的特质意味着什么。"
}

## 风格约束
- 用「你」，不用「用户」
- 像朋友聊天，不像测评报告
- behavior 段必须引用行为叙事中的具体数据（秒数、张数、场景名）
- comment 段必须解释行为背后的心理模式——不要只重复行为描述
- summary 要跨游戏提炼一致模式，不要逐游戏复述
- 不夸「你很优秀」「你很棒」，只说特质意味着什么
- 不重复规则文案，要有增量信息`;
}

// ---------- 核心函数 ----------

/**
 * 生成 profile 的 hash，用于缓存
 * @param {object} profile
 * @returns {string}
 */
function getProfileHash(profile, behaviorNarrative = '') {
  const dims = JSON.stringify(profile.dimensions || {});
  const seed = dims + '|' + (behaviorNarrative || '');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `insight_${Math.abs(hash).toString(36)}`;
}

/**
 * 调用 AI 生成人格洞察
 * @param {object} profile           - UnifiedProfile
 * @param {object} translation       - translator.js 输出
 * @param {object} [options]
 * @param {boolean} [options.skipCache=false]  - 跳过缓存强制重新调用
 * @param {string} [options.behaviorNarrative] - 行为叙事文本
 * @returns {Promise<object|null>} - 结构化洞察结果，失败返回 null
 */
export async function generateInsight(profile, translation, options = {}) {
  const { skipCache = false, behaviorNarrative = '' } = options;

  // 1. 检查缓存
  if (!skipCache) {
    const hash = getProfileHash(profile, behaviorNarrative);
    try {
      const cached = localStorage.getItem(hash);
      if (cached) {
        log('[Insight] 命中缓存，直接返回');
        return JSON.parse(cached);
      }
    } catch { /* ignore */ }
  }

  // 2. 构建 Prompt
  const prompt = buildInsightPrompt(profile, translation, behaviorNarrative);

  // 3. 调用 API（混元主，DeepSeek 降级）
  log('[Insight] 正在调用 AI...');
  const api = await getApi();
  const raw = await api.callWithFallback(prompt, {
    temperature: 0.8,
    maxTokens: 2048,
    timeout: 35000,
    preferredProvider: 'deepseek',
  });

  if (!raw) {
    logWarn('[Insight] API 调用失败，无返回');
    return null;
  }

  // 4. 解析 JSON（容错：提取 ```json ... ``` 或裸 JSON）
  let result = null;
  try {
    // 尝试提取代码块中的 JSON
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;
    result = JSON.parse(jsonStr);

    // 验证必要字段
    if (!result.gameBehaviors || !Array.isArray(result.gameBehaviors) || !result.summary) {
      logWarn('[Insight] API 返回格式不完整，尝试补全');
      result = {
        gameBehaviors: result.gameBehaviors || [],
        summary: result.summary || '你的思维特质组合颇具个性，值得深入探索。',
      };
    }
  } catch (err) {
    logError('[Insight] JSON 解析失败:', err.message);
    logWarn('[Insight] 原始返回:', raw.slice(0, 200));
    return null;
  }

  // 5. 写入缓存
  try {
    const hash = getProfileHash(profile, behaviorNarrative);
    localStorage.setItem(hash, JSON.stringify(result));
  } catch { /* ignore */ }

  log('[Insight] 生成成功');
  return result;
}

/**
 * 清除指定 profile 的洞察缓存
 * @param {object} profile
 */
export function clearInsightCache(profile) {
  try {
    const hash = getProfileHash(profile);
    localStorage.removeItem(hash);
    log('[Insight] 缓存已清除:', hash);
  } catch { /* ignore */ }
}

/**
 * 检查是否有指定 profile 的缓存
 * @param {object} profile
 * @returns {boolean}
 */
export function hasInsightCache(profile) {
  try {
    const hash = getProfileHash(profile);
    return !!localStorage.getItem(hash);
  } catch {
    return false;
  }
}
