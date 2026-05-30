// ============================================================
// M4: engine.js — 通用游戏引擎（策略模式架构）
// 职责: 编排游戏生命周期，委派 UI 渲染/交互给 Strategy
// 依赖: utils.js, store.js
// ============================================================
//
// 策略模式架构:
//   Engine (编排层) ——→ Strategy (交互层)
//   状态机 + 数据管道     渲染 + 用户交互
//   永不关心 UI 细节     自由定义游戏方式
//
// Strategy 接口（每个 Strategy 必须实现 4 个方法）:
//   renderIntro(container, config, onStart)    → Promise<void>
//   renderScenario(container, scenario, idx, total, onResponse) → Promise<DecisionRecord>
//   renderFeedback(container, feedbackData, onNext) → Promise<void>
//   renderCompletion(container, result, config, onNavigate) → Promise<void>
// 每个方法返回 Promise，Engine await 后进入下一状态。
// ============================================================

import { normalize, clamp, log, logWarn, logError } from '../core/utils.js';
import { save } from '../core/store.js';

// ---------- 阶段枚举 ----------
const Phase = {
  IDLE:        'idle',
  INTRO:       'intro',
  SCENARIO:    'scenario',
  FEEDBACK:    'feedback',
  COMPLETION:  'completion',
};

// ---------- GameEngine 编排层 ----------

export class GameEngine {
  /**
   * @param {GameConfig}   config   - 游戏配置（gameId, title, intro, scenarios, scoring, completion 等）
   * @param {GameStrategy} strategy - 交互策略（renderIntro/renderScenario/renderFeedback/renderCompletion）
   * @param {HTMLElement}  container - 渲染目标 DOM 容器
   * @param {EngineCallbacks} [callbacks] - 可选回调
   */
  constructor(config, strategy, container, callbacks = {}) {
    if (!config || !config.gameId)   throw new Error('engine: config.gameId 不能为空');
    if (!strategy)                   throw new Error('engine: strategy 不能为空');
    if (!container)                  throw new Error('engine: container 不能为空');

    this.config   = config;
    this.strategy = strategy;
    this.container = container;
    this.callbacks = callbacks;

    // 内部状态（完全封装，Strategy 不可见）
    this._phase = Phase.IDLE;
    this._scenarioIndex = 0;
    this._rawScores = {};
    this._decisions = [];
    this._totalTime = 0;
    this._gameStartTime = 0;

    // 合法的状态转移表（用于严格检查）
    this._validTransitions = {
      [Phase.IDLE]:       [Phase.INTRO],
      [Phase.INTRO]:      [Phase.SCENARIO],
      [Phase.SCENARIO]:   [Phase.FEEDBACK, Phase.COMPLETION],
      [Phase.FEEDBACK]:   [Phase.SCENARIO, Phase.COMPLETION],
      [Phase.COMPLETION]: [],
    };
  }

  /** 获取当前阶段（只读） */
  get phase() { return this._phase; }

  // ========== 内部：状态机守卫 ==========

  /** 安全切换阶段，非法切换抛错 */
  _setPhase(newPhase) {
    const allowed = this._validTransitions[this._phase];
    if (!allowed || !allowed.includes(newPhase)) {
      throw new Error(
        `engine: 非法状态转移 ${this._phase} → ${newPhase}，允许: [${allowed?.join(', ') || '无'}]`
      );
    }
    const oldPhase = this._phase;
    this._phase = newPhase;

    // 触发阶段变更事件
    if (this.callbacks.onPhaseChange) {
      this.callbacks.onPhaseChange({ from: oldPhase, to: newPhase });
    }
  }

  /** 等待一段转场时间（给 CSS 退出动画留时间） */
  _transitionOut(ms = 250) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== 公开入口 ==========

