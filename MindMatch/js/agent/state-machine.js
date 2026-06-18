// ============================================================
// state-machine.js — 对话状态机
// 管理从 WELCOME → COMPLETE 的完整对话流程
// 支持画像检测、追问、进度追踪、localStorage 持久化
// ============================================================

import { loadAll, completedGames } from '../core/store.js';
import { steps, totalSteps, getStep } from '../data/intake-script.js';

// ---------- 状态常量 ----------
export const STATES = {
  WELCOME: 'WELCOME',
  PROFILE_CONFIRM: 'PROFILE_CONFIRM',
  Q1_STAGE: 'Q1_STAGE',
  Q2_EXPERIENCE: 'Q2_EXPERIENCE',
  Q3_MOTIVATION: 'Q3_MOTIVATION',
  Q4_CONSTRAINT: 'Q4_CONSTRAINT',
  Q5_PAST_TRY: 'Q5_PAST_TRY',
  SUMMARY_CONFIRM: 'SUMMARY_CONFIRM',
  GENERATE_RESULT: 'GENERATE_RESULT',
  COMPLETE: 'COMPLETE',
};

// 状态 → 步骤 ID 映射
const STATE_TO_STEP = {
  Q1_STAGE: 'stage',
  Q2_EXPERIENCE: 'experience',
  Q3_MOTIVATION: 'motivation',
  Q4_CONSTRAINT: 'constraints',
  Q5_PAST_TRY: 'pastTry',
};

// 问题状态的转移顺序（不含 WELCOME/PROFILE_CONFIRM）
const QUESTION_STATES = [
  STATES.Q1_STAGE,
  STATES.Q2_EXPERIENCE,
  STATES.Q3_MOTIVATION,
  STATES.Q4_CONSTRAINT,
  STATES.Q5_PAST_TRY,
];

const STORAGE_KEY = 'mindmatch_career_guide_state';

// ---------- 维度名称映射 ----------
const DIM_NAMES = {
  nAch: '成就驱动',
  nPow: '影响力驱动',
  nAff: '亲和驱动',
  TF: '技术/职能',
  GM: '综合管理',
  AU: '自主/独立',
  SE: '安全/稳定',
  EC: '创业/创造',
  SV: '服务/奉献',
  CH: '挑战',
  LS: '生活风格',
  wholistAnalytic: '分析型思维',
  presence: '意义在场',
  search: '意义探索',
};

// ---------- 从测评数据构建画像摘要 ----------
function buildProfileSummary() {
  const all = loadAll();
  const completed = completedGames();
  if (completed.length === 0) return null;

  // 聚合所有维度
  const dims = {};
  const rawDims = {};

  if (all.game1) {
    ['nAch', 'nPow', 'nAff'].forEach(d => {
      if (all.game1.dimensions[d] != null) {
        rawDims[d] = all.game1.dimensions[d];
        dims[d] = all.game1.dimensions[d] / 10;
      }
    });
  }
  if (all.game2) {
    ['TF', 'GM', 'AU', 'SE', 'EC', 'SV', 'CH', 'LS'].forEach(d => {
      if (all.game2.dimensions[d] != null) {
        rawDims[d] = all.game2.dimensions[d];
        dims[d] = all.game2.dimensions[d] / 10;
      }
    });
  }
  if (all.game3) {
    const val = all.game3.dimensions['wholistAnalytic'];
    if (val != null) {
      rawDims['wholistAnalytic'] = val;
      dims['wholistAnalytic'] = (val + 1) / 2;
    }
  }
  if (all.game4) {
    ['presence', 'search'].forEach(d => {
      if (all.game4.dimensions[d] != null) {
        rawDims[d] = all.game4.dimensions[d];
        dims[d] = all.game4.dimensions[d] / 10;
      }
    });
  }

  // 找 top 3 维度
  const sorted = Object.entries(dims)
    .filter(([, v]) => v != null)
    .sort(([, a], [, b]) => b - a);

  const topDims = sorted.slice(0, 3).map(([id, score]) => ({
    id,
    name: DIM_NAMES[id] || id,
    score: Math.round(score * 100),
  }));

  // 构建文字摘要
  const topNames = topDims.map(d => d.name).join('、');

  return {
    topDims,
    topNames,
    completedCount: completed.length,
    allCompleted: completed.length === 4,
    normalizedDims: dims,
    rawDims,
  };
}

