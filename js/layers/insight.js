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
 * @param {object} profile   - UnifiedProfile（integrator.js 输出）
 * @param {object} translation - translator.js 输出
 * @returns {string}
 */
function buildInsightPrompt(profile, translation) {
  const { dimensions, meta } = profile;

  // 维度分数摘要（取前 6 高 + 前 2 低）
  const dimEntries = Object.entries(dimensions).sort((a, b) => b[1] - a[1]);
  const topDims = dimEntries.slice(0, 6).map(([k, v]) => `${k}:${v}`).join('、');
  const lowDims = dimEntries.slice(-2).map(([k, v]) => `${k}:${v}`).join('、');

  // 规则翻译摘要
  const transSummary = translation && translation.sections
    ? translation.sections.map((t) => `【${t.gameName || t.gameId}】${t.summary || ''}`).join('\n')
    : '（无翻译结果）';

  // 行为摘要
  const behaviors = [];
  if (meta) {
    if (meta.g1TopDrive) behaviors.push(`G1最高驱动力：${meta.g1TopDrive}`);
    if (meta.g2TopAnchors) behaviors.push(`G2前3锚点：${meta.g2TopAnchors.join('、')}`);
    if (meta.g3Type) behaviors.push(`G3认知类型：${meta.g3Type}`);
    if (meta.g4Type) behaviors.push(`G4意义类型：${meta.g4Type}`);
  }

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

### 游戏行为摘要
${behaviors.length ? behaviors.join('\n') : '（无行为数据）'}

---

## 输出要求

严格按以下 JSON 格式输出，不要输出任何 JSON 以外的内容：

{
  "oneLiner": "一句话总结，15 字以内，适合做 Hero 展示，用第二人称",
  "overall": "整体画像段落，120-150 字，跨维度交叉描述，用第二人称「你」，像朋友聊天，不像测评报告，不列举分数，讲这些分数意味着什么",
  "highlights": [
    "亮点1（维度组合洞察，20-30 字）",
    "亮点2（反差或独特性，20-30 字）",
    "亮点3（一致性或深层动机，20-30 字）"
  ],
  "tension": "矛盾或张力描述，50 字以内，如果用户各维度无显著矛盾则返回 null"
}

## 风格约束
- 用「你」，不用「用户」
- 像朋友聊天，不像测评报告
- 不重复规则文案，要有增量信息
- 不夸「你很优秀」「你很棒」，只说特质意味着什么
- oneLiner 要有画面感，不要泛泛而谈`;
}

// ---------- 核心函数 ----------

/**
 * 生成 profile 的 hash，用于缓存
 * @param {object} profile
 * @returns {string}
 */
function getProfileHash(profile) {
  const dims = JSON.stringify(profile.dimensions || {});
  let hash = 0;
  for (let i = 0; i < dims.length; i++) {
    const char = dims.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `insight_${Math.abs(hash).toString(36)}`;
}

/**
 * 调用 AI 生成人格洞察
 * @param {object} profile      - UnifiedProfile
 * @param {object} translation  - translator.js 输出
 * @param {object} [options]
 * @param {boolean} [options.skipCache=false] - 跳过缓存强制重新调用
 * @returns {Promise<object|null>} - 结构化洞察结果，失败返回 null
 */
export async function generateInsight(profile, translation, options = {}) {
  const { skipCache = false } = options;

  // 1. 检查缓存
  if (!skipCache) {
    const hash = getProfileHash(profile);
    try {
      const cached = localStorage.getItem(hash);
      if (cached) {
        log('[Insight] 命中缓存，直接返回');
        return JSON.parse(cached);
      }
    } catch { /* ignore */ }
  }

  // 2. 构建 Prompt
  const prompt = buildInsightPrompt(profile, translation);

  // 3. 调用 API（混元主，DeepSeek 降级）
  log('[Insight] 正在调用 AI...');
  const api = await getApi();
  const raw = await api.callWithFallback(prompt, {
    temperature: 0.8,
    maxTokens: 1024,
    timeout: 35000,
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
    if (!result.oneLiner || !result.overall || !Array.isArray(result.highlights)) {
      logWarn('[Insight] API 返回格式不完整，尝试补全');
      result = {
        oneLiner: result.oneLiner || '你是一个独特的人',
        overall: result.overall || '你的思维特质组合颇具个性，值得深入探索。',
        highlights: result.highlights || ['维度组合有亮点', '特质鲜明', '有独特优势'],
        tension: result.tension || null,
      };
    }
  } catch (err) {
    logError('[Insight] JSON 解析失败:', err.message);
    logWarn('[Insight] 原始返回:', raw.slice(0, 200));
    return null;
  }

  // 5. 写入缓存
  try {
    const hash = getProfileHash(profile);
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
