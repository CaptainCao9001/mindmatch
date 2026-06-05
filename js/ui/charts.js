// ============================================================
// M22: charts.js — ECharts 图表渲染层
// 职责: 用 ECharts 渲染 G1-G4 的维度图表
//       纯 DOM 渲染，依赖 ECharts CDN
// 依赖: ECharts 5.x (CDN)
// ============================================================

/**
 * 初始化 ECharts 实例
 */
function initChart(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`[MindMatch] 图表容器不存在: ${containerId}`);
    return null;
  }

  const chart = echarts.init(container, 'dark');

  // 响应式：窗口变化时 resize
  window.addEventListener('resize', () => chart.resize());

  return chart;
}

/**
 * 颜色常量（与 base.css 主色系一致）
 */
const COLORS = {
  purple: '#7c3aed',
  coral: '#f97316',
  teal: '#06b6d4',
  green: '#10b981',
  pink: '#ec4899',
  amber: '#f59e0b',
  blue: '#3b82f6',
  red: '#ef4444',
  primary: '#7c3aed',
};

// ============================================================
// G1: 水平柱状图（3 维度）
// ============================================================

/**
 * @param {string} containerId
 * @param {object} g1Data - { nAch, nPow, nAff } 原始分数 [0-10]
 */
export function renderG1Bar(containerId, g1Data) {
  const chart = initChart(containerId);
  if (!chart) return;

  const dimensions = [
    { name: '成就动机', value: g1Data.nAch, color: COLORS.purple },
    { name: '权力动机', value: g1Data.nPow, color: COLORS.coral },
    { name: '亲和动机', value: g1Data.nAff, color: COLORS.teal },
  ];

  chart.setOption({
    backgroundColor: 'transparent',
    grid: { left: 80, right: 30, top: 10, bottom: 10 },
    xAxis: { type: 'value', max: 10, show: false },
    yAxis: {
      type: 'category',
      data: dimensions.map(d => d.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#9ca3af', fontSize: 12 },
    },
    series: [{
      type: 'bar',
      data: dimensions.map(d => ({
        value: d.value,
        itemStyle: { color: d.color, borderRadius: [0, 4, 4, 0] },
      })),
      barWidth: 18,
      label: {
        show: true,
        position: 'right',
        formatter: '{c}/10',
        color: '#9ca3af',
        fontSize: 12,
      },
    }],
    animation: true,
    animationDuration: 800,
  });
}

// ============================================================
// G2: 雷达图（8 维度）
// ============================================================

/**
 * @param {string} containerId
 * @param {object} g2Data - { TF, GM, AU, SE, EC, SV, CH, LS } 原始分数 [0-10]
 */
export function renderG2Radar(containerId, g2Data) {
  const chart = initChart(containerId);
  if (!chart) return;

  const ANCHOR_NAMES = {
    TF: '技术', GM: '管理', AU: '自主', SE: '稳定',
    EC: '创业', SV: '服务', CH: '挑战', LS: '生活',
  };

  const values = Object.entries(g2Data)
    .map(([id, score]) => ({
      name: ANCHOR_NAMES[id] || id,
      value: score,
      max: 10,
    }));

  chart.setOption({
    backgroundColor: 'transparent',
    radar: {
      indicator: values,
      axisName: { color: '#9ca3af', fontSize: 11 },
      splitArea: {
        areaStyle: {
          color: ['rgba(139, 92, 246, 0.02)', 'rgba(139, 92, 246, 0.04)',
                  'rgba(139, 92, 246, 0.06)', 'rgba(139, 92, 246, 0.08)', 'rgba(139, 92, 246, 0.1)'],
        },
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: values.map(v => v.value),
        name: '职业锚点',
        areaStyle: { color: 'rgba(139, 92, 246, 0.25)' },
        lineStyle: { color: COLORS.purple, width: 2 },
        itemStyle: { color: COLORS.purple },
        symbol: 'circle',
        symbolSize: 6,
      }],
    }],
    animation: true,
    animationDuration: 800,
  });
}

// ============================================================
// G3: 水平柱状图（wholistAnalytic [-1, +1]）
// ============================================================

/**
 * @param {string} containerId
 * @param {number} wholistAnalytic - [-1, +1]
 */
