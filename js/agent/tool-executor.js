// ============================================================
// tool-executor.js — 前端工具执行器
// 接收 Agent Server 返回的 toolCalls → 映射到 renderer 方法
// ============================================================

/**
 * 执行 Agent 返回的工具调用
 * @param {Array} toolCalls - [{name, args, result}] 来自 agent server
 * @param {object} renderer - ChatRenderer 实例
 */
export function executeToolCalls(toolCalls, renderer) {
  if (!toolCalls || toolCalls.length === 0) return;

  for (const tc of toolCalls) {
    switch (tc.name) {
      case 'advance_phase': {
        const { phase, label } = tc.args;
        if (renderer.showProgress) {
          renderer.showProgress(phase, 7, label);
        }
        break;
      }
      case 'show_hint': {
        // 方向提示：在聊天区插入一个提示卡片
        if (renderer.addHint) {
          renderer.addHint(tc.args.direction, tc.args.hint);
        }
        break;
      }
      case 'save_collected':
        // 前端不需要处理，由 agent server 维护
        break;
    }
  }
}

/**
 * 获取 Agent Server URL（自动判断本地/线上环境）
 */
export function getAgentUrl() {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:8101/api/agent/chat';
  }
  // 线上：CloudBase SCF 云函数地址
  return 'https://mindmatch-d0gz847n4e29e3181.service.tcloudbase.com/agent/chat';
}

/**
 * 调用 Agent Server
 * @param {string|null} sessionId - 会话 ID（首次为 null）
 * @param {string} message - 用户输入
 * @param {object|null} profile - 画像摘要（首次传入）
 * @returns {object} {reply, toolCalls, phase, label, sessionId}
 */
export async function sendToAgent(sessionId, message, profile) {
  const url = getAgentUrl();

  const body = { message };
  if (sessionId) body.sessionId = sessionId;
  if (profile) body.profile = profile;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Agent server error: ${res.status}`);
  }

  return res.json();
}
