# 职业规划对话智能体 — 技术方案

> 基于 MindMatch 现有架构扩展的引导式职业规划 AI 智能体
> 版本：v1.0 · 2026-06-04

---

## 一、产品定位

MindMatch 现有模块解决的是"你是谁"（Why 层）——通过游戏化测评生成 14 维人格画像和职业方向匹配。

**本模块解决的是"你站在哪里 + 你可以怎么走"（What + How 层）**——通过引导式对话采集用户现实情况，结合（可选的）测评画像，输出职业方向建议和可执行的第一步。

```
┌──────────────────────────────────────────────────────┐
│                   MindMatch 体系                      │
│                                                      │
│   Part A: 认识自己          Part B: 探索方向          │
│   ┌──────────┐              ┌──────────────┐         │
│   │ G1-G4    │ ──画像──→    │ 对话智能体    │         │
│   │ 游戏测评  │   14维      │ 引导式问答    │         │
│   │          │              │ 现实锚定      │         │
│   └──────────┘              └──────────────┘         │
│        │                          │                  │
│        ▼                          ▼                  │
│   results.html              career-guide.html        │
│   (人格肖像)                 (方向+发展建议)          │
│                                                      │
│   ◄───── 两个入口可互相跳转 ─────►                    │
└──────────────────────────────────────────────────────┘
```

---

## 二、LLM 选型与理由

### 2.1 选型：DeepSeek Chat（deepseek-chat）

| 维度 | DeepSeek Chat | 混元 Lite | GPT-4o-mini | 通义 Qwen |
|------|:---:|:---:|:---:|:---:|
| **中文理解** | ★★★★★ | ★★★★ | ★★★★ | ★★★★★ |
| **结构化输出** | ★★★★ | ★★★ | ★★★★★ | ★★★★ |
| **推理链** | ★★★★★ | ★★★ | ★★★★ | ★★★★ |
| **成本** | ¥1/百万token | ¥0.8/百万token | $0.15/百万token | ¥1.2/百万token |
| **API 兼容性** | OpenAI 格式 ✅ | 自有格式 ⚠️ | OpenAI 格式 ✅ | OpenAI 格式 ✅ |
| **现有集成** | ✅ 已接通 | ✅ 已接通 | ❌ 未接入 | ❌ 未接入 |
| **长上下文** | 64K | 32K | 128K | 32K |

### 2.2 选择理由

1. **已集成**：MindMatch 现有 `api.js` 已接通 DeepSeek 代理（SCF 环境变量 `DEEPSEEK_API_KEY` 已配置），零额外接入工作
2. **中文能力强**：对话场景全程中文，DeepSeek 在中文语境下推理链清晰、输出自然
3. **结构化输出可靠**：本模块需要 AI 按固定 JSON Schema 输出（方向建议+技能列表），DeepSeek 对 JSON 格式的遵循度高
4. **降级方案**：现有 `callWithFallback()` 已支持 DeepSeek → 混元自动降级

### 2.3 备选方案

- 如果 DeepSeek 服务不稳定：自动降级到混元 Lite（已有机制）
- 如果需要更强推理：可切换到 DeepSeek R1（推理模型，token 消耗更高但推理链更强）

---

## 三、与现有模块的联动设计

### 3.1 数据流转

```
Part A (游戏测评)                        Part B (对话智能体)
┌──────────┐                             ┌──────────────┐
│ G1-G4    │                             │              │
│ 游戏交互  │                             │  引导式对话   │
└────┬─────┘                             └──────┬───────┘
     │ store.save()                              │
     ▼                                           ▼
┌──────────┐                             ┌──────────────┐
│ store.js │ ◄── localStorage ──►        │ store.js     │
│ game1-4  │    (共享数据桥)              │ career_guide │
└────┬─────┘                             └──────┬───────┘
     │ load()                                    │ save()
     ▼                                           ▼
┌──────────┐                             ┌──────────────┐
│integrator│ → 14维 profile              │prompt-builder│
│translator│ → 规则翻译                  │ → 构建 Prompt │
│portrait  │ → 人格肖像                  │ → 注入画像     │
└──────────┘                             └──────────────┘
     │                                           │
     ▼                                           ▼
results.html                             career-guide.html
(人格肖像+AI洞察)                        (方向建议+发展路径)
```

### 3.2 两个入口的互相跳转

