// ============================================================
// M: behavior-narrative.js — 行为叙事提取层
// 职责: 从四个游戏的过程数据中提取对比与异常，产出叙事钩子供 AI 解读
// 输入: store.loadAll() 的 game results
// 输出: BehaviorNarrative 结构（符合 docs/behavior-narrative-proposal.md 定义）
// ============================================================

import { GAME1_CONFIG } from '../games/game1-data.js?v=20260602e';
import { SCENARIOS as G4_SCENARIOS } from '../games/game4-data.js?v=20260602e';

// ---------- 阈值常量（Phase 3 精调） ----------

const G1_FAST_MS = 2000;       // 慢于这个算审慎
const G1_SLOW_MS = 3600;       // 快于 G1_FAST 算直觉，慢于此算审慎
const G1_VAR_HIGH = 2.5;       // max/avg > 这个算高波动
const G1_TREND_RATIO = 0.7;    // 前/后 < 这个算变速

const G2_FLIP_TARGET = 1.2;    // flip/kept <= 这个算目标型
const G2_FLIP_EXPLORE = 2.0;   // flip/kept >= 这个算探索型
const G2_ANCHOR_GAP = 3.0;     // primary-secondary >= 这个算差距明显

const G3_IMPULSE_HIGH = 7;     // impulse >= 这个算直觉型
const G3_IMPULSE_LOW = 4;      // impulse < 这个算审慎型
const G3_RHYTHM_RATIO = 0.6;   // stage1/stage2 < 这个算分组快排序慢

const G4_PRESENCE_FAST = 2000; // avgPresence < 这个
const G4_SEARCH_SLOW = 3000;   // avgSearch > 这个
const G4_PRESENCE_SLOW = 3000; // avgPresence > 这个
const G4_SEARCH_FAST = 2000;   // avgSearch < 这个
const G4_GAP_PRESENCE = 0.8;   // avgPresence < avgSearch * 0.8
const G4_GAP_SEARCH = 1.5;     // avgSearch > avgPresence * 1.5

// ---------- 工具 ----------

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------- G1 提取 ----------

function extractG1(game1) {
  if (!game1 || !game1.decisions || !game1.decisions.length) return null;

  const times = game1.decisions.map(d => d.decisionTime);
  const avgTime = Math.round(avg(times));
  const maxTime = Math.max(...times);
  const variance = maxTime / Math.max(avgTime, 1);

  // 决策风格
  let decisionStyle;
  if (avgTime < G1_FAST_MS) decisionStyle = '直觉型';
  else if (avgTime > G1_SLOW_MS) decisionStyle = '审慎型';
  else decisionStyle = '均衡型';

  // 时间波动
  const timeVariance = variance > G1_VAR_HIGH ? '高' : '低';

  // 快/慢锚点（最快 1 个 + 最慢 2 个）
  const indexed = game1.decisions.map((d, i) => ({ ...d, idx: i }));
  const sorted = [...indexed].sort((a, b) => a.decisionTime - b.decisionTime);
  const fastest = sorted[0];
  const slowest = sorted.slice(-2);

  // scenarioId → title 映射
  const titleMap = {};
  (GAME1_CONFIG.scenarios || []).forEach(s => {
    titleMap[s.id] = s.title;
  });

  const anchors = [];
  if (fastest && fastest.scenarioId) {
    anchors.push({
      scenarioId: fastest.scenarioId,
      scenarioLabel: titleMap[fastest.scenarioId] || `场景${fastest.scenarioId}`,
      timeMs: fastest.decisionTime,
      type: 'fastest',
    });
  }
  slowest.forEach(d => {
    if (d.scenarioId) {
      anchors.push({
        scenarioId: d.scenarioId,
        scenarioLabel: titleMap[d.scenarioId] || `场景${d.scenarioId}`,
        timeMs: d.decisionTime,
        type: 'slowest',
      });
    }
  });

  // 趋势（前 3 vs 后 3）
  const half = Math.ceil(times.length / 2);
  const firstAvg = avg(times.slice(0, half));
  const lastAvg = avg(times.slice(half));
  let trend, trendNote;
  if (firstAvg < lastAvg * G1_TREND_RATIO) {
    trend = '先快后慢';
    trendNote = `前${half}题平均 ${Math.round(firstAvg / 1000)}s，后${times.length - half}题平均 ${Math.round(lastAvg / 1000)}s — 越做越犹豫`;
  } else if (lastAvg < firstAvg * G1_TREND_RATIO) {
    trend = '先慢后快';
    trendNote = `前${half}题平均 ${Math.round(firstAvg / 1000)}s，后${times.length - half}题平均 ${Math.round(lastAvg / 1000)}s — 热身之后加速`;
  } else {
    trend = '匀速';
    trendNote = `全程节奏稳定，平均 ${Math.round(avgTime / 1000)}s 每题`;
  }

  return {
    decisionStyle,
    avgTimeMs: avgTime,
    timeVariance,
    anchors,
    trend,
    trendNote,
  };
}

