// Phase 3: 行为叙事阈值验证
// 用 inject-behavior.html 中的 4 个行为原型跑 narrative 提取，检查分类准确性
import { extractBehaviorNarrative, formatBehaviorNarrative } from '../js/layers/behavior-narrative.js';

// 从 inject-behavior.html 复制的 4 个行为原型数据
const now = Date.now();

const PROFILES = {
  '直觉型快速决策者': {
    expected: {
      g1Style: '直觉型', g2Style: '目标型', g3Rhythm: '直觉型', g4Style: '深度内化'
    },
    data: {
      game1: { gameId:'game1', dimensions:{ nAch:8.2, nPow:3.5, nAff:4.1 }, decisions:[{ scenarioId:'s1', chosenOptionId:'s1_a', decisionTime:920 },{ scenarioId:'s2', chosenOptionId:'s2_b', decisionTime:1340 },{ scenarioId:'s3', chosenOptionId:'s3_a', decisionTime:810 },{ scenarioId:'s4', chosenOptionId:'s4_d', decisionTime:1580 },{ scenarioId:'s5', chosenOptionId:'s5_c', decisionTime:1100 }], meta:{ totalTime:6140, elapsedMs:45000, decisionCount:5, scenarioIds:['s1','s2','s3','s4','s5'] } },
      game2: { gameId:'game2', dimensions:{ TF:9.0, GM:5.0, AU:4.0, SE:3.5, EC:6.0, SV:2.5, CH:5.5, LS:4.5 }, behaviorSummary:{ primaryAnchor:'TF', secondaryAnchor:'EC', bottomAnchor:'SV' }, meta:{ cardsFlipped:6, stage1Kept:6 } },
      game3: { gameId:'game3', dimensions:{ wholistAnalytic:-0.2 }, behaviorSummary:{ dominantStyle:'整体型', flexibility:5.5, impulseScore:8.0 }, meta:{ stage1Time:12000, stage2Time:14000, greenCount:4, yellowCount:2, redCount:2 } },
      game4: { gameId:'game4', dimensions:{ presence:7.5, search:6.0 }, decisions:[ { scenarioId:'s1', reactionTimeMs:4500, reactionOneMs:1200, reactionTwoMs:3300 },{ scenarioId:'s2', reactionTimeMs:3800, reactionOneMs:800, reactionTwoMs:3000 },{ scenarioId:'s3', reactionTimeMs:5100, reactionOneMs:1500, reactionTwoMs:3600 },{ scenarioId:'s4', reactionTimeMs:4200, reactionOneMs:1100, reactionTwoMs:3100 },{ scenarioId:'s5', reactionTimeMs:3900, reactionOneMs:950, reactionTwoMs:2950 },{ scenarioId:'s6', reactionTimeMs:6800, reactionOneMs:2200, reactionTwoMs:4600 } ] },
    }
  },
  '审慎型慢速决策者': {
    expected: {
      g1Style: '审慎型', g2Style: '探索型', g3Rhythm: '审慎型', g4Style: '搜寻型'
    },
    data: {
      game1: { gameId:'game1', dimensions:{ nAch:6.5, nPow:7.2, nAff:5.0 }, decisions:[{ scenarioId:'s1', chosenOptionId:'s1_b', decisionTime:6200 },{ scenarioId:'s2', chosenOptionId:'s2_a', decisionTime:5100 },{ scenarioId:'s3', chosenOptionId:'s3_c', decisionTime:5800 },{ scenarioId:'s4', chosenOptionId:'s4_a', decisionTime:7100 },{ scenarioId:'s5', chosenOptionId:'s5_a', decisionTime:4400 }], meta:{ totalTime:28600, elapsedMs:58000, decisionCount:5, scenarioIds:['s1','s2','s3','s4','s5'] } },
      game2: { gameId:'game2', dimensions:{ TF:7.5, GM:5.5, AU:4.0, SE:3.0, EC:4.5, SV:6.0, CH:4.0, LS:5.5 }, behaviorSummary:{ primaryAnchor:'TF', secondaryAnchor:'SV', bottomAnchor:'SE' }, meta:{ cardsFlipped:13, stage1Kept:6 } },
      game3: { gameId:'game3', dimensions:{ wholistAnalytic:0.45 }, behaviorSummary:{ dominantStyle:'分析型', flexibility:4.0, impulseScore:3.0 }, meta:{ stage1Time:28000, stage2Time:12000, greenCount:3, yellowCount:3, redCount:2 } },
      game4: { gameId:'game4', dimensions:{ presence:3.5, search:7.8 }, decisions:[ { scenarioId:'s1', reactionTimeMs:5300, reactionOneMs:3400, reactionTwoMs:1900 },{ scenarioId:'s2', reactionTimeMs:4600, reactionOneMs:2900, reactionTwoMs:1700 },{ scenarioId:'s3', reactionTimeMs:5000, reactionOneMs:3200, reactionTwoMs:1800 },{ scenarioId:'s4', reactionTimeMs:5800, reactionOneMs:3900, reactionTwoMs:1900 },{ scenarioId:'s5', reactionTimeMs:4700, reactionOneMs:3000, reactionTwoMs:1700 },{ scenarioId:'s6', reactionTimeMs:4400, reactionOneMs:2800, reactionTwoMs:1600 } ] },
    }
  },
  '均衡探索型': {
    expected: {
      g1Style: '均衡型', g2Style: '均衡型', g3Rhythm: '均衡型', g4Style: '平衡型'
    },
    data: {
      game1: { gameId:'game1', dimensions:{ nAch:5.6, nPow:4.8, nAff:6.8 }, decisions:[{ scenarioId:'s1', chosenOptionId:'s1_a', decisionTime:3100 },{ scenarioId:'s2', chosenOptionId:'s2_c', decisionTime:2400 },{ scenarioId:'s3', chosenOptionId:'s3_b', decisionTime:2800 },{ scenarioId:'s4', chosenOptionId:'s4_a', decisionTime:3600 },{ scenarioId:'s5', chosenOptionId:'s5_b', decisionTime:2200 }], meta:{ totalTime:14100, elapsedMs:62000, decisionCount:5, scenarioIds:['s1','s2','s3','s4','s5'] } },
      game2: { gameId:'game2', dimensions:{ TF:4.0, GM:5.0, AU:8.5, SE:2.5, EC:7.5, SV:4.5, CH:5.0, LS:5.5 }, behaviorSummary:{ primaryAnchor:'AU', secondaryAnchor:'EC', bottomAnchor:'SE' }, meta:{ cardsFlipped:11, stage1Kept:6 } },
      game3: { gameId:'game3', dimensions:{ wholistAnalytic:0.5 }, behaviorSummary:{ dominantStyle:'均衡型', flexibility:5.5, impulseScore:5.0 }, meta:{ stage1Time:18000, stage2Time:16000, greenCount:3, yellowCount:3, redCount:2 } },
      game4: { gameId:'game4', dimensions:{ presence:5.5, search:5.8 }, decisions:[ { scenarioId:'s1', reactionTimeMs:5200, reactionOneMs:2600, reactionTwoMs:2600 },{ scenarioId:'s2', reactionTimeMs:4800, reactionOneMs:2400, reactionTwoMs:2400 },{ scenarioId:'s3', reactionTimeMs:5100, reactionOneMs:2500, reactionTwoMs:2600 },{ scenarioId:'s4', reactionTimeMs:4900, reactionOneMs:2500, reactionTwoMs:2400 },{ scenarioId:'s5', reactionTimeMs:5000, reactionOneMs:2400, reactionTwoMs:2600 },{ scenarioId:'s6', reactionTimeMs:5200, reactionOneMs:2600, reactionTwoMs:2600 } ] },
    }
  },
  '高波动矛盾型': {
    expected: {
      g1Style: '审慎型', g2Style: '目标型', g3Rhythm: '审慎型', g4Style: '平衡型'
    },
    data: {
      game1: { gameId:'game1', dimensions:{ nAch:5.2, nPow:4.5, nAff:3.8 }, decisions:[{ scenarioId:'s1', chosenOptionId:'s1_c', decisionTime:1500 },{ scenarioId:'s2', chosenOptionId:'s2_a', decisionTime:7200 },{ scenarioId:'s3', chosenOptionId:'s3_a', decisionTime:2100 },{ scenarioId:'s4', chosenOptionId:'s4_b', decisionTime:5600 },{ scenarioId:'s5', chosenOptionId:'s5_a', decisionTime:2600 }], meta:{ totalTime:19000, elapsedMs:70000, decisionCount:5, scenarioIds:['s1','s2','s3','s4','s5'] } },
      game2: { gameId:'game2', dimensions:{ TF:3.5, GM:7.0, AU:6.5, SE:4.0, EC:3.0, SV:5.5, CH:4.5, LS:4.0 }, behaviorSummary:{ primaryAnchor:'GM', secondaryAnchor:'AU', bottomAnchor:'EC' }, meta:{ cardsFlipped:5, stage1Kept:6 } },
      game3: { gameId:'game3', dimensions:{ wholistAnalytic:-0.35 }, behaviorSummary:{ dominantStyle:'整体型', flexibility:4.0, impulseScore:3.5 }, meta:{ stage1Time:22000, stage2Time:19000, greenCount:4, yellowCount:2, redCount:2 } },
      game4: { gameId:'game4', dimensions:{ presence:4.8, search:6.5 }, decisions:[ { scenarioId:'s1', reactionTimeMs:5100, reactionOneMs:3100, reactionTwoMs:2000 },{ scenarioId:'s2', reactionTimeMs:5800, reactionOneMs:3800, reactionTwoMs:2000 },{ scenarioId:'s3', reactionTimeMs:6200, reactionOneMs:4300, reactionTwoMs:1900 },{ scenarioId:'s4', reactionTimeMs:4900, reactionOneMs:2800, reactionTwoMs:2100 },{ scenarioId:'s5', reactionTimeMs:5400, reactionOneMs:3500, reactionTwoMs:1900 },{ scenarioId:'s6', reactionTimeMs:4500, reactionOneMs:2400, reactionTwoMs:2100 } ] },
    }
  }
};

