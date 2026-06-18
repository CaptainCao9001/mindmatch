// ============================================================
// insight-card.js — AI 解读卡片 UI 组件
// 职责: 渲染加载态/成功态/失败态，挂载到指定容器
// 依赖: ../core/utils.js（仅 log/logWarn，容错）
// ============================================================

const INSIGHT_CSS = `
.insight-section {
  max-width: 800px;
  margin: var(--space-12) auto 0;
  padding: 0 var(--space-4);
}

.insight-card {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), var(--color-card, #1a1a2e));
  border: 1px solid rgba(124, 58, 237, 0.25);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  position: relative;
  overflow: hidden;
}

.insight-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--color-primary, #7c3aed), transparent);
}

.insight-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.insight-header-icon {
  font-size: var(--text-xl);
}

.insight-header h3 {
  font-size: var(--text-lg);
  margin: 0;
  flex: 1;
  background: linear-gradient(135deg, var(--color-primary, #7c3aed), #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 一句话总结 */
.insight-oneliner {
  font-size: var(--text-2xl);
  font-weight: 800;
  line-height: 1.3;
  margin-bottom: var(--space-5);
  color: var(--color-text, #f0f0f0);
}

/* 游戏行为卡片 */
.insight-game-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.insight-game-item {
  padding: var(--space-4);
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary, #7c3aed);
}

.insight-game-title {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-primary, #7c3aed);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-2);
}

.insight-game-behavior {
  color: var(--color-text-secondary, #a0a0b8);
  font-size: var(--text-sm);
  line-height: 1.7;
  margin-bottom: var(--space-2);
  padding-left: var(--space-3);
  border-left: 2px solid rgba(255, 255, 255, 0.08);
}

.insight-game-comment {
  color: var(--color-text, #f0f0f0);
  font-size: var(--text-sm);
  line-height: 1.7;
  padding-left: var(--space-3);
  border-left: 2px solid var(--color-primary, #7c3aed);
  font-weight: 500;
}

/* 跨游戏总结 */
.insight-summary {
  padding: var(--space-4);
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(124, 58, 237, 0.02));
  border: 1px solid rgba(124, 58, 237, 0.15);
  border-radius: var(--radius-md);
  color: var(--color-text, #f0f0f0);
  font-size: var(--text-base);
  line-height: 1.8;
}

.insight-summary-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-primary, #7c3aed);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-2);
}

/* 加载进度 */
.insight-loading {
  display: flex;
  flex-direction: column;
  padding: var(--space-6) var(--space-4) var(--space-5);
  gap: var(--space-5);
}

.insight-loading-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  color: var(--color-primary, #7c3aed);
  font-size: var(--text-base);
  font-weight: 600;
}

.insight-loading-icon {
  font-size: var(--text-xl);
  animation: insightPulse 2s ease-in-out infinite;
}

@keyframes insightPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.95); }
}

.insight-loading-text {
  text-align: center;
  color: var(--color-text-secondary, #a0a0b8);
  font-size: var(--text-base);
  line-height: 1.5;
}

/* 失败态 */
.insight-error {
  text-align: center;
  padding: var(--space-6);
  color: var(--color-text-muted, #6b6b80);
  font-size: var(--text-sm);
}

.insight-error button {
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: 1px solid var(--color-border, #2a2a40);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary, #a0a0b8);
  cursor: pointer;
  font-size: var(--text-sm);
  transition: border-color var(--transition-fast);
}

.insight-error button:hover {
  border-color: var(--color-primary, #7c3aed);
  color: var(--color-primary, #7c3aed);
}

/* 触发按钮 */
.insight-trigger-section {
  width: 100%;
  max-width: 800px;
  margin: var(--space-10) auto 0;
  padding: 0 var(--space-4);
  box-sizing: border-box;
}

.insight-trigger-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-5) var(--space-6);
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(124, 58, 237, 0.04));
  border: 1px solid rgba(124, 58, 237, 0.3);
  border-radius: var(--radius-lg);
  color: var(--color-primary, #7c3aed);
  font-size: var(--text-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.insight-trigger-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(124, 58, 237, 0.08));
  border-color: rgba(124, 58, 237, 0.5);
  transform: translateY(-1px);
}

.insight-trigger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.insight-trigger-icon {
  font-size: var(--text-xl);
}

/* 已缓存提示 */
.insight-cached-hint {
  text-align: center;
  padding: var(--space-2);
  color: var(--color-text-muted, #6b6b80);
  font-size: var(--text-xs);
}
`;

