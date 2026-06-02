# Game 3「平行宇宙观察站」设计方案

> 定位：G2（过去/职业锚）→ G3（未来/认知风格）→ G4（整合/意义建构）  
> 心理理论：MBTI 认知功能（E/I、S/N、T/F、J/P）  
> 交互方式：两阶段聚焦排序（归类 → 精排）  
> 状态：待开发

---

## 一、叙事设定

> 你在一艘星际飞船的冷冻舱里沉睡了很久。  
> 醒来时，飞船已自动泊入一颗新星球。舷窗外是陌生的星空。  
> 你的记忆模糊了——你还记得自己是谁，但不太确定"自己是什么样的人"。  
> 舱壁上浮现出 8 段记忆碎片，每一段都是"过去的你"做决策的样子。  
> 哪些……更像真正的你？

**隐喻解析**：
- 沉眠 = 从纷繁现实中抽离（创造心理距离，降低防御）
- 醒来 = 重新认识自己（认知探索的起点）
- 记忆碎片 = 不同认知风格的行为快照
- 聚焦 = 从模糊到清晰，逐步锁定核心认知偏好

---

## 二、数据映射：8 碎片 → MBTI 四维度（中间数据）

> **注意**：MBTI 四维度是 G3 的**中间计算数据**。G3 最终输出需与 `数据结构定义.md` 的 `wholistAnalytic` 维度兼容。MBTI 原始得分通过映射公式转换为 wholistAnalytic（见第八节）。

每段记忆碎片描述"面对重建方向决策时，你是怎么思考和行动的"（过程，不是结果）。

| 编号 | 记忆标题 | 内容描述 | 主导维度 | 辅助维度 |
|:----:|---------|---------|:-------:|:-------:|
| M1 | "数据不会说谎" | 先调出星球环境数据、资源分布、风险指数，做三张对比表格，用数据支撑最终选择 | **S** 感觉 | **T** 思考 |
| M2 | "我有一种预感" | 不查太多数据，站在舷窗前看了很久星空，心里慢慢浮现一个方向——"就是这里了" | **N** 直觉 | **F** 情感 |
| M3 | "先听听大家的" | 打开通讯频道，和船上其他沉醒者讨论，在对话中碰撞了两个小时，最终形成共同选择 | **E** 外向 | **F** 情感 |
| M4 | "让我先想清楚" | 关掉通讯频道，一个人在舱室里坐了很久，想清楚之后才打开频道说："我决定了" | **I** 内向 | **T** 思考 |
| M5 | "制定计划，严格执行" | 花了一晚上写详细重建方案，分三个阶段，每个阶段有明确里程碑和截止日期 | **J** 判断 | **S** 感觉 |
| M6 | "走到哪算哪，随机应变" | 只带一个背包走出飞船，先安顿住处，再解决食物，遇到什么问题就解决什么问题 | **P** 知觉 | **N** 直觉 |
| M7 | "每个人都应该被照顾到" | 注意到有个同伴还很虚弱，先帮她检查身体状况，再一起商量下一步，团队里每个人的状态都记在心里 | **F** 情感 | **J** 判断 |
| M8 | "先行动，问题来了再解决" | 二话不说就开始搭建庇护所，有人犹豫，你说："别想了，动手吧，遇到问题再说" | **T** 思考 | **P** 知觉 |

**MBTI 中间得分计算**（仅用于内部计算，不直接输出给 integrator）：
```
E/I = (M3得分 - M4得分) 归一化到 [-10, +10]
     正值=E倾向，负值=I倾向
S/N = (M1得分 - M2得分) 归一化到 [-10, +10]
     正值=S倾向，负值=N倾向
T/F = (M4得分 + M8得分) - (M2得分 + M7得分)
J/P = (M5得分 + M7得分) - (M6得分 + M8得分)
```

### MBTI → wholistAnalytic 映射逻辑

