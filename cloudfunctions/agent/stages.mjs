// ============================================================
// agent-v2/stages.js — 阶段配置（唯一数据源）
// 新版 4 阶段：结果共鸣 → 深度挖掘 → 现实校准 → 行动地图
// 修改阶段只改这个文件 + replies.js
// ============================================================

export const STAGES = [
  {
    id: 1,
    key: 'resonance',
    label: '结果共鸣',
    goal: '让用户对测评结果产生共鸣，确认/修正初步方向',
    minTurns: 2,
    maxTurns: 3,
    openingTemplate: '你做了4个游戏，结果挺有意思的——你的核心特质是{topTrait}，最匹配的方向是{topDirection}。你觉得这个描述准吗？',
    advanceWhen: '用户已确认测评结果认同度（哪些准/哪些不准），或用户提出了不认同的具体原因',
    collectFields: ['resonance'],
    followupHints: [
      '如果用户说"不准"：追问具体哪个维度不准，为什么',
      '如果用户说"准"：追问是否有意外发现——"有没有哪个结果让你 surprised？"',
      '如果用户说"不确定"：给具体场景让它判断——"比如让你做一件事做到忘记时间，你觉得会是什么事？"',
    ],
    example: {
      good: {
        user: '成就驱动我同意，但我不确定是不是真的想做技术',
        ai: '成就驱动认同——但你对"技术"有犹豫，这本身就是很有价值的信息。你能说说这个犹豫是什么感觉吗？是觉得技术太枯燥，还是担心自己不够擅长？',
      },
      bad: {
        user: '还行吧',
        ai: '好的，了解了。让我们继续下一个话题。',
      },
    },
  },
  {
    id: 2,
    key: 'deep_dive',
    label: '深度挖掘',
    goal: '挖出测评无法触及的深层信息，用方向区分性问题筛选方向',
    minTurns: 3,
    maxTurns: 4,
    openingTemplate: '现在我想更深入地了解你。你更喜欢"从零搭一个系统"还是"研究透一个现象"？',
    advanceWhen: '用户已表达了方向倾向（偏哪个方向），并有至少 1 个关键经历佐证',
    collectFields: ['directionPreference', 'keyExperience', 'innerDrive'],
    followupHints: [
      '用方向区分性问题追问：建造 vs 理解 / 创造 vs 连接 / 影响 vs 陪伴',
      '交叉验证：用户说的和测评数据是否一致？不一致就追问原因',
      '追问具体经历："你说的那段经历里，具体哪个瞬间让你有感觉？"',
    ],
    example: {
      good: {
        user: '我更喜欢搭系统，之前帮团队搭了个自动化流程',
        ai: '搭自动化流程——这其实是典型的"系统建构者"行为。你当时是怎么发现需要搭这个流程的？是别人要求的还是你自己主动看出来的？',
      },
      bad: {
        user: '我更喜欢搭系统',
        ai: '好的，了解了。继续说说其他方面。',
      },
    },
  },
  {
    id: 3,
    key: 'calibration',
    label: '现实校准',
    goal: '把理想方向拉回现实，考虑约束条件，找出可达的第一步',
    minTurns: 2,
    maxTurns: 3,
    openingTemplate: '{topDirection}方向，最常见的入门路径是{entryRole}。你现在的背景和这个方向之间，你觉得最大的gap在哪？',
    advanceWhen: '用户已明确现实约束优先级（城市/薪资/稳定/成长）和可接受妥协点',
    collectFields: ['constraints', 'tradeoffs'],
    followupHints: [
      '如果理想和现实差距大：提出过渡路径——不是否定理想，而是找到可达的第一步',
      '追问约束优先级："如果只能保一个，你选哪个？"',
      '追问过渡意愿："如果需要先做 X 再做 Y，你愿意等吗？"',
    ],
    example: {
      good: {
        user: '我更在意成长空间，薪资可以先低一点',
        ai: '愿意为成长空间接受低薪资——这是典型的长期主义。那你现在的技能储备，离这个方向的入门要求还差什么？',
      },
      bad: {
        user: '薪资先不管',
        ai: '好的，薪资暂不考虑。继续聊。',
      },
    },
  },
  {
    id: 4,
    key: 'action_map',
    label: '行动地图',
    goal: '给出可执行的行动建议：方向 + 岗位 + 技能差距 + 第一步行动',
    minTurns: 2,
    maxTurns: 3,
    openingTemplate: '结合我们聊的，我觉得你最适合的方向是{direction}——理由是{reason}。你觉得呢？',
    advanceWhen: '建议已完整输出，用户确认或无异议',
    collectFields: ['actionPlan'],
    followupHints: [
      '如果用户有异议：调整建议，说明调整理由',
      '补充具体的第一步行动——72小时内可执行的',
      '给出备选方向作为 Plan B',
    ],
    example: {
      good: {
        user: '听起来不错',
        ai: '那我来帮你整理一下——\n📍 推荐方向：系统建构者\n💼 推荐岗位：产品经理\n📐 技能差距：需要补数据分析能力\n🚀 第一步行动：本周在 Boss 直聘搜 5 个产品经理岗位，对比 JD 要求\n\n你觉得这个计划可行吗？',
      },
      bad: {
        user: '好的',
        ai: '建议已给出，感谢使用！',
      },
    },
  },
];

/** 总阶段数（供前端进度条用） */
export const TOTAL_STAGES = STAGES.length;

/** 所有 collectFields 的聚合（供工具动态枚举） */
export const ALL_COLLECT_FIELDS = STAGES.flatMap(s => s.collectFields);

// ============================================================
// 查询函数
// ============================================================

/** 按 ID 获取阶段 */
export function getStage(id) {
  return STAGES.find(s => s.id === id) || null;
}

/** 按 key 获取阶段 */
export function getStageByKey(key) {
  return STAGES.find(s => s.key === key) || null;
}

/** 获取阶段标签 */
export function getStageLabel(id) {
  const stage = getStage(id);
  return stage ? stage.label : '';
}
