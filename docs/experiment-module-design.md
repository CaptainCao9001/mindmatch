// ============================================================
// M: experiment.js — 方向验证实验 AI 层
// 职责: 基于用户剖面对比 Top 方向，生成 4 个可执行的验证实验
// 模式: 镜像 insight.js（Prompt 构建 + API 调用 + 缓存）
// ============================================================

// 省略模块导入（实际实现时补上）

/**
 * 构建方向验证实验的 Prompt
 * @param {object} profile        - UnifiedProfile（14 维）
 * @param {object} directionReport - directionMatch() 的输出
 * @param {string} translationText - translator 翻译文本
 * @param {string} behaviorNarrative - 行为叙事文本
 * @returns {string}
 */
function buildExperimentPrompt(profile, directionReport, translationText, behaviorNarrative) {
  const topDir = directionReport[0];
  const top2 = directionReport[1];
  const top3 = directionReport[2];

  const dimSummary = Object.entries(profile.dimensions)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');

  return `你是 MindMatch 的职业方向验证顾问。你的任务是帮用户设计 4 个可执行的微型实验，让他们在现实生活中验证"这个方向是否适合我"。

## 用户的测试画像

### Top 方向
- 第1: ${topDir.directionName}（匹配 ${topDir.score}%）
- 第2: ${top2.directionName}（匹配 ${top2.score}%）
- 第3: ${top3.directionName}（匹配 ${top3.score}%）

### 14 维分数
${dimSummary}

### 人格翻译
${translationText || '（无翻译结果）'}

### 行为叙事
${behaviorNarrative || '（无行为叙事数据）'}

---

## 4 个实验的设计要求

你必须生成 4 个实验，每个实验必须在 80-120 字之间，用第二人称「你」，语气像朋友给你出主意。每个实验必须包含：
1. 「做什么」——具体、可执行、3-7 天内能完成
2. 「观察什么」——做完后关注什么信号
3. 「为什么能验证」——这个实验和方向的关系

### 实验类型（必须各一个）

🧪 行为实验 — 做一件模拟该方向核心活动的事。例：如果你的方向是「创意塑造者」，试着在 48 小时内从零完成一个小创作。观察你在过程中是感到心流还是煎熬。

📝 观察实验 — 记录/觉察一个模式。例：接下来 5 天，每次感到「想做点什么」或「不想做什么」时记下来。看这些冲动的方向和频率是否符合该方向的特征。

💬 对话实验 — 找一个该方向的从业者聊 30 分钟。不要问「这工作好不好」，要问「你一个典型周二下午在做什么」。观察你对 Ta 描述的那些琐碎日常是觉得「有意思」还是「好无聊」。

❓ 否定实验 — 刻意停止做一件该方向相关的事一周。例：如果你是「人际联结者」，试试一周不主动组局——看你会觉得「终于清净了」还是「缺了点什么」。缺失感就是方向信号。

### 约束
- 每个实验引用至少一个用户的具体数据（维度分数、行为叙事中的秒数或锚点、Top 方向名称）
- 不夸「你很适合」「你很优秀」
- 不做职业规划建议（如「去学 XX 技能」「去投 XX 岗位」）
- 只说「你可以试着做什么来验证」

---

## 输出格式

严格按以下 JSON 输出，不要输出任何 JSON 以外的内容：

{
  "directionName": "创意塑造者",
  "directionMatch": 85,
  "experiments": [
    {
      "type": "act",
      "icon": "🧪",
      "title": "10-15字的标题，用动词开头的祈使句",
      "body": "80-120字的实验描述，包含做什么、观察什么、为什么能验证。引用具体数据。用第二人称「你」。"
    },
    {
      "type": "observe",
      "icon": "📝",
      "title": "同上",
      "body": "同上"
    },
    {
      "type": "connect",
      "icon": "💬",
      "title": "同上",
      "body": "同上"
    },
    {
      "type": "negate",
      "icon": "❓",
      "title": "同上",
      "body": "同上"
    }
  ],
  "closingNote": "30-40字的收尾语，鼓励用户不要把匹配当结论，而是当探索的起点。"
}`;
}

// 完整模块实现省略（后续由工程师实现）
