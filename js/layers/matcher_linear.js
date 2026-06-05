// ============================================================
// M15: matcher_linear.js — 线性加权匹配引擎
// 职责: 基于理想剖面，计算用户与每个岗位的线性加权匹配度
// 输入: UnifiedProfile (14 维标准化) + JobProfiles
// 输出: LinearMatchResult[] (每岗位的 0-100 得分)
// v2.1: 两阶段加权（游戏内聚合 + 游戏间 gameWeights 加权）
// ============================================================

import { log } from '../core/utils.js?v=20260602e';

// ---------- 14 维 → 4 游戏分组 (共享常量) ----------
const GAME_GROUPS = {
  G1: ['nAch', 'nPow', 'nAff'],
  G2: ['TF', 'GM', 'AU', 'SE', 'EC', 'SV', 'CH', 'LS'],
  G3: ['wholistAnalytic'],
  G4: ['presence', 'search'],
};

// ---------- 维度级匹配 ----------

/**
 * 高斯核匹配度 — 连续、可导、无死区
 * 以 ideal 为靶心，用户实际值越接近 ideal 匹配度越高
 *
 * @param {number} actual — 用户标准化后的维度值 [0, 1]
 * @param {number} ideal — 方向/职业对该维度的理想值 [0, 1]
 * @param {number} [sigma=0.25] — 带宽/宽容度，越小越严格
 * @returns {number} — 匹配度 [0, 1]，精确到 ideal 时 = 1.0
 */
function gaussianMatch(actual, ideal, sigma = 0.20) {
  const diff = actual - ideal;
  return Math.exp(-(diff * diff) / (2 * sigma * sigma));
}

// ---------- 两阶段加权核心 ----------

/**
 * Phase 1: 单游戏内加权聚合
 * 对一个游戏内的若干维度，用 profiles[].weight 加权平均
 * @returns {{ score: number, dimDetails: object }} score ∈ [0, 1]
 */
function _phase1GameScore(userProfile, jobProfile, gameId) {
  const dims = GAME_GROUPS[gameId];
  const dimDetails = {};
  let wSum = 0, tW = 0;

  for (const field of dims) {
    const pf = jobProfile.profiles.find(p => p.field === field);
    if (!pf) continue;
    const actual = userProfile[field];
    const match = gaussianMatch(actual, pf.ideal, pf.bandwidth || 0.20);
    const dimWs = match * pf.weight;
    wSum += dimWs;
    tW += pf.weight;

    dimDetails[field] = {
      actual: +(actual != null ? actual.toFixed(3) : 0),
      direction: pf.direction,
      ideal: pf.ideal,
      weight: pf.weight,
      match: +match.toFixed(3),
      contribution: +dimWs.toFixed(4),
    };
  }

  return {
    score: tW > 0 ? wSum / tW : 0,
    dimDetails,
  };
}

/**
 * 计算用户对单个岗位的线性加权匹配度（两阶段加权）
 *
 * Phase 1: 游戏内 — 用 profiles[].weight 对各游戏独立聚合
 * Phase 2: 游戏间 — 用 gameWeights 加权求和
 *
 * @param {object} userProfile — integrator 输出的 dimensions (14 维标准化)
 * @param {object} jobProfile — 岗位理想剖面（含 profiles[] 和 gameWeights）
 * @returns {object} — { jobId, score, gameScores, dimDetails }
 */
function linearScoreForJob(userProfile, jobProfile) {
  const allDimDetails = {};
  const gameScores = {};

  for (const gameId of Object.keys(GAME_GROUPS)) {
    const { score, dimDetails } = _phase1GameScore(userProfile, jobProfile, gameId);
    gameScores[gameId] = score; // [0, 1]
    Object.assign(allDimDetails, dimDetails);
  }

  // Phase 2: 游戏间加权
  const gw = jobProfile.gameWeights || { G1: 0.25, G2: 0.25, G3: 0.25, G4: 0.25 };
  let finalScore = 0;
  for (const [gameId, w] of Object.entries(gw)) {
    finalScore += (gameScores[gameId] || 0) * w;
  }

  return {
    jobId: jobProfile.id,
    score: Math.round(finalScore * 100),
    gameScores,   // { G1, G2, G3, G4 } 各游戏得分 [0, 1]
    dimDetails: allDimDetails,
  };
}

/**
 * 主入口：计算用户对所有岗位的线性加权匹配度
 * @param {UnifiedProfile} profile — integrator 输出
 * @param {object} jobs — ideal-profiles.json 的 jobs 对象
 * @returns {Array<{jobId, score, dimDetails}>} — 按 score 降序排列
 */
export function linearMatch(profile, jobs) {
  const results = [];

  for (const [jobId, jobProfile] of Object.entries(jobs)) {
    const result = linearScoreForJob(profile.dimensions, jobProfile);
    results.push(result);
  }

  results.sort((a, b) => b.score - a.score);

  log(`matcher_linear: 匹配完成 → ${results.map(r => `${r.jobId}=${r.score}`).join(', ')}`);
  return results;
}

/**
 * 获取游戏级聚合得分（供展示使用）
 *
 * 与 linearScoreForJob 共用 Phase 1 逻辑：
 *   G1-G4 各游戏内加权平均 → gameWeights 加权 → total
 *
 * @param {object} userProfile — 用户维度
 * @param {object} jobProfile — 岗位维度（含 profiles[] 和 gameWeights）
 * @returns {object} — { G1: number, G2: number, G3: number, G4: number, total: number }
 */
export function gameLevelBreakdown(userProfile, jobProfile) {
  const breakdown = {};

  for (const gameId of Object.keys(GAME_GROUPS)) {
    const { score } = _phase1GameScore(userProfile, jobProfile, gameId);
    breakdown[gameId] = Math.round(score * 100);
  }

  // 游戏级加权（与 linearScoreForJob Phase 2 一致）
  const gw = jobProfile.gameWeights || { G1: 0.25, G2: 0.25, G3: 0.25, G4: 0.25 };
  let total = 0;
  for (const [gameId, w] of Object.entries(gw)) {
    total += (breakdown[gameId] || 0) * w;
  }
  breakdown.total = Math.round(total);

  return breakdown;
}