// 注入 CSS（仅一次）
let _cssInjected = false;
function ensureCss() {
  if (_cssInjected) return;
  try {
    const style = document.createElement('style');
    style.textContent = INSIGHT_CSS;
    document.head.appendChild(style);
    _cssInjected = true;
  } catch (e) {
    // 静默失败
  }
}

// ---------- 渲染函数 ----------

/**
 * 渲染「生成 AI 解读」按钮
 * @param {string} containerId - 容器 ID
 * @param {function} onClick - 按钮点击回调，接收 button 元素
 */
export function renderInsightTrigger(containerId, onClick) {
  ensureCss();
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <button class="insight-trigger-btn" id="insightTriggerBtn">
      <span class="insight-trigger-icon">🧠</span>
      <span>生成 AI 深度解读</span>
    </button>
  `;

  const btn = document.getElementById('insightTriggerBtn');
  if (btn && onClick) {
    btn.addEventListener('click', () => onClick(btn));
  }
}

/**
 * 渲染加载态（静态等待界面）
 * @param {string} [containerId] - 默认 'insightCardContainer'
 */
export function renderInsightLoading(containerId) {
  ensureCss();
  const container = document.getElementById(containerId || 'insightCardContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="insight-section">
      <div class="insight-card">
        <div class="insight-loading">
          <div class="insight-loading-header">
            <span class="insight-loading-icon">🧠</span>
            <span>AI 正在深度解读</span>
          </div>
          <div class="insight-loading-text">正在调用AI对你的行为进行分析</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染成功态
 * @param {string} [containerId] - 默认 'insightCardContainer'
 * @param {object} data - { gameBehaviors, summary }
 */
export function renderInsightSuccess(containerId, data) {
  ensureCss();
  const container = document.getElementById(containerId || 'insightCardContainer');
  if (!container) return;

  const gameIcons = { 'G1': '🎯', 'G2': '⚓', 'G3': '🧩', 'G4': '💡' };

  const gameBehaviorsHtml = (data.gameBehaviors || [])
    .map(gb => {
      const gameTag = gb.game ? gb.game.substring(0, 2) : '';
      const icon = gameIcons[gameTag] || '◆';
      return `
        <div class="insight-game-item">
          <div class="insight-game-title">${icon} ${gb.game || ''}</div>
          <div class="insight-game-behavior">${gb.behavior || ''}</div>
          <div class="insight-game-comment">${gb.comment || ''}</div>
        </div>
      `;
    })
    .join('');

  const summaryHtml = data.summary
    ? `<div class="insight-summary">
        <div class="insight-summary-label">🧠 总结</div>
        ${data.summary}
      </div>`
    : '';

  container.innerHTML = `
    <div class="insight-section">
      <div class="insight-card">
        <div class="insight-header">
          <span class="insight-header-icon">🧠</span>
          <h3>AI 深度解读</h3>
        </div>
        <div class="insight-game-list">${gameBehaviorsHtml}</div>
        ${summaryHtml}
        <div class="insight-cached-hint">💡 已缓存，刷新页面无需重新生成</div>
      </div>
    </div>
  `;

  // 淡入动画
  requestAnimationFrame(() => {
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.5s ease';
    requestAnimationFrame(() => {
      container.style.opacity = '1';
    });
  });
}

/**
 * 渲染失败态
 * @param {string} [containerId] - 默认 'insightCardContainer'
 * @param {function} onRetry - 重试回调
 * @param {string} [lastError] - 上次错误信息
 */
export function renderInsightError(containerId, onRetry, lastError) {
  ensureCss();
  const container = document.getElementById(containerId || 'insightCardContainer');
  if (!container) return;

  const errorDetail = lastError ? `<p style="font-size:12px;color:#6b6b80;margin-top:8px;">错误详情: ${lastError}</p>` : '';

  container.innerHTML = `
    <div class="insight-section">
      <div class="insight-card">
        <div class="insight-error">
          <p>生成失败，可能是网络问题或 API 额度已用尽</p>
          ${errorDetail}
          <button id="insightRetryBtn">重试</button>
        </div>
      </div>
    </div>
  `;

  const retryBtn = document.getElementById('insightRetryBtn');
  if (retryBtn && onRetry) {
    retryBtn.addEventListener('click', () => onRetry());
  }
}