  /**
   * 启动游戏。串行执行：intro → [scenario ↔ feedback] × N → completion
   * @returns {Promise<GameOutput>} 游戏完成后的标准化输出
   */
  async run() {
    this._gameStartTime = performance.now();
    this._initScores();

    // Phase 1: 引导页
    await this._runIntro();

    // Phase 2: 情境循环（每个情境 → 决策 → 反馈）
    const scenarios = this.config.scenarios;
    for (let i = 0; i < scenarios.length; i++) {
      this._scenarioIndex = i;

      // 2a: 渲染情境，等待用户决策
      const record = await this._runScenario(scenarios[i]);
      this._decisions.push(record);

      // 2b: 触达进度回调
      if (this.callbacks.onProgress) {
        this.callbacks.onProgress(i + 1, scenarios.length);
      }
      if (this.callbacks.onDecision) {
        this.callbacks.onDecision(record);
      }

      // 2c: 如果是最后一个情境，跳过反馈直接进入完成页
      if (i < scenarios.length - 1) {
        await this._runFeedback(scenarios[i], record);
      }
    }

    // Phase 3: 计算 + 保存 + 完成页
    const output = this._calculateOutput();
    try {
      save(this.config.gameId, output);
      log(`${this.config.gameId} 全部完成，结果已保存`);
    } catch (err) {
      logError(`${this.config.gameId} 保存失败: ${err.message}`);
      // 不阻断流程，用户仍可看到完成页（数据仅在内存中）
    }

    await this._runCompletion(output);

    // 触发完成回调
    if (this.callbacks.onComplete) {
      this.callbacks.onComplete(output);
    }

    return output;
  }

  // ========== 内部：各阶段的编排逻辑 ==========

  /** 显示引导页，等待用户点"开始" */
  async _runIntro() {
    this._setPhase(Phase.INTRO);
    this.container.innerHTML = '';
    log(`${this.config.gameId}: 显示引导页`);
    await this.strategy.renderIntro(this.container, this.config);
  }

  /** 渲染一个情境，等待用户选择 → 返回 DecisionRecord */
  async _runScenario(scenario) {
    const { total } = this._getProgress();

    // 先让当前内容退出（CSS 动画）
    if (this._scenarioIndex > 0) {
      const current = this.container.querySelector('.scenario-view, .feedback-overlay');
      if (current) {
        current.classList.add('is-exiting');
      }
      await this._transitionOut(280);
    }

    this._setPhase(Phase.SCENARIO);
    this.container.innerHTML = '';
    log(`${this.config.gameId}: 渲染情境 ${scenario.id}`);

    const record = await this.strategy.renderScenario(
      this.container, scenario, this._scenarioIndex, total
    );

    // 引擎负责：权重累加 + 时间累积
    this._accumulateWeights(scenario, record);
    this._totalTime += record.decisionTime;

    return record;
  }

  /** 显示反馈，等待用户点"继续" */
  async _runFeedback(scenario, decision) {
    const feedbackText = this._getFeedback(scenario, decision);
    if (!feedbackText) return; // 无反馈则跳过

    // 退出当前场景
    const current = this.container.querySelector('.scenario-view');
    if (current) current.classList.add('is-exiting');
    await this._transitionOut(250);

    this._setPhase(Phase.FEEDBACK);
    this.container.innerHTML = '';
    log(`${this.config.gameId}: 显示反馈 for ${scenario.id}`);
    await this.strategy.renderFeedback(this.container, feedbackText);
  }

  /** 显示完成页 */
  async _runCompletion(output) {
    // 退出最后一个场景/反馈
    const current = this.container.querySelector('.scenario-view, .feedback-overlay');
    if (current) current.classList.add('is-exiting');
    await this._transitionOut(300);

    this._setPhase(Phase.COMPLETION);
    this.container.innerHTML = '';
    log(`${this.config.gameId}: 显示完成页`);
    await this.strategy.renderCompletion(this.container, output, this.config);
  }

  // ========== 内部：数据管道 ==========

  /** 初始化原始分数（全 0）*/
  _initScores() {
    const dims = this.config.scoring?.dimensions || [];
    dims.forEach(d => { this._rawScores[d] = 0; });
  }

  /** 累积选项权重到原始分数 */
  _accumulateWeights(scenario, record) {
    const scenarioId = scenario.id;
    const optionId = record.chosenOptionId;
    const chosenOpt = scenario.options.find(o => o.id === optionId);
    if (!chosenOpt || !chosenOpt.weights) {
      logWarn(`情境 ${scenarioId} 未找到选项 ${optionId} 的权重`);
      return;
    }

    Object.entries(chosenOpt.weights).forEach(([dim, weight]) => {
      if (this._rawScores.hasOwnProperty(dim)) {
        this._rawScores[dim] += weight;
      }
    });
  }