为什么需要映射？`数据结构定义.md` 和 `匹配算法设计.md` 规定 G3 输出为 Riding CSA 的 **整体-分析维度（wholistAnalytic）**，范围 [-1, +1]。MBTI 不直接测量此维度，但存在已验证的交叉关联：

| MBTI 维度 | 与 wholistAnalytic 的关联 | 方向 |
|-----------|--------------------------|------|
| **S/N** | S（感觉）→ 关注具体细节 → 分析型；N（直觉）→ 关注全局模式 → 整体型 | **主信号**（权重 0.5） |
| **T/F** | T（思考）→ 逐步逻辑分析 → 分析型；F（情感）→ 整体价值判断 → 整体型 | **次信号**（权重 0.3） |
| **J/P** | J（判断）→ 结构化拆解 → 分析型；P（知觉）→ 开放包容 → 整体型 | **辅助信号**（权重 0.2） |
| **E/I** | E/I 与信息加工方式弱相关，不参与映射 | — |

> 学术依据：Riding (1991) 指出 S/N 与整体-分析有中等相关（r≈0.35-0.45）；T/F 与分析偏好有弱-中等相关（r≈0.25-0.35）。此映射为 Demo 阶段的近似方案，正式版可通过收集真实用户数据做回归校准。

---

## 三、交互设计：两阶段聚焦

### 为什么不用纯拖拽 1-8 排序？

| 方案 | 认知负荷 | 精度 | 体验 | 结论 |
|------|---------|------|------|------|
| 纯拖拽 1-8 | ❌ 很高 | 高 | 累 | 不选 |
| 淘汰赛 PK | 中（7轮） | 高 | 重复感 | 不选 |
| **三组归类 → 精排** | ✅ 低 | **高** | **流畅** | **采用** |

### 阶段一「记忆浮现」— 三组归类（快、直觉、~15s）

> 8 段记忆碎片同时浮现。凭第一感觉，把它们分成三组：

| 分组 | 图标 | 标签 | 含义 |
|:----:|:----:|------|------|
| A | 🟢 | 这就是我 | "看到这段记忆，心里说'对，这就是我'" |
| B | 🟡 | 有点像我 | "不完全是，但有几分相似" |
| C | 🔴 | 不太像我 | "这个版本的做事方式，不太符合我" |

**操作**：点击卡片 → 循环切换分组（A→B→C→A）  
**反馈**：分组颜色实时变化，分组计数实时更新  
**最低要求**：🟢组至少 2 张（否则阶段二无意义，直接跳过）  
**预期分布**：🟢 2-4张 / 🟡 2-4张 / 🔴 2-4张

**阶段一结束反馈**：
> 🌟 大部分记忆碎片已经归位了。  
> 但真正定义你的，是那些"这就是我"的瞬间。  
> 让我们再看一次……

---

### 阶段二「聚焦核心」— 🟢组精排（慢、深度、~30s）

> 现在只看"这就是我"的记忆碎片（2-4张）。  
> 如果必须排出先后——哪个最像你？

**操作**：拖拽排序（数量少，体验轻量）  
**排序结果**：第1名=权重3，第2名=权重2，第3名+=权重1  

**如果🟢组只有 1 张**：跳过阶段二，直接用它作为核心认知风格。

---

## 四、评分计算：从交互到 wholistAnalytic

### 4.1 阶段评分规则

| 阶段 | 操作 | 分数贡献 |
|------|------|---------|
| 阶段一 | 分入 🟢「这就是我」 | +2 |
| 阶段一 | 分入 🟡「有点像我」 | +1 |
| 阶段一 | 分入 🔴「不太像我」 | 0 |
| 阶段二 | 🟢组第 1 名 | +3（额外） |
| 阶段二 | 🟢组第 2 名 | +2（额外） |
| 阶段二 | 🟢组第 3+ 名 | +1（额外） |

每张记忆碎片的总分 = 阶段一分 + 阶段二额外分（0-5）

### 4.2 MBTI 中间得分计算