| 跳转方向 | 触发条件 | 实现方式 |
|---------|---------|---------|
| A → B（推荐路径） | 用户完成全部4个游戏后，results.html 显示"探索你的职业方向"按钮 | `<a href="career-guide.html?from=assessment">` |
| A → B（无画像） | 用户未做游戏，直接进入 career-guide.html | 页面检测 `store.hasAll()` → 提示"建议先完成测评"或"直接开始" |
| B → A | 对话智能体发现用户未做测评，建议"先完成测评更精准" | `<a href="index.html">` 或直接跳转 |
| results → B | results.html 结果页底部 CTA | 同 A→B |

### 3.3 localStorage 数据桥

Part A 和 Part B 通过 `store.js` 共享数据：

| Key | 写入方 | 读取方 | 内容 |
|-----|--------|--------|------|
| `mindmatch_game1` ~ `game4` | 游戏模块 | Part B 的 prompt-builder | 游戏原始输出（含 dimensions） |
| `mindmatch_meta` | 游戏模块 | Part B 入口检测 | completedGames 列表 |
| `mindmatch_career_guide` | Part B | career-guide.html | 对话结果（方向+建议） |

**Part B 新增的 store 操作**：

```javascript
// store.js 扩展
export function saveCareerGuide(data) {
  const backend = getBackend();
  backend.setItem(STORAGE_PREFIX + 'career_guide', JSON.stringify(data));
}

export function loadCareerGuide() {
  const backend = getBackend();
  const raw = backend.getItem(STORAGE_PREFIX + 'career_guide');
  return raw ? JSON.parse(raw) : null;
}
```

---

## 四、对话智能体架构

### 4.1 整体架构

```
career-guide.html
    │
    ├── career-guide.css          ← 布局+聊天样式
    │
    ├── js/agent/
    │   ├── state-machine.js      ← 对话状态机（6步流程控制）
    │   ├── prompt-builder.js     ← Prompt 构建（注入画像+知识库+已收集信息）
    │   ├── chat-renderer.js      ← 聊天 UI 渲染（消息气泡+流式输出）
    │   └── knowledge-base.js     ← 预置知识库加载
    │
    ├── js/data/
    │   ├── career-mapping.json   ← 方向→技能→路径映射
    │   ├── skill-pathways.json   ← 技能→入门第一步
    │   └── intake-script.json    ← 引导问题脚本
    │
    └── 复用现有模块
        ├── js/core/store.js      ← 数据读写
        ├── js/core/api.js        ← DeepSeek 调用
        └── js/layers/integrator.js ← 14维画像聚合（可选）
```

### 4.2 对话状态机

```
                    ┌─────────────┐
                    │   WELCOME   │  欢迎语 + 选择入口
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        有测评结果                  无测评结果
              │                         │
              ▼                         ▼
     ┌─────────────┐          ┌─────────────┐
     │  PROFILE_    │          │  QUESTION_  │
     │  CONFIRM     │          │  1_STAGE    │  "你现在处于什么阶段？"
     └──────┬──────┘          └──────┬──────┘
            │                         │
            ▼                         ▼
     ┌─────────────┐          ┌─────────────┐
     │  QUESTION_   │          │  QUESTION_  │
     │  2_EXPERIENCE│          │  2_EXPERIENCE│  "你做过什么？"
     └──────┬──────┘          └──────┬──────┘
            │                         │
            ▼                         ▼
     ┌─────────────┐          ┌─────────────┐
     │  QUESTION_   │          │  QUESTION_  │
     │  3_MOTIVATION│          │  3_MOTIVATION│  "什么让你觉得'做对了'？"
     └──────┬──────┘          └──────┬──────┘
            │                         │
            ▼                         ▼
     ┌─────────────┐          ┌─────────────┐
     │  QUESTION_   │          │  QUESTION_  │
     │  4_CONSTRAINT│          │  4_CONSTRAINT│  "最重要的现实考量？"
     └──────┬──────┘          └──────┬──────┘
            │                         │
            ▼                         ▼
     ┌─────────────┐          ┌─────────────┐
     │  QUESTION_   │          │  QUESTION_  │
     │  5_PAST_TRY │          │  5_PAST_TRY │  "之前试过什么方法？"
     └──────┬──────┘          └──────┬──────┘
            │                         │
            └───────────┬─────────────┘
                        │
                        ▼
                 ┌─────────────┐
                 │  SUMMARY_   │  AI 复述确认
                 │  CONFIRM     │  "我理解的你的现状是…"
                 └──────┬──────┘
                        │
                  用户确认
                        │
                        ▼
                 ┌─────────────┐
                 │  GENERATE_   │  AI 生成方向建议
                 │  RESULT      │  + 技能发展路径
                 └──────┬──────┘
                        │
                        ▼
                 ┌─────────────┐
                 │   COMPLETE   │  结果展示 + 存储
                 └─────────────┘
```

