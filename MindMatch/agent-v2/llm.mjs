// ============================================================
// agent-v2/llm.js — DeepSeek API 调用封装
// 从旧版 agent-server.js 提取 callDeepSeek + tryFollowUp
// ============================================================

import {
  DEEPSEEK_URL, DEEPSEEK_MODEL, API_TIMEOUT_MS,
  HUNYUAN_URL, HUNYUAN_MODEL,
  DEFAULT_TEMPERATURE, MAX_TOKENS,
  FOLLOW_UP_TEMPERATURE, FOLLOW_UP_MAX_TOKENS,
} from './config.mjs';

/**
 * 调用 DeepSeek API
 * @param {object} opts
 * @param {Array} opts.messages - 消息历史
 * @param {Array} opts.tools - 工具列表（DeepSeek function calling 格式）
 * @param {string} opts.apiKey
 * @param {object} [opts.modelParams] - 覆盖默认模型参数
 * @returns {Promise<{reply: string, rawToolCalls: Array}|{error: string, errorCode: string}>}
 */
export async function callDeepSeek(opts) {
  const { messages, tools, apiKey, modelParams } = opts;
  const requestBody = {
    model: modelParams?.model || DEEPSEEK_MODEL,
    messages,
    tools: tools || [],
    tool_choice: tools ? 'auto' : undefined,
    temperature: modelParams?.temperature || DEFAULT_TEMPERATURE,
    max_tokens: modelParams?.max_tokens || MAX_TOKENS,
  };

  // 移除 undefined 字段
  Object.keys(requestBody).forEach(k => requestBody[k] === undefined && delete requestBody[k]);

  let response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[LLM] API 错误 ${response.status}: ${errText.slice(0, 200)}`);
      return { error: `API 错误 ${response.status}`, errorCode: `API_${response.status}` };
    }
  } catch (err) {
    console.error('[LLM] 网络错误:', err.message);
    const errorCode = err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
    return { error: err.message, errorCode };
  }

  // 解析响应
  let data;
  try {
    data = await response.json();
  } catch (e) {
    console.error('[LLM] JSON 解析失败:', e.message);
    return { error: 'JSON 解析失败', errorCode: 'JSON_PARSE' };
  }

  const choice = data.choices?.[0];
  if (!choice) {
    console.error('[LLM] 无有效回复:', JSON.stringify(data).slice(0, 200));
    return { error: '无有效回复', errorCode: 'EMPTY_RESPONSE' };
  }

  const msg = choice.message;
  return {
    reply: msg.content || '',
    rawToolCalls: msg.tool_calls || [],
  };
}

/**
 * 调用混元 API（DeepSeek 故障时 fallback）
 * 混元不支持 function calling，仅用作基础对话 fallback
 * @param {object} opts
 * @param {Array} opts.messages - 消息历史
 * @param {string} opts.apiKey
 * @returns {Promise<{reply: string, rawToolCalls: Array}>}
 */
export async function callHunyuan(opts) {
  const { messages, apiKey } = opts;

  // 转换为纯文本消息（移除 tool_calls 等 DeepSeek 特有字段）
  const plainMessages = messages.map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : (m.content || '').toString(),
  }));

  const requestBody = {
    model: HUNYUAN_MODEL,
    messages: plainMessages,
    temperature: DEFAULT_TEMPERATURE,
    max_tokens: MAX_TOKENS,
  };

  console.log(`[LLM]  DeepSeek 失败，fallback 到混元 (${HUNYUAN_MODEL})`);

  let response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    response = await fetch(HUNYUAN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[LLM] 混元 API 错误 ${response.status}: ${errText.slice(0, 200)}`);
      return { error: `混元 API 错误 ${response.status}`, errorCode: `HY_${response.status}` };
    }
  } catch (err) {
    console.error('[LLM] 混元网络错误:', err.message);
    return { error: err.message, errorCode: 'HY_NETWORK' };
  }

  let data;
  try {
    data = await response.json();
  } catch (e) {
    return { error: '混元 JSON 解析失败', errorCode: 'HY_JSON' };
  }

  const choice = data.choices?.[0];
  if (!choice) {
    return { error: '混元无有效回复', errorCode: 'HY_EMPTY' };
  }

  const msg = choice.message;
  return {
    reply: msg.content || '',
    rawToolCalls: [],
  };
}

/**
 * Follow-up 调用（补全短回复）
 * 当 AI 调了工具但文字回复过短/为空时，再次调用让 AI 补全
 * @param {Array} messages - 原始消息历史
 * @param {object} context - { phase, phaseLabel, collected, recentQuestions }
 * @param {string} apiKey
 * @returns {Promise<{reply: string}|null>}
 */
export async function callFollowUp(messages, context, apiKey) {
  const { phase, phaseLabel, collected, recentQuestions } = context;

  const collectedStr = Object.entries(collected || {})
    .filter(([, v]) => v && v.value && typeof v.value === 'string' && v.value.trim())
    .map(([k, v]) => `${k}=${v.value}`)
    .join('，') || '暂无';

  const followUpMessages = [
    {
      role: 'system',
      content: `你刚才的回复太短或为空。请立刻生成一个完整回复（≥30字）：
【当前阶段】${phase}（${phaseLabel}）
【已收集】${collectedStr}
【你最近问过】${recentQuestions.slice(0, 3).join(' / ') || '无'}
【硬性规则】你的回复必须包含至少一个明确的问题（以"？"结尾）。分析/回应之后必须接问句，否则不合格。
【要求】回复 = 对用户的回应（1句）+ 具体追问（1句，必须带"？"）。禁止说"了解了""好的""继续聊"。`,
    },
    ...messages,
  ];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: followUpMessages,
        temperature: FOLLOW_UP_TEMPERATURE,
        max_tokens: FOLLOW_UP_MAX_TOKENS,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const data = await response.json();
      const msg = data.choices?.[0]?.message;
      if (msg?.content) {
        return { reply: msg.content };
      }
    }
  } catch {
    // fall through
  }

  return null;
}
