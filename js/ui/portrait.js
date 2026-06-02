// ============================================================
// M21: portrait.js — 肖像渲染层（纯 DOM）
// 职责: 将 TranslationResult 渲染为 HTML 肖像报告
//       零业务逻辑，只负责 DOM 操作
// 依赖: 无（纯 DOM）
// ============================================================

/**
 * 渲染完整肖像报告
 * @param {string} containerId - 目标 DOM 容器 ID
 * @param {object} data
 * @param {TranslationResult} data.translation
 * @param {UnifiedProfile} data.profile
 */
export function renderPortrait(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { translation, profile } = data;
  container.innerHTML = '';

  // ---- 总述 ----
  const header = createEl('div', 'portrait-header');
  const totalGames = profile.meta.completedCount;
  header.innerHTML = `
    <h2>你的思维肖像</h2>
    <p class="portrait-subtitle">
      ${totalGames === 0
        ? '你还没有完成任何思维游戏。完成游戏后，你的画像将在这里呈现。'
        : totalGames === 4
          ? '基于你在 4 个思维游戏中的选择，我们为你绘制了这份思维肖像。'
          : `你已完成 ${totalGames}/4 个游戏。以下是已有数据的画像，完成更多游戏后画像会更加完整。`
      }
    </p>
  `;
  container.appendChild(header);

  // ---- 逐游戏渲染 ----
  const GAME_ICONS = {
    game1: '🎯',
    game2: '⏮️',
    game3: '🚀',
    game4: '🏛️',
  };
  const GAME_DESCS = {
    game1: '核心驱动力',
    game2: '职业锚点',
    game3: '认知风格',
    game4: '意义建构',
  };
  const ALL_GAMES = ['game1', 'game2', 'game3', 'game4'];

  ALL_GAMES.forEach(gameId => {
    const section = translation.sections.find(s => s.gameId === gameId);

    const card = createEl('div', 'portrait-card');
    card.id = `portrait-${gameId}`;

    if (section) {
      // 已完成——渲染详细内容
      card.innerHTML = `
        <div class="portrait-card-header">
          <span class="portrait-card-icon">${GAME_ICONS[gameId]}</span>
          <h3>${section.gameName}</h3>
          <span class="portrait-card-badge portrait-card-badge--done">已完成</span>
        </div>
        <div class="portrait-card-body">
          <div class="portrait-dims">
            ${section.dimensions.map(d => `
              <div class="portrait-dim ${d.level}">
                <span class="portrait-dim-name">${d.name}</span>
                <span class="portrait-dim-score">${d.score}${typeof d.score === 'number' ? (Math.abs(d.score) <= 1 && d.id === 'wholistAnalytic' ? '' : '/10') : ''}</span>
              </div>
            `).join('')}
          </div>
          <div class="portrait-summary">${formatSummary(section.summary)}</div>
        </div>
      `;
    } else {
      // 未完成——渲染占位
      card.innerHTML = `
        <div class="portrait-card-header">
          <span class="portrait-card-icon">${GAME_ICONS[gameId]}</span>
          <h3>${GAME_DESCS[gameId]}</h3>
          <span class="portrait-card-badge portrait-card-badge--locked">未完成</span>
        </div>
        <div class="portrait-card-body portrait-card-body--locked">
          <p class="portrait-locked-text">完成「${GAME_DESCS[gameId]}」后解锁此区域</p>
        </div>
      `;
    }

    container.appendChild(card);
  });

  // ---- 未完成提示（如果有） ----
  if (totalGames < 4 && totalGames > 0) {
    const hint = createEl('div', 'portrait-hint');
    const remaining = 4 - totalGames;
    hint.innerHTML = `
      <p>完成剩余 <strong>${remaining}</strong> 个游戏后，你的思维画像将更加完整。</p>
    `;
    container.appendChild(hint);
  }
}

/**
 * 渲染维度概览卡片（带图表容器）
 */
export function renderOverviewCards(containerId, profile) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  const GAME_INFO = [
    { id: 'game1', name: '核心驱动力', icon: '🎯', dimCount: 3 },
    { id: 'game2', name: '职业锚点', icon: '⏮️', dimCount: 8 },
    { id: 'game3', name: '认知风格', icon: '🚀', dimCount: 1 },
    { id: 'game4', name: '意义建构', icon: '🏛️', dimCount: 2 },
  ];

  GAME_INFO.forEach(game => {
    const completed = profile.meta.completedGames.includes(game.id);
    const card = createEl('div', 'overview-card');
    card.id = `overview-${game.id}`;

    if (completed) {
      card.classList.add('overview-card--done');
      card.innerHTML = `
        <div class="overview-card-header">
          <span class="overview-card-icon">${game.icon}</span>
          <h4>${game.name}</h4>
        </div>
        <div class="overview-card-chart" id="chart-${game.id}"></div>
      `;
    } else {
      card.classList.add('overview-card--locked');
      card.innerHTML = `
        <div class="overview-card-header">
          <span class="overview-card-icon">${game.icon}</span>
          <h4>${game.name}</h4>
          <span class="overview-lock">🔒</span>
        </div>
        <div class="overview-card-placeholder">
          <p>完成游戏后显示</p>
        </div>
      `;
    }

    container.appendChild(card);
  });
}

// ---------- 内部辅助 ----------

function createEl(tag, className) {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

function formatSummary(text) {
  // 将换行转为 HTML 段落
  return text.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('');
}
