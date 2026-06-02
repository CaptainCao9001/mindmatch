// ============================================================
// API 代理服务器 - 解决浏览器 CORS 限制
// 浏览器 → localhost:8100 → 混元/DeepSeek API
// 使用: node server/proxy.js
// ============================================================

const http = require('http');

const PORT = 8100;
const TIMEOUT = 30000;

// -- 配置 ---------------------------------------------------
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

// -- 主逻辑 -------------------------------------------------
const server = http.createServer(async (req, res) => {
  // CORS 头 — 允许来自任意源的请求
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // OPTIONS 预检请求直接返回
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 健康检查
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
    return;
  }

  // API 代理
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      try {
        const { provider, model, prompt, temperature, maxTokens, apiKey } = JSON.parse(body);

        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '缺少 apiKey' }));
          return;
        }

        const cfg = PROVIDERS[provider] || PROVIDERS.hunyuan;
        const payload = {
          model: model || cfg.defaultModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: temperature || 0.7,
          max_tokens: maxTokens || 1024,
        };

        console.log(`[proxy] → ${provider} (${payload.model})`);

        const apiRes = await fetch(cfg.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(TIMEOUT),
        });

        const data = await apiRes.json();

        if (!apiRes.ok) {
          console.log(`[proxy] ← ${provider} HTTP ${apiRes.status}:`, data.error?.message || 'unknown');
          res.writeHead(apiRes.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: data.error?.message || `HTTP ${apiRes.status}` }));
          return;
        }

        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log(`[proxy] ← ${provider} OK (${content.length} chars)`);
        } else {
          console.log(`[proxy] ← ${provider} OK (no content?)`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content }));
      } catch (err) {
        console.error(`[proxy] ERROR: ${err.message}`);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`\n🚀 API 代理已启动: http://localhost:${PORT}`);
  console.log(`   健康检查: http://localhost:${PORT}/health`);
  console.log(`   代理地址: http://localhost:${PORT}/api/chat\n`);
  console.log('   可用 provider: hunyuan, deepseek\n');
  console.log('   按 Ctrl+C 停止\n');
});
