// ============================================================
// Strategy: dual-reaction.js — 双重反应（G4 意义建构）
// 职责: 每个场景显示故事 → 反应①(二选一) → 反应②(二选一)
//       反应②在反应①选中后才出现，无反馈文案
// ============================================================

import { PROFILE_TYPES } from '../game4-data.js?v=20260602e';

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const DualReactionStrategy = {

  // ═══ renderIntro ═══
  renderIntro(container, config) {
    return new Promise(resolve => {
      const intro = config.intro || {};
      container.innerHTML = `
        <div class="g4-intro animate-fade-in">
          <div class="g4-intro__ambient" aria-hidden="true"></div>
          <p class="g4-intro__subtitle">${esc(intro.subtitle)}</p>
          <h2 class="g4-intro__title">${esc(intro.title)}</h2>
          <p class="g4-intro__desc">${intro.description}</p>
          ${intro.estimatedTime ? `<p class="g4-intro__time">⏱ ${esc(intro.estimatedTime)}</p>` : ''}
          <button class="btn btn-primary btn-lg g4-intro__cta" id="js-g4-start">${esc(intro.ctaText)}</button>
        </div>
      `;
      container.querySelector('#js-g4-start').addEventListener('click', () => resolve());
      container.querySelector('#js-g4-start').focus();
    });
  },

  // ═══ renderScenario ═══
  /**
   * @returns {Promise<{presenceChoice: string, searchChoice: string, reactionTime: number}>}
   */
  renderScenario(container, scenario, index, total) {
    return new Promise(resolve => {
      const step = index + 1;
      const pOpts = shuffle(scenario.reactions.presence.options);
      const sOpts = shuffle(scenario.reactions.search.options);
      const startTime = performance.now();

      container.innerHTML = `
        <div class="g4-scene slide-in-right">
          <div class="g4-scene__progress">
            ${Array.from({length: total}, (_, i) => `<span class="g4-dot ${i < step ? 'g4-dot--done' : i === step-1 ? 'g4-dot--active' : ''}"></span>`).join('')}
            <span class="g4-scene__step">${step}/${total}</span>
          </div>

          <span class="g4-scene__tag">${esc(scenario.timeTag)}</span>
          <h2 class="g4-scene__title">${esc(scenario.title)}</h2>
          <p class="g4-scene__story">${esc(scenario.story)}</p>

          <div class="g4-scene__illustration">
            <img src="images/${esc(scenario.id)}.png" alt="" loading="lazy" />
          </div>

          <!-- 反应①: Presence — 独立卡片 -->
          <div class="g4-reaction-card" id="js-g4-r1-card">
            <p class="g4-reaction-card__prompt">${esc(scenario.reactions.presence.prompt)}</p>
            <div class="g4-reaction-card__options">
              ${pOpts.map(opt => `
                <button class="g4-option" data-id="${esc(opt.id)}">
                  ${esc(opt.text)}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- 反应②: Search — 独立卡片，初始隐藏 -->
          <div class="g4-reaction-card g4-reaction-card--hidden" id="js-g4-r2-card">
            <p class="g4-reaction-card__prompt">${esc(scenario.reactions.search.prompt)}</p>
            <div class="g4-reaction-card__options">
              ${sOpts.map(opt => `
                <button class="g4-option" data-id="${esc(opt.id)}">
                  ${esc(opt.text)}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      let presenceChoice = null;
      let reactionOneTime = 0;

      // 反应① 点击处理
      const r1Opts = container.querySelectorAll('#js-g4-r1-card .g4-option');
      r1Opts.forEach(btn => {
        btn.addEventListener('click', () => {
          r1Opts.forEach(b => b.classList.remove('g4-option--chosen'));
          btn.classList.add('g4-option--chosen');
          presenceChoice = btn.dataset.id;
          reactionOneTime = Math.round(performance.now() - startTime);  // 记录反应①完成时刻

          // 显示反应②卡片
          const r2Card = document.getElementById('js-g4-r2-card');
          r2Card.classList.add('g4-reaction-card--revealed');
          r2Card.classList.remove('g4-reaction-card--hidden');
          setTimeout(() => r2Card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);

          // 反应② 点击处理
          const r2Opts = container.querySelectorAll('#js-g4-r2-card .g4-option');
          r2Opts.forEach(b2 => {
            b2.addEventListener('click', () => {
              r2Opts.forEach(b => b.classList.remove('g4-option--chosen'));
              b2.classList.add('g4-option--chosen');

              const reactionTime = Math.round(performance.now() - startTime);
              const reactionTwoMs = Math.round(performance.now() - startTime - reactionOneTime);
              setTimeout(() => {
                resolve({ presenceChoice, searchChoice: b2.dataset.id, reactionTime, reactionOneMs: reactionOneTime, reactionTwoMs });
              }, 300);
            }, { once: true });
          });
        }, { once: true });
      });
    });
  },

  // ═══ renderCompletion ═══
  renderCompletion(container, output, config) {
    return new Promise(resolve => {
      const pt = output.behaviorSummary.profileType;
      const key = pt === '成长型' ? 'growth' : pt === '安定型' ? 'stable' : pt === '探索型' ? 'seeker' : 'drifting';
      const t = PROFILE_TYPES[key];
      const comp = config.completion || {};

      container.innerHTML = `
        <div class="g4-completion animate-scale-in">
          <div class="g4-completion__icon" aria-hidden="true">📖</div>
          <h2 class="g4-completion__title">六帧手记已经翻完了</h2>
          <p class="g4-completion__subtitle">你的答案，不是某一个画面给的——而是六个画面叠加后，浮现出来的那个东西。</p>

          <div class="g4-completion__type">
            <span class="g4-type__emoji">${t.emoji}</span>
            <span class="g4-type__label">${t.label}</span>
            <span class="g4-type__title">${t.title}</span>
            <p class="g4-type__desc">${t.desc}</p>
          </div>

          <div class="g4-completion__nav">
            <a class="btn btn-primary" href="${esc(comp.nextGameUrl)}">→ ${esc(comp.nextGameLabel)}</a>
            <a class="btn btn-secondary" href="../index.html">返回首页</a>
          </div>
        </div>
      `;

      container.querySelector('.btn-secondary').addEventListener('click', () => resolve());
    });
  },
};
