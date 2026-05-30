// ============================================================
// M2: api.js — LLM 调用封装
// 职责: 混元（主）+ DeepSeek（备）API 调用，超时保护，优雅降级
// 依赖: 无（纯 fetch）
// ============================================================

import { log, logWarn, logError } from './utils.js';

// ---------- 配置 ----------
const DEFAULT_TIMEOUT = 10000;

let _config = {
  hunyuanKey: null,
  deepseekKey: null,
  hunyuanEndpoint: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
  deepseekEndpoint: 'https://api.deepseek.com/v1/chat/completions',
  timeout: DEFAULT_TIMEOUT,
};

// ---------- 内部：从 localStorage 读取已保存的 Key ----------
function loadKeysFromStorage() {
  try {
    const raw = localStorage.getItem('mindmatch_api_keys');
    if (raw) {
      const keys = JSON.parse(raw);
      if (keys.hunyuanKey && !_config.hunyuanKey) _config.hunyuanKey = keys.hunyuanKey;
      if (keys.deepseekKey && !_config.deepseekKey) _config.deepseekKey = keys.deepseekKey;
    }
  } catch { /* ignore */ }
}

/**
 * 通用 API 调用
 */
async function _callApi(endpoint, apiKey, model, prompt, temperature, maxTokens, timeout) {
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      logWarn(`API 调用失败 (${model}): HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();

    // OpenAI 兼容格式
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }

    logWarn(`API 响应格式异常 (${model})`);
    return null;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      logWarn(`API 调用超时 (${model}, ${timeout}ms)`);
    } else {
      logError(`API 网络错误 (${model}):`, err.message);
    }
    return null;
  }
}

// ---------- 公开 API ----------

/**
 * 初始化 API 配置
 * @param {object} config
 */
export function configure(config = {}) {
  _config = { ..._config, ...config };
  // 保存到 localStorage
  try {
    const keys = {
      hunyuanKey: _config.hunyuanKey,
      deepseekKey: _config.deepseekKey,
    };
    localStorage.setItem('mindmatch_api_keys', JSON.stringify(keys));
  } catch { /* ignore storage errors */ }
  log('API 配置已更新');
}

/**
 * 设置单个 API Key
 * @param {"hunyuan"|"deepseek"} service
 * @param {string} key
 */
export function setApiKey(service, key) {
  if (service === 'hunyuan') {
    _config.hunyuanKey = key;
  } else if (service === 'deepseek') {
    _config.deepseekKey = key;
  }
  // 持久化
  try {
    const keys = {
      hunyuanKey: _config.hunyuanKey,
      deepseekKey: _config.deepseekKey,
    };
    localStorage.setItem('mindmatch_api_keys', JSON.stringify(keys));
  } catch { /* ignore */ }
}

/**
 * 调用混元 API
 * @param {string} prompt
 * @param {object} [options]
 * @returns {Promise<string|null>}
 */
export async function callHunyuan(prompt, options = {}) {
  loadKeysFromStorage();

  const {
    temperature = 0.7,
    maxTokens = 1024,
    timeout = _config.timeout,
  } = options;

  return _callApi(
    _config.hunyuanEndpoint,
    _config.hunyuanKey,
    'hunyuan-lite',
    prompt,
    temperature,
    maxTokens,
    timeout
  );
}

/**
 * 调用 DeepSeek API
 * @param {string} prompt
 * @param {object} [options]
 * @returns {Promise<string|null>}
 */
export async function callDeepseek(prompt, options = {}) {
  loadKeysFromStorage();

  const {
    temperature = 0.7,
    maxTokens = 1024,
    timeout = _config.timeout,
  } = options;

  return _callApi(
    _config.deepseekEndpoint,
    _config.deepseekKey,
    'deepseek-chat',
    prompt,
    temperature,
    maxTokens,
    timeout
  );
}

/**
 * 带降级的调用：混元失败 → 自动尝试 DeepSeek
 * @param {string} prompt
 * @param {object} [options]
 * @returns {Promise<string|null>}
 */
export async function callWithFallback(prompt, options = {}) {
  loadKeysFromStorage();

  // 1. 优先混元
  const hunyuanResult = await callHunyuan(prompt, options);
  if (hunyuanResult !== null) {
    return hunyuanResult;
  }

  log('混元不可用，尝试 DeepSeek 降级...');

  // 2. 降级到 DeepSeek
  const deepseekResult = await callDeepseek(prompt, options);
  if (deepseekResult !== null) {
    log('已降级到 DeepSeek');
  } else {
    logWarn('所有 API 均不可用');
  }

  return deepseekResult;
}
