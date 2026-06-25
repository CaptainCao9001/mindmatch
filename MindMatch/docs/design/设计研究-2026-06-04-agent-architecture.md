# 设计研究：职业规划对话智能体云端架构

**研究目标**：为 MindMatch 搜索基于 DeepSeek Function Calling + 预置知识库的引导式对话 Agent 技术参考
**研究日期**：2026-06-04
**搜索范围**：DeepSeek 官方文档 × 3 篇 + 百度云教程 × 2 篇 + CSDN 实战 × 2 篇 + CloudBase 官方示例 × 1 = 8 个源

---

## 一、关键发现

### 发现 1：DeepSeek Function Calling 完全兼容 OpenAI 格式

DeepSeek Chat 支持标准的 `tools` 参数，与 OpenAI SDK 完全兼容。可直接用 `openai` npm 包对接。

```javascript
const response = await client.chat.completions.create({
  model: "deepseek-chat",
  messages: messages,
  tools: tools,           // 工具定义数组
  tool_choice: "auto"     // 让模型自行判断
});
```

**返回的 tool_calls 结构**：
```json
{
  "tool_calls": [{
    "id": "call_xxx",
    "function": {
      "name": "advance_phase",
      "arguments": "{\"phase\": 3, \"label\": \"内在驱动\"}"
    }
  }]
}
```

### 发现 2：SCF 无状态特性适合做 Agent Server

CloudBase SCF 每次调用独立，需要外部 DB 存 session。这正是我们需要的——前端发 sessionId + message，SCF 从 DB 恢复会话 → 调 DeepSeek → 更新 DB → 返回。

**CloudBase 有官方 deepseek-agent 模板**（`@cloudbase/aiagent-framework`），但当前用原生 API 调用更灵活。

### 发现 3：Tool 定义是最关键的工程设计

高质量的 tool 定义直接影响 AI 是否在正确时机调用。三大要点：

| 要点 | 说明 |
|------|------|
| **description 要精确** | 不说"更新进度"，说"在对话阶段推进到下一轮时调用，更新前端进度条显示" |
| **parameters 用 JSON Schema 约束** | 字段 `phase` 用 `enum: [1-7]` 限制；`label` 用 `enum: ["现状了解","经验盘点",...]` 预定义 |
| **strict 模式兜底** | `"strict": true` + `"additionalProperties": false` 防止 AI 即兴发挥多余字段 |

### 发现 4：多轮对话的标准回传方式

```
第1轮：user msg → DeepSeek → tool_calls
         ↓
    消息历史追加 assistant msg (含 tool_calls)
    + role:"tool" msg (含 tool_call_id + 执行结果)
         ↓
第2轮：DeepSeek → 基于 tool 结果生成最终文本回复
```

关键：**tool 结果必须用 `role: "tool"` + `tool_call_id` 回传**，让模型知道"我调用的工具已经返回结果了"。

---

## 二、可融入的创意（按优先级）

| 优先级 | 创意 | 来源 | 融入方式 |
|:---:|------|------|---------|
| **P0** | Function Calling 替代状态机硬编码推进 | DeepSeek 官方文档 | SCF 端定义 `advance_phase` tool，AI 自主判断何时过渡；SCF 保留 `MAX_PHASE_TURNS` 兜底 |
| **P0** | SCF + CloudBase DB 做 session 管理 | CloudBase 官方示例 | 前端发 `{sessionId, message}`；SCF 从 `agent_sessions` 集合读写 |
| **P1** | `save_collected` tool 让 AI 自主提取信息 | 结构化输出指南 | AI 每次回复时同时调用 `save_collected({field, value})`，替代 `_saveCurrentAnswer` 的硬编码逻辑 |
| **P1** | strict 模式 + enum 约束 | DeepSeek beta 文档 | `advance_phase` 的 `phase` 字段用 `enum` 限制值域 |
| **P2** | 消息去重（system prompt 只发送一次） | 多轮对话实践 | SCF 创建 session 时注入 system prompt，后续轮次只发用户新消息 |

---

## 三、应避免的问题

| 问题 | 来源 | 规避方法 |
|------|------|---------|
| **Tool 定义模糊导致不触发** | 百度云教程 | description 写清触发场景："当用户对当前话题的探索已足够深入，准备过渡到下一个话题时调用" |
| **arguments 解析失败** | CSDN 实战 | 始终用 `try-catch` 包裹 `JSON.parse(call.function.arguments)`，失败时忽略并继续 |
| **tool 结果不回传导致对话断裂** | 官方文档 | 每次 tool 调用后必须构造 `role:"tool"` 消息追加到历史 |
| **SCF 冷启动时 DB 连接慢** | CloudBase 经验 | 连接复用（在 handler 外创建 client），超时设 5s |

