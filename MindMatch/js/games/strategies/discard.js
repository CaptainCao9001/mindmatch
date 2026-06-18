// ============================================================
// Strategy: discard.js — 逐步抛弃策略（G2 职业锚）
// 职责: 三阶段批处理 UI 渲染（列表浏览 + 保留/抛弃 + 故事卡选择）
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
      const stages = STAGES;
      const stageIcons = ['🎪', '📚', '🧳'];
      container.innerHTML = `
        <div class="g2-intro animate-fade-in">
          <p class="g2-intro__subtitle">${esc(intro.subtitle)}</p>
          <h2 class="g2-intro__title">${esc(intro.title)}</h2>
          <p class="g2-intro__desc">${intro.description}</p>

          <div class="g2-intro__stages">
            ${stages.map((s, i) => `
              <div class="g2-intro__stage-card">
                <div class="g2-intro__stage-top">
                  <span class="g2-intro__stage-icon">${stageIcons[i]}</span>
                  <div>
                    <span class="g2-intro__stage-num">阶段${i + 1}</span>
                    <span class="g2-intro__stage-name">${esc(s.name)}</span>
                  </div>
                </div>
                <p class="g2-intro__stage-sub">${esc(s.subtitle)}</p>
                <p class="g2-intro__stage-desc">${esc(s.description)}</p>
              </div>
            `).join('')}
          </div>

          ${intro.estimatedTime ? `<p class="g2-intro__time">⏱ ${esc(intro.estimatedTime)}</p>` : ''}
          <button class="btn btn-primary btn-lg g2-intro__cta" id="js-g2-start">${esc(intro.ctaText)}</button>
        </div>
      `;
      container.querySelector('#js-g2-start').addEventListener('click', () => resolve());
      container.querySelector('#js-g2-start').focus();
    });
  },

  // ═══ renderStage1: 百团大战 16→8 — 左右分栏 ═══
  /** @returns {Promise<{selected: string[], cardsViewed: number, viewedCardIds: string[]}>} */
  renderStage1(container, allCards, stageCfg) {
    return new Promise(resolve => {
      const shuffled = shuffle(allCards);
      const selected = new Set();
      const viewedCards = new Set();    // 点击左侧列表查看过的卡片
      let activeCardId = null;          // 当前右侧展示的卡片

      const max = stageCfg.maxSelect;

      function updateUI() {
        const count = selected.size;
        document.getElementById('js-g2-count').textContent = count;
        const confirmBtn = document.getElementById('js-g2-confirm');
        confirmBtn.disabled = count < 2 || count > max;
        confirmBtn.textContent =
          count < 2 ? `至少选 2 个（已选 ${count}）` : count > max ? `最多选 ${max} 个` : `确认选择（${count}/${max}）`;
      }

      function updateList() {
        // 更新左侧列表的选中/激活状态
        document.querySelectorAll('.g2-club-item').forEach(el => {
          const id = el.dataset.id;
          el.classList.toggle('g2-club-item--active', id === activeCardId);
          el.classList.toggle('g2-club-item--joined', selected.has(id));
        });
      }

      function showDetail(card) {
        activeCardId = card.id;
        viewedCards.add(card.id);
        const panel = document.getElementById('js-g2-detail');
        const isJoined = selected.has(card.id);
        panel.innerHTML = `
          <div class="g2-detail__name">${esc(card.front)}</div>
          <p class="g2-detail__text">${esc(card.detail)}</p>
          <button class="btn btn-primary g2-detail__join" id="js-g2-join" data-id="${card.id}">
            ${isJoined ? '✓ 已加入 — 点击退出' : esc(stageCfg.joinLabel)}
          </button>
        `;
        panel.classList.add('g2-detail--visible');
        updateList();
      }

      container.innerHTML = `
        <div class="g2-stage slide-in-right">
          <div class="g2-stage__header">
            <span class="g2-stage__badge">阶段一</span>
            <h2 class="g2-stage__title">${esc(stageCfg.name)}</h2>
            <p class="g2-stage__subtitle">${esc(stageCfg.subtitle)}</p>
          </div>
          <p class="g2-stage__desc">${esc(stageCfg.description)}</p>

          <div class="g2-split">
            <div class="g2-split__list" id="js-g2-list"></div>
            <div class="g2-split__detail" id="js-g2-detail">
              <div class="g2-detail__placeholder">← 点击左侧社团查看详情</div>
            </div>
          </div>

          <div class="g2-stage__bar">
            <span class="g2-stage__count">已选：<strong id="js-g2-count">0</strong></span>
            <button class="btn btn-primary" id="js-g2-confirm" disabled>至少选 2 个（已选 0）</button>
          </div>
        </div>
      `;

      // 渲染左侧列表
      const list = document.getElementById('js-g2-list');
      shuffled.forEach(card => {
        const item = document.createElement('div');
        item.className = 'g2-club-item';
        item.dataset.id = card.id;
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', `查看 ${card.front} 详情`);
        item.innerHTML = `
          <span class="g2-club-item__name">${esc(card.front)}</span>
          <span class="g2-club-item__check">✓</span>
        `;
        item.addEventListener('click', () => showDetail(card));
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(card); }
        });
        list.appendChild(item);
      });

      // 右侧加入按钮事件（委托）
      document.getElementById('js-g2-detail').addEventListener('click', (e) => {
        const btn = e.target.closest('#js-g2-join');
        if (!btn) return;
        const cardId = btn.dataset.id;

        if (selected.has(cardId)) {
          selected.delete(cardId);
        } else {
          if (selected.size >= max) return;
          selected.add(cardId);
        }

        // 重新渲染当前详情
        const card = allCards.find(c => c.id === cardId);
        if (card) showDetail(card);
        updateUI();
      });

      document.getElementById('js-g2-confirm').addEventListener('click', () => {
        if (selected.size >= 2 && selected.size <= max) {
          resolve({ selected: [...selected], cardsViewed: viewedCards.size, viewedCardIds: [...viewedCards] });
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
        const storyText = card.phase2 || card.detail || '';
        el.innerHTML = `
          <div class="g2-polaroid__label">${esc(card.front)}</div>
          <div class="g2-polaroid__story">${esc(storyText)}</div>
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
