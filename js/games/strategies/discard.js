// ============================================================
// Strategy: discard.js — 翻牌抛弃策略（G2 职业锚）
// 职责: 三阶段批处理 UI 渲染（翻牌 + 保留/抛弃 + 拍立得选择）
// 接口: 每个阶段方法返回 Promise，resolve 时返回选中的卡片列表
// ============================================================

import { ANCHOR_NAMES, STAGES, ANCHOR_COMPLETION } from '../game2-data.js?v=20260602e';

// ---------- 工具 ----------

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 洗牌 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- 导出 ----------

export const DiscardStrategy = {

  // ═══ renderIntro ═══
  /** @returns {Promise<void>} */
  renderIntro(container, config) {
    return new Promise(resolve => {
      const intro = config.intro || {};
      container.innerHTML = `
        <div class="g2-intro animate-fade-in">
          <p class="g2-intro__subtitle">${esc(intro.subtitle)}</p>
          <h2 class="g2-intro__title">${esc(intro.title)}</h2>
          <p class="g2-intro__desc">${intro.description}</p>
          ${intro.estimatedTime ? `<p class="g2-intro__time">⏱ ${esc(intro.estimatedTime)}</p>` : ''}
          <button class="btn btn-primary btn-lg g2-intro__cta" id="js-g2-start">${esc(intro.ctaText)}</button>
        </div>
      `;
      container.querySelector('#js-g2-start').addEventListener('click', () => resolve());
      container.querySelector('#js-g2-start').focus();
    });
  },

  // ═══ renderStage1: 百团大战 16→8 ═══
  /** @returns {Promise<{selected: string[], cardsFlipped: number, flippedCardIds: string[]}>} */
  renderStage1(container, allCards, stageCfg) {
    return new Promise(resolve => {
      const shuffled = shuffle(allCards);
      const selected = new Set();
      const flippedCards = new Set();  // 翻牌记录
      const max = stageCfg.maxSelect;

      function updateUI() {
        const count = selected.size;
        document.getElementById('js-g2-count').textContent = count;
        document.getElementById('js-g2-confirm').disabled = count < 2 || count > max;
        document.getElementById('js-g2-confirm').textContent =
          count < 2 ? `至少选 2 张（已选 ${count}）` : count > max ? `最多选 ${max} 张` : `确认选择（${count}/${max}）`;
      }

      container.innerHTML = `
        <div class="g2-stage slide-in-right">
          <div class="g2-stage__header">
            <span class="g2-stage__badge">阶段一</span>
            <h2 class="g2-stage__title">${esc(stageCfg.name)}</h2>
            <p class="g2-stage__subtitle">${esc(stageCfg.subtitle)}</p>
          </div>
          <p class="g2-stage__desc">${esc(stageCfg.description)}</p>
          <p class="g2-stage__hint">${esc(stageCfg.instruction)}</p>
          <div class="g2-card-grid" id="js-g2-grid"></div>
          <div class="g2-stage__bar">
            <span class="g2-stage__count">已选：<strong id="js-g2-count">0</strong></span>
            <button class="btn btn-primary" id="js-g2-confirm" disabled>至少选 2 张（已选 0）</button>
          </div>
        </div>
      `;

      // 渲染所有卡片
      const grid = document.getElementById('js-g2-grid');
      shuffled.forEach(card => {
        const el = document.createElement('div');
        el.className = 'g2-card';
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `${esc(card.front)} - 点击翻牌查看详情`);
        el.innerHTML = `
          <div class="g2-card__inner">
            <div class="g2-card__front">
              <span class="g2-card__name">${esc(card.front)}</span>
              <span class="g2-card__flip-hint">点击查看</span>
              <span class="g2-card__stamp">已加入</span>
            </div>
            <div class="g2-card__back">
              <span class="g2-card__back-name">${esc(card.front)}</span>
              <p class="g2-card__detail">${esc(card.detail)}</p>
              <div class="g2-card__actions">
                <button class="btn btn-primary btn-sm g2-card__join" data-id="${card.id}">${esc(stageCfg.joinLabel)}</button>
              </div>
              <span class="g2-card__stamp">已加入</span>
            </div>
          </div>
        `;
        grid.appendChild(el);

        // 翻牌
        el.addEventListener('click', (e) => {
          if (!el.classList.contains('is-flipped') && !e.target.closest('button')) {
            el.classList.add('is-flipped');
            flippedCards.add(card.id);
          }
        });
        el.addEventListener('keydown', (e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !el.classList.contains('is-flipped')) {
            e.preventDefault();
            el.classList.add('is-flipped');
            flippedCards.add(card.id);
          }
        });
      });

      // 加入按钮事件（委托）
      grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.g2-card__join');
        if (!btn) return;
        const cardId = btn.dataset.id;
        e.stopPropagation(); // 阻止冒泡到卡片翻牌

        if (selected.has(cardId)) {
          selected.delete(cardId);
        } else {
          if (selected.size >= max) return;
          selected.add(cardId);
        }

        // 高亮卡片
        grid.querySelectorAll('.g2-card').forEach(el => {
          const joinBtn = el.querySelector('.g2-card__join');
          if (joinBtn && selected.has(joinBtn.dataset.id)) {
            el.classList.add('g2-card--kept');
          } else {
            el.classList.remove('g2-card--kept');
          }
        });

        updateUI();
      });

      document.getElementById('js-g2-confirm').addEventListener('click', () => {
        if (selected.size >= 2 && selected.size <= max) {
          resolve({ selected: [...selected], cardsFlipped: flippedCards.size, flippedCardIds: [...flippedCards] });
        }
      });
    });
  },

  // ═══ renderStage2: 大三抉择 8→3~4 ═══
  /** @returns {Promise<string[]>} 保留的卡片 ID 列表 */
  renderStage2(container, keptCards, allCards, stageCfg) {
    return new Promise(resolve => {
      const cards = keptCards.map(id => allCards.find(c => c.id === id)).filter(Boolean);
      const selected = new Set(keptCards); // 默认全选
      const max = stageCfg.maxSelect;

      function updateUI() {
        const count = selected.size;
        document.getElementById('js-g2-count2').textContent = count;
        document.getElementById('js-g2-confirm2').disabled = count < 2 || count > max;
        document.getElementById('js-g2-confirm2').textContent =
          count < 2 ? `至少留 2 个（已留 ${count}）` : count > max ? `最多留 ${max} 个` : `确认取舍（${count}/${max}）`;
      }

      container.innerHTML = `
        <div class="g2-stage slide-in-right">
          <div class="g2-stage__header">
            <span class="g2-stage__badge">阶段二</span>
            <h2 class="g2-stage__title">${esc(stageCfg.name)}</h2>
            <p class="g2-stage__subtitle">${esc(stageCfg.subtitle)}</p>
          </div>
          <p class="g2-stage__desc">${esc(stageCfg.description)}</p>
          <p class="g2-stage__hint">${esc(stageCfg.instruction)}</p>
          <div class="g2-table-list" id="js-g2-table"></div>
          <div class="g2-stage__bar">
            <span class="g2-stage__count">留下：<strong id="js-g2-count2">${selected.size}</strong></span>
            <button class="btn btn-primary" id="js-g2-confirm2">确认取舍（${selected.size}/${max}）</button>
          </div>
        </div>
      `;

      const table = document.getElementById('js-g2-table');
      cards.forEach(card => {
        const row = document.createElement('div');
        row.className = 'g2-table-row';
        row.innerHTML = `
          <div class="g2-table-row__info">
            <span class="g2-table-row__name">${esc(card.front)}</span>
            <span class="g2-table-row__detail">${esc(card.detail)}</span>
            <span class="g2-table-row__phase2">${esc(card.phase2 || card.detail)}</span>
          </div>
          <div class="g2-table-row__actions">
            <button class="btn btn-primary btn-sm g2-btn-keep" data-id="${card.id}" ${selected.has(card.id) ? '' : 'style="opacity:0.4"'}>${esc(stageCfg.joinLabel)}</button>
            <button class="btn btn-ghost btn-sm g2-btn-drop" data-id="${card.id}" ${!selected.has(card.id) ? '' : 'style="opacity:0.4"'}>${esc(stageCfg.passLabel)}</button>
          </div>
        `;

        // Keep
        row.querySelector('.g2-btn-keep').addEventListener('click', () => {
          selected.add(card.id);
          row.classList.remove('g2-table-row--dropped');
          row.querySelector('.g2-btn-keep').style.opacity = '';
          row.querySelector('.g2-btn-drop').style.opacity = '0.4';
          updateUI();
        });

        // Drop
        row.querySelector('.g2-btn-drop').addEventListener('click', () => {
          selected.delete(card.id);
          row.classList.add('g2-table-row--dropped');
          row.querySelector('.g2-btn-drop').style.opacity = '';
          row.querySelector('.g2-btn-keep').style.opacity = '0.4';
          updateUI();
        });

        table.appendChild(row);
      });

      document.getElementById('js-g2-confirm2').addEventListener('click', () => {
        if (selected.size >= 2 && selected.size <= max) {
          resolve([...selected]);
        }
      });
    });
  },

  // ═══ renderStage3: 毕业拍立得 3~4→1~2 ═══
  /** @returns {Promise<string[]>} 最终选中的卡片 ID */
  renderStage3(container, keptCards, allCards, stageCfg) {
    return new Promise(resolve => {
      const cards = keptCards.map(id => allCards.find(c => c.id === id)).filter(Boolean);
      const selected = new Set();
      const max = stageCfg.maxSelect;

      function updateUI() {
        const count = selected.size;
        document.getElementById('js-g2-count3').textContent = count;
        const btn = document.getElementById('js-g2-confirm3');
        btn.disabled = count < 1 || count > max;
        btn.textContent = count < 1 ? '至少选 1 张' : count > max ? `最多选 ${max} 张` : `装进行李箱（${count}/${max}）`;
      }

      container.innerHTML = `
        <div class="g2-stage slide-in-right">
          <div class="g2-stage__header">
            <span class="g2-stage__badge">阶段三</span>
            <h2 class="g2-stage__title">${esc(stageCfg.name)}</h2>
            <p class="g2-stage__subtitle">${esc(stageCfg.subtitle)}</p>
          </div>
          <p class="g2-stage__desc">${esc(stageCfg.description)}</p>
          <p class="g2-stage__hint">${esc(stageCfg.instruction)}</p>
          <div class="g2-polaroid-grid" id="js-g2-polaroid"></div>
          <div class="g2-stage__bar">
            <span class="g2-stage__count">已选：<strong id="js-g2-count3">0</strong></span>
            <button class="btn btn-primary" id="js-g2-confirm3" disabled>至少选 1 张</button>
          </div>
        </div>
      `;

      const grid = document.getElementById('js-g2-polaroid');
      // 给每张照片一个随机微倾斜角度
      const tilts = [-3, 1, -1.5, 2.5];
      cards.forEach((card, i) => {
        const tilt = tilts[i] || 0;
        const el = document.createElement('div');
        el.className = 'g2-polaroid';
        el.style.transform = `rotate(${tilt}deg)`;
        el.tabIndex = 0;
        el.setAttribute('role', 'checkbox');
        el.setAttribute('aria-checked', 'false');
        el.setAttribute('aria-label', `选择: ${esc(card.front)}`);
        el.innerHTML = `
          <div class="g2-polaroid__img"></div>
          <div class="g2-polaroid__text">${esc(card.front)}</div>
          <div class="g2-polaroid__sub">${esc(card.detail.substring(0, 30))}...</div>
        `;

        el.addEventListener('click', () => {
          if (selected.has(card.id)) {
            selected.delete(card.id);
            el.classList.remove('g2-polaroid--chosen');
            el.setAttribute('aria-checked', 'false');
          } else {
            if (selected.size >= max) return;
            selected.add(card.id);
            el.classList.add('g2-polaroid--chosen');
            el.setAttribute('aria-checked', 'true');
          }
          updateUI();
        });

        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            el.click();
          }
        });

        grid.appendChild(el);
      });

      document.getElementById('js-g2-confirm3').addEventListener('click', () => {
        if (selected.size >= 1 && selected.size <= max) {
          const stage = container.querySelector('.g2-stage');
          const btn = document.getElementById('js-g2-confirm3');
          const polaroids = container.querySelectorAll('.g2-polaroid');

          // 锁定交互
          btn.disabled = true;
          btn.textContent = '装入中...';
          polaroids.forEach(p => p.style.pointerEvents = 'none');

          // Phase 1: UI 退场（0.55s）
          stage.classList.add('g2-stage--exiting');

          // Phase 2: 未选中照片风化 + 选中照片发光（700ms 后开始）
          setTimeout(() => {
            polaroids.forEach(p => {
              if (!p.classList.contains('g2-polaroid--chosen')) {
                p.classList.add('g2-polaroid--weathering');
              } else {
                p.classList.add('g2-polaroid--kept');
              }
            });
          }, 700);

          // Phase 3: 风化崩解（2100ms 后触发）
          setTimeout(() => {
            polaroids.forEach(p => {
              if (p.classList.contains('g2-polaroid--weathering')) {
                p.classList.remove('g2-polaroid--weathering');
                p.classList.add('g2-polaroid--disintegrated');
              }
            });
          }, 2100);

          // 动画完毕 → resolve
          setTimeout(() => resolve([...selected]), 3300);
        }
      });
    });
  },

  // ═══ renderFeedback ═══
  /** @returns {Promise<void>} */
  renderFeedback(container, text) {
    return new Promise(resolve => {
      container.innerHTML = `
        <div class="feedback-overlay animate-scale-in" role="alert" aria-live="polite">
          <div class="feedback-card">
            <p class="feedback-text" style="white-space:pre-line">${esc(text)}</p>
            <button class="btn btn-secondary feedback-next" id="js-g2-fb-next">继续</button>
          </div>
        </div>
      `;
      const btn = document.getElementById('js-g2-fb-next');
      btn.addEventListener('click', () => resolve());
      btn.focus();
    });
  },

  // ═══ renderCompletion ═══
  /** @returns {Promise<void>} */
  renderCompletion(container, output, config) {
    return new Promise(resolve => {
      const { primaryAnchor, secondaryAnchor } = output.behaviorSummary;
      const primaryName = ANCHOR_NAMES[primaryAnchor] || primaryAnchor;
      const secondaryName = ANCHOR_NAMES[secondaryAnchor] || secondaryAnchor;
      const primaryText = ANCHOR_COMPLETION[primaryAnchor] || '';
      const secondaryText = ANCHOR_COMPLETION[secondaryAnchor] || '';
      const comp = config.completion || {};

      container.innerHTML = `
        <div class="g2-completion animate-scale-in">
          <div class="g2-completion__icon" aria-hidden="true">🧳</div>
          <h2 class="g2-completion__title">${esc(comp.title)}</h2>

          <div class="g2-completion__anchors">
            <div class="g2-anchor g2-anchor--primary">
              <span class="g2-anchor__label">你最重要的锚</span>
              <span class="g2-anchor__name">${esc(primaryName)}</span>
              <p class="g2-anchor__text">${esc(primaryText)}</p>
            </div>
            <div class="g2-anchor g2-anchor--secondary">
              <span class="g2-anchor__label">紧随其后</span>
              <span class="g2-anchor__name">${esc(secondaryName)}</span>
              <p class="g2-anchor__text">${esc(secondaryText)}</p>
            </div>
          </div>

          <p class="g2-completion__message">${esc(comp.message)}</p>

          <div class="g2-completion__nav">
            ${comp.nextGameUrl ? `<a class="btn btn-primary" href="${esc(comp.nextGameUrl)}">→ ${esc(comp.nextGameLabel)}</a>` : ''}
            <a class="btn btn-secondary" href="../index.html">返回首页</a>
          </div>
        </div>
      `;

      // resolve when user navigates away
      container.querySelector('.btn-secondary').addEventListener('click', () => {
        resolve();
      });
    });
  },
};
