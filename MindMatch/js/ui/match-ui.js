// ============================================================
// M22: match-ui.js — 岗位匹配结果渲染层（纯 DOM）
// 职责: 将 MatchReport 渲染为 HTML 匹配结果面板
//       零业务逻辑，只负责 DOM 操作
// 依赖: 无（纯 DOM）
// ============================================================

/**
 * 渲染完整的岗位匹配结果
 * @param {string} containerId — 目标 DOM 容器 ID
 * @param {MatchReport} report — matcher.js 输出
 */
export function renderMatchResults(containerId, report) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`renderMatchResults: 容器 #${containerId} 不存在`);
    return;
  }

  try {
    container.innerHTML = '';
    container.classList.add('match-results');

    // 标题
    const header = createEl('div', 'match-header');
    header.innerHTML = `
      <h2>岗位匹配分析</h2>
      <p class="match-subtitle">
        基于你的思维肖像，以下是与你的特质最匹配的岗位方向。
        匹配度综合考虑了核心驱动力、职业锚点、认知风格和意义建构取向四个维度。
      </p>
    `;
    container.appendChild(header);

    // 排名卡片
    const rankingContainer = createEl('div', 'match-ranking');
    if (report.ranking && report.ranking.length > 0) {
      report.ranking.forEach((entry, i) => {
        rankingContainer.appendChild(buildJobCard(entry, i + 1));
      });
    } else {
      rankingContainer.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:2rem;">暂无匹配数据</p>';
    }
    container.appendChild(rankingContainer);

    // 方法论说明
    const footer = createEl('div', 'match-footer');
    footer.innerHTML = `
      <p class="match-methodology">
        匹配算法采用双轨混合引擎：TOPSIS 距离法（主）+ 线性加权规则（辅）。
        ${report.needsAIReview ? '两轨道排名存在一定差异，建议结合自身偏好综合判断。' : '两轨道排名一致，结果可信度较高。'}
      </p>
    `;
    container.appendChild(footer);
  } catch (err) {
    console.error('renderMatchResults 渲染失败:', err);
    container.innerHTML = `
      <div class="match-placeholder">
        <h3>匹配结果渲染失败</h3>
        <p>${err.message || '未知错误'}</p>
      </div>
    `;
  }
}

/**
 * 构建单个岗位排名卡片
 */
function buildJobCard(entry, rank) {
  const card = createEl('div', 'match-card');
  card.classList.add(`match-card--rank${rank}`);

  const percentage = entry.score;
  const barColor = getRankColor(rank);

  // 游戏级分解
  const breakdownBars = ['G1', 'G2', 'G3', 'G4']
    .map(game => {
      const val = entry.breakdown[game] || 0;
      return `
        <div class="match-breakdown-item">
          <span class="match-breakdown-label">${getGameLabel(game)}</span>
          <div class="match-breakdown-bar">
            <div class="match-breakdown-fill" style="width:${val}%;background:${getGameColor(game)}"></div>
          </div>
          <span class="match-breakdown-val">${val}%</span>
        </div>
      `;
    })
    .join('');

  card.innerHTML = `
    <div class="match-card-rank">${rank === 1 ? '🏆' : `#${rank}`}</div>
    <div class="match-card-body">
      <div class="match-card-header-row">
        <span class="match-card-icon">${entry.jobIcon}</span>
        <div class="match-card-titles">
          <h3>${entry.jobName}</h3>
          <p class="match-card-slogan">${entry.jobSlogan}</p>
        </div>
        <div class="match-card-score">
          <div class="match-score-ring" style="--pct:${percentage}">
            <span class="match-score-num">${percentage}%</span>
          </div>
          <span class="match-score-label">匹配度</span>
        </div>
      </div>
      <p class="match-card-desc">${entry.jobDescription}</p>
      <div class="match-breakdown">
        <span class="match-breakdown-title">四维度分解</span>
        ${breakdownBars}
      </div>
      <div class="match-card-bar">
        <div class="match-card-bar-fill" style="width:${percentage}%;background:${barColor}"></div>
      </div>
      <div class="match-card-meta">
        <span>TOPSIS 贴近度: ${(entry.topsisCloseness * 100).toFixed(0)}%</span>
        <span>线性得分: ${entry.linearScore}</span>
      </div>
    </div>
  `;

  return card;
}

// ---------- 纯展示辅助（v2.0: 导出供 match-ui-extended.js 复用） ----------

export function createEl(tag, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

export function getRankColor(rank) {
  const colors = ['#f59e0b', '#7c3aed', '#3b82f6', '#6b7280'];
  return colors[rank - 1] || '#6b7280';
}

export function getGameColor(game) {
  const colors = { G1: '#7c3aed', G2: '#3b82f6', G3: '#10b981', G4: '#f59e0b' };
  return colors[game] || '#7c3aed';
}

export function getGameLabel(game) {
  const labels = { G1: '核心驱动力', G2: '职业锚点', G3: '认知风格', G4: '意义建构' };
  return labels[game] || game;
}
