// ============================================================
// career-mapping.js — 6 方向 × 技能 × 入门路径
// 预置职业知识库，JS 模块版本
// ============================================================

export const directions = [
  {
    id: 'system_builder',
    name: '系统构建者',
    icon: '🏗️',
    tagline: '把复杂问题变成可运行的方案',
    description: '擅长从零搭建系统，在约束中寻找最优解。享受架构设计、流程优化和让事情跑起来的成就感。',
    keywords: ['系统设计', '架构', '逻辑', '效率', '工程化', '搭建', '优化'],
    relatedDimensions: {
      wholistAnalytic: 'high', // 分析型思维
      TF: 'medium',             // 技术/职能
      nAch: 'high',             // 成就驱动
      GM: 'medium',             // 管理
    },
    requiredSkills: {
      core: ['系统思维', '逻辑分析', '工具链使用'],
      nice_to_have: ['编程基础', '项目管理', '技术写作'],
    },
    entryPaths: [
      {
        role: '产品经理（技术方向）',
        barrier: '中等 — 需要理解技术栈和用户需求',
        typicalSalary: '15-35万（初级）',
        firstStep: '找3个你常用的App，用一页纸分析每个App解决了什么问题和怎么解决的',
      },
      {
        role: '系统架构师（入门）',
        barrier: '较高 — 通常需要2-3年开发经验后转型',
        typicalSalary: '25-50万',
        firstStep: '学习一个后端框架（如Node.js Express或Python FastAPI），搭建一个简单的API服务',
      },
    ],
    commonTransition: [
      '技术支持 → 产品经理 → 技术VP',
      '软件工程师 → 系统架构师 → CTO',
      '数据分析师 → 数据工程师 → 数据架构师',
    ],
  },
  {
    id: 'deep_interpreter',
    name: '深度解读者',
    icon: '🔍',
    tagline: '从数据和行为中看到别人看不到的模式',
    description: '喜欢探究"为什么"，不满足于表面答案。善于从数据、文字或行为中提取洞察，发现深层规律。',
    keywords: ['分析', '研究', '洞察', '数据', '模式识别', '深度思考', '追问'],
    relatedDimensions: {
      wholistAnalytic: 'high', // 分析型
      nAch: 'medium',
      presence: 'high',         // 意义在场
      search: 'high',           // 意义探索
    },
    requiredSkills: {
      core: ['数据分析', '逻辑推理', '结构化写作'],
      nice_to_have: ['SQL', '统计学基础', '可视化'],
    },
    entryPaths: [
      {
        role: '数据分析师',
        barrier: '中等 — 需要掌握SQL和基本统计',
        typicalSalary: '12-30万（初级）',
        firstStep: '在Kaggle上找一个公开数据集，用Excel或Python做3个分析图表并写一段解读',
      },
      {
        role: '用户研究员',
        barrier: '中等 — 需要学习研究方法论',
        typicalSalary: '12-28万（初级）',
        firstStep: '选一个你常用的产品，做5个人的用户访谈（可以找朋友），整理出3个关键发现',
      },
    ],
    commonTransition: [
      '数据分析师 → 商业分析师 → 数据科学家',
      '用户研究员 → 产品策略 → 研究总监',
      '行业分析师 → 咨询顾问 → 战略总监',
    ],
  },
  {
    id: 'creative_shaper',
    name: '创意塑造者',
    icon: '🎨',
    tagline: '在美和功能之间找到那个恰到好处的点',
    description: '对"什么样才是好的"有敏锐直觉。用文字、视觉或体验创造有影响力的作品，在意细节和整体感受。',
    keywords: ['设计', '创意', '美学', '用户体验', '内容', '表达', '叙事'],
    relatedDimensions: {
      wholistAnalytic: 'low',  // 偏整体型
      nAff: 'high',             // 亲和——对人敏感
      presence: 'high',
      CH: 'medium',             // 创造性
    },
    requiredSkills: {
      core: ['设计思维', '视觉/文字表达', '用户同理心'],
      nice_to_have: ['Figma/Sketch', '原型制作', 'A/B测试'],
    },
    entryPaths: [
      {
        role: 'UI/UX 设计师',
        barrier: '中等 — 需要作品集',
        typicalSalary: '12-30万（初级）',
        firstStep: '挑一个你用着不舒服的App界面，用Figma重新设计3个关键页面并说明你的改进理由',
      },
      {
        role: '内容策略师',
        barrier: '较低 — 需要写作能力和用户洞察',
        typicalSalary: '10-25万（初级）',
        firstStep: '选一个品牌/产品，分析它现有的内容策略，写一篇800字的改进方案',
      },
    ],
    commonTransition: [
      'UI设计师 → UX设计师 → 设计总监',
      '内容编辑 → 内容策略师 → 品牌总监',
      '平面设计师 → 创意总监 → 创意合伙人',
    ],
  },
  {
    id: 'people_connector',
    name: '人际连接者',
    icon: '🤝',
    tagline: '让人与人之间的协作变得更好',
    description: '对人的状态和关系高度敏感。善于建立信任、化解冲突、激励他人，在团队中扮演"润滑剂"和"催化剂"角色。',
    keywords: ['沟通', '协作', '激励', '关系', '团队', '赋能', '共情'],
    relatedDimensions: {
      nAff: 'high',             // 亲和驱动
      nPow: 'medium',           // 影响力驱动
      SE: 'high',               // 服务/奉献
      LS: 'medium',             // 生活风格
    },
    requiredSkills: {
      core: ['沟通表达', '共情倾听', '冲突调解'],
      nice_to_have: ['组织发展', '教练技术', '演讲能力'],
    },
    entryPaths: [
      {
        role: 'HR BP（人力资源业务伙伴）',
        barrier: '中等 — 需要理解业务和人力资源',
        typicalSalary: '12-28万（初级）',
        firstStep: '找3个不同行业的朋友了解他们的工作日常，总结每个岗位的"核心挑战"和"成长路径"',
      },
      {
        role: '客户成功经理',
        barrier: '较低 — 需要沟通能力和服务意识',
        typicalSalary: '10-25万（初级）',
        firstStep: '在领英/Boss直聘上研究10个客户成功岗位的JD，总结出最常出现的3个能力要求',
      },
    ],
    commonTransition: [
      'HR专员 → HR BP → HRD',
      '客户支持 → 客户成功经理 → 客户成功总监',
      '社群运营 → 社区经理 → 生态运营总监',
    ],
  },
  {
    id: 'value_driver',
    name: '价值驱动者',
    icon: '🎯',
    tagline: '找到一件事情的社会价值并把它放大',
    description: '做事不只是为了收入和职位，更在意"这件事值不值得做"。对社会议题敏感，希望通过工作创造有意义的改变。',
    keywords: ['社会价值', '使命感', '可持续发展', '公平', '教育', '公共事务', '影响力'],
    relatedDimensions: {
      SV: 'high',               // 服务/奉献
      EC: 'medium',             // 创业/创造
      presence: 'high',         // 意义在场
      search: 'medium',         // 意义探索
    },
    requiredSkills: {
      core: ['系统思考', '跨领域沟通', '项目策划'],
      nice_to_have: ['影响力评估', '政策分析', '筹款/资源整合'],
    },
    entryPaths: [
      {
        role: 'ESG/可持续发展顾问',
        barrier: '中等 — 需要学习ESG框架和报告标准',
        typicalSalary: '15-35万（初级）',
        firstStep: '下载一份上市公司ESG报告（如腾讯/阿里），用一页纸总结它的核心指标和改进空间',
      },
      {
        role: '社会企业创业者',
        barrier: '较高 — 需要创业能力和领域知识',
        typicalSalary: '波动大',
        firstStep: '找一个你想解决的社会问题，访谈5个受这个问题影响的人，写一份一页纸的问题定义和初步解决方案',
      },
    ],
    commonTransition: [
      '公益项目助理 → 项目经理 → 基金会总监',
      'ESG分析师 → ESG顾问 → 可持续发展VP',
      '公务员 → 政策研究员 → 公共事务总监',
    ],
  },
  {
    id: 'enabler_companion',
    name: '赋能陪伴者',
    icon: '🌱',
    tagline: '帮助他人成长本身就是你的成长',
    description: '从"看到别人因为你变得更好"中获得深层满足。善于观察人的潜力，用提问和反馈引导他人发现自己的答案。',
    keywords: ['成长', '辅导', '教育', '陪伴', '赋能', '提问', '反馈'],
    relatedDimensions: {
      nAff: 'high',             // 亲和
      SE: 'high',               // 服务/奉献
      SV: 'medium',             // 服务价值
      LS: 'high',               // 生活风格——追求平衡
    },
    requiredSkills: {
      core: ['深度倾听', '提问技巧', '反馈能力'],
      nice_to_have: ['教练技术', '课程设计', '学习科学'],
    },
    entryPaths: [
      {
        role: '职业发展教练',
        barrier: '中等 — 需要学习教练技术和积累案例',
        typicalSalary: '10-30万（自由职业波动大）',
        firstStep: '找3个朋友各做一次45分钟的职业探索对话（参考CDPC框架），记录每个人的核心发现',
      },
      {
        role: '学习发展专员（L&D）',
        barrier: '较低 — 需要培训设计和沟通能力',
        typicalSalary: '10-25万（初级）',
        firstStep: '设计一个30分钟的微型工作坊（主题自选），找5个人试讲并收集反馈',
      },
    ],
    commonTransition: [
      '培训专员 → L&D经理 → 人才发展总监',
      '教师 → 教育产品经理 → 教育创业者',
      '心理咨询师 → 职业教练 → 组织发展顾问',
    ],
  },
];

/** 根据方向 ID 查找 */
export function getDirection(id) {
  return directions.find(d => d.id === id) || null;
}

/** 获取所有方向 ID 列表 */
export function getAllDirectionIds() {
  return directions.map(d => d.id);
}

export default { directions, getDirection, getAllDirectionIds };