export function renderG3Slider(containerId, wholistAnalytic) {
  const chart = initChart(containerId);
  if (!chart) return;

  // 风格标签
  const styleLabel = wholistAnalytic > 0.01
    ? '分析型'
    : wholistAnalytic < -0.01
      ? '整体型'
      : '平衡型';
  const scoreText = wholistAnalytic >= 0.01
    ? `+${wholistAnalytic.toFixed(2)}`
    : wholistAnalytic.toFixed(2);

  chart.setOption({
    backgroundColor: 'transparent',
    grid: { left: 10, right: 70, top: 35, bottom: 35 },
    xAxis: { type: 'value', min: -1, max: 1, show: false },
    yAxis: {
      type: 'category',
      data: [''],
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
    },
    series: [{
      type: 'bar',
      data: [{
        value: wholistAnalytic,
        itemStyle: {
          color: wholistAnalytic >= 0 ? COLORS.blue : COLORS.amber,
        },
      }],
      barWidth: 18,
      label: {
        show: true,
        position: 'right',
        formatter: `${styleLabel} ${scoreText}`,
        color: '#d1d5db',
        fontSize: 13,
        fontWeight: 'bold',
      },
    }],
    animation: true,
    animationDuration: 800,
  });
}

// ============================================================
// G4: 四象限散点图（Presence × Search）
// ============================================================

/**
 * @param {string} containerId
 * @param {object} g4Data - { presence, search } 原始分数 [0-10]
 */
export function renderG4Quadrant(containerId, g4Data) {
  const chart = initChart(containerId);
  if (!chart) return;

  chart.setOption({
    backgroundColor: 'transparent',
    grid: { left: 50, right: 30, top: 30, bottom: 50 },
    xAxis: {
      type: 'value', min: 0, max: 10, name: '寻求意义',
      nameLocation: 'center', nameGap: 25,
      nameTextStyle: { color: '#9ca3af', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisLabel: { color: '#6b7280', fontSize: 10 },
    },
    yAxis: {
      type: 'value', min: 0, max: 10, name: '意义拥有感',
      nameLocation: 'end', nameGap: 10,
      nameTextStyle: { color: '#9ca3af', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisLabel: { color: '#6b7280', fontSize: 10 },
    },
    graphic: [
      // 四象限标签
      { type: 'text', left: '12%', top: '10%', style: { text: '安定型', fill: '#4ade80', fontSize: 11, opacity: 0.6 } },
      { type: 'text', right: '12%', top: '10%', style: { text: '成长型', fill: '#60a5fa', fontSize: 11, opacity: 0.6 } },
      { type: 'text', left: '12%', bottom: '15%', style: { text: '游离型', fill: '#9ca3af', fontSize: 11, opacity: 0.4 } },
      { type: 'text', right: '12%', bottom: '15%', style: { text: '探索型', fill: '#f97316', fontSize: 11, opacity: 0.6 } },
      // 分割线标签
      { type: 'text', left: 'center', top: 'center', style: { text: '+', fill: 'rgba(255,255,255,0.15)', fontSize: 40, fontWeight: 900 } },
    ],
    // 中线 markLine
    series: [
      {
        type: 'scatter',
        data: [{
          value: [g4Data.search, g4Data.presence],
          symbol: 'circle',
          symbolSize: 20,
          itemStyle: { color: COLORS.primary, borderColor: '#fff', borderWidth: 2 },
          label: { show: true, formatter: '你', color: '#fff', fontSize: 10, position: 'top', distance: 8 },
        }],
        markLine: {
          silent: true,
          lineStyle: { color: 'rgba(255,255,255,0.1)', type: 'dashed' },
          data: [
            { xAxis: 5 },
            { yAxis: 5 },
          ],
          label: { show: false },
          symbol: 'none',
        },
        animation: true,
        animationDuration: 800,
      },
    ],
  });
}

// ============================================================
// 批量渲染入口
// ============================================================

/**
 * 根据 profile 自动渲染所有已完成的图表
 * @param {UnifiedProfile} profile
 */
export function renderAllCharts(profile) {
  const completed = profile.meta.completedGames;

  if (completed.includes('game1')) {
    renderG1Bar('chart-game1', {
      nAch: profile.raw.nAch,
      nPow: profile.raw.nPow,
      nAff: profile.raw.nAff,
    });
  }

  if (completed.includes('game2')) {
    renderG2Radar('chart-game2', {
      TF: profile.raw.TF, GM: profile.raw.GM, AU: profile.raw.AU, SE: profile.raw.SE,
      EC: profile.raw.EC, SV: profile.raw.SV, CH: profile.raw.CH, LS: profile.raw.LS,
    });
  }

  if (completed.includes('game3')) {
    renderG3Slider('chart-game3', profile.raw.wholistAnalytic);
  }

  if (completed.includes('game4')) {
    renderG4Quadrant('chart-game4', {
      presence: profile.raw.presence,
      search: profile.raw.search,
    });
  }
}
