// ============================================================
// chat-renderer.js — 聊天 UI 渲染器
// 负责消息气泡渲染、输入管理、加载动画、结果面板
// ============================================================

export class ChatRenderer {
  /**
   * @param {HTMLElement} containerEl - 消息列表容器
   * @param {HTMLElement} inputEl - 输入框
   * @param {HTMLElement} sendBtnEl - 发送按钮
   * @param {HTMLElement} progressBarEl - 进度条容器（可选）
   */
  constructor(containerEl, inputEl, sendBtnEl, progressBarEl) {
    this.container = containerEl;
    this.input = inputEl;
    this.sendBtn = sendBtnEl;
    this.progressBar = progressBarEl || null;
    this.thinkingEl = null;
    this._sendCallback = null;
    this._boundHandlers = {};

    this._bindEvents();
  }

  // ---------- 消息渲染 ----------

  /**
   * 添加一条消息气泡
   * @param {'user'|'assistant'} role
   * @param {string} text
   */
  addMessage(role, text) {
    if (!text) return;

    const wrapper = document.createElement('div');
    wrapper.className = `cg-message cg-message--${role}`;

    const bubble = document.createElement('div');
    bubble.className = `cg-bubble cg-bubble--${role}`;

    // 支持换行
    bubble.innerHTML = this._formatText(text);

    // AI 消息加上小头像
    if (role === 'assistant') {
      const avatar = document.createElement('div');
      avatar.className = 'cg-avatar';
      avatar.textContent = '🧭';
      wrapper.appendChild(avatar);
    }

    wrapper.appendChild(bubble);
    this.container.appendChild(wrapper);
    this._scrollToBottom();
  }

  /**
   * 显示"正在思考..."加载动画
   */
  showThinking() {
    this.hideThinking(); // 先移除旧的

    const wrapper = document.createElement('div');
    wrapper.className = 'cg-message cg-message--assistant';
    wrapper.id = 'cg-thinking';

    const avatar = document.createElement('div');
    avatar.className = 'cg-avatar';
    avatar.textContent = '🧭';
    wrapper.appendChild(avatar);

    const bubble = document.createElement('div');
    bubble.className = 'cg-bubble cg-bubble--assistant cg-bubble--thinking';
    bubble.innerHTML = '<span class="cg-dot"></span><span class="cg-dot"></span><span class="cg-dot"></span>';
    wrapper.appendChild(bubble);

    this.container.appendChild(wrapper);
    this.thinkingEl = wrapper;
    this._scrollToBottom();
  }

  /**
   * 隐藏加载动画
   */
  hideThinking() {
    if (this.thinkingEl) {
      this.thinkingEl.remove();
      this.thinkingEl = null;
    }
    // 也移除遗留的
    const legacy = document.getElementById('cg-thinking');
    if (legacy) legacy.remove();
  }

  // ---------- 结果面板 ----------

