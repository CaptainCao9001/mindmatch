// ============================================================
// agent-v2/server.js — HTTP 入口（本地调试）
// ============================================================

import { createServer } from 'http';
import { handleChat } from './handler.mjs';
import { getApiKey } from './config.mjs';
import { PORT } from './config.mjs';
import * as session from './session.mjs';

function startLocalServer() {
  const server = createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // POST /api/agent/chat
    if (req.method === 'POST' && req.url === '/api/agent/chat') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { sessionId, message, profile } = JSON.parse(body);
          if (!message) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'message 必填' }));
            return;
          }
          const result = await handleChat(sessionId, message, profile);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // GET /health
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', hasKey: !!getApiKey(), version: 'v2' }));
      return;
    }

    // GET /api/agent/session/:id — 调试端点
    if (req.method === 'GET' && req.url.startsWith('/api/agent/session/')) {
      const id = req.url.split('/').pop();
      const sess = session.getSession(id);
      if (!sess) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '会话不存在' }));
        return;
      }
      // 返回会话概览（不含完整 messages，避免过长）
      const { messages, ...meta } = sess;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...meta,
        messageCount: messages.length,
        recentMessages: messages.slice(-4).map(m => ({
          role: m.role,
          contentLength: (m.content || '').length,
          hasToolCalls: !!(m.tool_calls && m.tool_calls.length > 0),
        })),
      }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.listen(PORT, () => {
    console.log(`[Agent v2] 本地服务已启动 → http://localhost:${PORT}`);
    console.log(`[Agent v2] API Key: ${getApiKey() ? '已设置' : '❌ 未设置'}`);
    console.log(`[Agent v2] 健康检查: http://localhost:${PORT}/health`);
  });
}

export { startLocalServer };
