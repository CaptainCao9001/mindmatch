// ============================================================
// Strategy: focus-sort.js — 两阶段聚焦排序（G3 认知风格）
// 职责: 阶段一（点击循环分组）+ 阶段二（拖拽排序）
// ============================================================

import { GROUPS, RANK_WEIGHTS, STYLE_TEXTS } from '../game3-data.js?v=20260602e';

// ---------- 工具 ----------

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- 导出 ----------

export const FocusSortStrategy = {

  // ═══ renderIntro: 星空叙事 ═══
  renderIntro(container, config) {
    return new Promise(resolve => {
      const intro = config.intro || {};
      container.innerHTML = `
        <div class="g3-intro animate-fade-in">
          <div class="g3-stars" aria-hidden="true"></div>
          <p class="g3-intro__subtitle">${esc(intro.subtitle)}</p>
          <h2 class="g3-intro__title">${esc(intro.title)}</h2>
          <p class="g3-intro__desc">${intro.description}</p>
          ${intro.estimatedTime ? `<p class="g3-intro__time">⏱ ${esc(intro.estimatedTime)}</p>` : ''}
          <button class="btn btn-primary btn-lg g3-intro__cta" id="js-g3-start">${esc(intro.ctaText)}</button>
        </div>
      `;
      container.querySelector('#js-g3-start').addEventListener('click', () => resolve());
      container.querySelector('#js-g3-start').focus();
    });
  },

  // ═══ renderStage1: 三区拖拽分组 ═══
  /**
   * @returns {Promise<Object>} { groups: { [cardId]: 'green'|'yellow'|'red' } }
   */
  renderStage1(container, fragments) {
    return new Promise(resolve => {
      // groups: cardId → zone key (null = 仍在池中)
      const groups = {};
      fragments.forEach(f => { groups[f.id] = null; });

      // 碎片池列表（未归类的卡片 ID）
      let poolIds = fragments.map(f => f.id);

      function getCardsInZone(zone) {
        return Object.entries(groups).filter(([, z]) => z === zone).map(([id]) => id);
      }

      function counts() {
        return {
          green: getCardsInZone('green').length,
          yellow: getCardsInZone('yellow').length,
          red: getCardsInZone('red').length,
          pool: poolIds.length,
        };
      }

      // --- 渲染区 ---

      function renderCard(id) {
        const f = fragments.find(x => x.id === id);
        const zone = groups[id];
        const cssClass = zone ? `g3-card--${zone}` : 'g3-card--pool';
        return `
          <div class="g3-card ${cssClass}" draggable="true" data-id="${esc(id)}"
               role="button" tabindex="0" aria-grabbed="false"
               aria-label="${esc(f.title)} — ${zone ? GROUPS.find(g => g.key === zone)?.label || '' : '待分类'}，可拖拽">
            <span class="g3-card__title">${esc(f.title)}</span>
            <p class="g3-card__detail">${esc(f.detail)}</p>
          </div>`;
      }

      function renderAll() {
        // 三区卡片
        ['green','yellow','red'].forEach(zone => {
          const body = document.getElementById(`js-g3-zone-body-${zone}`);
          if (!body) return;
          const ids = getCardsInZone(zone);
          if (ids.length === 0) {
            body.innerHTML = `<div class="g3-zone__empty">拖入碎片</div>`;
          } else {
            body.innerHTML = ids.map(id => renderCard(id)).join('');
          }
        });

        // 碎片池
        const poolEl = document.getElementById('js-g3-pool-cards');
        if (poolEl) {
          poolEl.innerHTML = poolIds.map(id => renderCard(id)).join('');
        }

        updateCounters();
        bindDragEvents();
      }

      function updateCounters() {
        const c = counts();
        ['green','yellow','red'].forEach(key => {
          const el = document.getElementById(`js-g3-cnt-${key}`);
          if (el) el.textContent = c[key];
        });
        const btn = document.getElementById('js-g3-confirm1');
        if (btn) {
          const unfinished = c.green === 0 && c.yellow === 0 && c.red === 0;
          btn.disabled = c.pool > 0;
          if (c.pool > 0) {
            btn.textContent = `还有 ${c.pool} 个碎片未分类`;
          } else {
            btn.textContent = `确认分组（🟢${c.green} 🟡${c.yellow} 🔴${c.red}）`;
          }
        }
      }

      // --- 拖拽事件 ---

      function bindDragEvents() {
        const allCards = document.querySelectorAll('#js-g3-pool-cards .g3-card, [id^="js-g3-zone-body-"] .g3-card');
        const allZones = document.querySelectorAll('.g3-zone');
        const poolDrop = document.getElementById('js-g3-pool');

        // 卡片: dragstart / dragend
        allCards.forEach(card => {
          card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', card.dataset.id);
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('g3-card--dragging');
          });
          card.addEventListener('dragend', () => {
            card.classList.remove('g3-card--dragging');
          });
        });

        // 三区: dragover / dragleave / drop
        allZones.forEach(zone => {
          const zoneKey = zone.dataset.zone;
          zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            zone.classList.add('g3-zone--drag-over');
          });
          zone.addEventListener('dragleave', () => {
            zone.classList.remove('g3-zone--drag-over');
          });
          zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('g3-zone--drag-over');
            const id = e.dataTransfer.getData('text/plain');
            if (!id) return;
            moveCard(id, zoneKey);
          });
        });

        // 碎片池: dragover / drop（拖回池中）
        if (poolDrop) {
          poolDrop.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            poolDrop.classList.add('g3-pool--drag-over');
          });
          poolDrop.addEventListener('dragleave', () => {
            poolDrop.classList.remove('g3-pool--drag-over');
          });
          poolDrop.addEventListener('drop', (e) => {
            e.preventDefault();
            poolDrop.classList.remove('g3-pool--drag-over');
            const id = e.dataTransfer.getData('text/plain');
            if (!id) return;
            moveCard(id, null); // null = 回池
          });
        }
      }

      function moveCard(id, targetZone) {
        const currentZone = groups[id];
        // 已在目标区，不用动
        if (currentZone === targetZone) return;
        // 从旧区移除
        if (currentZone) {
          // 卡片从 zone 移除
        } else {
          // 卡片从 pool 移除
          poolIds = poolIds.filter(x => x !== id);
        }
        // 移到新区
        if (targetZone) {
          groups[id] = targetZone;
        } else {
          groups[id] = null;
          poolIds.push(id);
        }
        renderAll();
      }

      // --- 构建初始 HTML（左池 + 右三区）---

      container.innerHTML = `
        <div class="g3-stage slide-in-right">
          <div class="g3-stage__header">
            <span class="g3-stage__badge">阶段一</span>
            <h2 class="g3-stage__title">记忆浮现</h2>
            <p class="g3-stage__subtitle">凭第一感觉分组</p>
          </div>
          <p class="g3-stage__desc">8 段记忆碎片同时浮现。凭第一感觉，把它们拖入对应的分组。</p>

          <div class="g3-layout">

            <!-- 左侧：碎片池 -->
            <div class="g3-pool" id="js-g3-pool">
              <div class="g3-pool__label">📋 待分类 · 拖入右侧区域</div>
              <div class="g3-pool__cards" id="js-g3-pool-cards"></div>
            </div>

            <!-- 右侧：三区 -->
            <div class="g3-zones">
              ${GROUPS.map(g => `
                <div class="g3-zone g3-zone--${g.key}" data-zone="${g.key}">
                  <div class="g3-zone__header">
                    ${g.emoji} ${g.label}
                    <span class="g3-zone__count">（<strong id="js-g3-cnt-${g.key}">0</strong>）</span>
                  </div>
                  <div class="g3-zone__body" id="js-g3-zone-body-${g.key}">
                    <div class="g3-zone__empty">拖入碎片</div>
                  </div>
                </div>
              `).join('')}
            </div>

          </div>

          <div class="g3-stage__bar">
            <span class="g3-stage__hint-text">拖拽卡片到对应区域</span>
            <button class="btn btn-primary" id="js-g3-confirm1" disabled>至少选 2 张「这就是我」（已选 0）</button>
          </div>
        </div>
      `;

      renderAll();

      document.getElementById('js-g3-confirm1').addEventListener('click', () => {
        if (counts().pool === 0) {
          resolve(groups);
        }
      });
    });
  },

  // ═══ renderStage2: 拖拽排序 ═══
  /**
   * @param {string[]} greenIds - 🟢组碎片 ID 列表
   * @returns {Promise<string[]>} 排序后的 ID 列表 (第一名在前)
   */
  renderStage2(container, greenIds, fragments) {
    return new Promise(resolve => {
      const cards = greenIds.map(id => fragments.find(f => f.id === id)).filter(Boolean);
      let order = [...cards]; // 初始顺序 = 原始顺序

      function renderOrder() {
        const list = document.getElementById('js-g3-sort-list');
        if (!list) return;
        list.innerHTML = order.map((card, i) => `
          <div class="g3-sort-card" draggable="true" data-id="${card.id}" data-index="${i}">
            <span class="g3-sort-card__rank">#${i + 1}</span>
            <div class="g3-sort-card__content">
              <span class="g3-sort-card__title">${esc(card.title)}</span>
              <span class="g3-sort-card__detail">${esc(card.detail)}</span>
            </div>
            <div class="g3-sort-card__controls">
              <button class="g3-sort-btn g3-sort-btn--up" data-id="${card.id}" data-dir="up" aria-label="上移" ${i === 0 ? 'disabled' : ''}>▲</button>
              <button class="g3-sort-btn g3-sort-btn--down" data-id="${card.id}" data-dir="down" aria-label="下移" ${i === order.length - 1 ? 'disabled' : ''}>▼</button>
            </div>
            <span class="g3-sort-card__handle" aria-hidden="true">⠿</span>
          </div>
        `).join('');

        // 绑定拖拽事件（桌面端）
        list.querySelectorAll('.g3-sort-card').forEach(card => {
          card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', card.dataset.id);
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('g3-sort-card--dragging');
          });
          card.addEventListener('dragend', () => {
            card.classList.remove('g3-sort-card--dragging');
          });
          card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          });
          card.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            const targetId = card.dataset.id;
            if (draggedId === targetId) return;

            // 交换位置
            const fromIdx = order.findIndex(c => c.id === draggedId);
            const toIdx = order.findIndex(c => c.id === targetId);
            const [moved] = order.splice(fromIdx, 1);
            order.splice(toIdx, 0, moved);
            renderOrder();
          });
        });

        // 绑定上/下移动按钮（移动端 + 键盘友好）
        list.querySelectorAll('.g3-sort-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const dir = btn.dataset.dir;
            const idx = order.findIndex(c => c.id === id);
            if (dir === 'up' && idx > 0) {
              [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
            } else if (dir === 'down' && idx < order.length - 1) {
              [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
            }
            renderOrder();
          });
        });
      }

      container.innerHTML = `
        <div class="g3-stage slide-in-right">
          <div class="g3-stage__header">
            <span class="g3-stage__badge">阶段二</span>
            <h2 class="g3-stage__title">聚焦核心</h2>
            <p class="g3-stage__subtitle">哪个最像你？</p>
          </div>
          <p class="g3-stage__desc">现在只看「这就是我」的记忆碎片。如果必须排出先后——哪个最像你？</p>
          <p class="g3-stage__hint-text" style="text-align:center;color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--space-4);">拖拽卡片排序 — 排第一的最像你</p>
          <div class="g3-sort-list" id="js-g3-sort-list"></div>
          <div class="g3-stage__bar g3-stage__bar--center">
            <span></span>
            <button class="btn btn-primary" id="js-g3-confirm2">确认排序</button>
          </div>
        </div>
      `;

      renderOrder();

      document.getElementById('js-g3-confirm2').addEventListener('click', () => {
        resolve(order.map(c => c.id));
      });
    });
  },

  // ═══ renderFeedback ═══
  renderFeedback(container, text) {
    return new Promise(resolve => {
      container.innerHTML = `
        <div class="feedback-overlay animate-scale-in" role="alert" aria-live="polite">
          <div class="feedback-card">
            <p class="feedback-text" style="white-space:pre-line">${esc(text)}</p>
            <button class="btn btn-secondary feedback-next" id="js-g3-fb-next">继续</button>
          </div>
        </div>
      `;
      const btn = document.getElementById('js-g3-fb-next');
      btn.addEventListener('click', () => resolve());
      btn.focus();
    });
  },

  // ═══ renderCompletion ═══
  renderCompletion(container, output, config) {
    return new Promise(resolve => {
      const wa = output.dimensions.wholistAnalytic;
      const style = output.behaviorSummary.dominantStyle;
      const key = style === '整体型' ? 'wholist' : style === '分析型' ? 'analytic' : 'balanced';
      const t = STYLE_TEXTS[key];
      const comp = config.completion || {};

      // 连续条百分比
      const pct = Math.round(((wa + 1) / 2) * 100);

      container.innerHTML = `
        <div class="g3-completion animate-scale-in">
          <div class="g3-completion__icon" aria-hidden="true">${t.emoji}</div>
          <h2 class="g3-completion__title">${esc(comp.title)}</h2>

          <div class="g3-completion__style-tag">${t.label}</div>
          <p class="g3-completion__style-title">${t.title}</p>

          <div class="g3-continuum" aria-label="认知风格连续条">
            <span class="g3-continuum__label">整体型</span>
            <div class="g3-continuum__bar">
              <div class="g3-continuum__fill" style="width:${pct}%"></div>
              <div class="g3-continuum__dot" style="left:${pct}%"></div>
            </div>
            <span class="g3-continuum__label">分析型</span>
          </div>

          <p class="g3-completion__desc">${t.desc}</p>

          <p class="g3-completion__message">${esc(comp.message)}</p>

          <div class="g3-completion__nav">
            ${comp.nextGameUrl ? `<a class="btn btn-primary" href="${esc(comp.nextGameUrl)}">→ ${esc(comp.nextGameLabel)}</a>` : ''}
            <a class="btn btn-secondary" href="../index.html">返回首页</a>
          </div>
        </div>
      `;

      container.querySelector('.btn-secondary').addEventListener('click', () => resolve());
    });
  },
};