  /** 获取反馈文案 */
  _getFeedback(scenario, decision) {
    const optionId = decision.chosenOptionId;
    const feedbackMap = this.config.feedbackMap;
    if (!feedbackMap) return '';
    return feedbackMap[optionId] || '';
  }

  /** 进度信息 */
  _getProgress() {
    return {
      current: this._scenarioIndex,
      total: this.config.scenarios.length,
    };
  }

  /** 归一化 + 生成最终 GameOutput */
  _calculateOutput() {
    const dims = this.config.scoring?.dimensions || [];
    const rawRange   = this.config.scoring?.rawRange   || [0, 10];
    const outputRange = this.config.scoring?.outputRange || [0, 10];

    const dimensions = {};
    dims.forEach(dim => {
      const raw = this._rawScores[dim] || 0;
      dimensions[dim] = normalize(raw, rawRange[0], rawRange[1]);
    });

    // 再映射到输出范围（通常 [0,10]）
    const [outMin, outMax] = outputRange;
    Object.keys(dimensions).forEach(dim => {
      dimensions[dim] = clamp(
        outMin + dimensions[dim] * (outMax - outMin),
        outMin, outMax
      );
    });

    const totalElapsed = Math.round(performance.now() - this._gameStartTime);

    return {
      gameId:     this.config.gameId,
      version:    '1.0.0',
      dimensions,
      decisions:  this._decisions,
      meta: {
        totalTime:   this._totalTime,
        elapsedMs:   totalElapsed,
        decisionCount: this._decisions.length,
        scenarioIds: this.config.scenarios.map(s => s.id),
        completedAt: Date.now(),
      },
    };
  }
}

// ---------- 类型参考（JSDoc，编译时无影响） ----------

/**
 * @typedef {Object} GameConfig
 * @property {string}      gameId    - 'game1'|'game2'|'game3'|'game4'
 * @property {string}      title     - 游戏标题
 * @property {Object}      intro     - 引导页数据 { subtitle, title, description, ctaText, estimatedTime? }
 * @property {Scenario[]}  scenarios - 情境列表
 * @property {Object}      scoring   - { dimensions: string[], rawRange: [number,number], outputRange: [number,number] }
 * @property {Object}      [feedbackMap] - { [optionId]: feedbackText }
 * @property {Object}      completion - 完成页数据 { title, message }
 *
 * @typedef {Object} Scenario
 * @property {string}   id          - e.g. 's1'
 * @property {string}   title       - 情境标题
 * @property {string}   description - 情境描述（纯文本或 HTML）
 * @property {Option[]}  options    - 可选方案
 *
 * @typedef {Object} Option
 * @property {string}   id      - e.g. 's1_a'
 * @property {string}   text    - 选项文字
 * @property {string}   [subtext] - 选项补充说明
 * @property {Object<string,number>} weights - 权重贡献 { dim1: +2, dim2: -1 }
 *
 * @typedef {Object} DecisionRecord
 * @property {string}   scenarioId
 * @property {string}   chosenOptionId
 * @property {number}   decisionTime - 毫秒
 *
 * @typedef {Object} GameOutput
 * @property {string}   gameId
 * @property {string}   version
 * @property {Object<string,number>} dimensions
 * @property {DecisionRecord[]} decisions
 * @property {Object}   meta
 *
 * @typedef {Object} GameStrategy
 * @property {(container:HTMLElement, config:GameConfig)=>Promise<void>} renderIntro
 * @property {(container:HTMLElement, scenario:Scenario, index:number, total:number)=>Promise<DecisionRecord>} renderScenario
 * @property {(container:HTMLElement, feedbackText:string)=>Promise<void>} renderFeedback
 * @property {(container:HTMLElement, output:GameOutput, config:GameConfig)=>Promise<void>} renderCompletion
 *
 * @typedef {Object} EngineCallbacks
 * @property {(record:DecisionRecord)=>void} [onDecision]
 * @property {(current:number, total:number)=>void} [onProgress]
 * @property {(result:GameOutput)=>void} [onComplete]
 */
