// ============================================================
// M15: translator.js — 规则翻译层（纯函数）
// 职责: 将 14 维原始分数翻译为自然语言描述
//       纯函数: 输入 profile → 输出 TranslationResult
//       零 DOM、零异步、零副作用
// 依赖: 无
// ============================================================

// ---------- 分档函数 ----------
// 0-3 = low, 4-6 = medium, 7-10 = high
function getLevel(score) {
  if (score == null) return null;
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

// G3 特殊分档: [-1, +1]
function getWALevel(score) {
  if (score == null) return null;
  if (score > 0.3) return 'high';    // 分析型
  if (score < -0.3) return 'low';   // 整体型
  return 'medium';                    // 平衡型
}

// ---------- 维度名称映射 ----------
const DIM_NAMES = {
  // G1
  nAch: '成就动机', nPow: '权力动机', nAff: '亲和动机',
  // G2
  TF: '技术/职能', GM: '管理/统筹', AU: '自主/独立',
  SE: '安全/稳定', EC: '创业/创造', SV: '服务/奉献',
  CH: '挑战/突破', LS: '生活方式',
  // G3
  wholistAnalytic: '认知风格',
  // G4
  presence: '意义拥有感', search: '意义寻求倾向',
};

// ---------- G1 文案模板 ----------
const G1_TEXTS = {
  nAch: {
    high:   '你对卓越有强烈的追求——不是别人定义的卓越，而是你自己心里的标准。攻克难题、超越记录，这些是你内在的驱动力。',
    medium: '你有成就意识，但它不是你的第一驱动力。你会在乎把事情做好，但不会为此牺牲生活的其他部分。',
    low:    '成就对你来说不是最重要的东西。这不代表你没有能力，只是你从别的方面获得满足——也许是人、也许是稳定、也许是自由。',
  },
  nPow: {
    high:   '你享受影响力带来的满足感——让事情按你的判断推进，让你兴奋。你天然地想要承担统筹和决策的角色。',
    medium: '你对权力没有特别的执念，但也不排斥。如果需要你站出来，你也能做好。',
    low:    '你不太在意"谁说了算"。控制权和地位不是你做事的动力，你更关注事情本身。',
  },
  nAff: {
    high:   '人在你心里排第一。关系、连接、被需要的感觉，这些驱动着你做很多决定。团队里你是那个把人聚在一起的人。',
    medium: '你在乎人际关系，但不会为了维护关系而牺牲一切。你有自己的底线。',
    low:    '你不是那种为了关系妥协的人。独立判断对你更重要。这不代表你冷漠，只是你优先级不同。',
  },
};

// ---------- G2 文案模板 ----------
const G2_TEXTS = {
  TF: {
    high:   '你最无法放弃的是专业深度——成为某个领域的专家，用技术说话。',
    medium: '你认可专业能力的价值，但它不是你唯一的锚点。',
    low:    '技术专精对你来说不是必须的。你更愿意做综合性的事情。',
  },
  GM: {
    high:   '你渴望带领团队、推动变革——统筹和决策让你有成就感。',
    medium: '你不排斥管理角色，但也不是你主动追求的方向。',
    low:    '管理岗位对你没有吸引力。你更想专注于自己做的事。',
  },
  AU: {
    high:   '自由是你最在意的——按自己的节奏、用自己的方式做事。被束缚是你无法接受的。',
    medium: '你重视一定程度的自主权，但也接受合理的管理框架。',
    low:    '你不太在意自主权的多少。有明确方向和结构反而让你更安心。',
  },
  SE: {
    high:   '稳定和可预期是你工作选择的第一考量。你喜欢知道明天会发生什么。',
    medium: '你看重一定的稳定性，但也愿意接受适度的不确定性。',
    low:    '安全感不是你的追求。你更愿意冒险去探索未知的可能性。',
  },
  EC: {
    high:   '创造新事物是你的核心动力——从零到一的过程让你着迷。',
    medium: '你对创造有兴趣，但不一定非要自己从零开始。',
    low:    '创业和创造新事物对你吸引力不大。你更偏好成熟的方向。',
  },
  SV: {
    high:   '帮助他人、服务社会是你工作的意义来源。你希望自己的工作能给别人带来价值。',
    medium: '你有一定的服务意识，但它不是你选择工作最重要的考量。',
    low:    '你不太以"服务他人"为核心驱动力。你更关注个人成长和自我实现。',
  },
  CH: {
    high:   '解决难题本身让你兴奋——越难越好。你享受那种攻克不可能的感觉。',
    medium: '你不怕挑战，但也不会刻意追求困难。你在意的是结果的价值。',
    low:    '你不太追求"难"。效率和确定性对你更重要。',
  },
  LS: {
    high:   '工作生活平衡是你的核心锚点——你不会为了事业牺牲生活。',
    medium: '你重视生活的品质，但也愿意在关键时刻为工作付出更多。',
    low:    '生活平衡不是你的优先考量。你愿意为有意义的事情投入大量时间。',
  },
};

// ---------- G3 文案模板 ----------
const G3_TEXTS = {
  wholistAnalytic: {
    high:   '你倾向于分析型思维——习惯先拆解问题、收集数据、逐步推理，再拼合出答案。面对复杂信息时，你的第一反应是"把它拆开来看"。',
    medium: '你的认知风格比较灵活——既能从全局把握，也能深入细节。你根据情境自动切换，不执着于一种方式。',
    low:    '你倾向于整体型思维——习惯先看清全局、把握整体脉络，再决定要不要深入细节。你擅长"一眼看穿"模式。',
  },
};

// ---------- G4 文案模板 ----------
const G4_TEXTS = {
  presence: {
    high:   '你对当下生活的意义感很清晰——你知道自己在做什么、为什么做。这种确定性给了你内心的安定。',
    medium: '你有时能感受到意义，有时又觉得模糊。意义感对你来说是一个还在探索中的课题。',
    low:    '你目前对"生活的意义"比较迷茫——很多事情做起来觉得缺少方向感。这不代表你不在乎，只是还没有找到答案。',
  },
  search: {
    high:   '你一直在积极探索什么对自己有意义——你读、你试、你问。这种寻找本身就是你动力的一部分。',
    medium: '你对意义的探索有一些兴趣，但不会为此投入太多精力。你觉得该来的总会来。',
    low:    '你不太主动追问"意义"的问题。你更倾向于接受当下的状态，顺其自然。',
  },
};

// ---------- G2 锚点中文全名（用于段落描述） ----------
const G2_FULLNAMES = {
  TF: '专业深度', GM: '团队统筹', AU: '自主自由', SE: '稳定可预期',
  EC: '创造新事物', SV: '帮助他人', CH: '攻克难题', LS: '工作生活平衡',
};

// ---------- 游戏名映射 ----------
const GAME_NAMES = {
  game1: '核心驱动力',
  game2: '职业锚点',
  game3: '认知风格',
  game4: '意义建构',
};

// ---------- 核心翻译函数 ----------

/**
 * 翻译单个维度
 * @returns {DimensionText|null}
 */
function translateDimension(dimId, rawScore) {
  if (rawScore == null) return null;
  const score = Math.round(rawScore * 100) / 100;
  const level = dimId === 'wholistAnalytic' ? getWALevel(score) : getLevel(score);
  if (level === null) return null;

  // 选择模板集
  let texts;
  if (dimId.startsWith('game')) return null; // 不应出现
  if (G1_TEXTS[dimId]) texts = G1_TEXTS[dimId];
  else if (G2_TEXTS[dimId]) texts = G2_TEXTS[dimId];
  else if (G3_TEXTS[dimId]) texts = G3_TEXTS[dimId];
  else if (G4_TEXTS[dimId]) texts = G4_TEXTS[dimId];
  else return null;

  return {
    id: dimId,
    name: DIM_NAMES[dimId] || dimId,
    score,
    level,
    text: texts[level],
  };
}

/**
 * 主函数: 将 profile 翻译为自然语言
 * @param {UnifiedProfile} profile - integrator.integrate() 的输出
 * @returns {TranslationResult}
 */
export function translate(profile) {
  const sections = [];
  const completed = profile.meta.completedGames;

  // ---- G1 ----
  if (completed.includes('game1')) {
    const g1Dims = ['nAch', 'nPow', 'nAff']
      .map(d => translateDimension(d, profile.raw[d]))
      .filter(Boolean);

    // 找最高驱动力
    const primary = g1Dims.reduce((a, b) => (a.score > b.score ? a : b), g1Dims[0]);
    // 找第二高驱动力（用 sort 替代 reduce，避免 null 初始值导致的 null.score 崩溃）
    const remaining = g1Dims.filter(d => d.id !== primary.id);
    const secondary = remaining.length > 0
      ? remaining.reduce((a, b) => (a.score > b.score ? a : b))
      : null;

    // 总结段落
    let summary = `在核心驱动力层面，你的最高驱动力是${primary.name}（${primary.score}/10）——${primary.text}`;
    if (secondary && Math.abs(primary.score - secondary.score) <= 2) {
      summary += ` 紧随其后的是${secondary.name}（${secondary.score}/10），两者构成了你内在驱动力的双重基调。`;
    }

    sections.push({
      gameId: 'game1',
      gameName: GAME_NAMES.game1,
      dimensions: g1Dims,
      summary,
    });
  }

  // ---- G2 ----
  if (completed.includes('game2')) {
    const g2Dims = ['TF', 'GM', 'AU', 'SE', 'EC', 'SV', 'CH', 'LS']
      .map(d => translateDimension(d, profile.raw[d]))
      .filter(Boolean);

    // 按分数排序，取前三锚点
    const sorted = [...g2Dims].sort((a, b) => b.score - a.score);
    const primary = sorted[0];
    const secondary = sorted[1];

    // 只对 primary 和 secondary 生成详细段落，其余简述
    const topAnchors = sorted.slice(0, 3).map(d => `${G2_FULLNAMES[d.id]}（${d.score}）`).join('、');

    let summary = `在职业锚点层面，你最无法放弃的是${G2_FULLNAMES[primary.id]}（${primary.score}/10）——${primary.text}`;
    if (secondary && secondary.score >= 4) {
      summary += ` 其次是${G2_FULLNAMES[secondary.id]}（${secondary.score}/10），这意味着你同时看重${G2_FULLNAMES[secondary.id]}。`;
    }
    summary += `\n\n你的锚点排序：${topAnchors}。`;

    sections.push({
      gameId: 'game2',
      gameName: GAME_NAMES.game2,
      dimensions: g2Dims,
      summary,
    });
  }

  // ---- G3 ----
  if (completed.includes('game3')) {
    const g3Dims = ['wholistAnalytic']
      .map(d => translateDimension(d, profile.raw[d]))
      .filter(Boolean);

    const wa = g3Dims[0];
    const waLevel = wa ? (wa.level === 'high' ? '分析型' : wa.level === 'low' ? '整体型' : '平衡型') : '';

    let summary = `在认知风格层面，你偏向${waLevel}——${wa ? wa.text : ''}`;

    sections.push({
      gameId: 'game3',
      gameName: GAME_NAMES.game3,
      dimensions: g3Dims,
      summary,
    });
  }

  // ---- G4 ----
  if (completed.includes('game4')) {
    const g4Dims = ['presence', 'search']
      .map(d => translateDimension(d, profile.raw[d]))
      .filter(Boolean);

    const p = g4Dims.find(d => d.id === 'presence');
    const s = g4Dims.find(d => d.id === 'search');

    // 判定 profileType
    let profileType;
    if (p && s) {
      const pLvl = getLevel(p.score);
      const sLvl = getLevel(s.score);
      if (pLvl === 'high' && sLvl === 'high') profileType = '成长型';
      else if (pLvl === 'high' && sLvl !== 'high') profileType = '安定型';
      else if (pLvl !== 'high' && sLvl === 'high') profileType = '探索型';
      else profileType = '游离型';
    }

    let summary = '';
    if (p && s) {
      summary = `在意义建构层面，你的意义拥有感为${p.score}/10（${p.level === 'high' ? '清晰' : p.level === 'medium' ? '模糊' : '迷茫'}），意义寻求倾向为${s.score}/10（${s.level === 'high' ? '积极' : s.level === 'medium' ? '适中' : '被动'}）。`;
      if (profileType) {
        const typeTexts = {
          '成长型': '你既清楚地感知到当下方向的意义，又保持着积极探索的心态——这是最理想的状态。',
          '安定型': '你对当下方向有清晰的意义感，不太需要额外探索——你知道自己在做什么，并且认可它。',
          '探索型': '你目前的意义感还不稳定，但你的探索欲望很强烈——你在路上，答案还没到。',
          '游离型': '你既没有很强的意义感，也没有主动去寻找——可能你正处在一个过渡期。',
        };
        summary += `\n\n综合来看，你属于「${profileType}」——${typeTexts[profileType]}`;
      }
    }

    sections.push({
      gameId: 'game4',
      gameName: GAME_NAMES.game4,
      dimensions: g4Dims,
      summary,
      profileType: profileType || null,
    });
  }

  return {
    sections,
    completedCount: completed.length,
    allCompleted: profile.meta.allCompleted,
  };
}
