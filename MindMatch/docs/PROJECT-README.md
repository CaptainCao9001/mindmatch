# MindMatch — AI 职业方向探索平台

> **版本**: v1.0-submission (2026-06-10)  
> **线上地址**: https://mindmatch-d0gz847n4e29e3181-1438477634.tcloudbaseapp.com  
> **GitHub**: https://github.com/CaptainCao9001/mindmatch

---

## 一、产品概述

MindMatch 是一个基于 AI 对话的职业方向探索工具。用户通过 4 轮渐进式对话完成自我认知，系统生成 14 维人格肖像，再通过多算法匹配推荐适合的职业方向，并提供 AI 职业顾问深度咨询。

### 核心流程

```
对话采集 → 14维肖像 → 行为叙事 → 职业匹配 → 职业顾问
(4阶段AI对话)  (雷达图)   (行为画像)  (TOPSIS+余弦)  (多轮对话)
```

### 页面一览

| 页面 | 文件 | 功能 |
|------|------|------|
| 首页 | `index.html` | 产品介绍 + 开始入口 |
| 对话页 | `index.html#/chat` | 4 阶段 AI 对话采集 |
| 肖像页 | `results.html` | 14 维雷达图 + 行为叙事 + 导出 |
| 匹配页 | `match.html` | 职业方向推荐 + 实验 + 导出 |
| 职业顾问 | `career-guide.html` | AI 深度职业咨询 |
| 导出报告 | `export-report.html` | 6 板块报告（PDF/图片） |
| 游戏页 | `games/game1-4.html` | 4 款心理学小游戏 |

---

## 二、技术架构

### 前端（纯静态 SPA）

- **零框架**: 原生 HTML/CSS/JS（ES Modules），无 React/Vue
- **版本缓存策略**: `window.__MM_VER__` 统一版本号，CSS/JS 引用带 `?v=` 参数
- **数据流**: `localStorage` 中转（肖像页/匹配页 → 导出页）
- **LLM 调用**: 前端通过代理（本地 localhost:8100 或云函数 proxy）调用 API

### 后端（腾讯云 CloudBase）

- **云函数 `agent`**: Agent v2 对话引擎（4 阶段编排 + Function Calling）
- **云函数 `proxy`**: LLM API 代理（混元/DeepSeek），Key 从环境变量读取
- **静态托管**: HTML/CSS/JS/JSON 全部托管在 CloudBase CDN

### LLM 供应商

| 供应商 | 模型 | 用途 | 优先级 |
|--------|------|------|--------|
| DeepSeek | deepseek-chat | Agent v2 对话引擎（支持 Function Calling） | 主 |
| 混元 | hunyuan-lite | 代理 API + Agent fallback（不支持 FC） | 备 |

---

## 三、目录结构

