// ============================================================
// M17: matcher.js — 岗位匹配主编排器
// 职责: 调用双轨引擎（线性 + TOPSIS），融合结果，输出统一匹配报告
// 依赖: matcher_linear.js, matcher_topsis.js
// ============================================================

import { linearMatch, gameLevelBreakdown } from './matcher_linear.js?v=20260602e';
import { topsisMatch, needsAIReview } from './matcher_topsis.js?v=20260602e';
import { directionMatch, jobMatch } from './matcher_extended.js?v=20260602e';
import { log, logWarn } from '../core/utils.js?v=20260602e';

/**
 * 主入口：计算用户与所有岗位的匹配结果
 * @param {UnifiedProfile} profile — integrator 输出
 * @param {object} jobs — ideal-profiles.json 的 jobs 对象
 * @returns {MatchReport}
 */
export function match(profile, jobs) {
  // 轨道一：线性加权
  const linearResults = linearMatch(profile, jobs);

  // 轨道二：TOPSIS
  const topsisResults = topsisMatch(profile, jobs);

  // 检查是否需要 AI 审核
  const needsAI = needsAIReview(linearResults, topsisResults);

  // 融合最终排名（以 TOPSIS 为主，线性为辅）
  const finalRanking = buildFinalRanking(topsisResults, linearResults);

  // 为每个排序结果附加游戏级分解
  const enriched = finalRanking.map(entry => {
    const job = jobs[entry.jobId];
    const breakdown = gameLevelBreakdown(profile.dimensions, job);
    return {
      ...entry,
      jobName: job.name,
      jobIcon: job.icon,
      jobSlogan: job.slogan,
      jobDescription: job.description,
      breakdown,
    };
  });

  log(`matcher: 匹配完成 → Top: ${enriched[0].jobName} (${enriched[0].score})`);

  return {
    profile,
    ranking: enriched,
    tracks: {
      linear: linearResults,
      topsis: topsisResults.map(r => ({
        jobId: r.jobId,
        closeness: r.closeness,
        rank: r.rank,
      })),
    },
    needsAIReview: needsAI,
    generatedAt: Date.now(),
  };
}

/**
 * 融合双轨结果：TOPSIS 排名为主，线性得分作为辅助分数
 */
function buildFinalRanking(topsisResults, linearResults) {
  const linearMap = {};
  linearResults.forEach(r => { linearMap[r.jobId] = r.score; });

  return topsisResults.map(t => ({
    jobId: t.jobId,
    topsisRank: t.rank,
    topsisCloseness: t.closeness,
    linearScore: linearMap[t.jobId] || 0,
    // 综合得分：TOPSIS 贴近度 × 100（方便统一展示）
    score: Math.round(t.closeness * 100),
  }));
}

// ============================================================
// v2.0 扩展入口: matchExtended() — 两级匹配主编排器
// ============================================================

/**
 * 主编排器：两级匹配（v2.0 新入口）
 *
 * 流程:
 * Step 1: 调用 directionMatch() 获取 6 方向排名
 * Step 2: 调用 jobMatch() 获取 Top1-3 方向下的职业排名
 * Step 3: 将 jobResults 附加到对应 DirectionMatchEntry 上
 * Step 4: 调用 needsAIReview() 检查双轨一致性
 * Step 5: 返回 ExtendedMatchReport
 *
 * @param {object} profile — integrator 输出的 UnifiedProfile
 * @param {object} data — ideal-profiles.json v2.0 完整数据
 * @param {object} data.directions — 6 方向剖面
 * @param {object} data.directionJobs — 每个方向下的职业变体数组
 * @returns {object} ExtendedMatchReport
 */
export function matchExtended(profile, data) {
  try {
    const { directions, directionJobs } = data;

    if (!directions || Object.keys(directions).length === 0) {
      logWarn('matchExtended: directions 为空');
      return {
        profile,
        directionRanking: [],
        tracks: { linear: [], topsis: [] },
        needsAIReview: false,
        generatedAt: Date.now(),
      };
    }

    // Step 1: 一级匹配 —— 6 方向排名
    const directionRanking = directionMatch(profile, directions);

    if (directionRanking.length === 0) {
      logWarn('matchExtended: directionRanking 为空');
      return {
        profile,
        directionRanking: [],
        tracks: { linear: [], topsis: [] },
        needsAIReview: false,
        generatedAt: Date.now(),
      };
    }

    // Step 2: 二级匹配 —— Top1-3 方向职业排名（方案A: Top1 展开, Top2/3 折叠可展开）
    const TOP_N = 3;
    for (let i = 0; i < Math.min(TOP_N, directionRanking.length); i++) {
      const dirEntry = directionRanking[i];
      const dirProfile = directions[dirEntry.directionId];
      const jobVariants = directionJobs?.[dirEntry.directionId] || [];
      if (jobVariants.length > 0) {
        dirEntry.jobResults = jobMatch(profile, dirProfile, jobVariants);
      } else {
        dirEntry.jobResults = [];
      }
    }

    // Step 3: 双轨一致性检查
    // 构造线性结果（方向级）供 needsAIReview 使用
    const linearResults = directionRanking.map(d => ({
      jobId: d.directionId,
      score: d.linearScore,
    }));
    const topsisResults = directionRanking.map(d => ({
      jobId: d.directionId,
      closeness: d.topsisCloseness,
      rank: d.topsisRank,
    }));

    let needsAI = false;
    try {
      needsAI = needsAIReview(linearResults, topsisResults);
    } catch (err) {
      logWarn('matchExtended: needsAIReview 失败:', err.message);
      needsAI = false;
    }

    // Step 4: 组装报告
    const tracks = {
      linear: linearResults,
      topsis: topsisResults,
    };

    log(`matchExtended: Top1: ${directionRanking[0]?.directionName}, Top2: ${directionRanking[1]?.directionName}, Top3: ${directionRanking[2]?.directionName}`);

    return {
      profile,
      directionRanking,
      tracks,
      needsAIReview: needsAI,
      generatedAt: Date.now(),
    };
  } catch (err) {
    logWarn('matchExtended 失败:', err.message);
    return {
      profile,
      directionRanking: [],
      tracks: { linear: [], topsis: [] },
      needsAIReview: false,
      generatedAt: Date.now(),
    };
  }
}
