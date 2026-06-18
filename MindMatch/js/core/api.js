// ============================================================
// M2: api.js — LLM 调用封装
// 职责: 混元（主）+ DeepSeek（备）API 调用，超时保护，优雅降级
// 环境适配:
//   - 开发 (localhost):   本地 proxy (port 8100)，apiKey 从 localStorage 传入
//   - 生产 (CloudBase 等): CloudBase 云函数 proxy，apiKey 从环境变量读取
//   用户无需在客户端配置 Key，打开页面即可使用 AI 功能
// ============================================================

import { log, logWarn, logError } from './utils.js?v=20260603b';

// ---------- 环境检测 ----------
const _isLocalhost = typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

// 根据部署域自动推导云函数 URL
function _autoDetectCloudFunctionUrl() {
  if (_isLocalhost) return '';
  const host = location.hostname;
  // CloudBase 域名: mindmatch-d0gz847n4e29e3181-1438477634.tcloudbaseapp.com
  // 对应云函数: https://mindmatch-d0gz847n4e29e3181.service.tcloudbase.com/proxy
  const match = host.match(/^([a-zA-Z0-9-]+)-\d+\.tcloudbaseapp\.com$/);
  if (match) {
    return `https://${match[1]}.service.tcloudbase.com/proxy`;
  }
  // CloudStudio / 其他沙箱域名 → fallback 到 CloudBase 云函数
  return 'https://mindmatch-d0gz847n4e29e3181.service.tcloudbase.com/proxy';
}

// ---------- 配置 ----------
const DEFAULT_TIMEOUT = 10000;

let _config = {
  hunyuanKey: null,
  deepseekKey: null,
  hunyuanEndpoint: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
  deepseekEndpoint: 'https://api.deepseek.com/v1/chat/completions',
  // 本地开发走 localhost proxy
  proxyUrl: 'http://localhost:8100/api/chat',
  // 生产环境：CloudBase 云函数代理地址（部署后自动填入）
  cloudFunctionUrl: _autoDetectCloudFunctionUrl(),
  useProxy: true, // 统一走代理（不管本地还是云端）
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
    const cfUrl = localStorage.getItem('mindmatch_cf_url');
    if (cfUrl && !_config.cloudFunctionUrl) _config.cloudFunctionUrl = cfUrl;
  } catch { /* ignore */ }
}

/**
 * 通过代理调用 API（本地 proxy 或云函数）
 * 自动选择: 云端 → cloudFunctionUrl, 本地 → proxyUrl
 *
 * API Key 策略:
 *   - 本地模式: apiKey 从 localStorage 读取，随请求体发送
 *   - 云端模式: apiKey 不发送，由云函数从环境变量 HUNYUAN_API_KEY 读取
 */
async function _callViaProxy(provider, model, prompt, temperature, maxTokens, timeout) {
  // 云端用云函数，本地用 localhost proxy
  const proxyUrl = _isLocalhost ? _config.proxyUrl : (_config.cloudFunctionUrl || _config.proxyUrl);
  if (!proxyUrl) {
    logWarn('未配置代理 URL，无法调用 API');
    return null;
  }

  // 构建请求体
  const body = { provider, model, prompt, temperature, maxTokens };

  // 本地模式: 需要传 apiKey（从 localStorage 读取）
  if (_isLocalhost) {
    loadKeysFromStorage();
    const apiKey = provider === 'hunyuan' ? _config.hunyuanKey : _config.deepseekKey;
    if (!apiKey) return null;
    body.apiKey = apiKey;
  }
  // 云端模式: 不传 apiKey，云函数从环境变量读取

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      logWarn(`代理调用失败 (${provider}): ${err.error || response.status}`);
      return null;
    }

    const data = await response.json();
    return data.content || null;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      logWarn(`代理调用超时 (${provider}, ${timeout}ms)`);
    } else {
      logError(`代理调用错误 (${provider}):`, err.message);
    }
    return null;
  }
}

/**
 * 通过云函数代理调用（快捷方式）
 * @deprecated 已合并到 _callViaProxy，通过 cloudFunctionUrl 配置
 */
async function _callViaCloudFunction(provider, model, prompt, temperature, maxTokens, timeout) {
  if (!_config.cloudFunctionUrl) return null;
  return _callViaProxy(provider, model, prompt, temperature, maxTokens, timeout);
}

/**
 * 直连 API 调用（Node.js 环境 / 无 CORS 限制时使用）
 */
async function _callDirect(endpoint, apiKey, model, prompt, temperature, maxTokens, timeout) {
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
      const errBody = await response.json().catch(() => ({}));
      const errMsg = errBody.error?.message || errBody.error?.code || `HTTP ${response.status}`;
      logWarn(`API 直连失败 (${model}): ${errMsg}`);
      return null;
    }

    const data = await response.json();

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
  try {
    const keys = {
      hunyuanKey: _config.hunyuanKey,
      deepseekKey: _config.deepseekKey,
    };
    localStorage.setItem('mindmatch_api_keys', JSON.stringify(keys));
  } catch { /* ignore */ }
  log('API 配置已更新');
}

