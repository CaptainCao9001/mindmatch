// ============================================================
// M1: store.js — 数据总线（全流程唯一数据桥梁）
// 职责: localStorage 读写封装，含数据校验、完成追踪、测试模式
// 依赖: 无
// ============================================================

import { log, logWarn, logError } from './utils.js?v=20260602e';

// ---------- 常量 ----------
const STORAGE_PREFIX = 'mindmatch_';
const META_KEY = STORAGE_PREFIX + 'meta';
const VALID_GAME_IDS = ['game1', 'game2', 'game3', 'game4'];

// ---------- 后端抽象（默认 localStorage，支持测试模式注入） ----------
let _backend = null;

function getBackend() {
  if (_backend) return _backend;
  return localStorage;
}

/**
 * 内部: 校验 GameOutput 基本结构
 */
function validateGameOutput(data) {
  if (!data || typeof data !== 'object') {
    return '数据不是有效对象';
  }
  if (!data.version) {
    return '缺少 version 字段';
  }
  if (!data.dimensions || typeof data.dimensions !== 'object') {
    return '缺少 dimensions 字段';
  }
  if (!data.meta || typeof data.meta !== 'object') {
    return '缺少 meta 字段';
  }
  if (typeof data.meta.totalTime !== 'number') {
    return 'meta.totalTime 不是数字';
  }
  if (typeof data.meta.completedAt !== 'number') {
    return 'meta.completedAt 不是数字';
  }
  return null; // 校验通过
}

/**
 * 更新 meta 中的完成列表
 */
function updateMeta(gameId) {
  const backend = getBackend();
  let meta;
  try {
    const raw = backend.getItem(META_KEY);
    meta = raw ? JSON.parse(raw) : { userId: null, completedGames: [] };
  } catch {
    meta = { userId: null, completedGames: [] };
  }

  if (!meta.completedGames.includes(gameId)) {
    meta.completedGames.push(gameId);
    backend.setItem(META_KEY, JSON.stringify(meta));
  }
}

// ---------- 公开 API ----------

/**
 * 写入一个游戏的完整结果。写入前校验数据结构。
 * @param {"game1"|"game2"|"game3"|"game4"} gameId
 * @param {object} data - 符合 GameOutput 类型
 */
export function save(gameId, data) {
  if (!VALID_GAME_IDS.includes(gameId)) {
    throw new Error(`无效的 gameId: ${gameId}，必须为 ${VALID_GAME_IDS.join('|')}`);
  }

  const error = validateGameOutput(data);
  if (error) {
    throw new Error(`数据格式错误 (${gameId}): ${error}`);
  }

  const backend = getBackend();
  const key = STORAGE_PREFIX + gameId;

  // 在 data 中注入 gameId（如果缺失）
  if (!data.gameId) {
    data.gameId = gameId;
  }

  backend.setItem(key, JSON.stringify(data));
  updateMeta(gameId);
  log(`${gameId} 结果已保存`);
}

/**
 * 读取单个游戏结果。未完成返回 null。
 * @param {string} gameId
 * @returns {object|null}
 */
export function load(gameId) {
  const key = STORAGE_PREFIX + gameId;
  const backend = getBackend();
  const raw = backend.getItem(key);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    logWarn(`${gameId} 数据损坏，无法解析`);
    return null;
  }
}

/**
 * 读取全部四个游戏结果。缺失的返回 null。
 * @returns {{ game1: object|null, game2: object|null, game3: object|null, game4: object|null }}
 */
export function loadAll() {
  return {
    game1: load('game1'),
    game2: load('game2'),
    game3: load('game3'),
    game4: load('game4'),
  };
}

/**
 * 检查四个游戏是否全部完成。
 * @returns {boolean}
 */
export function hasAll() {
  return VALID_GAME_IDS.every(id => load(id) !== null);
}

/**
 * 清空所有 MindMatch 数据（包括 meta）。
 */
export function clear() {
  const backend = getBackend();
  VALID_GAME_IDS.forEach(id => {
    backend.removeItem(STORAGE_PREFIX + id);
  });
  backend.removeItem(META_KEY);
  log('所有 MindMatch 数据已清空');
}

/**
 * 获取当前已完成游戏数量。
 * @returns {number}
 */
export function completedCount() {
  const meta = readMeta();
  return meta.completedGames.length;
}

/**
 * 获取当前已完成的游戏 ID 列表。
 * @returns {string[]}
 */
export function completedGames() {
  const meta = readMeta();
  return [...meta.completedGames];
}

/**
 * 获取/设置 userId
 */
export function getUserId() {
  const meta = readMeta();
  return meta.userId;
}

export function setUserId(id) {
  const meta = readMeta();
  meta.userId = id;
  const backend = getBackend();
  backend.setItem(META_KEY, JSON.stringify(meta));
}

// ---------- 内部辅助 ----------

function readMeta() {
  const backend = getBackend();
  try {
    const raw = backend.getItem(META_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* fall through */ }
  return { userId: null, completedGames: [] };
}

// ---------- 职业对话数据 ----------

const CAREER_GUIDE_KEY = STORAGE_PREFIX + 'career_guide';

/**
 * 保存职业对话数据
 * @param {object} data - 包含 { state, collected, history, profileSummary, result }
 */
export function saveCareerGuide(data) {
  const backend = getBackend();
  try {
    const existing = loadCareerGuide() || {};
    const merged = { ...existing, ...data, updatedAt: Date.now() };
    backend.setItem(CAREER_GUIDE_KEY, JSON.stringify(merged));
  } catch {
    logWarn('保存职业对话数据失败');
  }
}

/**
 * 读取职业对话数据
 * @returns {object|null}
 */
export function loadCareerGuide() {
  const backend = getBackend();
  try {
    const raw = backend.getItem(CAREER_GUIDE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * 检查是否完成了全部4个游戏（G1-G4）
 * @returns {boolean}
 */
export function hasAllGameData() {
  const meta = readMeta();
  return meta && meta.completedGames &&
    meta.completedGames.includes('game1') &&
    meta.completedGames.includes('game2') &&
    meta.completedGames.includes('game3') &&
    meta.completedGames.includes('game4');
}

// ---------- 测试模式 ----------

/**
 * 注入自定义存储后端（测试页用，不污染真实 localStorage）
 * @param {Storage|Map} memoryMap - 实现 getItem/setItem/removeItem 接口的对象
 */
export function _setBackend(memoryMap) {
  _backend = memoryMap;
}

/**
 * 重置后端为默认 localStorage
 */
export function _resetBackend() {
  _backend = null;
}