**状态机实现要点**：

| 要点 | 说明 |
|------|------|
| 状态定义 | 8 个命名状态，用枚举常量管理 |
| 转移条件 | 每个状态有明确的进入/退出条件和数据收集目标 |
| 追问逻辑 | 每个问题最多 1 次追问，由 AI 自行判断是否需要（Prompt 内指令） |
| 带画像路径 | 如有测评结果，跳过 QUESTION_3_MOTIVATION（画像已覆盖动机维度） |
| 状态持久化 | 每步 collected 数据写入 localStorage，刷新页面可恢复 |

### 4.3 state-machine.js 核心结构

```javascript
// 状态枚举
export const States = {
  WELCOME: 'welcome',
  PROFILE_CONFIRM: 'profile_confirm',   // 仅带画像路径
  QUESTION_1_STAGE: 'q1_stage',
  QUESTION_2_EXPERIENCE: 'q2_experience',
  QUESTION_3_MOTIVATION: 'q3_motivation',
  QUESTION_4_CONSTRAINT: 'q4_constraint',
  QUESTION_5_PAST_TRY: 'q5_past_try',
  SUMMARY_CONFIRM: 'summary_confirm',
  GENERATE_RESULT: 'generate_result',
  COMPLETE: 'complete',
};

// 每个状态的配置
const STATE_CONFIG = {
  [States.QUESTION_1_STAGE]: {
    questionKey: 'currentStage',
    aiQuestion: '你现在处于什么阶段？（在校/应届/在职想转行/其他）是什么让你今天想探索方向？',
    dataKey: 'stage',           // 收集到的数据存到 collected.stage
    allowFollowup: true,        // 允许AI追问一次
    profileSkip: false,         // 是否带画像时跳过
  },
  // ... 其他状态类似
};

// 状态机类
export class ConversationStateMachine {
  #state = States.WELCOME;
  #collected = {};           // 已收集的用户信息
  #hasProfile = false;       // 是否有测评画像
  #history = [];             // 对话历史
  #listeners = new Set();

  constructor() {
    this.#loadFromStorage();  // 恢复上次进度
  }

  get state() { return this.#state; }
  get collected() { return { ...this.#collected }; }
  get hasProfile() { return this.#hasProfile; }

  // 状态转移
  transition(userMessage, aiResponse) {
    // 记录对话历史
    this.#history.push({ role: 'user', content: userMessage });
    this.#history.push({ role: 'assistant', content: aiResponse });

    // 提取结构化数据
    this.#extractData(this.#state, aiResponse);

    // 推进状态
    this.#state = this.#nextState();
    this.#saveToStorage();
    this.#notifyListeners();
  }

  #nextState() {
    const s = this.#state;
    if (s === States.WELCOME) {
      return this.#hasProfile ? States.PROFILE_CONFIRM : States.QUESTION_1_STAGE;
    }
    if (s === States.PROFILE_CONFIRM) return States.QUESTION_1_STAGE;
    if (s === States.QUESTION_1_STAGE) return States.QUESTION_2_EXPERIENCE;
    // ... 依次推进
    if (s ===.QUESTION_5_PAST_TRY) return States.SUMMARY_CONFIRM;
    if (s === States.SUMMARY_CONFIRM) return States.GENERATE_RESULT;
    if (s === States.GENERATE_RESULT) return States.COMPLETE;
    return s;
  }
}
```

### 4.4 prompt-builder.js — Prompt 构建策略

每次用户输入后，构建一个新的 Prompt 发送给 DeepSeek。Prompt 结构：

```
┌─────────────────────────────────────┐
│ System Prompt（固定部分）             │
│                                     │
│ 角色定义：资深职业规划师              │
│ 行为规范：结构化提问、追问不超过1次    │
│ 输出格式：当前步骤的JSON结构          │
│ 知识库注入：career-mapping摘要        │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 上下文注入（动态部分）                │
│                                     │
│ 14维画像（如有）：维度摘要 + 规则翻译  │
│ 已收集信息：stage/experience/...    │
│ 当前步骤：正在问第N个问题             │
│ 对话历史：最近4轮摘要                 │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 用户最新输入                         │
└─────────────────────────────────────┘
```

**关键设计：不是把6轮对话历史全部塞进 Prompt，而是每轮只注入结构化摘要**。

这样做的好处：
1. 控制 token 消耗（每轮 Prompt ~1500 token，而非累积到 6000+）
2. 避免长上下文导致的输出漂移
3. 结构化摘要比原始对话更精确

**Prompt 模板示例（第3问-动机）**：