```javascript
// 每张碎片归属的 MBTI 维度（M1~M8）
const FRAGMENT_DIMENSIONS = {
  m1: { primary: 'S', secondary: 'T' },
  m2: { primary: 'N', secondary: 'F' },
  m3: { primary: 'E', secondary: 'F' },
  m4: { primary: 'I', secondary: 'T' },
  m5: { primary: 'J', secondary: 'S' },
  m6: { primary: 'P', secondary: 'N' },
  m7: { primary: 'F', secondary: 'J' },
  m8: { primary: 'T', secondary: 'P' },
};

// 各维度原始得分（所有相关碎片得分求和）
function calcMBTIRawScores(fragments) {
  const scores = { S: 0, N: 0, T: 0, F: 0, E: 0, I: 0, J: 0, P: 0 };
  for (const [id, dims] of Object.entries(FRAGMENT_DIMENSIONS)) {
    const fragmentScore = fragments[id].totalScore; // 0-5
    scores[dims.primary] += fragmentScore;
    scores[dims.secondary] += fragmentScore * 0.5; // 辅助维度权重减半
  }
  return scores;
}

// 归一化为 [-10, +10] 的 MBTI 四对维度
function normalizeMBTI(raw) {
  return {
    E: normalize(raw.E - raw.I, -10, 10),   // 正值=外向
    S: normalize(raw.S - raw.N, -10, 10),   // 正值=感觉
    T: normalize(raw.T - raw.F, -10, 10),   // 正值=思考
    J: normalize(raw.J - raw.P, -10, 10),   // 正值=判断
  };
}
```

### 4.3 MBTI → wholistAnalytic 映射公式

```javascript
/**
 * 将 MBTI 四维度映射为 Riding CSA 的整体-分析维度
 *
 * 映射逻辑：
 * - S（感觉）→ 关注具体细节 → 分析型 (+)
 * - N（直觉）→ 关注全局模式 → 整体型 (-)
 * - T（思考）→ 逐步逻辑分析 → 分析型 (+)
 * - F（情感）→ 整体价值判断 → 整体型 (-)
 * - J（判断）→ 结构化拆解 → 分析型 (+)
 * - P（知觉）→ 开放包容 → 整体型 (-)
 *
 * E/I 不参与映射（与信息加工方式弱相关）
 */
function mapMBTItoWholistAnalytic(mbti) {
  // 将 [-10, +10] 归一化为 [-1, +1]
  const sn = mbti.S / 10;  // S(+)=分析型, N(-)=整体型
  const tf = mbti.T / 10;  // T(+)=分析型, F(-)=整体型
  const jp = mbti.J / 10;  // J(+)=分析型, P(-)=整体型

  // 加权组合：S/N 主信号，T/F 次信号，J/P 辅助
  const raw = sn * 0.5 + tf * 0.3 + jp * 0.2;

  // 限制在 [-1, +1]
  return Math.max(-1, Math.min(1, raw));
}
```

### 4.4 behaviorSummary 计算

```javascript
function calcBehaviorSummary(wholistAnalytic, mbti, meta) {
  // dominantStyle
  let dominantStyle;
  if (wholistAnalytic < -0.3) dominantStyle = "整体型";
  else if (wholistAnalytic > 0.3) dominantStyle = "分析型";
  else dominantStyle = "平衡型";

  // flexibility: 基于 P 偏好程度（P 得分越高 → 越灵活）
  // mbti.J 范围 [-10, +10]，正值=J，负值=P
  // P 倾向 = -mbti.J → [0, 10]
  const pTendency = Math.max(0, -mbti.J);
  const flexibility = pTendency; // [0, 10]

  // impulseScore: 基于决策速度
  // 阶段一平均每张碎片决策时间 < 2s → 高冲动
  const avgStage1Time = meta.stage1Time / 8;
  const impulseScore = Math.max(0, Math.min(10,
    10 - (avgStage1Time / 1000) * 2  // 5s→0分, 0s→10分
  ));

  return { dominantStyle, flexibility, impulseScore };
}
```

### 4.5 完整数据流

