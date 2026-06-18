// ============================================================
// M22-ext: match-ui-extended.js — 职业方向匹配结果渲染层（v2.0 新增）
// 职责: 将 ExtendedMatchReport 渲染为方向卡片 + 职业列表
// 依赖: match-ui.js（导入 createEl, getRankColor, getGameColor, getGameLabel）
// ============================================================

import { createEl, getRankColor, getGameColor, getGameLabel } from './match-ui.js?v=20260602e';

/**
 * 渲染完整的两级匹配结果（6 方向卡片）
 * @param {string} containerId — 目标 DOM 容器 ID
 * @param {ExtendedMatchReport} report — matcher.js matchExtended() 输出
 */
export function renderDirectionResults(containerId, report) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`renderDirectionResults: 容器 #${containerId} 不存在`);
    return;
  }

  try {
    container.innerHTML = '';

    // ----- Header -----
    const header = createEl('div', 'match-header');
    header.innerHTML = `
      <h2>职业方向匹配</h2>
      <p class="match-subtitle">
        基于你的思维肖像，以下是与你的特质最匹配的六大职业方向。
        每个方向下包含9个具体职业，匹配度综合考虑了核心驱动力、职业锚点、认知风格和意义建构取向四个维度。
      </p>
    `;
    container.appendChild(header);

    // ----- Ranking Cards -----
    const rankingContainer = createEl('div', 'match-ranking');
    if (report.directionRanking && report.directionRanking.length > 0) {
      report.directionRanking.forEach((entry, idx) => {
        const rank = idx + 1; // 视觉顺序（按综合得分降序）
        const isExpanded = idx === 0; // Top1 展开
        const hasJobData = idx < 3 && entry.jobResults && entry.jobResults.length > 0;
        rankingContainer.appendChild(renderDirectionCard(entry, rank, isExpanded, hasJobData));
      });
    } else {
      rankingContainer.innerHTML = `
        <div class="match-empty">
          <div class="match-empty-icon">📭</div>
          <h3>暂无匹配数据</h3>
          <p>请先完成四项思维游戏后再来查看职业方向匹配结果。</p>
        </div>
      `;
    }
    container.appendChild(rankingContainer);

    // ----- Footer: 方法论说明 -----
    const footer = createEl('div', 'match-footer');
    footer.innerHTML = `
      <p class="match-methodology">
        匹配算法采用双轨混合引擎：TOPSIS 距离法（主）+ 线性加权规则（辅）。
        ${report.needsAIReview ? '两轨道排名存在一定差异，建议结合自身偏好综合判断。' : '两轨道排名一致，结果可信度较高。'}
      </p>
    `;
    container.appendChild(footer);
  } catch (err) {
    console.error('renderDirectionResults 渲染失败:', err);
    container.innerHTML = `
      <div class="match-empty">
        <div class="match-empty-icon">⚠️</div>
        <h3>匹配结果渲染失败</h3>
        <p>${err.message || '未知错误'}，请刷新页面重试。</p>
      </div>
    `;
  }
}

/**
 * 渲染单个方向排名卡片
 * @param {DirectionMatchEntry} entry — 单条方向匹配结果
 * @param {number} rank — 排名 (1-based)
 * @param {boolean} isExpanded — 是否初始展开职业列表
 * @param {boolean} hasJobData — 是否有职业数据可展开（用于显示折叠按钮）
 * @returns {HTMLElement}
 */