// ---------- G2 提取 ----------

function extractG2(game2) {
  if (!game2 || !game2.meta) return null;

  const { meta, behaviorSummary } = game2;
  const cardsFlipped = meta.cardsFlipped || 0;
  const cardsSelected = meta.stage1Kept || 0;
  const flipRatio = cardsSelected > 0 ? cardsFlipped / cardsSelected : 0;

  // 探索风格
  let explorationStyle;
  if (flipRatio <= G2_FLIP_TARGET) explorationStyle = '目标型';
  else if (flipRatio >= G2_FLIP_EXPLORE) explorationStyle = '探索型';
  else explorationStyle = '均衡型';

  // 锚差距
  const primaryAnchor = behaviorSummary?.primaryAnchor || '';
  const secondaryAnchor = behaviorSummary?.secondaryAnchor || '';
  const primScore = game2.dimensions?.[primaryAnchor] || 0;
  const secScore = game2.dimensions?.[secondaryAnchor] || 0;
  const anchorGap = Math.round((primScore - secScore) * 10) / 10;
  const gapNote = anchorGap >= G2_ANCHOR_GAP ? '差距明显' : '旗鼓相当';

  // 锚标签映射
  const anchorLabels = {
    TF: '技术职能', GM: '综合管理', AU: '自主独立',
    SE: '安全稳定', EC: '创新创业', SV: '服务奉献',
    CH: '挑战纯粹', LS: '生活方式',
  };

  return {
    explorationStyle,
    cardsFlipped,
    cardsSelected,
    primaryAnchor,
    primaryLabel: anchorLabels[primaryAnchor] || primaryAnchor,
    secondaryAnchor,
    secondaryLabel: anchorLabels[secondaryAnchor] || secondaryAnchor,
    anchorGap,
    gapNote,
  };
}

// ---------- G3 提取 ----------

function extractG3(game3) {
  if (!game3 || !game3.behaviorSummary || !game3.meta) return null;

  const { behaviorSummary, meta } = game3;
  const impulseScore = behaviorSummary.impulseScore || 5;

  // 认知节奏
  let cognitiveRhythm;
  if (impulseScore >= G3_IMPULSE_HIGH) cognitiveRhythm = '直觉型';
  else if (impulseScore < G3_IMPULSE_LOW) cognitiveRhythm = '审慎型';
  else cognitiveRhythm = '均衡型';

  const stage1Sec = Math.round((meta.stage1Time || 0) / 1000);
  const stage2Sec = Math.round((meta.stage2Time || 0) / 1000);
  const selfKnownCount = meta.greenCount || 0;
  const selfAmbiguousCount = meta.yellowCount || 0;

  // 节奏注
  let rhythmNote;
  if (stage1Sec > 0 && stage2Sec > 0) {
    if (stage1Sec < stage2Sec * G3_RHYTHM_RATIO) {
      rhythmNote = `你凭直觉快速分组（${stage1Sec}s），但排序时认真权衡（${stage2Sec}s）——你知道自己是谁，只是不确定哪个特质更重要。`;
    } else if (stage2Sec < stage1Sec * G3_RHYTHM_RATIO) {
      rhythmNote = `你分组时反复推敲（${stage1Sec}s），但排序时很快确定（${stage2Sec}s）——你对自己有全面的认识，且方向清晰。`;
    } else {
      rhythmNote = `分组和排序节奏相当（${stage1Sec}s/${stage2Sec}s）——你的自我认知过程和排序过程自然衔接。`;
    }
  }

  return {
    cognitiveRhythm,
    impulseScore,
    selfKnownCount,
    selfAmbiguousCount,
    stage1Sec,
    stage2Sec,
    rhythmNote,
  };
}

// ---------- G4 提取 ----------