```
你是 MindMatch 的职业规划智能体。你正在引导一位用户探索自己的职业方向。

## 你的角色
- 你是资深职业规划师，擅长通过少量关键问题定位用户的职业方向
- 你每一轮只问一个问题，等待用户回答
- 如果用户回答模糊，你可以追问一次，但最多一次
- 你的语气温暖但专业，不说废话

## 当前步骤
你正在问第3个问题：探索用户的内在动机。

## 已知信息
- 当前阶段：{collected.stage}
- 经验摘要：{collected.experience}
{如果有画像}
- 测评画像：该用户的核心驱动力是{topDimensions}，职业锚偏向{anchorType}
{如果没有画像}
- 测评画像：未提供

## 你需要做的
1. 基于已知信息，提出一个探索用户内在动机的问题
2. 如果有画像信息，可以结合画像让问题更有针对性
3. 你的回复格式必须是：
```json
{
  "message": "你对用户说的话",
  "followup_needed": false,
  "extracted_data": {
    "motivation": "从用户回答中提取的动机关键词"
  }
}
```
```

### 4.5 最终输出 Prompt（GENERATE_RESULT 阶段）

这是最关键的一次 Prompt 调用——生成最终的方向建议和发展路径：

```
## 已收集的完整信息
- 当前阶段：{collected.stage}
- 经验摘要：{collected.experience}
- 内在动机：{collected.motivation}
- 现实约束：{collected.constraints}
- 之前的尝试：{collected.pastTry}
{如果有画像}
- 14维画像：{profileSummary}
- 匹配方向：{directionRanking}

## 职业知识库
{career-mapping.json 中与用户画像最相关的 2-3 个方向的完整数据}

## 输出要求
请生成一份结构化的职业方向建议，格式如下：

```json
{
  "selfAwareness": {
    "coreTension": "用户的核心矛盾（1句话）",
    "strengths": ["优势1", "优势2"],
    "blindSpots": ["盲区1"]
  },
  "directions": [
    {
      "name": "方向名称",
      "feasibility": "high/medium/low",
      "why": "为什么适合（结合特质+现状）",
      "risk": "主要风险",
      "typicalRoles": ["岗位1", "岗位2"]
    }
  ],
  "verification": [
    {
      "type": "act/observe/connect/negate",
      "action": "具体可执行的事（1句话）",
      "why": "为什么做这个能验证方向"
    }
  ],
  "growthPath": {
    "direction": "推荐的首要方向",
    "firstStep": {
      "skill": "需要培养的能力",
      "action": "具体怎么做（1句话）",
      "timeEstimate": "大约需要多久"
    },
    "behavioralHabit": "一个值得养成的行为习惯"
  }
}
```
```

---

## 五、预置知识库设计

### 5.1 career-mapping.json — 方向→技能→路径映射

