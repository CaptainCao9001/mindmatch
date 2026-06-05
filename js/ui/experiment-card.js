// ============================================================
// experiment-card.js — 方向探索卡片 UI 组件
// 职责: 渲染按钮态/加载态/结果态/错误态
// 依赖: ../core/utils.js（仅 log，容错）
// ============================================================

const EXPERIMENT_CSS = `
.experiment-section {
  max-width: 680px;
  margin: var(--space-8) auto 0;
  padding: 0 var(--space-4);
}

.experiment-btn-wrap {
  text-align: center;
  padding: var(--space-10) 0;
}

.experiment-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-8);
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(124, 58, 237, 0.04));
  border: 1px solid rgba(124, 58, 237, 0.3);
  border-radius: var(--radius-lg);
  color: var(--color-primary, #7c3aed);
  font-size: var(--text-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.experiment-btn:hover {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(124, 58, 237, 0.08));
  border-color: rgba(124, 58, 237, 0.5);
  transform: translateY(-1px);
}

.experiment-btn-icon {
  font-size: var(--text-xl);
}

/* 加载态 */
.experiment-loading-card {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), var(--color-card, #1a1a2e));
  border: 1px solid rgba(124, 58, 237, 0.25);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  max-width: 680px;
  margin: var(--space-8) auto 0;
}

.experiment-loading-inner {
  display: flex;
  flex-direction: column;
  padding: var(--space-6) var(--space-4) var(--space-5);
  gap: var(--space-5);
}

.experiment-loading-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  color: var(--color-primary, #7c3aed);
  font-size: var(--text-base);
  font-weight: 600;
}

.experiment-loading-icon {
  font-size: var(--text-xl);
  animation: expPulse 2s ease-in-out infinite;
}

@keyframes expPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.95); }
}

.experiment-loading-text {
  text-align: center;
  color: var(--color-text-secondary, #a0a0b8);
  font-size: var(--text-base);
  line-height: 1.5;
}

/* 结果态 */
.experiment-result-header {
  text-align: center;
  margin-bottom: var(--space-6);
}

.experiment-result-direction {
  font-size: var(--text-2xl);
  font-weight: 800;
  background: linear-gradient(135deg, var(--color-primary, #7c3aed), #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.experiment-result-score {
  color: var(--color-text-secondary, #a0a0b8);
  font-size: var(--text-sm);
  margin-top: var(--space-1);
}

.experiment-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 680px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.experiment-card {
  background: var(--color-card, #1a1a2e);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  border-left: 4px solid var(--exp-color, #7c3aed);
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  transition: transform 0.2s ease;
}

.experiment-card:hover {
  transform: translateY(-2px);
}

.experiment-card[data-type="act"]   { --exp-color: #7c3aed; }
.experiment-card[data-type="observe"] { --exp-color: #2563eb; }
.experiment-card[data-type="connect"] { --exp-color: #059669; }
.experiment-card[data-type="negate"]  { --exp-color: #dc2626; }

.experiment-card-top {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.experiment-card-icon {
  font-size: var(--text-xl);
}

.experiment-card-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text, #f0f0f0);
}

.experiment-card-body {
  color: var(--color-text-secondary, #a0a0b8);
  font-size: var(--text-sm);
  line-height: 1.8;
  text-align: center;
}

/* 收尾语 */
.experiment-closing {
  text-align: center;
  color: var(--color-text-muted, #6b6b80);
  font-size: var(--text-sm);
  font-style: italic;
  margin-top: var(--space-6);
  padding: 0 var(--space-4);
}

/* 缓存提示 */
.experiment-cached-hint {
  text-align: center;
  padding: var(--space-2);
  color: var(--color-text-muted, #6b6b80);
  font-size: var(--text-xs);
  margin-top: var(--space-3);
}

/* 错误态 */
.experiment-error {
  text-align: center;
  padding: var(--space-6);
  color: var(--color-text-muted, #6b6b80);
  font-size: var(--text-sm);
}

.experiment-error button {
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

.experiment-error button:hover {
  border-color: var(--color-primary, #7c3aed);
  color: var(--color-primary, #7c3aed);
}
`;