  /**
   * 展示结构化结果面板
   * @param {object} resultData - AI 返回的 JSON 结果
   * @param {boolean} hasProfile - 是否有测评画像
   */
  showResultPanel(resultData, hasProfile) {
    const panel = document.createElement('div');
    panel.className = 'cg-result-panel';
    panel.id = 'cg-result-panel';

    // 安全解析
    const data = resultData || {};

    // --- 自我认知 ---
    if (data.selfAwareness) {
      const sa = data.selfAwareness;
      panel.appendChild(this._buildCard({
        icon: '🪞',
        title: '认识你自己',
        color: 'purple',
        body: `
          <div class="cg-result-row">
            <span class="cg-result-label">核心张力</span>
            <span class="cg-result-value">${this._esc(sa.coreTension || '—')}</span>
          </div>
          <div class="cg-result-row">
            <span class="cg-result-label">优势</span>
            <span class="cg-result-value">${this._listToStr(sa.strengths)}</span>
          </div>
          <div class="cg-result-row">
            <span class="cg-result-label">盲区</span>
            <span class="cg-result-value">${this._listToStr(sa.blindSpots)}</span>
          </div>
        `,
      }));
    }

    // --- 职业方向 ---
    if (data.directions && data.directions.length > 0) {
      const body = data.directions.map((d, i) => `
        <div class="cg-direction-item">
          <div class="cg-direction-header">
            <span class="cg-direction-rank">#${i + 1}</span>
            <span class="cg-direction-name">${this._esc(d.name || '未知方向')}</span>
            <span class="cg-direction-feasibility cg-feasibility--${(d.feasibility || '中')}">${d.feasibility || '中'}</span>
          </div>
          <p class="cg-direction-why">${this._esc(d.why || '')}</p>
          <div class="cg-direction-roles">
            ${(d.typicalRoles || []).map(r => `<span class="cg-role-tag">${this._esc(r)}</span>`).join('')}
          </div>
          ${d.risk ? `<p class="cg-direction-risk">⚠️ ${this._esc(d.risk)}</p>` : ''}
        </div>
      `).join('');

      panel.appendChild(this._buildCard({
        icon: '🎯',
        title: '可选职业方向',
        color: 'blue',
        body,
      }));
    }

    // --- 验证建议 ---
    if (data.verification && data.verification.length > 0) {
      const body = data.verification.map(v => `
        <div class="cg-verify-item">
          <span class="cg-verify-type">${this._esc(v.type || '行动')}</span>
          <div class="cg-verify-body">
            <p><strong>${this._esc(v.action || '')}</strong></p>
            <p class="cg-verify-why">${this._esc(v.why || '')}</p>
          </div>
        </div>
      `).join('');

      panel.appendChild(this._buildCard({
        icon: '✅',
        title: '验证建议',
        color: 'green',
        body,
      }));
    }

    // --- 成长路径 ---
    if (data.growthPath) {
      const gp = data.growthPath;
      panel.appendChild(this._buildCard({
        icon: '🚀',
        title: '成长路径',
        color: 'orange',
        body: `
          <div class="cg-result-row">
            <span class="cg-result-label">探索方向</span>
            <span class="cg-result-value">${this._esc(gp.direction || '—')}</span>
          </div>
          ${gp.firstStep ? `
          <div class="cg-growth-firststep">
            <h4>✨ 第一步</h4>
            <p><strong>技能：</strong>${this._esc(gp.firstStep.skill || '—')}</p>
            <p><strong>行动：</strong>${this._esc(gp.firstStep.action || '—')}</p>
            <p><strong>预计周期：</strong>${this._esc(gp.firstStep.timeEstimate || '—')}</p>
          </div>
          ` : ''}
          ${gp.behavioralHabit ? `
          <div class="cg-result-row">
            <span class="cg-result-label">日常习惯</span>
            <span class="cg-result-value">${this._esc(gp.behavioralHabit)}</span>
          </div>
          ` : ''}
        `,
      }));
    }

    // --- 底部链接 ---
    if (hasProfile) {
      const linkRow = document.createElement('div');
      linkRow.className = 'cg-result-footer';
      linkRow.innerHTML = '<a href="results.html" class="cg-result-link">📊 查看完整测评画像 →</a>';
      panel.appendChild(linkRow);
    }

    // 插入到聊天区之后
    this.container.parentElement.appendChild(panel);
    this._scrollToBottom();
  }

  // ---------- 进度条 ----------