/**
 * 设置单个 API Key
 */
export function setApiKey(service, key) {
  if (service === 'hunyuan') {
    _config.hunyuanKey = key;
  } else if (service === 'deepseek') {
    _config.deepseekKey = key;
  }
  try {
    const keys = {
      hunyuanKey: _config.hunyuanKey,
      deepseekKey: _config.deepseekKey,
    };
    localStorage.setItem('mindmatch_api_keys', JSON.stringify(keys));
  } catch { /* ignore */ }
}

/**
 * 设置生产环境云函数代理地址
 * @param {string} url - 云函数 HTTP 触发器 URL
 */
export function setCloudFunctionUrl(url) {
  _config.cloudFunctionUrl = url;
  _config.useProxy = true;
  try {
    localStorage.setItem('mindmatch_cf_url', url);
  } catch { /* ignore */ }
}

/**
 * 获取当前环境信息
 */
export function getEnvironment() {
  return {
    isLocalhost: _isLocalhost,
    mode: 'proxy',
    proxyUrl: (_isLocalhost ? _config.proxyUrl : _config.cloudFunctionUrl) || '',
    localProxyUrl: _config.proxyUrl,
    cloudFunctionUrl: _config.cloudFunctionUrl,
    // 本地模式：检查 localStorage；云端模式：Key 在服务器端，无需客户端关注
    keySource: _isLocalhost ? 'localStorage' : 'server-env',
    hasHunyuanKey: _isLocalhost ? !!_config.hunyuanKey : true,
    hasDeepseekKey: _isLocalhost ? !!_config.deepseekKey : true,
  };
}

/**
 * 调用混元 API
 */
export async function callHunyuan(prompt, options = {}) {
  loadKeysFromStorage();

  const {
    temperature = 0.7,
    maxTokens = 1024,
    timeout = _config.timeout,
  } = options;

  if (_config.useProxy) {
    return _callViaProxy('hunyuan', 'hunyuan-lite', prompt, temperature, maxTokens, timeout);
  }
  return _callDirect(
    _config.hunyuanEndpoint, _config.hunyuanKey,
    'hunyuan-lite', prompt, temperature, maxTokens, timeout
  );
}

/**
 * 调用 DeepSeek API
 */
export async function callDeepseek(prompt, options = {}) {
  loadKeysFromStorage();

  const {
    temperature = 0.7,
    maxTokens = 1024,
    timeout = _config.timeout,
  } = options;

  if (_config.useProxy) {
    return _callViaProxy('deepseek', 'deepseek-chat', prompt, temperature, maxTokens, timeout);
  }
  return _callDirect(
    _config.deepseekEndpoint, _config.deepseekKey,
    'deepseek-chat', prompt, temperature, maxTokens, timeout
  );
}

/**
 * 带降级的调用：主 provider 失败 → 自动尝试备选
 *
 * @param {string} prompt
 * @param {object} options
 * @param {string} [options.preferredProvider='hunyuan'] — 'hunyuan' 或 'deepseek'，指定主 provider
 */
export async function callWithFallback(prompt, options = {}) {
  loadKeysFromStorage();

  const { preferredProvider = 'hunyuan' } = options;

  // 主 provider
  const primaryFn = preferredProvider === 'deepseek' ? callDeepseek : callHunyuan;
  const fallbackFn = preferredProvider === 'deepseek' ? callHunyuan : callDeepseek;
  const primaryName = preferredProvider === 'deepseek' ? 'DeepSeek' : '混元';
  const fallbackName = preferredProvider === 'deepseek' ? '混元' : 'DeepSeek';

  const primaryResult = await primaryFn(prompt, options);
  if (primaryResult !== null) {
    return primaryResult;
  }

  log(`${primaryName} 不可用，尝试 ${fallbackName} 降级...`);

  const fallbackResult = await fallbackFn(prompt, options);
  if (fallbackResult !== null) {
    log(`已降级到 ${fallbackName}`);
  } else {
    logWarn('所有 API 均不可用');
  }

  return fallbackResult;
}

/**
 * 测试代理连接
 * 云端: 调用 /proxy/health 检查云函数 + API Key 配置状态
 * 本地: 调用 localhost:8100/health
 */
export async function testProxyHealth() {
  const proxyUrl = _isLocalhost
    ? _config.proxyUrl.replace('/api/chat', '/health')
    : _config.cloudFunctionUrl
      ? (_config.cloudFunctionUrl + '/health')
      : _config.proxyUrl.replace('/api/chat', '/health');

  try {
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'ok') {
        // 云端模式：额外检查 providers 状态
        if (!_isLocalhost && data.providers) {
          return data.providers.hunyuan || data.providers.deepseek;
        }
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
