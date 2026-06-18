# MindMatch 行为叙事层方案书

> 版本: v1.0-draft | 日期: 2026-06-01 | 作者: 雯

---

## 一、背景

### 1.1 现状

MindMatch 当前结果页的 AI 肖像解读（`insight.js`）向混元/DeepSeek API 传入了两条数据流：

1. **14 维人格分数**（integrator.js 产出）— 各维度 0-10 标准化分数
2. **规则翻译摘要**（translator.js 产出）— 基于分数的分档文案

但用户在四个游戏中产生的**中间过程量**（决策时间、翻牌行为、拖拽顺序、反应模式等）虽然已存入 localStorage，却从未参与 AI 解读。

### 1.2 问题

当前 AI 解读只能说出"你是什么样的"，说不出"你是怎么做的"。而用户对"被说中感"的感知，往往来自**具体的行为细节**而非概括性结论。

例如，以下两种描述的说中感差异明显：

> ❌ "你的成就驱动力较强，人际亲和力适中。"
>
> ✅ "在关于'帮助他人成功'的场景里你犹豫了 4.7 秒——那是你唯一思考超过 4 秒的题目。而在关于'做出一番成就'的场景你几乎秒选。"

后者是行为叙事——数据来自用户的实际操作，AI 只需要"发现"它。

---

## 二、现有数据资产审计

### 2.1 各游戏已采集的中间量

| 游戏 | 已采集 | 数据结构 | 是否进入 AI Prompt |
|------|--------|---------|:---:|
| G1 核心驱动力 | 每题决策时间、选择 ID | `decisions[]: {scenarioId, chosenOptionId, decisionTime}` | ✗ |
| G2 职业锚 | 三阶段保留/放弃记录、各阶段计数 | `decisions[]: {stage, cardId, action, anchor}`、meta 中 stage1-3 保留数量 | ✗ |
| G3 认知风格 | 8 碎片分组、排序结果、阶段耗时、impulseScore | `decisions[]: {stage, cardId, group/rank}`、`behaviorSummary.impulseScore` | ✗ |
| G4 意义建构 | 6 场景双反应选择、每题反应时间、avgReactionTimeMs | `decisions[]: {scenarioId, reactionPresence, reactionSearch, reactionTimeMs}` | ✗ |

### 2.2 采集盲区

| 盲区 | 位置 | 影响 |
|------|------|------|
| G2 翻牌行为 | discard.js 渲染了 flip 但未记录 | 无法判断用户是"翻了几张就选"还是"全翻完再选"——这是一个重要的探索风格信号 |
| G1 场景元数据 | engine.js 输出不含 scenario title | 无法生成"关于[帮助他人成功]的场景你犹豫最久"这种具体叙事 |
| G3 拖拽轨迹 | focus-sort.js 只有最终分组，没有中间移动 | 无法判断用户是否"反复调整" |
| G4 双反应间隔 | 只有总 reactionTime，未拆分反应①→②间隔 | 无法区分"看完故事立刻有反应"vs"看到第二个问题才纠结" |

### 2.3 integrator.js 管道断裂点

`insight.js` 的 `buildInsightPrompt` 中已有行为摘要占位：

```js
if (meta.g1TopDrive) behaviors.push(...);
if (meta.g2TopAnchors) behaviors.push(...);
if (meta.g3Type) behaviors.push(...);
if (meta.g4Type) behaviors.push(...);
```

但 `integrator.js` 产出的 `profile.meta` 只有 `totalDuration`、`completedGames`、`completedCount`、`allCompleted`——**不含**上述任何行为字段。因此 Prompt 中的「游戏行为摘要」永远输出「（无行为数据）」。

---

## 三、设计方案

### 3.1 核心思路

不是给 AI 塞数据表，而是提供**对比和异常**——让 AI 看到"哪里有矛盾"、"哪里不同于平均"、"哪里有模式"。

**设计原则：**
- 行为数据作为**叙事钩子**，不作为评估依据
- 宁可少而精，不要面面俱到
- 用对比创造"被说中感"：最快 vs 最慢、高方差 vs 低方差、直觉 vs 审慎

