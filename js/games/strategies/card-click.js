// ============================================================
// Strategy: card-click.js — 卡片点击选择（G1 核心驱动力）
// 职责: 渲染引导页/情境卡片/反馈弹窗/完成页
// 实现 GameStrategy 接口，供 GameEngine 调用
// ============================================================
//
// 优化点（v1.1 — design-researcher 研究后）:
//   ├── 选中延迟 1200ms → 600ms（MD3 推荐 300-400ms，留呼吸空间）
//   ├── Shared-axis 滑入动画（场景从右滑入）
//   ├── Press 涟漪效果（确认用户点击有反馈）
//   ├── 键盘焦点可见（focus-visible ring）
//   ├── 退出动画支持（.is-exiting 类，引擎调用）
//   └── ARIA: progress 区域 + option list role
// ============================================================

import { log } from '../../core/utils.js?v=20260602e';

// ---------- 常量 ----------
const SELECTED_DELAY_MS = 600; // 选中确认延迟

// ---------- 导出：Strategy 对象 ----------

export const CardClickStrategy = {

  // ═══ renderIntro ═══
  async renderIntro(container, config) {
    return new Promise(resolve => {
      const intro = config.intro || {};
      container.innerHTML = `
        <div class="game-intro animate-fade-in">
          <p class="game-intro__subtitle">${escapeHTML(intro.subtitle || '')}</p>
          <h2 class="game-intro__title">${escapeHTML(intro.title || config.title)}</h2>
          <p class="game-intro__desc">${intro.description || ''}</p>
          ${intro.estimatedTime ? `<p class="game-intro__time">⏱ ${escapeHTML(intro.estimatedTime)}</p>` : ''}
          <button class="btn btn-primary btn-lg game-intro__cta" id="js-intro-start">
            ${escapeHTML(intro.ctaText || '开始')}
          </button>
        </div>
      `;

      const btn = container.querySelector('#js-intro-start');
      btn.addEventListener('click', () => {
        log('card-click: 引导页 → 用户点击开始');
        resolve();
      });
      btn.focus();
    });
  },

  // ═══ renderScenario ═══
  async renderScenario(container, scenario, index, total) {
    return new Promise(resolve => {
      const step = index + 1;

      // 打乱选项顺序（避免首因效应）
      const shuffled = [...scenario.options].sort(() => Math.random() - 0.5);

      container.innerHTML = `
        <div class="scenario-view slide-in-right"
             role="region"
             aria-label="${escapeHTML(scenario.title)} — 第 ${step} 题，共 ${total} 题">
          <div class="scenario-header">
            <div class="progress-dots" id="js-progress-dots"
                 role="progressbar" aria-valuenow="${step}" aria-valuemin="1" aria-valuemax="${total}"
                 aria-label="进度: ${step}/${total}">
              ${renderProgressDots(total, step)}
            </div>
            <span class="scenario-step">${step} / ${total}</span>
          </div>

          <div class="scenario-card">
            <h2 class="scenario-title">${escapeHTML(scenario.title)}</h2>
            <p class="scenario-description">${scenario.description}</p>
          </div>

          <div class="option-list" id="js-option-list" role="radiogroup"
               aria-label="请选择你的应对方式">
            ${shuffled.map((opt, i) => `
              <button class="option-card btn-press"
                      role="radio"
                      data-option-id="${escapeHTML(opt.id)}"
                      data-index="${i}"
                      aria-label="选项 ${String.fromCharCode(65 + i)}: ${escapeHTML(opt.text)}">
                <span class="option-card__ripple"></span>
                <span class="option-card__label">${String.fromCharCode(65 + i)}</span>
                <span class="option-card__content">
                  <span class="option-card__text">${escapeHTML(opt.text)}</span>
                  ${opt.subtext ? `<span class="option-card__subtext">"${escapeHTML(opt.subtext)}"</span>` : ''}
                </span>
              </button>
            `).join('')}
          </div>
        </div>
      `;

      const optionList = container.querySelector('#js-option-list');
      const options = optionList.querySelectorAll('.option-card');
      const startTime = performance.now();

      // 选项点击处理
      options.forEach(card => {
        card.addEventListener('click', (e) => {
          // 涟漪效果
          triggerRipple(card, e);

          // 禁用所有选项
          options.forEach(c => {
            c.classList.add('option-card--disabled');
            c.setAttribute('aria-disabled', 'true');
            c.disabled = true;
          });

          // 高亮选中项
          card.classList.add('option-card--selected');
          card.classList.remove('option-card--disabled');
          card.setAttribute('aria-checked', 'true');
          card.disabled = false;

          const optionId = card.dataset.optionId;
          const decisionTime = Math.round(performance.now() - startTime);

          log(`card-click: 用户选择 ${optionId}, 耗时 ${decisionTime}ms`);

          // 短暂停留后自动推进（让用户看到确认反馈）
          setTimeout(() => {
            resolve({ scenarioId: scenario.id, chosenOptionId: optionId, decisionTime });
          }, SELECTED_DELAY_MS);
        });
      });

      // 自动聚焦第一个选项
      if (options.length > 0) {
        options[0].focus({ preventScroll: true });
      }
    });
  },

  // ═══ renderFeedback ═══
  async renderFeedback(container, feedbackText) {
    return new Promise(resolve => {
      container.innerHTML = `
        <div class="feedback-overlay animate-scale-in"
             role="alert" aria-live="polite">
          <div class="feedback-card">
            <p class="feedback-text">${escapeHTML(feedbackText)}</p>
            <button class="btn btn-secondary feedback-next btn-press" id="js-feedback-next">
              继续
              <span class="btn__ripple"></span>
            </button>
          </div>
        </div>
      `;

      const btn = container.querySelector('#js-feedback-next');
      btn.addEventListener('click', () => {
        log('card-click: 反馈 → 用户点击继续');
        resolve();
      });
      btn.focus();
    });
  },

  // ═══ renderCompletion ═══
  async renderCompletion(container, output, config) {
    return new Promise(resolve => {
      const comp = config.completion || {};

      container.innerHTML = `
        <div class="game-complete animate-scale-in">
          <div class="game-complete__icon" aria-hidden="true">✦</div>
          <h2 class="game-complete__title">${escapeHTML(comp.title || '完成')}</h2>
          <p class="game-complete__desc">${comp.message || ''}</p>

          <div class="game-complete__nav">
            <button class="btn btn-primary btn-press" id="js-next-game" style="display:none;">
              → ${escapeHTML(comp.nextGameLabel || '下一个游戏')}
              <span class="btn__ripple"></span>
            </button>
            <button class="btn btn-secondary btn-press" id="js-back-home">
              返回首页
              <span class="btn__ripple"></span>
            </button>
          </div>
        </div>
      `;

      // 返回首页
      container.querySelector('#js-back-home').addEventListener('click', () => {
        log('card-click: 完成页 → 返回首页');
        window.location.href = '../index.html';
        resolve();
      });

      // 继续下一个游戏（如果配置了）
      const nextBtn = container.querySelector('#js-next-game');
      if (comp.nextGameUrl) {
        nextBtn.style.display = '';
        nextBtn.addEventListener('click', () => {
          log(`card-click: 完成页 → ${comp.nextGameUrl}`);
          window.location.href = comp.nextGameUrl;
          resolve();
        });
      }
    });
  },

};

// ========== 内部工具函数 ==========

/** 渲染进度圆点 */
function renderProgressDots(total, current) {
  let html = '';
  for (let i = 1; i <= total; i++) {
    const cls = i <= current ? 'dot dot--done' : 'dot';
    const label = i === current ? ' dot--active' : '';
    html += `<span class="${cls}${label}" aria-hidden="true"></span>`;
  }
  return html;
}

/** 按钮涟漪效果 */
function triggerRipple(button, event) {
  const ripple = button.querySelector('.option-card__ripple');
  if (!ripple) return;

  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.classList.remove('is-active');
  void ripple.offsetWidth; // 强制回流，重启动画
  ripple.classList.add('is-active');
}

/** 基础 HTML 转义 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