console.log('='.repeat(60));
console.log('Phase 3: 行为叙事阈值验证');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

for (const [name, profile] of Object.entries(PROFILES)) {
  console.log(`\n--- ${name} ---`);
  console.log(`预期: G1=${profile.expected.g1Style} G2=${profile.expected.g2Style} G3=${profile.expected.g3Rhythm} G4=${profile.expected.g4Style}`);

  const bn = extractBehaviorNarrative(profile.data);

  let allOk = true;

  // G1
  if (bn.g1) {
    const g1 = bn.g1;
    const ok = g1.decisionStyle === profile.expected.g1Style;
    console.log(`  G1: ${g1.decisionStyle} ${ok ? '✅' : '❌ 预期'+profile.expected.g1Style} (avg=${(g1.avgTimeMs/1000).toFixed(1)}s, var=${g1.timeVariance}, trend=${g1.trend})`);
    if (!ok) allOk = false;
  }

  // G2
  if (bn.g2) {
    const g2 = bn.g2;
    const ok = g2.explorationStyle === profile.expected.g2Style;
    // compute flipRatio manually for debugging
    const flipRatio = g2.cardsSelected > 0 ? g2.cardsFlipped / g2.cardsSelected : 0;
    console.log(`  G2: ${g2.explorationStyle} ${ok ? '✅' : '❌ 预期'+profile.expected.g2Style} (flip=${g2.cardsFlipped}, kept=${g2.cardsSelected}, ratio=${flipRatio.toFixed(2)}, gap=${g2.anchorGap})`);
    if (!ok) allOk = false;
  }

  // G3
  if (bn.g3) {
    const g3 = bn.g3;
    const ok = g3.cognitiveRhythm === profile.expected.g3Rhythm;
    console.log(`  G3: ${g3.cognitiveRhythm} ${ok ? '✅' : '❌ 预期'+profile.expected.g3Rhythm} (impulse=${g3.impulseScore}, s1=${g3.stage1Sec}s, s2=${g3.stage2Sec}s)`);
    if (!ok) allOk = false;
  }

  // G4
  if (bn.g4) {
    const g4 = bn.g4;
    const ok = g4.meaningStyle === profile.expected.g4Style;
    console.log(`  G4: ${g4.meaningStyle} ${ok ? '✅' : '❌ 预期'+profile.expected.g4Style} (gap=${g4.presenceSearchGap})`);
    if (!ok) allOk = false;
  }

  if (allOk) {
    passed++;
  } else {
    failed++;
    console.log('  💡 交互叙事:', formatBehaviorNarrative(bn).split('\n').join('\n       '));
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`结果: ${passed}/${passed+failed} 通过, ${failed} 失败`);
console.log(`${'='.repeat(60)}`);
