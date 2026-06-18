# 二、技术实现与方法参考

## 2.1 游戏引擎：策略模式 + 状态机 + 过程行为追踪

MindMatch 的 4 款心理学测评游戏共用同一套引擎架构（`js/games/engine.js`），采用 **策略模式（Strategy Pattern）**[^6] 实现编排层与交互层的解耦：

```
Engine (编排层) ──→ Strategy (交互层)
  状态机 + 数据管道      渲染 + 用户交互
```

引擎定义了 4 个标准生命周期阶段（INTRO → SCENARIO ↔ FEEDBACK → COMPLETION），通过 `_validTransitions` 状态转移表进行严格的状态机守卫，非法跳转会抛出异常。每个阶段的 Strategy 方法均返回 Promise，引擎通过 `await` 串行编排，保证异步渲染的顺序性。

**行为追踪管道**：引擎在内部维护 `_rawScores`（维度累加器）、`_decisions`（决策记录数组）和 `_totalTime`（累计用时）。每轮情境中，Strategy 返回 `DecisionRecord`（含 `scenarioId`、`chosenOptionId`、`decisionTime`），引擎据此：
1. 按选项权重累加维度原始分（`_accumulateWeights`）
2. 累积决策时间（用于过程行为分析）
3. 触发回调（`onProgress` / `onDecision` / `onComplete`）

游戏完成后，引擎调用 `_calculateOutput()` 执行 **Min-Max 归一化**[^7]（`rawRange → [0,1] → outputRange`），输出标准化 `GameOutput`（含 14 维标准化分数 + 决策记录 + 元数据）并通过 `save()` 持久化到 localStorage。

**方法参考**：Strategy Pattern (Gamma et al., 1994)；有限状态机（FSM）理论；Min-Max 特征归一化。

---

## 2.2 14 维人格画像引擎：多源数据融合与标准化

`integrator.js` 实现从 4 款游戏到统一画像的数据融合管道。14 个维度按来源分组：

| 游戏 | 维度数 | 维度名 | 原始范围 | 标准化方法 |
|------|:--:|------|:--:|------|
| G1 核心驱动力 | 3 | nAch, nPow, nAff | [0, 10] | `x / 10` |
| G2 职业锚 | 8 | TF, GM, AU, SE, EC, SV, CH, LS | [0, 10] | `x / 10` |
| G3 认知风格 | 1 | wholistAnalytic | [-1, +1] | `(x+1) / 2` |
| G4 意义建构 | 2 | presence, search | [0, 10] | `x / 10` |

`integrate()` 函数从 `loadAll()` 读取 localStorage 数据，对每个游戏的维度独立标准化到 `[0, 1]` 区间，输出 `UnifiedProfile` 结构。**支持部分完成**：未完成的维度设为 `null`，不阻断后续管道，下游模块按需跳过或使用默认值。

画像引擎同时保留 `raw`（原始分 0-10）供 translator（文本翻译层）按分档匹配文案，以及 `meta`（总时长、完成游戏列表）供进度追踪。这种"标准化分数 + 原始分数"双轨存储的设计参考了心理测量学中**多特质多方法矩阵（MTMM）**[^8] 的理念——不同测量工具（4 款游戏）通过统一量纲映射到同一人格空间。

---

## 2.3 双轨职业匹配引擎：高斯核 + 线性加权 + TOPSIS

匹配引擎（`matcher.js`）采用**双轨混合架构**，融合两种互补决策方法，取长补短：

### 轨道一：线性加权匹配（`matcher_linear.js`）

核心创新在于用**高斯核函数（Gaussian Kernel）**[^9] 替代传统阶跃函数或线性距离：

$$M(a, i) = \exp\left(-\frac{(a - i)^2}{2\sigma^2}\right)$$

其中 $a$ 为用户实际维度值，$i$ 为职业理想值，$\sigma = 0.20$ 为带宽参数（经 20260610d 版本调优）。相比阶跃函数（硬阈值），高斯核提供了连续、可导的匹配曲面，避免了"差 0.01 就完全不匹配"的边界问题。

匹配采用**两阶段加权**：
1. **Phase 1 游戏内聚合**：同一游戏的若干维度按 `profiles[].weight` 加权平均
2. **Phase 2 游戏间加权**：4 款游戏的得分按 `gameWeights`（默认各 0.25）合成总分