export class ConversationStateMachine {
  constructor() {
    this.state = STATES.WELCOME;
    this.collected = {};       // 已收集的用户信息 { stepId: { question, answer } }
    this.hasProfile = false;   // 是否有测评画像
    this.profileSummary = null; // 画像摘要
    this.history = [];         // 对话历史 [{role, content}]
    this.roundCount = 0;       // 对话轮次计数
    this.MAX_ROUNDS = 12;      // 最大轮次上限（含追问）
    this._pendingFollowup = null; // 待发送的追问
    this._phaseTurns = 0;      // 当前阶段已用轮次
    this.MAX_PHASE_TURNS = 3;  // 每阶段最多3轮（含第一问+追问）

    this._loadFromStorage();
    this._init();
  }

  // ---------- 初始化 ----------
  _init() {
    const completed = completedGames();
    this.hasProfile = completed.length > 0;

    if (this.hasProfile) {
      this.profileSummary = buildProfileSummary();
    }
  }

  // ---------- 持久化 ----------
  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        this.state = saved.state || STATES.WELCOME;
        this.collected = saved.collected || {};
        this.history = saved.history || [];
        this.roundCount = saved.roundCount || 0;
        this._phaseTurns = saved._phaseTurns || 0;
        this.hasProfile = saved.hasProfile || false;
        if (saved.profileSummary) {
          this.profileSummary = saved.profileSummary;
        }
      }
    } catch {
      // 忽略损坏数据，使用默认值
    }
  }

  _saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        state: this.state,
        collected: this.collected,
        history: this.history,
        roundCount: this.roundCount,
        _phaseTurns: this._phaseTurns,
        hasProfile: this.hasProfile,
        profileSummary: this.profileSummary,
      }));
    } catch {
      // 存储满时静默失败
    }
  }

  // ---------- 公开方法 ----------

  /**
   * 获取欢迎消息（第一句 AI 消息）
   */
  getWelcomeMessage() {
    if (this.hasProfile && this.profileSummary) {
      const summary = this.profileSummary;
      const topDrive = summary.topDims[0]?.name || '成就';
      const countStr = summary.allCompleted
        ? '你已经完成了全部4个测评游戏'
        : `你已经完成了 ${summary.completedCount}/4 个测评游戏`;

      return `你好！${countStr}，从你的测评结果来看，你的核心特质是「${summary.topNames}」。其中${topDrive}是你最突出的驱动力。接下来我会通过几个关键问题，结合你的测评画像，帮你更清晰地定位职业方向。`;
    }

    return '你好！我是你的职业方向探索伙伴 🧭\n\n接下来我会通过几个关键问题来了解你的现状、经历和期待。不考知识，没有标准答案——你只需要说出真实的想法。\n\n准备好了吗？让我们开始吧！';
  }

  /**
   * 获取当前应该问的问题
   */
  getCurrentQuestion() {
    // 如果有待发送的追问，先发追问
    if (this._pendingFollowup) {
      const q = this._pendingFollowup;
      this._pendingFollowup = null;
      return q;
    }

    switch (this.state) {
      case STATES.WELCOME:
        // WelCOME 之后自动推进到 PROFILE_CONFIRM 或 Q1
        return null; // 由 getWelcomeMessage 处理

      case STATES.PROFILE_CONFIRM: {
        const step = getStep('stage');
        if (step && step.profileVariant && step.profileVariant.hasProfile) {
          return step.profileVariant.hasProfile;
        }
        // fallback
        return step ? step.question : '你现在处于什么阶段？是什么让你今天想探索方向？';
      }

      case STATES.Q1_STAGE:
      case STATES.Q2_EXPERIENCE:
      case STATES.Q3_MOTIVATION:
      case STATES.Q4_CONSTRAINT:
      case STATES.Q5_PAST_TRY: {
        const stepId = STATE_TO_STEP[this.state];
        const step = getStep(stepId);

        if (!step) return '请继续说说你的想法。';

        // 检查 motivation 是否有画像变体
        if (stepId === 'motivation' && this.hasProfile && step.profileVariant?.hasProfile) {
          const topDrive = this.profileSummary?.topDims[0]?.name || '成就驱动';
          return step.profileVariant.hasProfile.replace('{topDrive}', topDrive);
        }

        return step.question;
      }

      case STATES.SUMMARY_CONFIRM:
        return this._buildSummaryPrompt();

      case STATES.GENERATE_RESULT:
        return null; // 由外部处理

      case STATES.COMPLETE:
        return null;

      default:
        return null;
    }
  }

  /**
   * 状态转移：处理用户输入，推进到下一步
   * @param {string} userInput - 用户最新输入
   * @param {string} aiResponse - AI 的回复（用于记录历史）
   */
  transition(userInput, aiResponse) {
    // 记录历史
    this.history.push({ role: 'user', content: userInput });
    if (aiResponse) {
      this.history.push({ role: 'assistant', content: aiResponse });
    }

    // 保存当前步骤的收集信息
    this._saveCurrentAnswer(userInput);

    // 阶段轮次++（只在提问阶段计数）
    if (_isQuestionState(this.state)) {
      this._phaseTurns++;
    }

    // 推进状态
    this.state = this._getNextState();
    this.roundCount++;
    this._saveToStorage();
  }

  /**
   * 获取当前阶段轮次信息（供 prompt-builder 使用）
   * @returns {{turn, max, remaining}|null}
   */
  getPhaseTurnInfo() {
    if (!_isQuestionState(this.state)) return null;
    // +1 是因为 transition() 即将递增 _phaseTurns，这里返回的 turn 是"本轮将是第几轮"
    const upcomingTurn = this._phaseTurns + 1;
    return {
      turn: upcomingTurn,
      max: this.MAX_PHASE_TURNS,
      remaining: this.MAX_PHASE_TURNS - upcomingTurn,
    };
  }

  /**
   * 记录 AI 的追问（设置 pending followup）
   */
  setFollowup(question) {
    this._pendingFollowup = question;
    this._saveToStorage();
  }

  /**
   * 检查是否可以继续对话
   */
  canContinue() {
    return this.roundCount < this.MAX_ROUNDS;
  }

  /**
   * 获取进度信息（按阶段而非轮次）
   */
  getProgress() {
    const phaseMap = {
      [STATES.WELCOME]: 0,
      [STATES.PROFILE_CONFIRM]: 0,
      [STATES.Q1_STAGE]: 1,
      [STATES.Q2_EXPERIENCE]: 2,
      [STATES.Q3_MOTIVATION]: 3,
      [STATES.Q4_CONSTRAINT]: 4,
      [STATES.Q5_PAST_TRY]: 5,
      [STATES.SUMMARY_CONFIRM]: 6,
      [STATES.GENERATE_RESULT]: 7,
      [STATES.COMPLETE]: 7,
    };

    const phaseLabels = [
      '',                      // 0: welcome
      '现状了解',              // 1: stage
      '经验盘点',              // 2: experience
      '内在驱动',              // 3: motivation
      '现实考量',              // 4: constraints
      '过往探索',              // 5: pastTry
      '总结确认',              // 6: summary
      '生成建议',              // 7: generate/complete
    ];

    const phase = phaseMap[this.state] || 0;
    const total = 7;

    return {
      phase,
      totalPhases: total,
      percentage: Math.round((phase / total) * 100),
      label: phaseLabels[phase] || '',
    };
  }

  /**
   * 设置状态为 GENERATE_RESULT（跳过总结确认）
   */
  setGenerating() {
    this.state = STATES.GENERATE_RESULT;
    this._saveToStorage();
  }

  /**
   * 标记为完成
   */
  setComplete() {
    this.state = STATES.COMPLETE;
    this._saveToStorage();
  }

  /**
   * 清空所有状态（重新开始）
   */
  reset() {
    this.state = STATES.WELCOME;
    this.collected = {};
    this.history = [];
    this.roundCount = 0;
    this._phaseTurns = 0;
    this._pendingFollowup = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    this._init();
  }

  // ---------- 内部方法 ----------

  _saveCurrentAnswer(userInput) {
    const stepId = STATE_TO_STEP[this.state];
    if (stepId) {
      const step = getStep(stepId);
      if (!this.collected[stepId]) {
        // 第一轮：创建新条目
        this.collected[stepId] = {
          question: step ? step.question : '',
          answer: userInput,
          timestamp: Date.now(),
        };
      } else {
        // 追问轮：追加到已有答案（不覆盖）
        this.collected[stepId].answer += '\n[追问回答] ' + userInput;
        this.collected[stepId].timestamp = Date.now();
      }
    }
    // SUMMARY_CONFIRM 的回答特殊处理
    if (this.state === STATES.SUMMARY_CONFIRM) {
      this.collected['_summaryResponse'] = {
        question: '总结确认反馈',
        answer: userInput,
        timestamp: Date.now(),
      };
    }
  }

  _getNextState() {
    switch (this.state) {
      case STATES.WELCOME:
        this._phaseTurns = 0;
        return this.hasProfile ? STATES.PROFILE_CONFIRM : STATES.Q1_STAGE;

      case STATES.PROFILE_CONFIRM:
        this._phaseTurns = 0;
        return STATES.Q1_STAGE;

      // --- 提问阶段：达到 MAX_PHASE_TURNS 才推进，否则停留 ---
      case STATES.Q1_STAGE:
        if (this._phaseTurns < this.MAX_PHASE_TURNS) return STATES.Q1_STAGE;
        this._phaseTurns = 0;
        return STATES.Q2_EXPERIENCE;

      case STATES.Q2_EXPERIENCE:
        if (this._phaseTurns < this.MAX_PHASE_TURNS) return STATES.Q2_EXPERIENCE;
        this._phaseTurns = 0;
        // 如果有画像，跳过 Q3_MOTIVATION
        if (this.hasProfile) return STATES.Q4_CONSTRAINT;
        return STATES.Q3_MOTIVATION;

      case STATES.Q3_MOTIVATION:
        if (this._phaseTurns < this.MAX_PHASE_TURNS) return STATES.Q3_MOTIVATION;
        this._phaseTurns = 0;
        return STATES.Q4_CONSTRAINT;

      case STATES.Q4_CONSTRAINT:
        if (this._phaseTurns < this.MAX_PHASE_TURNS) return STATES.Q4_CONSTRAINT;
        this._phaseTurns = 0;
        return STATES.Q5_PAST_TRY;

      case STATES.Q5_PAST_TRY:
        if (this._phaseTurns < this.MAX_PHASE_TURNS) return STATES.Q5_PAST_TRY;
        this._phaseTurns = 0;
        return STATES.SUMMARY_CONFIRM;

      // --- 非提问阶段：直接推进 ---
      case STATES.SUMMARY_CONFIRM:
        return STATES.GENERATE_RESULT;

      case STATES.GENERATE_RESULT:
        return STATES.COMPLETE;

      case STATES.COMPLETE:
        return STATES.COMPLETE;

      default:
        return STATES.COMPLETE;
    }
  }

  _getStateLabel() {
    const labels = {
      [STATES.WELCOME]: '欢迎',
      [STATES.PROFILE_CONFIRM]: '确认阶段',
      [STATES.Q1_STAGE]: '现状了解',
      [STATES.Q2_EXPERIENCE]: '经验盘点',
      [STATES.Q3_MOTIVATION]: '内在驱动',
      [STATES.Q4_CONSTRAINT]: '现实约束',
      [STATES.Q5_PAST_TRY]: '以往尝试',
      [STATES.SUMMARY_CONFIRM]: '总结确认',
      [STATES.GENERATE_RESULT]: '生成建议',
      [STATES.COMPLETE]: '完成',
    };
    return labels[this.state] || '';
  }

  _buildSummaryPrompt() {
    const parts = ['好的，让我帮你梳理一下我们聊的内容：\n'];

    const order = ['stage', 'experience', 'motivation', 'constraints', 'pastTry'];
    const labels = {
      stage: '📌 你的现状',
      experience: '💼 你的经验',
      motivation: '🔥 你的驱动',
      constraints: '⚖️ 你的约束',
      pastTry: '🔍 你的尝试',
    };

    order.forEach(id => {
      if (this.collected[id]) {
        parts.push(`${labels[id]}：${this.collected[id].answer}`);
        parts.push('');
      }
    });

    if (this.hasProfile && this.profileSummary) {
      parts.push(`🧬 测评画像补充：你的核心特质是「${this.profileSummary.topNames}」`);
      parts.push('');
    }

    parts.push('如果以上总结有偏差，请告诉我需要修正的地方。如果没问题，回复"确认"或"没问题"，我来为你生成职业方向建议。');

    return parts.join('\n');
  }
}

export default ConversationStateMachine;

// --- 内部辅助 ---
function _isQuestionState(state) {
  return state === STATES.Q1_STAGE ||
         state === STATES.Q2_EXPERIENCE ||
         state === STATES.Q3_MOTIVATION ||
         state === STATES.Q4_CONSTRAINT ||
         state === STATES.Q5_PAST_TRY;
}
