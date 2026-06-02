// ============================================================
// M18: matcher_extended.js — 两级匹配核心算法（v2.0 新增）
// 职责: 实现方向级（6方向）和职业级（54职业）的双轨匹配
// 依赖: matcher_linear.js, matcher_topsis.js, core/utils.js
// ============================================================

import { linearMatch, gameLevelBreakdown } from './matcher_linear.js?v=20260602e';
import { topsisMatch } from './matcher_topsis.js?v=20260602e';
import { log, logWarn, clamp } from '../core/utils.js?v=20260602e';

/**
 * @typedef {'nAch'|'nPow'|'nAff'|'TF'|'GM'|'AU'|'SE'|'EC'|'SV'|'CH'|'LS'|'wholistAnalytic'|'presence'|'search'} DimensionId
 */

/**
 * @typedef {{field: DimensionId, ideal: number, direction: string, weight: number}} ProfileEntry
 */

/**
 * @typedef {{id: string, name: string, slogan?: string, description: string, icon: string, gameWeights: {G1:number,G2:number,G3:number,G4:number}, profiles: ProfileEntry[]}} DirectionProfile
 */

/**
 * @typedef {{id: string, name: string, directionId: string, icon: string, description: string, delta: Record<DimensionId, number>}} JobVariant
 */

/**
 * @typedef {{directionId: string, directionName: string, directionIcon: string, directionSlogan: string, directionDescription: string, score: number, topsisCloseness: number, topsisRank: number, linearScore: number, breakdown: {G1:number,G2:number,G3:number,G4:number}, jobResults?: any[]}} DirectionMatchEntry
 */

/**
 * @typedef {{jobId: string, jobName: string, jobIcon: string, jobDescription: string, score: number, topsisCloseness: number, internalRank: number, linearScore: number, breakdown: {G1:number,G2:number,G3:number,G4:number}}} JobMatchEntry
 */

// ============================================================
// 内部辅助
// ============================================================

/**
 * 创建安全的维度对象——将 null 维度替换为 0.5（中间值 fallback）
 * 确保未完成的游戏维度不会导致匹配崩溃
 * @param {object} dims — profile.dimensions
 * @returns {object} — 所有维度非 null 的副本
 */
function _safeDimensions(dims) {
  const safe = {};
  for (const key of Object.keys(dims)) {
    safe[key] = (dims[key] != null) ? dims[key] : 0.5;
  }
  return safe;
}

/**
 * 将 dimensions 为 null 的 profile 包装成安全的版本
 * @param {object} profile — 用户 UnifiedProfile
 * @returns {object} — 带安全 dimensions 的 profile
 */
