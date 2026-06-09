// ============================================================
// agent-v2/session.js — 会话管理（纯存储，零业务逻辑）
// 复用自旧版 agent/session.js，微调默认值
// ============================================================

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { SESSION_FILE } from './config.mjs';

// 内存存储 + 文件持久化（防止重启丢 session）
const STORE = new Map();

/**
 * 创建新会话
 * @param {object} opts
 * @param {string} [opts.systemPrompt] - 系统 Prompt
 * @param {object} [opts.profile] - 画像摘要
 * @returns {object} session 对象
 */
export function createSession(opts = {}) {
  const id = randomUUID();
  const sess = {
    id,
    status: 'active',           // active | completed
    phase: 1,
    phaseLabel: '',
    phaseTurns: 0,
    phaseDepth: null,           // shallow / adequate / deep
    collected: {},              // field → { value, depth }
    messages: [],
    profile: opts.profile || null,
    finalSummary: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // 注入 System Prompt（只在创建时发送一次）
  if (opts.systemPrompt) {
    sess.messages.push({ role: 'system', content: opts.systemPrompt });
  }

  STORE.set(id, sess);
  _persist(id, sess);
  return sess;
}

/**
 * 读取会话
 */
export function getSession(id) {
  let sess = STORE.get(id);
  if (!sess) {
    sess = _loadFromFile(id);
    if (sess) STORE.set(id, sess);
  }
  return sess || null;
}

/**
 * 向会话追加消息
 */
export function addMessage(id, role, content) {
  const s = getSession(id);
  if (!s) return null;
  s.messages.push({ role, content });
  s.updatedAt = Date.now();
  _persist(id, s);
  return s;
}

/**
 * 向会话追加带 tool_calls 的 assistant 消息
 */
export function addToolCalls(id, toolCalls) {
  const s = getSession(id);
  if (!s) return null;
  s.messages.push({ role: 'assistant', content: null, tool_calls: toolCalls });
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
  _persist(id, s);
  return s;
}

/**
 * 删除会话
 */
export function deleteSession(id) {
  STORE.delete(id);
  try {
    const all = _loadAll();
    delete all[id];
    writeFileSync(SESSION_FILE, JSON.stringify(all, null, 2));
  } catch { /* ignore */ }
}

// ---- 内部：文件持久化 ----

function _persist(id, sess) {
  try {
    const all = _loadAll();
    all[id] = sess;
    writeFileSync(SESSION_FILE, JSON.stringify(all, null, 2));
  } catch { /* ignore */ }
}

function _loadFromFile(id) {
  try { return _loadAll()[id] || null; } catch { return null; }
}

function _loadAll() {
  if (!existsSync(SESSION_FILE)) return {};
  return JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
}
