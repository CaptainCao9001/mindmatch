// ============================================================
// M14: integrator.js — 数据整合层
// 职责: 从 store 读取 G1-G4 → 标准化到 [0,1] → 输出统一 profile
//       支持部分完成（未完成的维度为 null）
// 依赖: js/core/store.js, js/core/utils.js
// ============================================================

import { loadAll, completedGames, getUserId } from '../core/store.js?v=20260602e';
import { log } from '../core/utils.js?v=20260602e';

// ---------- G1 维度定义 ----------
const G1_DIMS = ['nAch', 'nPow', 'nAff'];
// G1 原始范围 [0, 10] → 标准化 x/10

// ---------- G2 维度定义 ----------
const G2_DIMS = ['TF', 'GM', 'AU', 'SE', 'EC', 'SV', 'CH', 'LS'];
// G2 原始范围 [0, 10] → 标准化 x/10

// ---------- G3 维度定义 ----------
const G3_DIMS = ['wholistAnalytic'];
// G3 原始范围 [-1, +1] → 标准化 (x+1)/2

// ---------- G4 维度定义 ----------
const G4_DIMS = ['presence', 'search'];
// G4 原始范围 [0, 10] → 标准化 x/10

// ---------- 所有维度 ID ----------
const ALL_DIMS = [...G1_DIMS, ...G2_DIMS, ...G3_DIMS, ...G4_DIMS];

/**
 * 初始化全 null 的维度对象
 */
function initNullDims(dims) {
  const obj = {};
  dims.forEach(d => { obj[d] = null; });
  return obj;
}

/**
 * 标准化 G1/G2/G4 维度: raw [0, 10] → [0, 1]
 */
function normalize01(raw) {
  return Math.max(0, Math.min(1, raw / 10));
}

/**
 * 标准化 G3 维度: raw [-1, +1] → [0, 1]
 */
function normalizeWA(raw) {
  return Math.max(0, Math.min(1, (raw + 1) / 2));
}

/**
 * 核心函数: 读取全部游戏数据，标准化，输出统一 profile
 * 始终返回 UnifiedProfile，未完成的维度为 null
 * @returns {UnifiedProfile}
 */
export function integrate() {
  const data = loadAll();
  const completed = completedGames();

  // 初始化全 null
  const dimensions = initNullDims(ALL_DIMS);
  const raw = initNullDims(ALL_DIMS);

  let totalDuration = 0;

  // ---- G1 ----
  if (data.game1) {
    G1_DIMS.forEach(dim => {
      const val = data.game1.dimensions[dim];
      if (val != null) {
        raw[dim] = val;
        dimensions[dim] = normalize01(val);
      }
    });
    totalDuration += data.game1.meta.totalTime;
  }

  // ---- G2 ----
  if (data.game2) {
    G2_DIMS.forEach(dim => {
      const val = data.game2.dimensions[dim];
      if (val != null) {
        raw[dim] = val;
        dimensions[dim] = normalize01(val);
      }
    });
    totalDuration += data.game2.meta.totalTime;
  }

  // ---- G3 ----
  if (data.game3) {
    G3_DIMS.forEach(dim => {
      const val = data.game3.dimensions[dim];
      if (val != null) {
        raw[dim] = val;
        dimensions[dim] = normalizeWA(val);
      }
    });
    totalDuration += data.game3.meta.totalTime;
  }

  // ---- G4 ----
  if (data.game4) {
    G4_DIMS.forEach(dim => {
      const val = data.game4.dimensions[dim];
      if (val != null) {
        raw[dim] = val;
        dimensions[dim] = normalize01(val);
      }
    });
    totalDuration += data.game4.meta.totalTime;
  }

  const profile = {
    userId: getUserId(),
    generatedAt: Date.now(),
    dimensions,
    raw,
    meta: {
      totalDuration,
      completedGames: completed,
      completedCount: completed.length,
      allCompleted: completed.length === 4,
    },
  };

  log(`integrator: 完成 ${completed.length}/4 游戏，已标准化 ${ALL_DIMS.length} 维`);
  return profile;
}

/**
 * 获取维度原始值的快捷方法
 * 用于 translator 按分档匹配文案
 */
export function getRawScore(profile, dimId) {
  return profile.raw[dimId];
}
