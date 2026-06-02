// ============================================================
// G3 Data: 平行宇宙观察站 — 8段记忆碎片 + 维度映射 + 配置
// 职责: 纯数据定义，零逻辑
// ============================================================

// ---------- 8 段记忆碎片 ----------
// 每段对应 MBTI 维度的一个主导 + 辅助维度
// 内容描述「面对重建方向决策时，你是怎么思考和行动的」

export const FRAGMENTS = [
  {
    id: 'm1', title: '数据不会说谎',
    detail: '先调出星球环境数据、资源分布、风险指数，做三张对比表格，用数据支撑最终选择。',
    primary: 'S', secondary: 'T',
  },
  {
    id: 'm2', title: '我有一种预感',
    detail: '不查太多数据，站在舷窗前看了很久星空，心里慢慢浮现一个方向——「就是这里了」。',
    primary: 'N', secondary: 'F',
  },
  {
    id: 'm3', title: '先听听大家的',
    detail: '打开通讯频道，和船上其他沉睡者讨论，在对话中碰撞了两个小时，最终形成共同选择。',
    primary: 'E', secondary: 'F',
  },
  {
    id: 'm4', title: '让我先想清楚',
    detail: '关掉通讯频道，一个人在舱室里坐了很久，想清楚之后才打开频道说：「我决定了。」',
    primary: 'I', secondary: 'T',
  },
  {
    id: 'm5', title: '制定计划，严格执行',
    detail: '花了一晚上写详细重建方案，分三个阶段，每个阶段有明确里程碑和截止日期。',
    primary: 'J', secondary: 'S',
  },
  {
    id: 'm6', title: '走到哪算哪，随机应变',
    detail: '只带一个背包走出飞船，先安顿住处再解决食物，遇到什么问题就解决什么问题。',
    primary: 'P', secondary: 'N',
  },
  {
    id: 'm7', title: '每个人都应该被照顾到',
    detail: '注意到有个同伴还很虚弱，先帮她检查身体状况，再一起商量下一步，团队里每个人的状态都记在心里。',
    primary: 'F', secondary: 'J',
  },
  {
    id: 'm8', title: '先行动，问题来了再解决',
    detail: '二话不说就开始搭建庇护所。有人犹豫，你说：「别想了，动手吧，遇到问题再说。」',
    primary: 'T', secondary: 'P',
  },
];

// ---------- 维度映射（碎片ID → 维度归属） ----------
export const FRAGMENT_DIMENSIONS = {};
FRAGMENTS.forEach(f => {
  FRAGMENT_DIMENSIONS[f.id] = { primary: f.primary, secondary: f.secondary };
});

// ---------- 8维 MBTI 标签 ----------
export const MBTI_LABELS = { S: 'S', N: 'N', T: 'T', F: 'F', E: 'E', I: 'I', J: 'J', P: 'P' };

// ---------- 阶段一：分组配置 ----------
export const GROUPS = [
  { key: 'green',  label: '这就是我', emoji: '🟢', score: 2, hint: '「对，这就是我」' },
  { key: 'yellow', label: '有点像我', emoji: '🟡', score: 1, hint: '「不完全是，但有几分相似」' },
  { key: 'red',    label: '不太像我', emoji: '🔴', score: 0, hint: '「这个版本的做事方式，不太符合我」' },
];

// ---------- 阶段二：排序权重 ----------
export const RANK_WEIGHTS = [3, 2, 1]; // 第1名+3, 第2名+2, 第3+名+1

// ---------- 阶段配置 ----------
export const STAGES = [
  {
    id: 1,
    name: '记忆浮现',
    subtitle: '凭第一感觉分组',
    description: '8 段记忆碎片同时浮现。凭第一感觉，把它们分成三组。',
    instruction: '点击卡片 → 循环切换分组 → 不用想太多',
    minGreen: 2, // 🟢组至少 2 张才能进入阶段二
  },
  {
    id: 2,
    name: '聚焦核心',
    subtitle: '哪个最像你？',
    description: '现在只看「这就是我」的记忆碎片。如果必须排出先后——哪个最像你？',
    instruction: '拖拽卡片排序 → 排第一的最像你',
  },
];

// ---------- 反馈文案 ----------
export const FEEDBACK_TEXT = {
  stage1: '🌟 大部分记忆碎片已经归位了。\n\n但真正定义你的，是那些「这就是我」的瞬间。\n\n让我们再看一次……',
};

// ---------- 完成页：3 种认知风格描述 ----------
export const STYLE_TEXTS = {
  wholist: {
    label: '整体型',
    emoji: '🌐',
    title: '你习惯先看清全局，再深入细节',
    desc: '面对复杂问题时，你倾向于先理解整体框架和系统关系，再决定从哪里下手。你的认知方式让你善于看到大局，捕捉不同信息之间的关联。',
  },
  analytic: {
    label: '分析型',
    emoji: '🔬',
    title: '你习惯先拆解问题，再拼合答案',
    desc: '面对复杂问题时，你倾向于先把它拆成可管理的模块，逐步分析每个部分。你的认知方式让你善于深入细节，有条不紊地推进。',
  },
  balanced: {
    label: '平衡型',
    emoji: '⚖️',
    title: '你灵活切换整体和细节，因事制宜',
    desc: '面对复杂问题时，你能够在宏观视角和微观分析之间自由切换——需要大局观时看全局，需要精准时深入细节。这种灵活性让你在不同类型的任务中都能找到节奏。',
  },
};

// ---------- 游戏基础配置 ----------
export const GAME_CONFIG = {
  gameId: 'game3',
  title: '平行宇宙观察站',
  subtitle: '你的认知风格画像',
  intro: {
    subtitle: '第三站',
    title: '平行宇宙观察站',
    description: '你在一艘星际飞船的冷冻舱里沉睡了很久。醒来时，飞船已泊入一颗新星球。你的记忆模糊了——还记得自己是谁，但不太确定「自己是什么样的人」。舱壁上浮现出 8 段记忆碎片，每一段都是过去的你做决策的样子。哪些……更像真正的你？',
    estimatedTime: '约 2-3 分钟',
    ctaText: '开始回溯',
  },
  completion: {
    title: '观察完成',
    message: '你已看清自己如何思考。\n但「思考」之外，什么对你真正有意义？',
    nextGameLabel: '前往意义之殿',
    nextGameUrl: 'game4-meaning-construction.html',
  },
};