// 注入 CSS（仅一次）
let _cssInjected = false;
function ensureCss() {
  if (_cssInjected) return;
  try {
    const style = document.createElement('style');
    style.textContent = EXPERIMENT_CSS;
    document.head.appendChild(style);
    _cssInjected = true;
  } catch (e) { /* 静默 */ }
}

// ---------- 渲染函数 ----------

/**
 * 渲染「生成我的方向探索」按钮
 * @param {string} containerId
 * @param {function} onClick - 按钮点击回调
 */
export function renderExperimentButton(containerId, onClick) {
  ensureCss();
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="experiment-btn-wrap">
      <button class="experiment-btn" id="experimentBtn">
        <span class="experiment-btn-icon">🧪</span>
        <span>生成我的方向探索</span>
      </button>
    </div>
  `;

  const btn = document.getElementById('experimentBtn');
  if (btn && onClick) {
    btn.addEventListener('click', () => onClick(btn));
  }
}

/**
 * 渲染加载态
 * @param {string} containerId
 */
export function renderExperimentLoading(containerId) {
  ensureCss();
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="experiment-loading-card">
      <div class="experiment-loading-inner">
        <div class="experiment-loading-header">
          <span class="experiment-loading-icon">🧠</span>
          <span>AI 正在生成方向探索</span>
        </div>
        <div class="experiment-loading-text">正在调用AI对你的行为进行分析</div>
      </div>
    </div>
  `;
}

/**
 * 渲染结果态
 * @param {string} containerId
 * @param {object} data - { directionName, directionMatch, experiments, closingNote }
 */
export function renderExperimentResult(containerId, data) {
  ensureCss();
  const container = document.getElementById(containerId);
  if (!container) return;

  const typeLabels = { act: '行为实验', observe: '观察实验', connect: '对话实验', negate: '否定实验' };

  const cardsHtml = (data.experiments || []).map(exp => `
    <div class="experiment-card" data-type="${exp.type || 'act'}">
      <div class="experiment-card-top">
        <span class="experiment-card-icon">${exp.icon || '🧪'}</span>
        <span class="experiment-card-title">${exp.title || typeLabels[exp.type] || '实验'}</span>
      </div>
      <div class="experiment-card-body">${exp.body || ''}</div>
    </div>
  `).join('');

  const closingHtml = data.closingNote
    ? `<div class="experiment-closing">${data.closingNote}</div>`
    : '';

  container.innerHTML = `
    <div class="experiment-result-header">
      <div class="experiment-result-direction">${data.directionName || '你的方向'}</div>
      <div class="experiment-result-score">匹配度 ${data.directionMatch || 0}%</div>
    </div>
    <div class="experiment-cards">${cardsHtml}</div>
    ${closingHtml}
    <div class="experiment-cached-hint">💡 已缓存，刷新页面无需重新生成</div>
  `;

  // 淡入
  requestAnimationFrame(() => {
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.5s ease';
    requestAnimationFrame(() => {
      container.style.opacity = '1';
    });
  });
}

/**
 * 渲染错误态
 * @param {string} containerId
 * @param {string} errMsg
 * @param {function} onRetry
 */
export function renderExperimentError(containerId, errMsg, onRetry) {
  ensureCss();
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="experiment-error">
      <p>生成失败，可能是网络问题或 API 额度已用尽</p>
      ${errMsg ? `<p style="font-size:12px;color:#6b6b80;margin-top:8px;">${errMsg}</p>` : ''}
      <button id="experimentRetryBtn">重试</button>
    </div>
  `;

  const btn = document.getElementById('experimentRetryBtn');
  if (btn && onRetry) {
    btn.addEventListener('click', () => onRetry());
  }
}
