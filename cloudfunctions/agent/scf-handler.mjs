// ============================================================
// agent-v2/scf-handler.js — 腾讯云 CloudBase SCF 入口
// ============================================================

import { handleChat } from './handler.mjs';

/**
 * CloudBase SCF 入口
 * @param {object} event - SCF 事件对象 {body: "{\"sessionId\":\"...\",\"message\":\"...\"}"}
 * @param {object} context
 */
export async function main_handler(event, context) {
  try {
    const { sessionId, message, profile } = JSON.parse(event.body || '{}');
    if (!message) {
      return { statusCode: 400, body: JSON.stringify({ error: 'message 必填' }) };
    }
    const result = await handleChat(sessionId, message, profile);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
