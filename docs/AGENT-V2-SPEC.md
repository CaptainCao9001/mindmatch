# Agent v2 细节说明书

> 版本：v2.0（2026-06-10）| 状态：开发中 | 作者：MindMatch 团队

---

## 1. 概述

Agent v2 是 MindMatch 的**职业规划深度对话引擎**，在用户完成 4 个测评游戏后，通过 4 阶段结构化的 AI 对话，完成从"结果验证"到"行动地图"的完整闭环。

### 1.1 与 v1 的核心差异

| 维度 | v1（已废弃） | v2（当前） |
|------|-------------|-----------|
| 阶段数 | 7 阶段 | **4 阶段** |
| 工具数 | 4 个（含 show_hint） | **3 个**（去掉 show_hint） |
| 前端状态机 | 有 | **无**（全部服务端驱动） |
| 工具管理 | 硬编码 switch-case | **注册表模式** |
| Prompt 组装 | 单一大文件 | **模块化拼接** |
| LLM 容错 | 无 fallback | **DeepSeek → 混元自动切换** |
| 防重复 | 简单去重 | **话题级 + 已问问题级双重去重** |

### 1.2 核心设计原则

- **硬墙**：`career-guide.html` 的 `checkProfile()` 强制校验 4 游戏完成，未完成无法进入
- **服务端驱动**：所有状态、阶段推进、工具调用均由服务端 `handler.mjs` 编排，前端只负责渲染
- **数据驱动 Prompt**：阶段配置（`stages.mjs`）是唯一数据源，Prompt 从数据遍历生成
- **自动愈合**：工具参数填错时自动修正而非报错

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────┐
│                    main.mjs                          │
│           环境检测 → 本地Server / SCF                │
└──────────────┬──────────────────────────────────────┘
               │
    ┌──────────▼──────────┐
    │    server.mjs        │  ← HTTP 层（本地:8101）
    │  POST /api/agent/chat│
    │  GET  /health        │
    │  GET  /session/:id   │  ← 调试端点
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │   handler.mjs        │  ← 核心编排（6 步流程）
    │   handleChat()       │
    └──┬────┬──────┬──────┘
       │    │      │
  ┌────▼─┐┌─▼────┐┌▼──────┐
  │session││state ││tools  │
  │.mjs   ││.mjs  ││.mjs   │
  │(存储) ││(状态)││(注册) │
  └───────┘└──────┘└───┬───┘
                       │
              ┌────────▼────────┐
              │tool-executor.mjs │
              │(工具副作用)      │
              └─────────────────┘
       │
  ┌────▼─────┐  ┌──────────┐  ┌──────────┐
  │ llm.mjs  │  │dedup.mjs │  │replies   │
  │(API调用) │  │(防重复)  │  │.mjs      │
  └────┬─────┘  └──────────┘  │(兜底)    │
       │                      └──────────┘
  ┌────▼─────┐
  │ config   │
  │ .mjs     │
  │(配置)    │
  └──────────┘

  prompt/
  ├── index.mjs          ← 组装入口
  ├── role.mjs           ← AI 角色身份
  ├── style.mjs          ← 对话风格规则
  ├── stages-prompts.mjs ← 阶段指令（从 stages.mjs 遍历生成）
  ├── profile-context.mjs← 测评画像注入
  └── anti-dup.mjs       ← 防重复指令格式化