```json
{
  "meta": {
    "version": "1.0",
    "source": "O*NET + ESCO 精简 + 行业专家标注",
    "lastUpdated": "2026-06-04"
  },
  "directions": [
    {
      "id": "system_builder",
      "name": "系统建构者",
      "keywords": ["架构", "系统", "流程优化", "技术架构"],
      "relatedDimensions": {
        "nAch": 0.8, "CH": 0.7, "AU": 0.6, "AN": 0.7
      },
      "requiredSkills": {
        "core": ["系统思维", "抽象建模", "技术理解力"],
        "nice_to_have": ["项目管理", "数据分析", "跨团队沟通"]
      },
      "entryPaths": [
        {
          "role": "产品经理（技术方向）",
          "barrier": "medium",
          "typicalSalary": "15-30K",
          "firstStep": "找3个你常用的产品，写一份竞品分析报告"
        },
        {
          "role": "系统架构师（需技术基础）",
          "barrier": "high",
          "typicalSalary": "25-50K",
          "firstStep": "学习一种云平台的架构设计模式（AWS/Azure/阿里云）"
        }
      ],
      "commonTransition": ["工程师→产品经理", "运营→业务分析师"]
    },
    {
      "id": "deep_interpreter",
      "name": "深度解读者",
      "keywords": ["研究", "分析", "洞察", "深度"],
      "relatedDimensions": {
        "AN": 0.9, "nAch": 0.7, "LS": 0.6
      },
      "requiredSkills": {
        "core": ["批判性思维", "信息检索", "逻辑推理"],
        "nice_to_have": ["学术写作", "统计学", "领域知识"]
      },
      "entryPaths": [
        {
          "role": "数据分析师",
          "barrier": "medium",
          "typicalSalary": "12-25K",
          "firstStep": "学 SQL + 一个可视化工具（Tableau/Metabase），用公开数据做一个小项目"
        }
      ],
      "commonTransition": ["记者→用户研究员", "教师→培训设计师"]
    },
    {
      "id": "creative_shaper",
      "name": "创意塑造者",
      "keywords": ["创意", "设计", "表达", "创作"],
      "relatedDimensions": {
        "AU": 0.9, "SE": 0.7, "CH": 0.5
      },
      "requiredSkills": {
        "core": ["创意发想", "视觉表达/文字表达", "审美判断"],
        "nice_to_have": ["工具熟练度(Figma/AI/PR)", "用户共情", "故事叙述"]
      },
      "entryPaths": [
        {
          "role": "UI/UX 设计师",
          "barrier": "medium",
          "typicalSalary": "12-30K",
          "firstStep": "用 Figma 重设计一个你常用的 App 的一个页面，对比原版"
        }
      ],
      "commonTransition": ["市场→品牌设计", "文员→内容运营"]
    },
    {
      "id": "people_connector",
      "name": "人际联结者",
      "keywords": ["沟通", "协调", "团队", "关系"],
      "relatedDimensions": {
        "nAff": 0.9, "SE": 0.7, "LS": 0.5
      },
      "requiredSkills": {
        "core": ["沟通表达", "关系建立", "冲突处理"],
        "nice_to_have": ["谈判技巧", "跨文化理解", "项目管理"]
      },
      "entryPaths": [
        {
          "role": "HR BP（人力资源业务伙伴）",
          "barrier": "medium",
          "typicalSalary": "15-30K",
          "firstStep": "了解 HR 三支柱模型，找一位 HR 朋友聊 ta 的一天"
        }
      ],
      "commonTransition": ["销售→客户成功", "教师→培训发展"]
    },
    {
      "id": "value_driver",
      "name": "价值驱动者",
      "keywords": ["使命", "社会影响", "公益", "意义"],
      "relatedDimensions": {
        "nAch": 0.6, "AU": 0.7, "search": 0.8
      },
      "requiredSkills": {
        "core": ["使命感驱动", "资源整合", "叙事能力"],
        "nice_to_have": ["项目管理", "公共演讲", "筹款/BD"]
      },
      "entryPaths": [
        {
          "role": "ESG/CSR 顾问",
          "barrier": "high",
          "typicalSalary": "20-40K",
          "firstStep": "读一份 ESG 报告（如腾讯/阿里的），理解评估框架"
        }
      ],
      "commonTransition": ["咨询→社会企业", "运营→NGO项目"]
    },
    {
      "id": "enabler_companion",
      "name": "赋能陪伴者",
      "keywords": ["教练", "辅导", "支持", "成长"],
      "relatedDimensions": {
        "nAff": 0.7, "SE": 0.8, "nAch": 0.5
      },
      "requiredSkills": {
        "core": ["倾听能力", "共情", "引导技巧"],
        "nice_to_have": ["心理学基础", "教练认证(ICF)", "培训设计"]
      },
      "entryPaths": [
        {
          "role": "职业发展教练",
          "barrier": "medium",
          "typicalSalary": "15-35K",
          "firstStep": "了解 ICF 教练体系，找一次被教练的体验（很多教练提供免费体验课）"
        }
      ],
      "commonTransition": ["HR→教练", "教师→教育顾问"]
    }
  ]
}
```

### 5.2 skill-pathways.json — 技能→入门路径

```json
{
  "meta": { "version": "1.0" },
  "skills": [
    {
      "id": "sql_basics",
      "name": "SQL 基础",
      "category": "数据分析",
      "difficulty": "beginner",
      "timeToStart": "1-2 周",
      "firstStep": "在 SQLZoo 或 LeetCode SQL 题库完成前 20 题",
      "freeResource": "SQLZoo.net / B站搜'SQL入门'",
      "relatedDirections": ["deep_interpreter", "system_builder"]
    },
    {
      "id": "figma_basics",
      "name": "Figma 基础",
      "category": "设计工具",
      "difficulty": "beginner",
      "timeToStart": "1 周",
      "firstStep": "注册 Figma，按官方教程完成一个简单页面",
      "freeResource": "Figma Community 教程 / B站搜'Figma入门'",
      "relatedDirections": ["creative_shaper"]
    },
    {
      "id": "system_thinking",
      "name": "系统思维",
      "category": "思维方法",
      "difficulty": "intermediate",
      "timeToStart": "2-4 周",
      "firstStep": "读《系统之美》，用书中框架分析你身边的一个系统",
      "freeResource": "《系统之美》/ Donella Meadows 论文",
      "relatedDirections": ["system_builder", "value_driver"]
    },
    {
      "id": "coaching_fundamentals",
      "name": "教练基础",
      "category": "软技能",
      "difficulty": "beginner",
      "timeToStart": "2 周",
      "firstStep": "了解 GROW 模型，找一个朋友练习一次教练对话",
      "freeResource": "ICF 官网资源 / 《Coaching for Performance》",
      "relatedDirections": ["enabler_companion", "people_connector"]
    },
    {
      "id": "data_analysis",
      "name": "数据分析思维",
      "category": "数据分析",
      "difficulty": "beginner",
      "timeToStart": "2-3 周",
      "firstStep": "用 Excel/Google Sheets 分析一个你感兴趣的数据集（Kaggle 有大量免费数据）",
      "freeResource": "Kaggle Learn / Google Data Analytics Certificate",
      "relatedDirections": ["deep_interpreter", "system_builder"]
    },
    {
      "id": "writing_basics",
      "name": "结构化写作",
      "category": "表达",
      "difficulty": "beginner",
      "timeToStart": "1 周",
      "firstStep": "用金字塔原理重写一段你之前的工作/学习总结",
      "freeResource": "《金字塔原理》/ 公众号'曹将'",
      "relatedDirections": ["creative_shaper", "value_driver", "deep_interpreter"]
    }
  ]
}
```

