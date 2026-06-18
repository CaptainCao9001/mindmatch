// ============================================================
// tool-executor.js — 前端工具执行器（v2 适配）
// 接收 Agent Server 返回的 toolCalls → 映射到 renderer 方法
// v2: 总阶段数从 7 改为 4，删除 show_hint
// ============================================================

/** v2 总阶段数 */
const TOTAL_STAGES_V2 = 4;

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
          renderer.showProgress(phase, TOTAL_STAGES_V2, label);
        }
        break;
      }
      case 'save_collected':
        // 前端不需要处理，由 agent server 维护
        break;
      case 'finish_conversation':
        // 对话结束，前端可据此禁用输入框
        if (renderer.disableInput) {
          renderer.disableInput();
        }
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
  // 线上：CloudBase HTTP 访问服务 → agent 云函数
  return 'https://mindmatch-d0gz847n4e29e3181-1438477634.ap-shanghai.app.tcloudbase.com/agent';
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

  // 超时保护（70s，略长于 SCF 60s 超时）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 70000);

  const body = { message };
  if (sessionId) body.sessionId = sessionId;
  if (profile) body.profile = profile;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Agent server error: ${res.status}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