function extractG4(game4) {
  if (!game4 || !game4.decisions || !game4.decisions.length) return null;

  const decisions = game4.decisions;

  const presenceTimes = decisions.map(d => d.reactionOneMs || 0);
  const searchTimes = decisions.map(d => d.reactionTwoMs || 0);
  const avgPresence = Math.round(avg(presenceTimes));
  const avgSearch = Math.round(avg(searchTimes));
  const avgReactionMs = Math.round(avg(decisions.map(d => d.reactionTimeMs || 0)));

  // 意义唤起模式
  let meaningStyle;
  if (avgPresence < G4_PRESENCE_FAST && avgSearch > G4_SEARCH_SLOW) {
    meaningStyle = '深度内化';
  } else if (avgPresence > G4_PRESENCE_SLOW && avgSearch < G4_SEARCH_FAST) {
    meaningStyle = '搜寻型';
  } else {
    meaningStyle = '平衡型';
  }

  // 共鸣/纠结场景
  const titleMap = {};
  (G4_SCENARIOS || []).forEach(s => {
    titleMap[s.id] = s.title;
  });

  let resonantIdx = 0, struggleIdx = 0;
  let resonantMin = Infinity, struggleMax = -1;
  decisions.forEach((d, i) => {
    if ((d.reactionOneMs || 0) < resonantMin) { resonantMin = d.reactionOneMs; resonantIdx = i; }
    if ((d.reactionTwoMs || 0) > struggleMax) { struggleMax = d.reactionTwoMs; struggleIdx = i; }
  });

  const resonantScenario = decisions[resonantIdx];
  const struggleScenario = decisions[struggleIdx];

  const resonantStory = resonantScenario?.scenarioId || '';
  const resonantLabel = titleMap[resonantStory] || '某个故事';
  const struggleStory = struggleScenario?.scenarioId || '';
  const struggleLabel = titleMap[struggleStory] || '某个故事';

  // presence→search 差距
  const presenceSearchGap = avgSearch > 0 ? Math.round((avgPresence / avgSearch) * 10) / 10 : 1;
  let gapNote;
  if (avgPresence < avgSearch * G4_GAP_PRESENCE) gapNote = '临在感来得很快，追寻感滞后';
  else if (avgSearch > avgPresence * G4_GAP_SEARCH) gapNote = '追寻感远超临在感';
  else gapNote = '临在感和追寻感几乎同步';

  return {
    meaningStyle,
    avgReactionMs,
    resonantStory,
    resonantLabel,
    struggleStory,
    struggleLabel,
    presenceSearchGap,
    gapNote,
  };
}

// ---------- 主导出 ----------

/**
 * @param {object} data — store.loadAll() 返回的 { game1, game2, game3, game4 }
 * @returns {object} behaviorNarrative | null
 */
export function extractBehaviorNarrative(data) {
  if (!data) return null;

  return {
    g1: extractG1(data.game1),
    g2: extractG2(data.game2),
    g3: extractG3(data.game3),
    g4: extractG4(data.game4),
  };
}

/**
 * 将 behaviorNarrative 转为 Prompt 文本片段
 * @param {object} bn — extractBehaviorNarrative 的输出
 * @returns {string} 行为叙事段落
 */
export function formatBehaviorNarrative(bn) {
  if (!bn) return '（无行为数据）';

  const parts = [];

  // G1
  if (bn.g1) {
    const g1 = bn.g1;
    let text = `决策风格：偏${g1.decisionStyle}（平均 ${(g1.avgTimeMs / 1000).toFixed(1)}s）`;
    if (g1.anchors && g1.anchors.length) {
      const slowest = g1.anchors.filter(a => a.type === 'slowest');
      const fastest = g1.anchors.filter(a => a.type === 'fastest');
      if (slowest.length) {
        text += `。在关于"${slowest[0].scenarioLabel}"的场景你花了 ${(slowest[0].timeMs / 1000).toFixed(1)} 秒`;
        if (slowest.length > 1) text += `，"${slowest[1].scenarioLabel}"也让你思考了很久（${(slowest[1].timeMs / 1000).toFixed(1)}s）`;
      }
      if (fastest.length) {
        text += `。而"${fastest[0].scenarioLabel}"几乎是秒选（${(fastest[0].timeMs / 1000).toFixed(1)}s）`;
      }
    }
    if (g1.trend && g1.trendNote) text += `。${g1.trendNote}`;
    parts.push(text);
  }

  // G2
  if (bn.g2) {
    const g2 = bn.g2;
    let text = `你属于${g2.explorationStyle}（${g2.cardsFlipped}/${g2.cardsSelected + g2.cardsFlipped} 张卡翻看了 ${g2.cardsFlipped} 张）`;
    text += `，核心锚是${g2.primaryLabel}和${g2.secondaryLabel}`;
    text += `（${g2.gapNote}，差 ${g2.anchorGap} 分）`;
    parts.push(text);
  }

  // G3
  if (bn.g3) {
    const g3 = bn.g3;
    let text = `认知节奏偏${g3.cognitiveRhythm}`;
    if (g3.rhythmNote) text += `。${g3.rhythmNote}`;
    parts.push(text);
  }

  // G4
  if (bn.g4) {
    const g4 = bn.g4;
    let text = `意义唤起模式：${g4.meaningStyle}`;
    text += `。"${g4.resonantLabel}"让你最有临在感，"${g4.struggleLabel}"让你想得最久`;
    text += `。${g4.gapNote}`;
    parts.push(text);
  }

  return parts.length ? parts.join('\n\n') : '（无行为数据）';
}
