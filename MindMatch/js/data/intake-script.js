// ============================================================
// intake-script.js — CDPC 职业咨询框架引导问题脚本
// 6 步结构化访谈，JS 模块版本（可直接 import）
// ============================================================

export const meta = {
  version: '1.0',
  basedOn: 'CDPC Intake Interview Framework',
};

export const steps = [
  {
    id: 'stage',
    order: 1,
    question: '你现在处于什么阶段？是什么让你今天想探索方向？',
    label: '现状与触发',
    purpose: '定位用户当前人生阶段和触发事件',
    extractFields: ['currentStage', 'triggerEvent'],
    followupCondition: '如果用户只说了阶段没说触发事件',
    followupQuestion: '是什么让你今天想来聊聊方向？',
    profileVariant: {
      hasProfile: '我看到你做了我们的测评。先确认一下——你现在是在校还是已经工作了？',
      noProfile: null,
    },
  },
  {
    id: 'experience',
    order: 2,
    question: '简单说说你到目前为止做过的事——实习、项目、社团、工作都算。哪一段让你觉得"这可能是我想做的"？',
    label: '经验盘点',
    purpose: '盘点经验资产 + 识别正向体验',
    extractFields: ['experienceSummary', 'highlightExperience'],
    followupCondition: '如果用户列举了经历但没说哪段最有感觉',
    followupQuestion: '这些经历里，哪一段让你觉得最有投入感？',
  },
  {
    id: 'motivation',
    order: 3,
    question: '有没有一个时刻——不管是在工作还是生活中——你觉得"这就是我该做的事"？那个时刻你在做什么？',
    label: '内在驱动',
    purpose: '探索内在驱动',
    extractFields: ['motivationKeywords', 'peakMoment'],
    followupCondition: '如果用户说"没有"或很模糊',
    followupQuestion: '那反过来，有没有什么事让你觉得"这不是我该待的地方"？',
    profileVariant: {
      hasProfile: '你的测评显示你的核心驱动力是{topDrive}——你在现实中有没有体验过这种驱动被满足的时刻？',
      skipIfProfile: true,
    },
  },
  {
    id: 'constraints',
    order: 4,
    question: '如果你要选一个方向，现在对你来说最重要的现实考量是什么？（可以多选：城市、薪资、稳定、成长空间、工作生活平衡……）',
    label: '现实约束',
    purpose: '过滤不可行方向',
    extractFields: ['constraintsList', 'mustHave', 'niceToHave'],
    followupCondition: '如果用户说了很多但没排优先级',
    followupQuestion: '如果只能保一个，你选哪个？',
  },
  {
    id: 'pastTry',
    order: 5,
    question: '你之前有没有试过确定方向的方法？比如做测评、跟人聊、尝试实习——效果怎么样？',
    label: '以往尝试',
    purpose: '评估用户自主探索能力 + 避免重复推荐',
    extractFields: ['previousMethods', 'whatWorked', 'whatDidnt'],
    followupCondition: '如果用户说没试过任何方法',
    followupQuestion: '那今天算是你第一次系统地探索方向？',
  },
];

/** 获取某一步的配置 */
export function getStep(stepId) {
  return steps.find(s => s.id === stepId) || null;
}

/** 获取下一步的 step id */
export function getNextStepId(currentId) {
  const idx = steps.findIndex(s => s.id === currentId);
  if (idx >= 0 && idx < steps.length - 1) {
    return steps[idx + 1].id;
  }
  return null; // 已是最后一步
}

/** 总步数 */
export const totalSteps = steps.length;

export default { meta, steps, getStep, getNextStepId, totalSteps };
