// ============================================================
// skill-pathways.js — 通用技能 × 入门路径
// 每个技能包含入门第一步和免费学习资源
// ============================================================

export const skills = [
  {
    id: 'sql',
    name: 'SQL 数据分析',
    category: '数据分析',
    difficulty: 'beginner',
    timeToStart: '1-2 周',
    firstStep: '在 SQLZoo (sqlzoo.net) 上完成前3个教程（SELECT basics, SELECT from WORLD, SELECT from Nobel）',
    freeResource: 'SQLZoo 交互式教程（免费）+ W3Schools SQL 参考',
    relatedDirections: ['deep_interpreter', 'system_builder'],
    whyItHelps: '几乎所有分析类岗位的基础技能，让你能直接从数据库中提取和筛选数据',
  },
  {
    id: 'figma',
    name: 'Figma 设计工具',
    category: '设计工具',
    difficulty: 'beginner',
    timeToStart: '1 周',
    firstStep: '注册 Figma 免费账号，跟着官方教程完成一个简单的手机App界面临摹',
    freeResource: 'Figma 官方 YouTube 教程（免费）+ Figma Community 模板',
    relatedDirections: ['creative_shaper', 'system_builder'],
    whyItHelps: '产品设计和原型制作的标准工具，从UI设计到产品原型都能覆盖',
  },
  {
    id: 'system_thinking',
    name: '系统思维',
    category: '思维方法',
    difficulty: 'intermediate',
    timeToStart: '2-3 周',
    firstStep: '读《系统思考》前3章（或看 Donella Meadows 的演讲视频），然后用因果循环图画一个你工作中的系统',
    freeResource: 'Donella Meadows "Thinking in Systems" 演讲（YouTube）+ The Systems Thinker 网站文章',
    relatedDirections: ['system_builder', 'value_driver', 'deep_interpreter'],
    whyItHelps: '帮你看到问题背后的结构和关联，而不是只看到表面现象——产品、策略、咨询都需要这个能力',
  },
  {
    id: 'coaching',
    name: '教练基础',
    category: '人际能力',
    difficulty: 'intermediate',
    timeToStart: '2-3 周',
    firstStep: '学习 GROW 模型（Goal-Reality-Options-Will），找一个人做一次30分钟的教练对话练习',
    freeResource: 'Sir John Whitmore "Coaching for Performance" 摘要（网上可找）+ ICF 核心能力免费介绍',
    relatedDirections: ['enabler_companion', 'people_connector'],
    whyItHelps: '从"给建议"升级为"帮人找到自己的答案"——管理、HR、咨询都受益',
  },
  {
    id: 'structured_writing',
    name: '结构化写作',
    category: '表达能力',
    difficulty: 'beginner',
    timeToStart: '1 周',
    firstStep: '用"结论先行+三点支撑"的结构写一篇800字的工作复盘或学习总结',
    freeResource: '《金字塔原理》核心框架（网上有大量中文解读）+ 少数派写作指南',
    relatedDirections: ['deep_interpreter', 'creative_shaper', 'value_driver'],
    whyItHelps: '让复杂想法清晰传达——报告、方案、文章、演讲都离不开结构化表达',
  },
  {
    id: 'product_thinking',
    name: '产品思维',
    category: '思维方法',
    difficulty: 'beginner',
    timeToStart: '1-2 周',
    firstStep: '选一个你常用的产品，用"用户-场景-问题-方案"四格框架分析它的核心功能',
    freeResource: '硅谷产品经理课程笔记（网上可搜 Chinese translation）+ Lenny\'s Newsletter 免费文章',
    relatedDirections: ['system_builder', 'creative_shaper', 'people_connector'],
    whyItHelps: '不只是产品经理才需要——任何需要"从用户角度思考问题"的工作都用得上',
  },
  {
    id: 'user_research',
    name: '用户研究',
    category: '研究方法',
    difficulty: 'intermediate',
    timeToStart: '2-3 周',
    firstStep: '设计一份5个问题的半结构化访谈提纲，找3个人做用户访谈并整理出3个关键洞察',
    freeResource: 'Nielsen Norman Group 免费文章 + Steve Portigal "Interviewing Users" 摘要',
    relatedDirections: ['deep_interpreter', 'creative_shaper', 'people_connector'],
    whyItHelps: '不做假设，用真实用户的反馈来验证你的想法——产品、设计、策略都依赖这个',
  },
  {
    id: 'project_management',
    name: '项目管理',
    category: '执行能力',
    difficulty: 'beginner',
    timeToStart: '1-2 周',
    firstStep: '用 Notion 或飞书创建一个项目看板，把本周要做的事拆成任务卡片，设定优先级和截止日期',
    freeResource: 'Atlassian 项目管理指南（免费）+ Scrum Guide 中文版',
    relatedDirections: ['system_builder', 'value_driver', 'enabler_companion'],
    whyItHelps: '把想法变成可执行的计划，把计划变成实际的交付——几乎所有岗位都需要',
  },
];

/** 根据技能 ID 查找 */
export function getSkill(id) {
  return skills.find(s => s.id === id) || null;
}

/** 根据方向 ID 筛选相关技能 */
export function getSkillsByDirection(directionId) {
  return skills.filter(s => s.relatedDirections.includes(directionId));
}

/** 根据难度筛选 */
export function getSkillsByDifficulty(difficulty) {
  return skills.filter(s => s.difficulty === difficulty);
}

/** 获取所有技能 ID */
export function getAllSkillIds() {
  return skills.map(s => s.id);
}

export default { skills, getSkill, getSkillsByDirection, getSkillsByDifficulty, getAllSkillIds };