### 5.3 intake-script.json — 引导问题脚本

```json
{
  "meta": { "version": "1.0", "basedOn": "CDPC Intake Interview Framework" },
  "steps": [
    {
      "id": "stage",
      "order": 1,
      "question": "你现在处于什么阶段？是什么让你今天想探索方向？",
      "purpose": "定位用户当前人生阶段和触发事件",
      "extractFields": ["currentStage", "triggerEvent"],
      "followupCondition": "如果用户只说了阶段没说触发事件",
      "followupQuestion": "是什么让你今天想来聊聊方向？",
      "profileVariant": {
        "hasProfile": "我看到你做了我们的测评。先确认一下——你现在是在校还是已经工作了？",
        "noProfile": null
      }
    },
    {
      "id": "experience",
      "order": 2,
      "question": "简单说说你到目前为止做过的事——实习、项目、社团、工作都算。哪一段让你觉得'这可能是我想做的'？",
      "purpose": "盘点经验资产 + 识别正向体验",
      "extractFields": ["experienceSummary", "highlightExperience"],
      "followupCondition": "如果用户列举了经历但没说哪段最有感觉",
      "followupQuestion": "这些经历里，哪一段让你觉得最有投入感？",
      "profileVariant": null
    },
    {
      "id": "motivation",
      "order": 3,
      "question": "有没有一个时刻——不管是在工作还是生活中——你觉得'这就是我该做的事'？那个时刻你在做什么？",
      "purpose": "探索内在驱动",
      "extractFields": ["motivationKeywords", "peakMoment"],
      "followupCondition": "如果用户说'没有'或很模糊",
      "followupQuestion": "那反过来，有没有什么事让你觉得'这不是我该待的地方'？",
      "profileVariant": {
        "hasProfile": "你的测评显示你的核心驱动力是{topDrive}——你在现实中有没有体验过这种驱动被满足的时刻？",
        "skipIfProfile": true
      }
    },
    {
      "id": "constraints",
      "order": 4,
      "question": "如果你要选一个方向，现在对你来说最重要的现实考量是什么？（可以多选：城市、薪资、稳定、成长空间、工作生活平衡……）",
      "purpose": "过滤不可行方向",
      "extractFields": ["constraintsList", "mustHave", "niceToHave"],
      "followupCondition": "如果用户说了很多但没排优先级",
      "followupQuestion": "如果只能保一个，你选哪个？",
      "profileVariant": null
    },
    {
      "id": "pastTry",
      "order": 5,
      "question": "你之前有没有试过确定方向的方法？比如做测评、跟人聊、尝试实习——效果怎么样？",
      "purpose": "评估用户自主探索能力 + 避免重复推荐",
      "extractFields": ["previousMethods", "whatWorked", "whatDidnt"],
      "followupCondition": "如果用户说没试过任何方法",
      "followupQuestion": "那今天算是你第一次系统地探索方向？",
      "profileVariant": null
    }
  ]
}
```

---

## 六、前端实现细节

### 6.0 说明界面（Intro Section）

在进入 AI 对话之前，展示一个简洁的说明区域，用户点击后转入对话。**同页面内切换**（不新建文件），默认显示 intro，隐藏 chat；点击后反转。