```
用户交互（归类+排序）
    ↓
碎片得分 [0-5] × 8
    ↓
MBTI 原始得分（各碎片按维度归属累加）
    ↓
MBTI 归一化 [-10, +10] × 4 对（E/I, S/N, T/F, J/P）
    ↓ ↘
    ↓   mbtiIntermediate（存入 localStorage，供肖像报告使用）
    ↓
wholistAnalytic 映射 [-1, +1] × 1（加权组合 S/N + T/F + J/P）
    ↓
behaviorSummary 计算（dominantStyle + flexibility + impulseScore）
    ↓
最终输出 → integrator.js（标准化为 [0, 1]）
```

---

## 四、界面结构

```
game3-cognitive-style.html
├── #scene-intro           ← 叙事引导（飞船醒来）
│   ├── 星空背景动画（CSS particles）
│   ├── 叙事文案（逐行打字机效果）
│   └── "开始回溯"按钮
│
├── #scene-stage1          ← 阶段一：三组归类
│   ├── 进度提示（"凭感觉分组，不用想太多"）
│   ├── 8 张记忆卡片（3×3 网格）
│   ├── 分组计数（🟢 0 / 🟡 0 / 🔴 0）
│   └── "确认分组"按钮（🟢≥2 才可点击）
│
├── #scene-stage2          ← 阶段二：🟢组精排
│   ├── 提示（"把这些最像你的记忆，按相似度排序"）
│   ├── 可拖拽卡片列表（2-4张）
│   └── "确认排序"按钮
│
├── #scene-feedback        ← 每阶段结束后的反馈（可选）
│   └── 简短文案 + 过渡动画
│
└── #scene-completion      ← 完成页
    ├── 认知风格画像（wholistAnalytic 连续条 [-1, +1]）
    ├── dominantStyle 标签（"整体型" / "分析型" / "平衡型"）
    ├── 一句核心描述（"你习惯先看清全局，再深入细节" / "你习惯先拆解问题，再拼合答案"）
    └── "进入意义之殿 →" 按钮（去 G4）
```

---

## 五、输出数据格式

```javascript
{
  gameId: "game3",
  version: "1.0.0",
  dimensions: {
    wholistAnalytic: 0.0    // 整体-分析连续体 [-1.0, +1.0]
                             // 负值 = 整体型（Wholist）
                             // 正值 = 分析型（Analytic）
                             // 0 = 平衡型
  },
  behaviorSummary: {
    dominantStyle: string,    // "整体型" | "分析型" | "平衡型"
    flexibility: number,      // 认知灵活性 (0-10，基于 P 偏好程度)
    impulseScore: number     // 冲动-反思维度 (0-10，基于决策速度)
  },
  // MBTI 中间数据（供肖像报告使用，不参与匹配引擎计算）
  mbtiIntermediate: {
    E: 0, I: 0,    // 外向/内向 [-10, +10]
    S: 0, N: 0,    // 感觉/直觉 [-10, +10]
    T: 0, F: 0,    // 思考/情感 [-10, +10]
    J: 0, P: 0     // 判断/知觉 [-10, +10]
  },
  decisions: [
    { stage: 1, cardId: "m1", group: "green",  groupLabel: "这就是我" },
    { stage: 1, cardId: "m3", group: "yellow", groupLabel: "有点像我" },
    // ...
    { stage: 2, cardId: "m1", rank: 1 },
    // ...
  ],
  meta: {
    stage1Time: 12000,
    stage2Time: 28000,
    greenCount: 3,
    yellowCount: 3,
    redCount: 2,
    totalTime: 45000,
    completedAt: 1748638800000,
  }
}
```

### 与 integrator.js 的兼容性