```
mindmatch-demo/
├── index.html              # 首页 + 对话页（Hash 路由）
├── results.html            # 肖像页
├── match.html              # 职业匹配页
├── career-guide.html       # 职业顾问页
├── export-report.html      # 导出报告页
│
├── css/
│   ├── base.css            # 全局基础样式
│   ├── components.css      # 通用组件样式
│   ├── index.css           # 首页样式
│   ├── results.css         # 肖像页样式
│   ├── match.css           # 匹配页样式
│   ├── career-guide.css    # 职业顾问样式
│   ├── export.css          # 导出报告打印样式
│   └── games.css           # 游戏页样式
│
├── js/
│   ├── core/               # 核心模块
│   │   ├── api.js          # LLM API 封装（代理+降级）
│   │   ├── store.js        # 数据持久化
│   │   └── utils.js        # 工具函数
│   │
│   ├── agent/              # 前端 Agent 交互
│   │   ├── chat-renderer.js   # 聊天 UI 渲染（含三阶段 thinking）
│   │   ├── prompt-builder.js  # Prompt 构建
│   │   ├── state-machine.js   # 对话状态机
│   │   └── tool-executor.js   # 工具执行 + 职业顾问对接
│   │
│   ├── layers/             # 数据处理层
│   │   ├── integrator.js      # 14 维整合
│   │   ├── behavior-narrative.js # 行为叙事生成
│   │   ├── translator.js      # 规则解读翻译
│   │   ├── matcher.js         # 职业匹配（入口）
│   │   ├── matcher_extended.js # 扩展匹配
│   │   ├── matcher_linear.js  # 线性匹配
│   │   ├── matcher_topsis.js  # TOPSIS 匹配
│   │   ├── insight.js         # AI 洞察生成
│   │   └── experiment.js      # 实验建议生成
│   │
│   ├── ui/                 # UI 渲染
│   │   ├── portrait.js        # 肖像雷达图
│   │   ├── charts.js          # Chart.js 图表
│   │   ├── match-ui.js        # 匹配结果 UI
│   │   ├── match-ui-extended.js # 扩展匹配 UI
│   │   ├── insight-card.js    # AI 洞察卡片
│   │   └── experiment-card.js # 实验卡片
│   │
│   ├── data/               # 数据定义
│   │   ├── intake-script.js   # 对话引导脚本
│   │   ├── career-mapping.js  # 职业分类映射
│   │   └── skill-pathways.js  # 技能路径
│   │
│   └── games/              # 游戏引擎
│       ├── engine.js
│       └── game1-4-data.js
│
├── agent-v2/               # Agent v2 后端（SCF 云函数）
│   ├── config.mjs          # 集中配置
│   ├── handler.mjs         # 6 步编排主流程
│   ├── llm.mjs             # DeepSeek + 混元 API
│   ├── main.mjs            # HTTP 入口
│   ├── session.mjs         # 会话管理
│   ├── stages.mjs          # 4 阶段定义
│   ├── state.mjs           # 阶段推进逻辑
│   ├── tools.mjs           # Function Calling 工具注册表
│   ├── tool-executor.mjs   # 工具执行器
│   ├── postprocess.mjs     # 后处理（问句补全）
│   ├── dedup.mjs           # 防重复机制
│   ├── replies.mjs         # 固定回复模板
│   ├── scf-bridge.js       # CJS 桥接（SCF 入口）
│   ├── scf-handler.mjs     # SCF 适配层
│   └── prompt/             # Prompt 模板
│       ├── index.mjs
│       ├── role.mjs
│       ├── style.mjs
│       ├── anti-dup.mjs
│       ├── stages-prompts.mjs
│       └── profile-context.mjs
│
├── cloudfunctions/         # CloudBase 云函数部署目录
│   ├── agent/              # Agent v2（从 agent-v2/ 复制）
│   └── proxy/              # LLM API 代理
│
├── mock/                   # Mock 数据
│   ├── ideal-profiles.json
│   ├── game-results.json
│   ├── insight-prompts.json
│   └── synthetic-users.json
│
├── games/                  # 游戏页
│   ├── game1-core-drive.html
│   ├── game2-career-anchor.html
│   ├── game3-cognitive-style.html
│   └── game4-meaning-construction.html
│
├── tools/                  # 开发/调试工具
│   ├── setup-api.html
│   ├── inject-data.html
│   ├── e2e-test.html
│   └── ...
│
├── docs/                   # 设计文档
├── cloudbaserc.json        # CloudBase 配置
└── vercel.json             # Vercel 配置（备用）
```

---

## 四、核心数据流

### 1. 对话采集 → 肖像生成

```
用户输入 → 前端 tool-executor → 云函数 agent
  → handler.mjs (6步编排) → callDeepSeek (Function Calling)
  → save_collected 工具提取字段 → advance_phase 推进阶段
  → 4阶段完成 → 返回 profile 数据
  → 前端 integrator.js 整合14维 → 雷达图渲染
```

### 2. 职业匹配

```
14维 profile → matcher.js (入口)
  → matcher_topsis.js (TOPSIS算法，主)
  → matcher_linear.js (线性匹配，辅)
  → 理想职业档案 (ideal-profiles.json)
  → 按匹配度排序 → 渲染方向卡片
```

### 3. 导出报告

```
results.html / match.html
  → packExportData() 打包到 localStorage['mindmatch_export_data']
  → window.open('export-report.html')
  → export-report.html 读取 localStorage → 渲染6板块
  → html2pdf.js → 下载PDF
  → html2canvas → 下载PNG
```

### 4. AI 洞察 & 实验

```
profile → insight.js → 云函数 proxy → 混元 API → 洞察文本
profile → experiment.js → 云函数 proxy → 混元 API → 实验建议
```

---

## 五、LLM Fallback 机制

### Agent v2（后端）

```
callDeepSeek() 成功 → 正常流程（支持 Function Calling）
callDeepSeek() 失败 → callHunyuan() fallback（纯对话，无 FC）
两者都失败 → 返回错误回复
```

### 前端（api.js）

```
云函数代理 (cloudFunctionUrl) → 优先
本地代理 (localhost:8100) → 本地开发用
callWithFallback() → 主 provider 失败 → 自动切换备选
```

---

## 六、关键设计决策

| 决策 | 理由 |
|------|------|
| 纯静态无框架 | 部署简单、加载快、CDN 友好 |
| Agent v2 SCF 部署 | DeepSeek Function Calling 需服务端调用 |
| localStorage 中转导出 | 跨页面传数据，无需后端存储 |
| 版本号 `?v=` 缓存策略 | CloudBase CDN 缓存重，需版本号强刷 |
| 三阶段 thinking 文案 | 冷启动时 0s/3s/8s 渐进切换提示 |
| 混元 fallback | DeepSeek 不稳定时保底，但不支持 FC |
