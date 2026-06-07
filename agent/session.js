// ============================================================
// agent/session.js — 会话管理（本地：内存 + JSON；线上：CloudBase DB）
// ============================================================

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';

// 本地存储文件（线上切换为 CloudBase DB 集合）
const LOCAL_STORE = new Map();
const LOCAL_FILE = 'agent-sessions.json'; // 本地开发启用文件持久化，防止重启丢 session

/**
 * 创建新会话
 * @param {object} opts
 * @param {string} [opts.systemPrompt] - 系统 Prompt
 * @param {object} [opts.profile] - 画像摘要
 * @returns {object} session 对象
 */
export function createSession(opts = {}) {
  const id = randomUUID();
  const session = {
    id,
    state: 'START',
    status: 'active',          // active | completed
    phase: 1,
    phaseLabel: '现状了解',
    phaseTurns: 0,
    maxPhaseTurns: 4,          // 每阶段最多 4 轮
    phaseDepth: null,          // 当前阶段深度 shallow/adequate/deep
    collected: {},
    hints: [],
    messages: [],
    profile: opts.profile || null,
    finalSummary: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // 注入 System Prompt（只在创建时发送一次）
  if (opts.systemPrompt) {
    session.messages.push({ role: 'system', content: opts.systemPrompt });
  }

  LOCAL_STORE.set(id, session);
  _saveToFile(id, session);
  return session;
}

/**
 * 读取会话
 */
export function getSession(id) {
  let session = LOCAL_STORE.get(id);
  if (!session && LOCAL_FILE) {
    session = _loadFromFile(id);
    if (session) LOCAL_STORE.set(id, session);
  }
  return session || null;
}

/**
 * 向会话追加消息
 */
export function addMessage(id, role, content) {
  const s = getSession(id);
  if (!s) return null;

  s.messages.push({ role, content });
  s.updatedAt = Date.now();
  _saveToFile(id, s);
  return s;
}

/**
 * 向会话追加带 tool_calls 的消息
 */
export function addToolCalls(id, toolCalls) {
  const s = getSession(id);
  if (!s) return null;

  // 追加 assistant 消息（含 tool_calls）
  s.messages.push({
    role: 'assistant',
    content: null,
    tool_calls: toolCalls,
  });
  s.updatedAt = Date.now();
  return s;
}

/**
 * 追加工具执行结果
 */
export function addToolResult(id, toolCallId, result) {
  const s = getSession(id);
  if (!s) return null;

  s.messages.push({
    role: 'tool',
    tool_call_id: toolCallId,
    content: typeof result === 'string' ? result : JSON.stringify(result),
  });
  s.updatedAt = Date.now();
  return s;
}

/**
 * 更新会话元数据（phase / collected 等）
 */
export function updateSession(id, updates) {
  const s = getSession(id);
  if (!s) return null;

  Object.assign(s, updates);
  s.updatedAt = Date.now();
  _saveToFile(id, s);
  return s;
}

/**
 * 删除会话
 */
export function deleteSession(id) {
  LOCAL_STORE.delete(id);
  if (LOCAL_FILE) {
    try {
      const all = _loadAll();
      delete all[id];
      writeFileSync(LOCAL_FILE, JSON.stringify(all, null, 2));
    } catch { /* ignore */ }
  }
}

// ---- 内部 ----

function _saveToFile(id, session) {
  if (!LOCAL_FILE) return;
  try {
    const all = _loadAll();
    all[id] = { id, state: session.state, status: session.status, phase: session.phase, phaseLabel: session.phaseLabel, phaseTurns: session.phaseTurns, maxPhaseTurns: session.maxPhaseTurns, phaseDepth: session.phaseDepth, collected: session.collected, hints: session.hints, messages: session.messages, profile: session.profile, finalSummary: session.finalSummary, updatedAt: session.updatedAt };
    writeFileSync(LOCAL_FILE, JSON.stringify(all, null, 2));
  } catch { /* ignore */ }
}

function _loadFromFile(id) {
  try { return _loadAll()[id] || null; } catch { return null; }
}

function _loadAll() {
  if (!existsSync(LOCAL_FILE)) return {};
  return JSON.parse(readFileSync(LOCAL_FILE, 'utf-8'));
}