---

## 四、参考项目清单

| 项目 | URL | 评分 | 关键参考价值 |
|------|-----|:---:|------------|
| DeepSeek 官方 Function Calling 文档 | https://api-docs.deepseek.com/zh-cn/guides/function_calling/ | 20 | tools 定义格式、tool_calls 解析、strict 模式 |
| 百度云 Function Calling 深度解析 | https://cloud.baidu.com/article/3723418 | 18 | 多工具编排、并行调用、异步流式 |
| DeepSeek-V3 Agent 开发实战 | https://blog.csdn.net/weixin_52610848/article/details/152813069 | 15 | 函数描述精确化、参数格式规范 |
| 结构化输出三种方法对比 | https://htmlpage.cn/topics/ai/structured-output-and-schema-control | 17 | Function Calling vs JSON Mode 选型依据 |
| CloudBase deepseek-agent 模板 | https://gitee.com/TencentCloudBase/Cloudbase-Examples/tree/master/cloudrunfunctions/deepseek-agent | 16 | SCF Node.js Agent 架构、@cloudbase/aiagent-framework |
| DeepSeek Tool Calls（strict 模式）| https://api-docs.deepseek.com/zh-cn/guides/tool_calls | 19 | enum/anyOf/$ref 高级约束 |

---

## 五、实施方案摘要

### 五-[1] 新增文件

| 文件 | 行数 | 说明 |
|------|:---:|------|
| `agent/agent-server.js` | ~200 | SCF handler：接收请求 → 读 DB → 调 DeepSeek → 处理 tool_calls → 写 DB → 返回 |
| `agent/tools.js` | ~80 | 3 个 tool 定义：`advance_phase`、`save_collected`、`show_direction_hint` |
| `agent/prompt.js` | ~80 | System Prompt 构建（创建 session 时注入一次） |
| `agent/session.js` | ~60 | CloudBase DB 读写封装 |

### 五-[2] 修改文件

| 文件 | 变更 |
|------|------|
| `career-guide.html` | 去掉 state-machine + prompt-builder import → 改为纯 HTTP 调用 `/api/agent/chat` |
| `js/agent/tool-executor.js`（新增） | 收到 toolCalls → 映射到 `renderer.showProgress()` / `renderer.showHint()` |

### 五-[3] Tool 定义预览

```javascript
// agent/tools.js — 3 个 AI 可调用的工具

export const TOOLS = [{
  type: "function",
  function: {
    name: "advance_phase",
    strict: true,
    description: `推进到下一个对话阶段并更新进度条。
      当用户在当前话题的探索已足够深入，需要过渡到下一个话题时调用。
      例如：用户已充分说明了自己的经历，自然过渡到"内在驱动"话题。`,
    parameters: {
      type: "object",
      properties: {
        phase: { type: "number", enum: [1,2,3,4,5,6,7], description: "阶段号" },
        label: { type: "string", enum: ["现状了解","经验盘点","内在驱动","现实考量","过往探索","总结确认","生成建议"] }
      },
      required: ["phase", "label"],
      additionalProperties: false
    }
  }
}, {
  type: "function",
  function: {
    name: "save_collected",
    strict: true,
    description: `从用户的回答中提取关键信息并保存。
      当用户在对话中提供了关于自身情况的有价值信息时调用。`,
    parameters: {
      type: "object",
      properties: {
        field: { type: "string", enum: ["stage","experience","motivation","constraints","pastTry"] },
        value: { type: "string", description: "从用户回答中提取的核心信息摘要（1-2句话）" }
      },
      required: ["field", "value"],
      additionalProperties: false
    }
  }
}];
```

### 五-[4] 预估开发量

| 阶段 | 任务 | 预估 |
|------|------|:---:|
| 搭本地 agent-server | Node.js 进程 + 内存 session | 2h |
| 写 tools.js + prompt.js | 3 个 tool + System Prompt | 1h |
| 前后端联调 | career-guide.html 适配 + tool-executor | 1.5h |
| 部署 SCF + DB | SCF 部署 + DB 集合创建 + 端到端测试 | 1.5h |
| **合计** | | **~6h** |