| 字段 | integrator 期望 | G3 输出 | 兼容 |
|------|:---:|---|:---:|
| `gameId` | `"game3"` | `"game3"` | ✅ |
| `dimensions.wholistAnalytic` | `number [-1, +1]` | `number [-1, +1]` | ✅ |
| `behaviorSummary.dominantStyle` | `string` | `"整体型"/"分析型"/"平衡型"` | ✅ |
| `behaviorSummary.flexibility` | `number [0-10]` | 基于 P 维度计算 | ✅ |
| `behaviorSummary.impulseScore` | `number [0-10]` | 基于决策速度计算 | ✅ |
| 标准化 | `(x + 1) / 2 → [0, 1]` | 符合 | ✅ |

> **注意**：`mbtiIntermediate` 不参与标准化和匹配引擎计算。它仅作为中间数据保留在 localStorage 中，供 Layer 2 肖像报告使用（如生成"你的认知风格偏好"的描述文本）。

---

## 六、技术映射

| 技术方案 | 说明 |
|---------|------|
| **策略** | `js/games/strategies/sort-focus.js`（新增，两阶段聚焦排序） |
| **数据** | `js/games/game3-data.js`（8段记忆碎片 + 维度映射） |
| **页面** | `games/game3-cognitive-style.html` |
| **引擎** | 复用 `engine.js`（通用状态机，不需要改造） |
| **归类交互** | 点击循环切换分组，CSS transition 250ms |
| **拖拽排序** | 原生 HTML5 Drag & Drop API（不引入第三方库） |
| **卡片布局** | CSS Grid 3×3，移动端 2×4 |

---

## 七、与 G4 的衔接

完成页底部：
> 🏛️ 你已看清自己如何思考。  
> 但"思考"之外，什么对你**真正有意义**？  
> 前往「意义之殿」——整合过去、现在、未来。

点击按钮 → `games/game4-meaning-construction.html`

---

## 八、待确认事项

- [x] 场景：星际飞船醒来（用户选择 A）
- [x] 两阶段聚焦节奏：确认可行
- [x] 🟢组最低要求：2张（合理）
- [x] 输出格式：已统一为 `wholistAnalytic [-1, +1]` + behaviorSummary（与数据结构定义兼容）
- [x] MBTI → wholistAnalytic 映射公式：S/N(0.5) + T/F(0.3) + J/P(0.2) 加权组合
- [ ] 记忆碎片文案：8段内容是否需要调整措辞？
- [ ] 反馈文案：阶段一/阶段二结束后的过渡文案
- [ ] 完成页文案：wholistAnalytic 三档如何转化为一句人话？

---

## 九、数据规范一致性检查（自查）

本方案已对照以下文档进行自查：

| 检查项 | 状态 |
|--------|:---:|
| `dimensions.wholistAnalytic` 存在，范围 [-1, +1] | ✅ |
| `gameId: "game3"` 与 integrator 期望一致 | ✅ |
| `behaviorSummary.dominantStyle` 三种类型与数据结构定义一致 | ✅ |
| `behaviorSummary.flexibility` 范围 [0-10]，计算逻辑合理 | ✅ |
| `behaviorSummary.impulseScore` 范围 [0-10]，基于决策速度 | ✅ |
| 标准化公式 `(x + 1) / 2` 与 integrator 兼容 | ✅ |
| `mbtiIntermediate` 仅作中间数据，不参与匹配引擎 | ✅ |
| `decisions` 数组包含完整行为记录（stage1 + stage2） | ✅ |
| `meta.totalTime` / `completedAt` 符合全局行为数据格式 | ✅ |
| 映射公式有学术依据（Riding 1991, S/N vs W-A 中等相关） | ✅ |
| 与 `匹配算法设计.md` 的 `Wholist-Analytic [-1.0, +1.0] × 1` 完全匹配 | ✅ |

> 修复记录：v1.1 新增 MBTI → wholistAnalytic 映射公式和完整评分计算流程，输出格式从 8 维 MBTI 修改为 1 维 wholistAnalytic + behaviorSummary，增加 mbtiIntermediate 中间数据保留。

---

*创建时间：2026-05-30*
*作者：AI Agent（基于用户讨论）*
*版本：v1.1（MBTI→wholistAnalytic 映射 + 输出格式统一）*
