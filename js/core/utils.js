// ============================================================
// M3: utils.js — 通用工具函数
// 职责: 纯函数集合，所有模块均可使用，零依赖
// ============================================================

/**
 * 范围映射: 将 value 从 [inMin, inMax] 映射到 [outMin, outMax]
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  const clamped = clamp(value, inMin, inMax);
  return outMin + ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/**
 * 归一化到 [0, 1]: value 原范围 [min, max]
 */
export function normalize(value, min, max) {
  const clamped = clamp(value, min, max);
  return (clamped - min) / (max - min);
}

/**
 * 夹紧到 [min, max] 区间
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * 分段线性映射——高分段用 (期望高分)
 * score: [0, 10] → output: [0, 1]
 */
export function piecewiseHigh(score) {
  if (score >= 7) return 1.0;
  if (score >= 4) return (score - 4) / 3;  // [0, 1]
  return 0.0;
}

/**
 * 分段线性映射——低分段用 (期望低分)
 * score: [0, 10] → output: [0, 1]
 */
export function piecewiseLow(score) {
  if (score <= 3) return 1.0;
  if (score <= 6) return (6 - score) / 3;  // [0, 1]
  return 0.0;
}

/**
 * 分段线性映射——中间最优 (期望中值)
 * score: [0, 10] → output: [0, 1]
 */
export function piecewiseMid(score) {
  const clamped = clamp(score, 0, 10);
  return clamp(1.0 - Math.abs(clamped - 5) / 5, 0, 1);
}

/**
 * 加权平均
 */
export function weightedMean(values, weights) {
  if (values.length !== weights.length || values.length === 0) return 0;
  const sum = weightedSum(values, weights);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  return weightSum === 0 ? 0 : sum / weightSum;
}

/**
 * 加权求和
 */
export function weightedSum(values, weights) {
  if (values.length !== weights.length) return 0;
  return values.reduce((acc, v, i) => acc + v * (weights[i] || 0), 0);
}

/**
 * 欧氏距离
 */
export function euclideanDistance(a, b) {
  if (a.length !== b.length) return NaN;
  const sum = a.reduce((acc, ai, i) => acc + (ai - b[i]) ** 2, 0);
  return Math.sqrt(sum);
}

/**
 * 数组最大值索引
 */
export function argmax(arr) {
  if (!arr || arr.length === 0) return -1;
  let maxIdx = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > arr[maxIdx]) maxIdx = i;
  }
  return maxIdx;
}

/**
 * 数组最小值索引
 */
export function argmin(arr) {
  if (!arr || arr.length === 0) return -1;
  let minIdx = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[minIdx]) minIdx = i;
  }
  return minIdx;
}

/**
 * 简洁的日志输出（可通过 LOG_LEVEL 控制）
 * 'silent' = 不输出  'warn' = 仅 warn/error  'verbose' = 全部
 */
let _logLevel = 'verbose';

export function setLogLevel(level) {
  _logLevel = level;
}

export function log(...args) {
  if (_logLevel === 'verbose') {
    console.log('[MindMatch]', ...args);
  }
}

export function logWarn(...args) {
  if (_logLevel !== 'silent') {
    console.warn('[MindMatch]', ...args);
  }
}

export function logError(...args) {
  console.error('[MindMatch]', ...args);
}
