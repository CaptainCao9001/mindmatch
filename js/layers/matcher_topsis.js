// ============================================================
// M16: matcher_topsis.js — TOPSIS 距离法匹配引擎
// 职责: 计算用户到 4 个岗位理想剖面的欧氏距离，输出贴近度排序
// 输入: UnifiedProfile (14 维标准化) + JobProfiles
// 输出: TopsisResult[] (每岗位的 closeness + dPlus/dMinus)
// v2.0: 高斯核连续映射替代阶梯式 mapSubDimension
// ============================================================

import { log } from '../core/utils.js?v=20260602e';

/**
 * 高斯核匹配度 — 与 matcher_linear.js 统一
 * @param {number} actual — 用户标准化后的维度值 [0, 1]
 * @param {number} ideal — 理想值 [0, 1]
 * @param {number} [sigma=0.25] — 带宽
 * @returns {number} — 匹配度 [0, 1]
 */
function gaussianMatch(actual, ideal, sigma = 0.20) {
  const diff = actual - ideal;
  return Math.exp(-(diff * diff) / (2 * sigma * sigma));
}

/**
 * 构建匹配度矩阵: 每个岗位(行) × 每个维度(列) 的匹配度
 * @returns {{ matrix: number[][], dimOrder: string[] }}
 */
function buildMatchMatrix(userProfile, jobs) {
  const jobIds = Object.keys(jobs);
  // 取第一个岗位的维度顺序作为全局顺序
  const dimOrder = jobs[jobIds[0]].profiles.map(p => p.field);
  const n = dimOrder.length;
  const m = jobIds.length;

  // D[m][n] — 每个岗位对每个维度的匹配度
  const D = jobIds.map(jobId => {
    const job = jobs[jobId];
    return dimOrder.map(field => {
      const pf = job.profiles.find(p => p.field === field);
      if (!pf) return 0;
      const actual = userProfile[field] != null ? userProfile[field] : 0;
      return gaussianMatch(actual, pf.ideal, pf.bandwidth || 0.20);
    });
  });

  return { matrix: D, dimOrder, jobIds };
}

/**
 * TOPSIS 算法主入口
 *
 * Step 1: 构建决策矩阵 D[m×n]
 * Step 2: 向量归一化 R[i][j] = D[i][j] / sqrt(Σ D[k][j]²)
 * Step 3: 加权 V[i][j] = R[i][j] × w[j]
 * Step 4: 确定正/负理想解 A⁺/A⁻
 * Step 5: 计算欧氏距离 d⁺/d⁻
 * Step 6: 贴近度 C = d⁻/(d⁺+d⁻)
 * Step 7: 按 C 降序排列
 *
 * @param {UnifiedProfile} profile — integrator 输出
 * @param {object} jobs — ideal-profiles.json 的 jobs 对象
 * @returns {Array<{jobId, closeness, dPlus, dMinus, rank}>}
 */
export function topsisMatch(profile, jobs) {
  const { matrix: D, dimOrder, jobIds } = buildMatchMatrix(profile.dimensions, jobs);
  const n = dimOrder.length;
  const m = jobIds.length;

  // Step 2: 向量归一化 —— 每列独立
  const colSums = new Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < m; i++) {
      colSums[j] += D[i][j] ** 2;
    }
  }

  const R = D.map(row =>
    row.map((val, j) => (colSums[j] > 0 ? val / Math.sqrt(colSums[j]) : 0))
  );

  // Step 3: 加权（使用每个岗位自身的维度权重）
  const dimWeights = dimOrder.map(field => {
    // 取第一个岗位的权重（简化——实际各岗位权重可能不同）
    const pf = jobs[jobIds[0]].profiles.find(p => p.field === field);
    return pf ? pf.weight : 0;
  });

  const V = R.map((row, i) =>
    row.map((val, j) => {
      const jPf = jobs[jobIds[i]].profiles.find(p => p.field === dimOrder[j]);
      const w = jPf ? jPf.weight : dimWeights[j];
      return val * w;
    })
  );

  // Step 4: 正理想解 A⁺ 和负理想解 A⁻
  const Aplus = new Array(n).fill(0).map((_, j) =>
    Math.max(...V.map(row => row[j]))
  );
  const Aminus = new Array(n).fill(0).map((_, j) =>
    Math.min(...V.map(row => row[j]))
  );

  // Step 5-6: 距离 + 贴近度
  const results = V.map((row, i) => {
    let dPlusSum = 0, dMinusSum = 0;
    for (let j = 0; j < n; j++) {
      dPlusSum += (row[j] - Aplus[j]) ** 2;
      dMinusSum += (row[j] - Aminus[j]) ** 2;
    }
    const dPlus = Math.sqrt(dPlusSum);
    const dMinus = Math.sqrt(dMinusSum);
    const denominator = dPlus + dMinus;
    const closeness = denominator > 0 ? dMinus / denominator : 0.5;

    return {
      jobId: jobIds[i],
      closeness: Math.round(closeness * 1000) / 1000,
      dPlus: Math.round(dPlus * 1000) / 1000,
      dMinus: Math.round(dMinus * 1000) / 1000,
    };
  });

  // Step 7: 排序
  results.sort((a, b) => b.closeness - a.closeness);
  results.forEach((r, i) => { r.rank = i + 1; });

  log(`matcher_topsis: 匹配完成 → ${results.map(r => `${r.jobId}=${r.closeness}`).join(', ')}`);
  return results;
}

/**
 * 检查线性排名与 TOPSIS 排名是否不一致
 * @returns {boolean} — 是否需要 AI 审核
 */
export function needsAIReview(linearResults, topsisResults) {
  // 提取排名
  const linearRank = {};
  linearResults.forEach((r, i) => { linearRank[r.jobId] = i + 1; });
  const topsisRank = {};
  topsisResults.forEach(r => { topsisRank[r.jobId] = r.rank; });

  // 第一名不一致，或排名差异 ≥ 2
  const firstLinear = linearResults[0].jobId;
  const firstTopsis = topsisResults[0].jobId;
  if (firstLinear !== firstTopsis) return true;

  for (const jobId of Object.keys(linearRank)) {
    if (Math.abs((linearRank[jobId] || 0) - (topsisRank[jobId] || 0)) >= 2) {
      return true;
    }
  }

  // 第一名贴近度 < 0.6
  if (topsisResults[0].closeness < 0.6) return true;

  return false;
}