```html
<!-- 说明界面（默认显示） -->
<section id="intro-section">
  <div class="intro-card">
    <h2>🧭 职业方向探索</h2>
    <p>接下来我会通过几个关键问题了解你的现状和期待，帮你找到适合的方向。</p>
    <ul class="intro-meta">
      <li>⏱ 大约 3-5 分钟</li>
      <li>📋 5-6 个核心问题</li>
      <li>💡 如有测评结果会更快更精准</li>
    </ul>
    <!-- 检测到测评结果时动态插入 -->
    <div id="intro-profile-hint" class="hidden">
      ✅ 检测到你已完成测评，我们会结合你的画像结果
    </div>
    <button id="start-chat-btn">开始探索</button>
  </div>
</section>
```

**切换逻辑**：

```javascript
document.getElementById('start-chat-btn').addEventListener('click', () => {
  document.getElementById('intro-section').classList.add('hidden');
  document.getElementById('chat-container').classList.remove('hidden');
  machine.start(); // 启动状态机
  renderer.addMessage('assistant', machine.getWelcomeMessage());
});
```

**检测测评结果**（页面加载时）：

```javascript
import { hasAllGameData } from '../core/store.js';
if (hasAllGameData()) {
  document.getElementById('intro-profile-hint').classList.remove('hidden');
}
```

### 6.1 career-guide.html 页面结构

```html
<body>
  <!-- 顶部导航：返回测评 | 标题 | 深色模式 -->
  <header>
    <a href="index.html">← 返回测评</a>
    <h1>职业方向探索</h1>
  </header>

  <!-- 说明界面（默认显示，点击后隐藏） -->
  <section id="intro-section">
    <!-- 见 6.0 -->
  </section>

  <!-- 对话区域（默认隐藏，点击"开始探索"后显示） -->
  <main id="chat-container" class="hidden">
    <div id="chat-messages"></div>
    <div id="chat-input-area">
      <textarea id="user-input" placeholder="输入你的回答..."></textarea>
      <button id="send-btn">发送</button>
    </div>
  </main>

  <!-- 结果展示区（COMPLETE 状态显示） -->
  <section id="result-panel" class="hidden">
    <div id="result-self-awareness"></div>
    <div id="result-directions"></div>
    <div id="result-verification"></div>
    <div id="result-growth-path"></div>
    <a href="results.html">查看完整测评画像 →</a>
  </section>
</body>
```

### 6.2 API 调用 — 流式 vs 非流式

**Demo 阶段选择非流式调用**（与现有 api.js 一致），原因：

| 方式 | 优点 | 缺点 |
|------|------|------|
| 非流式 | 复用现有 api.js、实现简单、JSON 解析可靠 | 用户等待时无渐进反馈 |
| SSE 流式 | 打字机效果、体验好 | 需改 proxy 支持 stream、JSON 未闭合时解析困难 |

**折中方案**：用非流式调用，但在等待时显示动态加载动画（类似"正在思考..."），响应到达后一次性渲染。如果后续需要升级为流式，api.js 只需加一个 `stream: true` 参数。

### 6.3 调用链

```javascript
// chat-renderer.js 核心逻辑
import { ConversationStateMachine, States } from './state-machine.js';
import { buildPrompt } from './prompt-builder.js';
import { callWithFallback } from '../core/api.js';

const machine = new ConversationStateMachine();
const renderer = new ChatRenderer(document.getElementById('chat-messages'));

// 用户发消息
async function handleUserInput(text) {
  renderer.addMessage('user', text);

  // 构建当前步骤的 Prompt
  const prompt = buildPrompt(machine.state, machine.collected, text);

  // 显示加载动画
  renderer.showThinking();

  // 调用 DeepSeek
  const response = await callWithFallback(prompt, {
    preferredProvider: 'deepseek',
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 30000,  // 对话场景给更长时间
  });

  renderer.hideThinking();

  if (response) {
    // 解析 AI 回复
    const parsed = parseAIResponse(response);
    renderer.addMessage('assistant', parsed.message);

    // 推进状态机
    machine.transition(text, parsed);
  } else {
    renderer.addMessage('assistant', '抱歉，网络不太稳定，能再说一次吗？');
  }
}
```

---

## 七、与参考项目的对比