### 3.2 架构：新增 `behavior-narrative.js` 提取层

位于 `store.js`（数据读取）和 `insight.js`（AI 调用）之间：

```
                    store.loadAll()
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    integrator.js   behavior-narrative   (未来层)
    (14维分数)       .js (NEW)              
          │               │
          ▼               ▼
    translator.js   ┌─────────────┐
          │         │ insight.js  │
          │         │ buildPrompt │
          └─────────┤ (profile +  │
                    │  translation│
                    │  + behavior)│
                    └──────┬──────┘
                           ▼
                    AI Portrait
```

### 3.3 行为叙事产出结构

```js
// behavior-narrative.js 导出的核心函数签名
function extractBehaviorNarrative() → BehaviorNarrative

// 产出结构
{
  g1: {
    decisionStyle: '审慎型' | '直觉型' | '均衡型',
    avgTimeMs: 2430,
    timeVariance: '高' | '低',        // 高 = 场景间区分明显
    anchors: [
      { scenarioLabel: '帮助他人成功', timeMs: 4720, type: 'slowest' },
      { scenarioLabel: '做出一番成就', timeMs: 910,  type: 'fastest' },
      { scenarioLabel: '获得他人认可', timeMs: 3980, type: 'slowest' },
    ],
    trend: '先快后慢' | '先慢后快' | '匀速',
    trendNote: '前3题平均 1.2s，后3题平均 3.8s — 越做越犹豫'
  },

  g2: {
    explorationStyle: '目标型' | '探索型' | '均衡型',
    cardsFlipped: 9,
    cardsSelected: 6,
    primaryAnchor: 'TF',
    primaryLabel: '技术职能',
    secondaryAnchor: 'GM',
    secondaryLabel: '综合管理',
    anchorGap: 3.2,                  // 首选与次选分差
    gapNote: '差距明显' | '旗鼓相当',
  },

  g3: {
    cognitiveRhythm: '直觉型' | '均衡型' | '审慎型',
    impulseScore: 7.2,
    selfKnownCount: 5,               // 🟢组数量
    selfAmbiguousCount: 2,           // 🟡组数量
    stage1Sec: 18,
    stage2Sec: 12,
    rhythmNote: '你很快完成了分组（18s），但在排序时花了12秒——你知道自己是谁，只是不确定哪个更重要。'
  },

  g4: {
    meaningStyle: '深度内化' | '搜寻型' | '平衡型',
    avgReactionMs: 2840,
    resonantStory: '时间',
    resonantLabel: '关于时间的故事',
    struggleStory: '告别',
    struggleLabel: '关于告别的故事',
    presenceSearchGap: 2.1,
    gapNote: '临在感略高于追寻感' | '几乎相同' | '追寻感远超临在感',
  },
}
```

### 3.4 Prompt 改造

当前 `buildInsightPrompt` 签名：
```js
function buildInsightPrompt(profile, translation)
```

改为：
```js
function buildInsightPrompt(profile, translation, behaviorNarrative)
```

Prompt 中行为摘要部分的改造：

**改前：**
```
### 游戏行为摘要
G1最高驱动力：成就 G2前3锚点：TF、GM、AU G3类型：分析型 G4类型：成长型
```

**改后（行为叙事）：**
```
### 行为叙事——你如何与游戏互动

决策风格：偏审慎（平均 2.4s）。在关于"帮助他人成功"的场景你花了 4.7 秒——那是你唯一犹豫超过 4 秒的题。而关于"做出一番成就"你只用了 0.9 秒。前3题你果断，后3题你明显放慢——越到后面你越想得多。

探索模式：在职业锚游戏中，你只翻了 9 张卡片就完成了选择，属于目标明确型。你最重要的两个锚是技术职能（TF）和综合管理（GM），前者比后者高了 3.2 分——你对核心方向相当笃定。

认知节奏：你凭直觉快速分组（18s），但排序花了 12 秒——知道自己是谁，只是不确定哪个特质更重要。这种"认知清晰但排序犹豫"是一个有意思的组合。

意义唤起：关于"时间"的故事你反应最快，似乎这个主题天然触动你。而"告别"让你想得最久。你的临在感和追寻感几乎持平——你在意义这件事上既在场，又在寻找。
```