```

---

## 3. 4 阶段交互设计

阶段定义在 `stages.mjs`（唯一数据源），每个阶段包含：目标、轮次上限、推进条件、采集字段、追问方向。

### 3.1 阶段概览

| 阶段 | Key | 标签 | 轮次 | 核心目标 |
|------|-----|------|:----:|---------|
| 1 | `resonance` | 结果共鸣 | 2-3 | 让用户确认/修正测评结果，建立信任 |
| 2 | `deep_dive` | 深度挖掘 | 3-4 | 用方向区分性问题挖深层信息 |
| 3 | `calibration` | 现实校准 | 2-3 | 把理想拉回现实，明确约束和妥协点 |
| 4 | `action_map` | 行动地图 | 2-3 | 给出方向+岗位+技能差距+第一步行动 |

### 3.2 阶段 1：结果共鸣（Resonance）

**目标**：让用户对测评结果产生共鸣，确认/修正初步方向。

**推进条件**：用户已确认测评结果认同度（哪些准/哪些不准），或用户提出了不认同的具体原因。

**采集字段**：`resonance`

**追问方向**：
- 如果用户说"不准"：追问具体哪个维度不准，为什么
- 如果用户说"准"：追问是否有意外发现
- 如果用户说"不确定"：给具体场景让它判断

**开场模板**：
> 你做了4个游戏，结果挺有意思的——你的核心特质是{topTrait}，最匹配的方向是{topDirection}。你觉得这个描述准吗？

### 3.3 阶段 2：深度挖掘（Deep Dive）

**目标**：挖出测评无法触及的深层信息，用方向区分性问题筛选方向。

**推进条件**：用户已表达方向倾向（偏哪个方向），并有至少 1 个关键经历佐证。

**采集字段**：`directionPreference`、`keyExperience`、`innerDrive`

**核心区分性问题**：
- 建造 vs 理解（系统建构者 vs 深度解读者）
- 创造 vs 连接（创意塑造者 vs 人际联结者）
- 影响 vs 陪伴（价值驱动者 vs 赋能陪伴者）

**追问方向**：
- 交叉验证：用户说的和测评数据是否一致？不一致就追问原因
- 追问具体经历："那段经历里，具体哪个瞬间让你有感觉？"

### 3.4 阶段 3：现实校准（Calibration）

**目标**：把理想方向拉回现实，考虑约束条件，找出可达的第一步。

**推进条件**：用户已明确现实约束优先级（城市/薪资/稳定/成长）和可接受妥协点。

**采集字段**：`constraints`、`tradeoffs`

**追问方向**：
- 如果理想和现实差距大：提出过渡路径
- 追问约束优先级："如果只能保一个，你选哪个？"
- 追问过渡意愿："如果需要先做 X 再做 Y，你愿意等吗？"

### 3.5 阶段 4：行动地图（Action Map）

**目标**：给出可执行的行动建议：方向 + 岗位 + 技能差距 + 第一步行动。

**推进条件**：建议已完整输出，用户确认或无异议。

**采集字段**：`actionPlan`

**输出要求**（放在同一条消息中）：
- 📍 推荐方向
- 💼 推荐岗位
- 📐 技能差距
- 🚀 第一步行动（72小时内可执行）

---

## 4. 工具注册表

3 个工具，注册表模式管理。定义在 `tools.mjs` 的 `TOOL_REGISTRY` 对象中。

### 4.1 advance_phase（阶段推进）

```json
{
  "name": "advance_phase",
  "description": "推进到下一个对话阶段并更新前端进度条",
  "parameters": {
    "phase": { "type": "number" },
    "label": { "type": "string" }
  }
}
```

**核心逻辑**（`tool-executor.mjs`）：
- **自动愈合**：AI 填错阶段号时自动修正为 `currentPhase + 1`
- 前端收到 `toolCalls[].name === 'advance_phase'` 后更新进度条
- 只在 `phase < TOTAL_STAGES(4)` 时启用

### 4.2 save_collected（信息采集）

```json
{
  "name": "save_collected",
  "description": "从用户回答中提取关键信息并保存。同时判断信息深度。",
  "parameters": {
    "field": { "type": "string", "enum": <动态> },
    "value": { "type": "string" },
    "depth": { "type": "string", "enum": ["shallow", "adequate", "deep"] }
  }
}
```

**动态枚举**：`field` 的可选值从 `ALL_COLLECT_FIELDS` 动态注入（当前 7 个字段）：
`resonance` / `directionPreference` / `keyExperience` / `innerDrive` / `constraints` / `tradeoffs` / `actionPlan`

**深度判断**：
- `shallow`：模糊，需进一步追问
- `adequate`：有信息，可追问一次确认
- `deep`：清晰，可以过渡到下一话题

### 4.3 finish_conversation（结束对话）

```json
{
  "name": "finish_conversation",
  "description": "结束对话。只能在阶段 4 调用。",
  "parameters": {
    "summary": { "type": "string" }
  }
}
```

**触发效果**：
- `session.status` → `completed`
- `session.completedAt` = 当前时间戳
- 前端收到后禁用输入框，展示"对话已完成"
- **只能且必须在阶段 4 启用**

---

## 5. 6 步编排主流程

`handler.mjs` 的 `handleChat()` 函数按以下 6 步执行：

```
用户消息 → Step1 → Step2 → Step3 → Step4 → Step5 → Step6 → 返回
```

### Step 1: ensureSession（会话管理）

- 新会话：从 `prompt/index.mjs` 构建 system prompt → `session.mjs` 创建 → `state.mjs` 初始化阶段为 1
- 已完成会话：直接返回 `COMPLETED_REPLY`
- 终止条件触发：`checkTermination()` → 标记 completed
- 活跃会话：追加用户消息

### Step 2: advanceIfNeeded（自动推进）

两种触发条件：
1. **阶段轮次超限**：`phaseTurns >= stage.maxTurns` → 自动 +1
2. **全局轮次超限**：总用户轮次 ≥ `MAX_TOTAL_TURNS(16)` → 强制跳到阶段 4

推进后重置 `phaseTurns = 0`、`phaseDepth = null`。

### Step 3: injectAntiDup（防重复注入）

每轮动态向 system prompt 追加防重复指令：
- 从消息历史提取已问问题（`extractAskedQuestions`）
- 从最近 assistant 消息提取关键词（`extractRecentKeywords`）
- 从 `session.collected` 推断已讨论话题（`getDiscussedTopics`）
- 旧区块被移除，新区块追加到 system prompt 末尾

### Step 4: callLLM（LLM 调用）

1. `callDeepSeek()` → 成功则提取 `reply` + `rawToolCalls`
2. DeepSeek 失败 → 自动 `callHunyuan()` fallback
   - 混元**不支持 function calling**，返回纯文本对话
   - 混元也失败 → 返回错误响应

调试：`DEBUG_PROMPT=1` 环境变量打印完整 prompt 和 tools。

### Step 5: handleToolCalls（工具执行）

- AI 调了工具 → `tool-executor.mjs` 执行副作用
- 工具结果（`tool` role message）回传给 LLM
- `finish_conversation` → 直接返回 completed
- 其他工具 → 执行 **follow-up 检测**

**Follow-up 机制**：
- 触发条件（`shouldTriggerFollowUp`）：调了工具 + AI 文字回复短/空 + 没有推进阶段
- 再次调用 DeepSeek 补全（`callFollowUp`），使用更高 temperature(0.8)
- Follow-up 也失败 → 用 `replies.mjs` 的阶段敏感兜底回复

### Step 6: postprocess（后处理）

- `ensureEndsWithQuestion()`：非最后阶段的回复必须包含问句
  - 短回复（< 20 字）→ 直接替换为兜底追问
  - 长回复无问句 → 末尾拼接兜底追问
  - 最后阶段（phase ≥ 4）→ 不需要问句

---

## 6. Prompt 组装

`prompt/index.mjs` 将 5 个模块拼接为完整 system prompt：

```
buildRoleBlock(profile)      → AI 角色身份定义
buildStyleBlock()            → 对话风格规则
buildStagesBlock()           → 4 阶段详细指令（从 stages.mjs 遍历生成）
buildExamplesBlock()         → 每阶段 Good/Bad 对话示例
buildProfileContext(profile) → 测评画像数据注入（核心特质、突出维度、游戏行为、匹配结果）
```

**动态生成**：
- `stages-prompts.mjs` 的 `buildStagesBlock()` 遍历 `STAGES` 数组，自动生成每个阶段的目标、推进条件、轮次限制、追问方向
- 新增/修改阶段只需改 `stages.mjs`，Prompt 自动更新

**防重复注入**（Step 3 每轮动态追加）：
```
[已讨论话题，禁止以任何方式重新询问：
- 测评结果
- 认同度
...]