  /**
   * 更新进度条（4 阶段步进器）
   * @param {number} phase - 当前阶段号 (1-4)
   * @param {number} total - 总阶段数 (4)
   * @param {string} label - 当前阶段标签
   */
  showProgress(phase, total, label) {
    if (!this.progressBar) return;

    const pct = total > 0 ? Math.round((phase / total) * 100) : 0;

    // 4 阶段名称
    const stageNames = ['结果共鸣', '深度挖掘', '现实校准', '行动地图'];

    // 生成阶段步骤
    let stepsHTML = '';
    for (let i = 0; i < total; i++) {
      const num = i + 1;
      let cls = '';
      if (num < phase) cls = 'cg-step--done';
      else if (num === phase) cls = 'cg-step--active';

      if (i > 0) {
        stepsHTML += '<span class="cg-step-arrow">→</span>';
      }
      stepsHTML += `<span class="cg-step ${cls}"><span class="cg-step-icon">${num < phase ? '●' : num === phase ? '◉' : '○'}</span> ${stageNames[i]}</span>`;
    }

    this.progressBar.innerHTML = `
      <div class="cg-progress-steps">
        ${stepsHTML}
      </div>
      <div class="cg-progress-track">
        <div class="cg-progress-fill" style="width:${pct}%"></div>
      </div>
    `;
  }

  // ---------- 输入控制 ----------

  /**
   * 设置输入是否可用
   */
  setInputEnabled(enabled) {
    this.input.disabled = !enabled;
    this.sendBtn.disabled = !enabled;

    if (!enabled) {
      this.sendBtn.classList.add('cg-send--loading');
    } else {
      this.sendBtn.classList.remove('cg-send--loading');
      this.input.focus();
    }
  }

  /**
   * 清空输入框
   */
  clearInput() {
    this.input.value = '';
  }

  /**
   * 绑定发送回调
   * @param {function} callback - callback(userText)
   */
  onSend(callback) {
    this._sendCallback = callback;
  }

  // ---------- 辅助方法 ----------

  /**
   * 显示错误消息
   */
  showError(text) {
    this.hideThinking();
    this.addMessage('assistant', `⚠️ ${text}`);
  }

  /**
   * 在聊天区添加一条系统分隔消息
   */
  addSystemMessage(text) {
    const el = document.createElement('div');
    el.className = 'cg-system-msg';
    el.textContent = text;
    this.container.appendChild(el);
    this._scrollToBottom();
  }

  // ---------- 内部方法 ----------

  _bindEvents() {
    // 发送按钮点击
    this._boundHandlers.onSendClick = () => this._handleSend();
    this.sendBtn.addEventListener('click', this._boundHandlers.onSendClick);

    // 回车发送（Shift+Enter 换行）
    this._boundHandlers.onKeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._handleSend();
      }
    };
    this.input.addEventListener('keydown', this._boundHandlers.onKeydown);
  }

  _handleSend() {
    const text = this.input.value.trim();
    if (!text || this.input.disabled) return;

    if (this._sendCallback) {
      this._sendCallback(text);
    }
  }

  _formatText(text) {
    // 转义 HTML 然后转换换行
    const escaped = this._esc(text);
    return escaped.replace(/\n/g, '<br>');
  }

  _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  _listToStr(arr) {
    if (!arr || !arr.length) return '—';
    return arr.map(item => this._esc(item)).join('、');
  }

  _scrollToBottom() {
    // 延迟一帧确保 DOM 渲染完成
    requestAnimationFrame(() => {
      if (this.container) {
        this.container.scrollTop = this.container.scrollHeight;
      }
    });
  }

  _buildCard({ icon, title, color, body }) {
    const card = document.createElement('div');
    card.className = `cg-card cg-card--${color}`;

    card.innerHTML = `
      <div class="cg-card-header">
        <span class="cg-card-icon">${icon}</span>
        <h3>${this._esc(title)}</h3>
      </div>
      <div class="cg-card-body">${body}</div>
    `;

    return card;
  }

  /**
   * 销毁渲染器，移除事件监听
   */
  destroy() {
    if (this._boundHandlers.onSendClick) {
      this.sendBtn.removeEventListener('click', this._boundHandlers.onSendClick);
    }
    if (this._boundHandlers.onKeydown) {
      this.input.removeEventListener('keydown', this._boundHandlers.onKeydown);
    }
    this.hideThinking();
  }
}

export default ChatRenderer;