| 维度 | AI Career Counselling (Qwen+SmolAgents) | 职业规划 Agent (Spring AI+通义) | AI Career Advisor (Gemini+Streamlit) | **MindMatch 智能体（本方案）** |
|------|:---:|:---:|:---:|:---:|
| **LLM** | Qwen2.5-Coder-32B | 通义 DashScope | Gemini Pro | **DeepSeek Chat** |
| **前端** | Gradio | Vue 3 | Streamlit | **Vanilla JS** |
| **结构化面试** | ❌ 开放式 | ❌ 开放式 | ❌ 开放式 | **✅ 6步状态机** |
| **与评估联动** | ❌ 无 | ❌ 无 | ❌ 无 | **✅ 14维画像+6方向** |
| **知识库** | 网络搜索工具 | RAG+Markdown | 无 | **预置 JSON** |
| **记忆持久化** | ❌ | 纯文本日志 | Session | **localStorage** |
| **状态管理** | Agent 推理 | 单例（有bug） | Session | **显式状态机** |
| **流式输出** | ❌ | SSE 双模式 | ❌ | 非流式（可升级） |

**MindMatch 智能体的差异化**：

1. **唯一实现了结构化引导流程**（其他项目都是开放式聊天）
2. **唯一实现了与评估模块的数据联动**（14维画像+6方向匹配结果注入 Prompt）
3. **唯一预置了职业知识库**（career-mapping.json + skill-pathways.json）
4. **显式状态机**控制对话进度，避免了其他项目中常见的"AI 跑偏"问题

---

## 八、技术风险与规避

| 风险 | 概率 | 影响 | 规避策略 |
|------|:---:|:---:|---------|
| DeepSeek 输出格式不遵循 JSON | 中 | 高 | Prompt 强调格式 + 正则提取 + 降级为纯文本解析 |
| AI 偏离引导流程（自问自答） | 中 | 中 | 状态机强制控制——每轮只注入当前步骤的指令 |
| localStorage 被清（用户关闭浏览器） | 低 | 中 | 每步自动保存 collected 数据，刷新可恢复 |
| API 超时（对话 Prompt 较长） | 低 | 中 | timeout=30s + callWithFallback 降级 |
| 职业知识库不够全 | 中 | 低 | 6方向×1-2路径=6-12条，Demo 够用，后续扩展 |
| 画像数据不存在（用户直接进入 Part B） | 中 | 低 | 入口选择"直接开始"，跳过画像相关提问 |

---

## 九、开发计划

| 序号 | 任务 | 文件 | 预估 |
|:---:|------|------|:---:|
| 1 | 创建 intake-script.json | `js/data/intake-script.json` | 0.5h |
| 2 | 创建 career-mapping.json | `js/data/career-mapping.json` | 1h |
| 3 | 创建 skill-pathways.json | `js/data/skill-pathways.json` | 0.5h |
| 4 | 实现 state-machine.js | `js/agent/state-machine.js` | 2h |
| 5 | 实现 prompt-builder.js | `js/agent/prompt-builder.js` | 2h |
| 6 | 实现 chat-renderer.js | `js/agent/chat-renderer.js` | 1.5h |
| 7 | 扩展 store.js | `js/core/store.js` | 0.5h |
| 8 | 创建 career-guide.html + CSS | `career-guide.html` + `css/career-guide.css` | 2h |
| 9 | 与 Part A 的导航链接 | `index.html` + `results.html` 修改 | 0.5h |
| 10 | 端到端测试 + 修复 | 全链路 | 1.5h |
| **合计** | | | **~12h** |

---

## 十、参考来源

| 来源 | URL | 参考价值 |
|------|-----|---------|
| AI Career Counselling Chatbot | https://github.com/manankumar7403/AI-career-counselling-chatbot | Agent 架构、Prompt 管理、工具调用 |
| 职业规划 Agent (Spring AI) | https://blog.csdn.net/xwhxy/article/details/160964185 | 流式输出、记忆持久化、RAG 架构 |
| AI 生涯规划系统 | https://cloud.tencent.com/developer/article/2592471 | 用户画像构建、协同过滤匹配、路径拆解 |
| Competency Mapper | https://github.com/Tocaa-ai/Competency-mapper | Prompt 驱动的能力映射思路 |
| AI Career Advisor (Gemini) | https://github.com/kesavapavan13/AI-Career-Advisor-Chatbot | 模块化架构、记忆管理、Token 优化 |
| ESCO 欧洲技能/职业分类 | https://esco.ec.europa.eu/en | 数据结构设计、职业-技能映射 |
| O*NET 职业数据库 | https://www.onetcenter.org/database.html | 职业数据、技能层级、工作活动 |
| CDPC 职业咨询框架 | https://cdpc-cedc.ca/competency-framework/ | 结构化面谈流程、信息收集维度 |
| SSE 流式架构最佳实践 | https://blog.csdn.net/gitblog_00370/article/details/151429093 | Vanilla JS + EventSource、状态管理、错误处理 |
| skills-ml 本体论 | https://workforce-data-initiative.github.io/skills-ml/ontologies/ | JSON-LD 技能本体、能力映射数据格式 |
