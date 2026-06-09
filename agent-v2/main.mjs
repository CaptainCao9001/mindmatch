// ============================================================
// agent-v2/main.js — 启动入口
// 检测运行环境：本地 → HTTP Server，SCF → 导出 main_handler
// ============================================================

import { startLocalServer } from './server.mjs';

// 全局错误捕获
process.on('unhandledRejection', (err) => {
  console.error('[Agent v2] Unhandled Rejection:', err?.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('[Agent v2] Uncaught Exception:', err?.message || err);
});

// 环境检测
const isSCF = !!process.env.TENCENTCLOUD_RUNENV || !!process.env.SCF_RUNTIME;

if (!isSCF) {
  startLocalServer();
} else {
  console.log('[Agent v2] 运行在 SCF 环境中，等待请求...');
}