### 轨道二：TOPSIS 距离法匹配（`matcher_topsis.js`）

TOPSIS（Technique for Order Preference by Similarity to Ideal Solution）[^10] 是经典的多准则决策方法，6 步流程：

1. 构建匹配度矩阵 $D_{m \times n}$（$m$ 个职业，$n$ 个维度）
2. 向量归一化：$R_{ij} = D_{ij} / \sqrt{\sum_k D_{kj}^2}$
3. 加权：$V_{ij} = R_{ij} \times w_j$（使用各职业独立的维度权重）
4. 确定正/负理想解 $A^+$/ $A^-$
5. 计算欧氏距离 $d^+$/ $d^-$
6. 贴近度：$C_i = d_i^- / (d_i^+ + d_i^-)$

### 双轨一致性检查

`needsAIReview()` 比较两轨道的 Top 1 是否一致、排名差是否 ≥ 2、TOPSIS 最高贴近度是否 < 0.6，任一触发则标记 `needsAIReview = true`，提示用户 AI 深度咨询。

**v2.0 扩展**：`matchExtended()` 实现**两级匹配**——先匹配 6 大方向，再在 Top 3 方向内匹配 9 个具体职业（共 54 个职业变体），通过分数对比度拉伸（`stretched = mean + (score - mean) × 1.4`）增强区分度。

---

## 2.4 行为叙事提取层：过程量 → 叙事文本

`behavior-narrative.js` 实现了一项关键创新——**将游戏过程数据（反应时、选择序列、卡片浏览数）转化为可读的行为叙事文本**，供 AI 深度解读。这个模块独立于维度分计算，关注的是"你怎么做"而非"你选了哪个"。

每款游戏有独立的提取逻辑和阈值常量（经 Phase 3 精调）：

| 游戏 | 提取维度 | 关键阈值 | 叙事输出示例 |
|------|---------|---------|------------|
| G1 | 决策风格、时间波动、快慢锚点、节奏趋势 | FAST=2000ms, SLOW=3600ms, VAR=2.5 | "偏直觉型（平均 1.8s），'团队冲突'场景花了 5.2s" |
| G2 | 探索风格、锚差距 | VIEW_TARGET=1.2, ANCHOR_GAP=3.0 | "目标型（查看了28个社团，最终加入22个），核心锚是自主独立和技术职能" |
| G3 | 认知节奏、自知/模糊卡片数 | IMPULSE_HIGH=7, RHYTHM_RATIO=0.6 | "偏直觉型，你凭直觉快速分组但排序时认真权衡" |
| G4 | 意义唤起模式、共鸣/纠结场景 | PRESENCE_FAST=2000ms, GAP=0.8 | "深度内化，'守护'让你最有临在感，'漂泊'让你想得最久" |

`formatBehaviorNarrative()` 将结构化数据序列化为自然语言段落，注入到 AI Prompt 中，使 AI 能基于"用户在第 3 个情境花了 8 秒才决定"这样的具体行为给出个性化解读[^11]。

---

## 2.5 Agent v2 对话引擎：4 阶段编排 + Function Calling + LLM Fallback

Agent v2（`agent-v2/`）是 MindMatch 的 AI 职业顾问后端，基于 **OpenAI Function Calling 规范**[^12] 实现结构化对话编排。部署在腾讯云 SCF（云函数），通过 DeepSeek API 驱动。

### 6 步编排流程

`handler.mjs` 的 `handleChat()` 实现 6 步严格编排（Step 1-6），每步有独立的容错边界：

1. **ensureSession**：创建/加载会话，已完成会话直接返回 `COMPLETED_REPLY`
2. **advanceIfNeeded**：轮次超限自动推进到下一阶段（`checkAndAdvance`）
3. **injectAntiDup**：提取已问问题、最近关键词、已讨论话题，动态注入防重复指令到 system prompt
4. **callLLM**：调用 DeepSeek API（`deepseek-chat`），失败则自动 fallback 到混元（`hunyuan-lite`）[^13]
5. **handleToolCalls**：执行 3 个注册工具（`advance_phase` / `save_collected` / `finish_conversation`），结果回传 LLM；触发 Follow-up 检测
6. **postprocess**：`ensureEndsWithQuestion()` 强制回复以问句结尾，无问句则注入兜底追问