function _safeProfile(profile) {
  return {
    ...profile,
    dimensions: _safeDimensions(profile.dimensions || {}),
  };
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 合并方向基线剖面 + 职业 delta → 完整职业剖面
 *
 * 规则:
 * - 浅拷贝 directionProfile 的 profiles 数组
 * - 对每个维度叠加 delta: ideal = clamp(baseIdeal + delta, 0, 1)
 * - direction 和 weight 从方向原型继承（不覆盖）
 * - 返回结构与 DirectionProfile 一致的新对象
 *
 * @param {DirectionProfile} directionProfile — 方向原型剖面
 * @param {JobVariant} jobVariant — 职业变体（含 delta）
 * @returns {DirectionProfile} 合并后的完整剖面
 */
export function resolveJobProfile(directionProfile, jobVariant) {
  try {
    const delta = jobVariant.delta || {};

    const mergedProfiles = directionProfile.profiles.map(pf => {
      const d = delta[pf.field] || 0;
      return {
        field: pf.field,
        ideal: clamp(pf.ideal + d, 0, 1),
        direction: pf.direction,
        weight: pf.weight,
      };
    });

    return {
      id: jobVariant.id,
      name: jobVariant.name,
      icon: jobVariant.icon,
      description: jobVariant.description,
      gameWeights: { ...directionProfile.gameWeights },
      profiles: mergedProfiles,
    };
  } catch (err) {
    logWarn(`resolveJobProfile 失败 (job=${jobVariant?.id}):`, err.message);
    // 降级: 返回未合并的方向剖面
    return {
      id: jobVariant?.id || 'unknown',
      name: jobVariant?.name || 'Unknown',
      icon: jobVariant?.icon || '❓',
      description: jobVariant?.description || '',
      gameWeights: { ...directionProfile.gameWeights },
      profiles: directionProfile.profiles.map(pf => ({ ...pf })),
    };
  }
}

/**
 * 一级匹配: 用户 → 6 方向排名（双轨: 线性 + TOPSIS）
 *
 * 流程:
 * 1. 调用 linearMatch() 获取各方向线性得分
 * 2. 调用 topsisMatch() 获取各方向 TOPSIS 贴近度
 * 3. 调用 gameLevelBreakdown() 获取 G1-G4 游戏级分解
 * 4. 融合: TOPSIS 定排名，线性定 score (0-100)
 *
 * @param {object} profile — integrator 输出的 UnifiedProfile
 * @param {Record<string, DirectionProfile>} directions — 方向剖面集
 * @returns {DirectionMatchEntry[]} 按 score 降序排列
 */
export function directionMatch(profile, directions) {
  try {
    const dirIds = Object.keys(directions);
    if (dirIds.length === 0) {
      logWarn('directionMatch: directions 为空，返回空数组');
      return [];
    }

    const safeProfile = _safeProfile(profile);

    // 轨道一: 线性加权
    const linearResults = linearMatch(safeProfile, directions);

    // 轨道二: TOPSIS
    const topsisResults = topsisMatch(safeProfile, directions);

    // 构建查找表
    const linearMap = {};
    linearResults.forEach(r => { linearMap[r.jobId] = r.score; });

    const topsisMap = {};
    topsisResults.forEach(r => { topsisMap[r.jobId] = { closeness: r.closeness, rank: r.rank }; });

    // 融合: TOPSIS 定排名，线性定 score
    const merged = dirIds.map(dirId => {
      const dir = directions[dirId];
      const topsis = topsisMap[dirId] || { closeness: 0, rank: dirIds.length };
      const linearScore = linearMap[dirId] || 0;
      const breakdown = gameLevelBreakdown(safeProfile.dimensions, dir);

      return {
        directionId: dirId,
        directionName: dir.name,
        directionIcon: dir.icon,
        directionSlogan: dir.slogan || '',
        directionDescription: dir.description || '',
        score: linearScore,
        topsisCloseness: topsis.closeness,
        topsisRank: topsis.rank,
        linearScore,
        breakdown,
      };
    });

    // 按 score 降序
    merged.sort((a, b) => b.score - a.score);

    log(`directionMatch: 匹配完成 → Top: ${merged[0]?.directionName || 'N/A'} (${merged[0]?.score || 0})`);
    return merged;
  } catch (err) {
    logWarn('directionMatch 失败:', err.message);
    return [];
  }
}

/**
 * 二级匹配: 用户 → 指定方向内职业排名
 *
 * 流程:
 * 1. 遍历 jobVariants，每个调用 resolveJobProfile() 合并基线 + delta
 * 2. 构建 jobs 对象用于双轨引擎
 * 3. 调用 linearScoreForJob() 获取线性得分
 * 4. 调用 topsisMatch() 获取 TOPSIS 贴近度和排名
 * 5. 调用 gameLevelBreakdown() 获取分解
 *
 * @param {object} profile — integrator 输出的 UnifiedProfile
 * @param {DirectionProfile} directionProfile — 方向原型剖面
 * @param {JobVariant[]} jobVariants — 该方向下的职业变体数组
 * @returns {JobMatchEntry[]} 按 score 降序排列
 */
export function jobMatch(profile, directionProfile, jobVariants) {
  try {
    if (!jobVariants || jobVariants.length === 0) {
      logWarn('jobMatch: jobVariants 为空，返回空数组');
      return [];
    }

    const safeProfile = _safeProfile(profile);

    // Step 1: 解析所有职业剖面
    const resolvedJobs = {};
    for (const variant of jobVariants) {
      const resolved = resolveJobProfile(directionProfile, variant);
      resolvedJobs[variant.id] = resolved;
    }

    // Step 2: 双轨计算
    const linearResults = linearMatch(safeProfile, resolvedJobs);
    let topsisResults;
    try {
      topsisResults = topsisMatch(safeProfile, resolvedJobs);
    } catch (topErr) {
      logWarn('jobMatch topsis 失败，降级为仅线性:', topErr.message);
      topsisResults = [];
    }

    // 构建查找表
    const linearMap = {};
    linearResults.forEach(r => { linearMap[r.jobId] = r.score; });

    const topsisMap = {};
    topsisResults.forEach(r => { topsisMap[r.jobId] = { closeness: r.closeness, rank: r.rank }; });

    // Step 3: 融合结果
    const numJobs = jobVariants.length;
    const merged = jobVariants.map((variant, idx) => {
      const topsis = topsisMap[variant.id] || { closeness: 0, rank: numJobs };
      const linearScore = linearMap[variant.id] || 0;
      const breakdown = gameLevelBreakdown(safeProfile.dimensions, resolvedJobs[variant.id]);

      return {
        jobId: variant.id,
        jobName: variant.name,
        jobIcon: variant.icon,
        jobDescription: variant.description,
        score: linearScore,
        topsisCloseness: topsis.closeness,
        internalRank: topsis.rank,
        linearScore,
        breakdown,
      };
    });

    // 按 score 降序
    merged.sort((a, b) => b.score - a.score);

    log(`jobMatch: 匹配完成 → Top: ${merged[0]?.jobName || 'N/A'} (${merged[0]?.score || 0})`);
    return merged;
  } catch (err) {
    logWarn('jobMatch 失败:', err.message);
    return [];
  }
}