export function renderDirectionCard(entry, rank, isExpanded, hasJobData) {
  const card = createEl('div', 'match-direction-card');
  card.classList.add(`match-direction-card--rank${rank}`);

  const percentage = entry.score || 0;
  const barColor = getRankColor(rank);
  const topsisPct = entry.topsisCloseness != null
    ? (entry.topsisCloseness * 100).toFixed(0)
    : '--';

  // G1-G4 分解条
  const breakdown = entry.breakdown || {};
  const breakdownBars = ['G1', 'G2', 'G3', 'G4']
    .map((game) => {
      const val = breakdown[game] || 0;
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

  // 排名徽标
  const rankBadge = rank === 1 ? '🏆' : `#${rank}`;

  // 折叠 / 展开区域: Top1 展开, Top2/3 可折叠, Top4+ 不展示
  let bottomSection = '';
  if (isExpanded) {
    bottomSection = `<div class="match-expanded-section"></div>`;
  } else if (hasJobData) {
    bottomSection = `<button class="match-toggle-btn" type="button">▼ 查看职业详情</button>`;
  }

  card.innerHTML = `
    <div class="match-card-rank">${rankBadge}</div>
    <div class="match-card-body">
      <div class="match-card-header-row">
        <span class="match-card-icon">${entry.directionIcon || '🎯'}</span>
        <div class="match-card-titles">
          <h3>${entry.directionName || '未知方向'}</h3>
          <p class="match-card-slogan">${entry.directionSlogan || ''}</p>
        </div>
        <div class="match-card-score">
          <div class="match-score-ring" style="--pct:${percentage}">
            <span class="match-score-num">${percentage}%</span>
          </div>
          <span class="match-score-label">匹配度</span>
        </div>
      </div>
      <p class="match-card-desc">${entry.directionDescription || ''}</p>
      <div class="match-breakdown">
        <span class="match-breakdown-title">四维度分解</span>
        ${breakdownBars}
      </div>
      <div class="match-card-bar">
        <div class="match-card-bar-fill" style="width:${percentage}%;background:${barColor}"></div>
      </div>
      <div class="match-card-meta">
        <span>TOPSIS 贴近度: ${topsisPct}%</span>
        <span>线性得分: ${entry.linearScore != null ? entry.linearScore : '--'}</span>
      </div>
      ${bottomSection}
    </div>
  `;

  // 展开态：填充职业列表
  if (isExpanded) {
    const expandedSection = card.querySelector('.match-expanded-section');
    if (expandedSection) {
      expandedSection.appendChild(renderJobList(entry.jobResults));
    }
  }

  // 折叠态：绑定 toggle 事件
  if (!isExpanded) {
    const toggleBtn = card.querySelector('.match-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        handleToggle(card, entry);
      });
    }
  }

  return card;
}

/**
 * 渲染职业列表（在方向卡片展开区域内）
 * @param {JobMatchEntry[]} jobResults — 该方向下已排序的职业匹配结果
 * @returns {HTMLElement}
 */
export function renderJobList(jobResults) {
  const list = createEl('div', 'match-job-list');

  if (!jobResults || jobResults.length === 0) {
    const empty = createEl('p', 'match-job-empty');
    empty.textContent = '暂无具体职业数据';
    empty.style.cssText = 'color:var(--color-text-muted);text-align:center;padding:var(--space-4);margin:0;font-size:var(--text-sm);';
    list.appendChild(empty);
    return list;
  }

  // 标题
  const title = createEl('div', 'match-job-list-title');
  title.textContent = '职业匹配';
  list.appendChild(title);

  // 取前 9 个职业
  const maxJobs = jobResults.slice(0, 9);
  maxJobs.forEach((job, i) => {
    const rank = i + 1;
    const item = createEl('div', 'match-job-item');
    const rankClass = rank === 1 ? '' : ' match-job-rank--secondary';
    const jobScore = job.score || 0;
    const jobBarColor = getRankColor(rank);

    item.innerHTML = `
      <div class="match-job-rank${rankClass}">${rank}</div>
      <span class="match-job-icon">${job.jobIcon || '💼'}</span>
      <span class="match-job-name" title="${job.jobName || ''}">${job.jobName || '未知职业'}</span>
      <div class="match-job-bar">
        <div class="match-job-bar-fill" style="width:${jobScore}%;background:${jobBarColor}"></div>
      </div>
      <span class="match-job-score">${jobScore}%</span>
    `;

    list.appendChild(item);
  });

  return list;
}

// ---------- 内部辅助 ----------

/**
 * 处理折叠卡片点击：展开 → 懒加载职业数据（或显示加载占位）
 * @param {HTMLElement} card — 方向卡片 DOM
 * @param {DirectionMatchEntry} entry — 方向匹配数据
 */
function handleToggle(card, entry) {
  const toggleBtn = card.querySelector('.match-toggle-btn');
  const body = card.querySelector('.match-card-body');
  if (!toggleBtn || !body) return;

  // 如果职业数据未加载 → 显示加载占位
  if (!entry.jobResults || entry.jobResults.length === 0) {
    toggleBtn.textContent = '加载中...';
    toggleBtn.disabled = true;

    // 插入展开区域（由 T03 的 match.html 负责填充实际数据）
    const loadingSection = createEl('div', 'match-expanded-section');
    const loadingEl = createEl('p', 'match-job-empty');
    loadingEl.textContent = '加载中...';
    loadingEl.style.cssText = 'color:var(--color-text-muted);text-align:center;padding:var(--space-4);margin:0;font-size:var(--text-sm);';
    loadingSection.appendChild(loadingEl);

    // 替换按钮为加载区域
    toggleBtn.replaceWith(loadingSection);

    // 保留引用以便后续填充
    loadingSection.dataset.directionId = entry.directionId;
    return;
  }

  // 已有数据 → 直接展开
  const expandedSection = createEl('div', 'match-expanded-section');
  expandedSection.appendChild(renderJobList(entry.jobResults));
  toggleBtn.replaceWith(expandedSection);
}
