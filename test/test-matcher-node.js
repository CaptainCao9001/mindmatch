// 匹配引擎独立测试 — 用 Node.js 运行，不依赖浏览器 DOM
import { match } from '../js/layers/matcher.js';
import { readFileSync } from 'fs';

// 模拟 integrator 输出的 UnifiedProfile（4 游戏全部完成）
const profile = {
  userId: 'test-001',
  generatedAt: Date.now(),
  dimensions: {
    // G1: nAch 偏高 (成就驱动), nAff 中等, nPow 低
    nAch: 0.85,   // 高成就
    nPow: 0.25,   // 低权力
    nAff: 0.55,   // 中等亲和
    // G2: TF 高 (技术职能), EC 高 (创业), SV 低
    TF: 0.88,
    GM: 0.35,
    AU: 0.60,
    SE: 0.50,
    EC: 0.78,
    SV: 0.20,
    CH: 0.65,
    LS: 0.45,
    // G3: 偏分析型
    wholistAnalytic: 0.82,
    // G4: 寻求意义偏高, 拥有意义中等
    presence: 0.55,
    search: 0.75,
  },
  raw: {},
  meta: {
    totalDuration: 120000,
    completedGames: ['game1', 'game2', 'game3', 'game4'],
    completedCount: 4,
    allCompleted: true,
  },
};

// 加载岗位配置
const jobsData = JSON.parse(
  readFileSync(new URL('../mock/ideal-profiles.json', import.meta.url))
);

console.log('\n=== 用户剖面 ===');
console.log(JSON.stringify(profile.dimensions, null, 2));

console.log('\n=== 运行匹配引擎 ===');
const report = match(profile, jobsData.jobs);

console.log('\n=== 最终排名 ===');
report.ranking.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.jobName} ${r.jobIcon}`);
  console.log(`     综合得分: ${r.score}%`);
  console.log(`     TOPSIS 贴近度: ${(r.topsisCloseness * 100).toFixed(1)}%`);
  console.log(`     线性得分: ${r.linearScore}`);
  console.log(`     分解: G1=${r.breakdown.G1}% G2=${r.breakdown.G2}% G3=${r.breakdown.G3}% G4=${r.breakdown.G4}%`);
  console.log(`     ${r.jobSlogan}`);
  console.log('');
});

console.log(`需 AI 审核: ${report.needsAIReview ? '是' : '否'}`);
console.log(`轨道数量: ${report.tracks.linear.length} 线性 + ${report.tracks.topsis.length} TOPSIS`);

// 验证：分析型应该排第一或第二（nAch高 + TF高 + wholistAnalytic高）
const topJob = report.ranking[0];
if (topJob.jobId === 'analytical' || topJob.jobId === 'technical') {
  console.log('\n✅ 验证通过：用户高成就+高技术+偏分析型 → 分析型/技术型排名靠前');
} else {
  console.log(`\n⚠️ 意外结果：排名第一是 ${topJob.jobName}，预期分析型或技术型`);
}