[已问过的问题，请勿重复：
- 你觉得这个描述准吗？
...]
```

---

## 7. API 与接口

### 7.1 POST /api/agent/chat

**请求体**：
```json
{
  "sessionId": "string|null",
  "message": "string (必填)",
  "profile": { "object|null" }
}
```

**响应体**：
```json
{
  "reply": "string",
  "toolCalls": [{ "name": "string", "args": {}, "result": {} }],
  "phase": "number (1-4)",
  "label": "string",
  "status": "'active'|'completed'|'error'",
  "sessionId": "string",
  "error": "string|null"
}
```

### 7.2 GET /health

```json
{
  "status": "ok",
  "hasKey": true,
  "version": "v2"
}
```

### 7.3 GET /api/agent/session/:id（调试端点）

返回会话概览（不含完整 messages，避免过长）：
```json
{
  "id": "...",
  "status": "active",
  "phase": 2,
  "phaseLabel": "深度挖掘",
  "phaseTurns": 2,
  "collected": { "resonance": { "value": "...", "depth": "deep" } },
  "messageCount": 8,
  "recentMessages": [...]
}
```

---

## 8. 状态机

### 8.1 会话生命周期

```
创建(phase=1) → [阶段1对话] → advance → [阶段2对话] → advance
→ [阶段3对话] → advance → [阶段4对话] → finish → completed
```

### 8.2 关键状态字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `phase` | number | 当前阶段 (1-4) |
| `phaseLabel` | string | 阶段中文标签 |
| `phaseTurns` | number | 当前阶段已进行的轮次 |
| `phaseDepth` | string\|null | 当前话题深度 (shallow/adequate/deep) |
| `collected` | object | `{ field: { value, depth } }` |
| `status` | string | active / completed |
| `messages` | array | 完整消息历史（含 system/user/assistant/tool） |

### 8.3 终止条件

1. AI 调用 `finish_conversation`（主动结束）
2. 全局轮次超限：总用户消息 ≥ `MAX_TOTAL_TURNS(16)`
3. 阶段 4 超限：`phaseTurns > stage.maxTurns + 2`
4. `session.status === 'completed'`（重复请求拦截）

---

## 9. 容错机制

### 9.1 LLM 层

| 故障 | 处理 |
|------|------|
| DeepSeek 网络超时 (30s) | AbortController 中止，返回 `TIMEOUT` 错误 |
| DeepSeek API 错误 | 自动 try `callHunyuan()` |
| 混元也失败 | 返回 `ERROR_REPLIES` 兜底文案 |
| JSON 解析失败 | 返回 `JSON_PARSE` 错误 |
| 空响应 | 返回 `EMPTY_RESPONSE` 错误 |

### 9.2 工具层

| 故障 | 处理 |
|------|------|
| AI 填错 advance_phase 的阶段号 | 自动愈合为 `currentPhase + 1` |
| 工具参数 JSON 解析失败 | 跳过该工具调用，记录 warn 日志 |
| AI 只调工具无文字回复 | Follow-up 补全 → 兜底回复 |
| Follow-up 也失败 | 使用 `replies.mjs` 阶段敏感兜底 |

### 9.3 阶段层

| 场景 | 处理 |
|------|------|
| 轮次超限但信息不够 | 强制推进，不卡住 |
| 全局轮次超限 | 强制跳到阶段 4 |
| 重复请求已完成会话 | 返回 `COMPLETED_REPLY` |

---

## 10. 前端集成

### 10.1 硬墙校验

`career-guide.html` 入口处 `checkProfile()` 函数：

```javascript
function checkProfile() {
  const raw = localStorage.getItem('mindmatch_profile_v2');
  if (!raw) return false;
  const p = JSON.parse(raw);
  // 必须完成全部 4 个游戏
  return p.game1 && p.game2 && p.game3 && p.game4;
}
```

未完成 → 显示拦截页面，不允许进入对话。

### 10.2 对话通信

客户端 → 服务端（`js/agent/chat-renderer.js` → `server.mjs`）：

```
POST /api/agent/chat
Body: { sessionId, message, profile }
```

`profile` 对象由客户端从 `localStorage` 和计算模块（`integrator.js`、`matcher.js`、`translator.js`）打包。

### 10.3 工具调用处理

前端收到 `toolCalls` 后：
- `advance_phase` → 更新进度条 UI
- `save_collected` → 无 UI 变化（纯服务端记录）
- `finish_conversation` → 禁用输入框，显示完成状态

---

## 11. 文件清单

```
agent-v2/
├── main.mjs              # 启动入口（环境检测）
├── server.mjs            # HTTP Server（本地 8101）
├── handler.mjs           # 核心编排（6 步流程，339 行）
├── llm.mjs               # DeepSeek / 混元 / Follow-up 调用
├── tools.mjs             # 工具注册表（3 工具 + 动态枚举）
├── tool-executor.mjs     # 工具副作用执行
├── config.mjs            # 集中配置（URL / Model / Timeout / 轮次）
├── state.mjs             # 状态机 / 阶段推进 / 终止检查
├── session.mjs           # 会话存储（内存 + 文件持久化）
├── stages.mjs            # 阶段定义（唯一数据源）
├── dedup.mjs             # 防重复提取（问句 / 关键词 / 话题）
├── postprocess.mjs       # 后处理（问句补全 + Follow-up 检测）
├── replies.mjs           # 兜底回复模板（阶段敏感）
├── scf-handler.mjs       # CloudBase SCF 入口
├── scf-bridge.js         # CJS 桥接层（SCF ESM 兼容）
├── package.json          # Node 依赖声明
└── prompt/
    ├── index.mjs         # Prompt 组装入口
    ├── role.mjs          # AI 角色身份
    ├── style.mjs         # 对话风格规则
    ├── stages-prompts.mjs# 阶段指令（遍历 stages.mjs 生成）
    ├── profile-context.mjs# 测评画像注入
    └── anti-dup.mjs      # 防重复指令格式化
```

**前端文件**（`js/agent/`）：
```
js/agent/
├── chat-renderer.js      # 对话渲染（含 thinking 三阶段渐进提示）
├── tool-executor.js      # 前端工具执行（进度条更新等）
└── (others)
```

---

## 12. 本地调试

```bash
# 启动 Agent v2 服务
node agent-v2/main.mjs
# → http://localhost:8101

# 启动静态页面服务
python -m http.server 8090
# → http://localhost:8090

# 调试完整 Prompt
DEBUG_PROMPT=1 node agent-v2/main.mjs

# 查看会话
curl http://localhost:8101/api/agent/session/<sessionId>
```

---

## 13. 已知限制与待优化

| 项 | 说明 | 优先级 |
|----|------|--------|
| 混元无 Function Calling | 混元 fallback 时无法调用工具，只能纯文本对话 | P1 |
| Session 内存存储 | 本地用文件持久化，SCF 无状态需改用外部存储 | P2 |
| Prompt 长度 | 4 阶段 + 画像 + 示例 + 防重复 ≈ 3-4K tokens/system prompt | P2 |
| 工具数量固定 | 新增工具需改 3 个文件（注册表 + 执行器 + 前端） | P3 |