这段约 300 字的叙事成为 AI 生成肖像时最重要的"素材"——它不是告诉 AI 结论，而是给 AI 具体的观察点。

### 3.5 数据补采集方案

| # | 补采集项 | 文件 | 方案 |
|---|---------|------|------|
| 1 | G2 翻牌记录 | `games/game2-career-anchor.html`（编排层） | 在阶段一的翻牌事件中增加 flip 记录数组，写入 `decisions[]` 或 meta |
| 2 | G1 场景标题 | `js/layers/behavior-narrative.js` | 新建模块中静态 import G1 数据做 scenarioId → title 映射（不修改 engine） |
| 3 | G4 双反应间隔 | `games/game4-meaning-construction.html`（编排层） | 在 reaction ① 点击时记录时间戳，与反应②点击时间求差 |

---

## 四、实施计划

### Phase 1: 数据管道打通（先验叙事质量）

| 步骤 | 内容 | 产出 |
|:---:|------|------|
| 1.1 | 新建 `js/layers/behavior-narrative.js` | 核心提取函数 |
| 1.2 | 修改 `insight.js` —— `buildInsightPrompt` 接受 behaviorNarrative | 行为叙事写入 Prompt |
| 1.3 | 修改 `results.html` —— 集成调用链 | 端到端串联 |
| 1.4 | 用 synthetic users 验证 Prompt 输出质量 | 确认 AI 能否利用行为叙事 |

### Phase 2: 补采集盲区

| 步骤 | 内容 | 产出 |
|:---:|------|------|
| 2.1 | G2 编排层补翻牌记录 | cardsFlipped 数据就绪 |
| 2.2 | G4 编排层补双反应间隔 | reactionGap 数据就绪 |
| 2.3 | G1 场景标题映射（behavior-narrative 内置） | scenario labels 就绪 |

### Phase 3: 精调与上线

| 步骤 | 内容 |
|:---:|------|
| 3.1 | actual user 测试，调整叙事钩子的选择和措辞 |
| 3.2 | Prompt token 长度评估（新增 ~400 tokens，在 1024 maxTokens 容限内） |
| 3.3 | 部署到 CloudBase |

---

## 五、风险与约束

| 风险 | 应对 |
|------|------|
| Prompt 过长导致 API 截断 | behaviorNarrative 字段控制精简，总计 ~400 汉字 |
| 缓存失效 | behaviorNarrative 不参与 hash 计算——行为数据每次不同，不缓存 |
| 部分游戏完成时 behaviorNarrative 部分缺失 | `extractBehaviorNarrative()` 对未完成游戏返回 null 字段，buildPrompt 中条件渲染 |
| G2 翻牌数据需要重新玩游戏才能采集 | 新用户直接受益，老用户行为叙事会缺失 G2 explorationStyle |
| AI 可能"编造"行为解读 | Prompt 中强调"不要编造场景内容，直接引用提供的行为叙事" |

---

## 六、附录：当前行为摘要在 Prompt 中的断裂

`insight.js` 第 39-46 行引用了不存在的 meta 字段：

```js
// 当前代码——这些字段在 integrator.js 产出的 profile.meta 中不存在
if (meta.g1TopDrive) behaviors.push(...);
if (meta.g2TopAnchors) behaviors.push(...);
if (meta.g3Type) behaviors.push(...);
if (meta.g4Type) behaviors.push(...);
```

这些行为标签实际上分散在各游戏的 `behaviorSummary` 中（如 `game2.behaviorSummary.primaryAnchor`），但从未被整合进 profile。方案中的 `behavior-narrative.js` 将负责这个整合工作。

---

**下一步讨论议题：**
1. 先跑 Phase 1（不谈补采集）验证叙事质量，还是 Phase 1+2 一起做？
2. behaviorNarrative 的"分档阈值"——如 avgTime 多快算「直觉型」、多慢算「审慎型」——从 synthetic users 抽样还是设定初始阈值后迭代？
3. Prompt 中行为纳事的措辞风格——自然段落 vs 要点式？
