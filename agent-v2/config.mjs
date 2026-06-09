// ============================================================
// agent-v2/config.js — 集中配置（唯一来源）
// 修改任何"魔法数字"只改这里
// ============================================================

/** 本地开发端口 */
export const PORT = 8101;

/** DeepSeek API */
export const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
export const DEEPSEEK_MODEL = 'deepseek-chat';
export const API_TIMEOUT_MS = 30000;

/** 轮次限制 */
export const MAX_TOTAL_TURNS = 16;     // 4 阶段 × 平均 4 轮

/** LLM 参数 */
export const DEFAULT_TEMPERATURE = 0.7;
export const MAX_TOKENS = 1024;

/** Follow-up 补全调用参数 */
export const FOLLOW_UP_TEMPERATURE = 0.8;
export const FOLLOW_UP_MAX_TOKENS = 1024;

/** 会话持久化文件（本地开发用，防止重启丢 session） */
export const SESSION_FILE = 'agent-v2-sessions.json';

// ============================================================
// API Key
// ============================================================

let _cachedKey = '';

export function getApiKey() {
  if (_cachedKey) return _cachedKey;
  _cachedKey = process.env.DEEPSEEK_API_KEY || globalThis.__DEEPSEEK_KEY__ || '';
  return _cachedKey;
}
