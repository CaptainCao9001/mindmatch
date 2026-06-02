// ============================================================
// MindMatch 云函数 API 代理
// 部署: 腾讯云 CloudBase 云函数 (HTTP 触发器)
// 用途: 作为 HTTPS 代理，转发前端请求到混元/DeepSeek API
//
// API Key 策略（优先级从高到低）：
//   1. 请求体中传入的 apiKey（向后兼容，用于本地开发）
//   2. 环境变量 HUNYUAN_API_KEY / DEEPSEEK_API_KEY（生产环境）
//   3. 都没有 → 返回 400 错误
//
// 本地开发: body 中传 apiKey
// 生产环境: 在 SCF 控制台设置 HUNYUAN_API_KEY 环境变量
// ============================================================

const PROVIDERS = {
  hunyuan: {
    endpoint: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
    defaultModel: 'hunyuan-lite',
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
  },
};

const TIMEOUT_MS = 30000;

/**
 * CloudBase 云函数入口（HTTP 触发器）
 */
exports.main = async (event, context) => {
  // 获取 HTTP 请求信息
  const { body: rawBody, httpMethod, path } = event;

  // CORS 处理
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: '',
    };
  }

  // 健康检查（同时暴露环境状态）
  if (httpMethod === 'GET' && path === '/health') {
    return {
      statusCode: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'ok',
        env: 'cloud-function',
        ts: Date.now(),
        providers: {
          hunyuan: !!process.env.HUNYUAN_API_KEY,
          deepseek: !!process.env.DEEPSEEK_API_KEY,
        },
      }),
    };
  }

  // 主 API 代理
  if (httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  } catch {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { provider = 'hunyuan', model, prompt, temperature = 0.7, maxTokens = 1024, apiKey: bodyApiKey } = body;

  // API Key 优先级：请求体 > 环境变量
  const apiKey = bodyApiKey || (provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.HUNYUAN_API_KEY);

  if (!apiKey) {
    console.error('[cloud-proxy] 缺少 API Key：请求体未传且环境变量未设置');
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: '服务器未配置 API Key，请联系管理员' }) };
  }

  if (!prompt) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: '缺少 prompt' }) };
  }

  const cfg = PROVIDERS[provider] || PROVIDERS.hunyuan;
  const payload = {
    model: model || cfg.defaultModel,
    messages: [{ role: 'user', content: prompt }],
    temperature: temperature || 0.7,
    max_tokens: maxTokens || 1024,
  };

  console.log(`[cloud-proxy] → ${provider}/${payload.model} (${prompt.length} chars)`);

  try {
    const apiRes = await fetchWithTimeout(cfg.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    }, TIMEOUT_MS);

    const data = await apiRes.json();

    if (!apiRes.ok) {
      console.log(`[cloud-proxy] ← ${provider} HTTP ${apiRes.status}:`, data.error?.message || 'unknown');
      return {
        statusCode: apiRes.status,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: data.error?.message || `HTTP ${apiRes.status}` }),
      };
    }

    const content = data.choices?.[0]?.message?.content;
    if (content) {
      console.log(`[cloud-proxy] ← ${provider} OK (${content.length} chars)`);
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    };
  } catch (err) {
    console.error(`[cloud-proxy] ERROR:`, err.message);
    return {
      statusCode: 502,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};

// -- 工具函数 -------------------------------------------------

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

/**
 * 带超时的 fetch
 */
function fetchWithTimeout(url, options, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ETIMEDOUT')), timeout);
    fetch(url, options)
      .then(res => { clearTimeout(timer); resolve(res); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}