### 4 阶段对话设计

| 阶段 | 目标 | 轮次 | 核心工具 |
|------|------|:--:|------|
| 1 结果共鸣 | 让用户感受到"被理解" | 2-3 | save_collected（采集情绪/认同点） |
| 2 深度挖掘 | 追问行为背后原因 | 3-4 | save_collected（采集价值观/动机） |
| 3 现实校准 | 将画像与真实背景对接 | 2-3 | save_collected（采集现实约束） |
| 4 行动地图 | 输出可执行的方向建议 | 2-3 | finish_conversation |

### 工具注册表模式

`tools.mjs` 实现**动态工具枚举 + 自动愈合**：每个阶段只暴露该阶段允许的工具，通过 `getTools()` 根据 `phase` 和 `phaseTurns` 动态过滤。工具参数（如 `advance_phase` 的 `toPhase` 选项）也在运行时动态注入，防止 LLM 幻觉跳阶。

### Prompt 模块化组装

`prompt/` 目录实现 5 模块拼接：`role.mjs`（角色人设 50-100 字）→ `profile-context.mjs`（14 维画像 + 行为叙事注入）→ `stages-prompts.mjs`（当前阶段的对话指令模板）→ `style.mjs`（语气规则：用"你"、不用标签、不夸赞）→ `anti-dup.mjs`（动态防重复块）。

---

## 2.6 AI 方向验证实验生成

`experiment.js` 将 AI 从"给建议者"转变为"实验设计者"。基于用户的 14 维画像 + 方向排名 + 行为叙事，通过 DeepSeek API 生成 4 种类型的可执行微型实验：

| 类型 | 设计意图 | 方法参考 |
|------|---------|---------|
| 🧪 行为实验 | 模拟方向核心活动 | 行为激活疗法（BAT）[^14] |
| 📝 观察实验 | 记录模式/冲动 | 经验抽样法（ESM）[^15] |
| 💬 对话实验 | 与从业者深度交流 | 信息性访谈（Informational Interview） |
| ❓ 否定实验 | 刻意停止 → 观察缺失感 | 减法实验（Subtraction Design）[^16] |

每个实验约 80-120 字，包含"做什么 → 观察什么 → 为什么能验证"三段结构，引用用户具体数据（维度分数、反应时、锚点），通过 `callWithFallback()` 调用 LLM API（DeepSeek 优先，混元 fallback），结果缓存到 localStorage 以节约 token。

---

[^6]: Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley.

[^7]: Han, J., Kamber, M., & Pei, J. (2012). *Data Mining: Concepts and Techniques* (3rd ed.). Morgan Kaufmann. Chapter 3: Data Preprocessing.

[^8]: Campbell, D. T., & Fiske, D. W. (1959). Convergent and discriminant validation by the multitrait-multimethod matrix. *Psychological Bulletin*, 56(2), 81–105.

[^9]: Rasmussen, C. E., & Williams, C. K. I. (2006). *Gaussian Processes for Machine Learning*. MIT Press. Chapter 4: Covariance Functions.

[^10]: Hwang, C. L., & Yoon, K. (1981). *Multiple Attribute Decision Making: Methods and Applications*. Springer-Verlag.

[^11]: 过程行为分析参考了心理测量学中的"行为残差"概念。参见 Furr, R. M. (2018). *Psychometrics: An Introduction* (3rd ed.). SAGE.

[^12]: OpenAI. (2023). *Function Calling Guide*. https://platform.openai.com/docs/guides/function-calling

[^13]: 腾讯混元大模型 API 文档。https://cloud.tencent.com/document/product/1729

[^14]: Jacobson, N. S., Martell, C. R., & Dimidjian, S. (2001). Behavioral activation treatment for depression: Returning to contextual roots. *Clinical Psychology: Science and Practice*, 8(3), 255–270.

[^15]: Csikszentmihalyi, M., & Larson, R. (1987). Validity and reliability of the Experience-Sampling Method. *The Journal of Nervous and Mental Disease*, 175(9), 526–536.

[^16]: Adams, G. S., Converse, B. A., Hales, A. H., & Klotz, L. E. (2021). People systematically overlook subtractive changes. *Nature*, 592, 258–261.
