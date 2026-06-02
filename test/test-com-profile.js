// 快速验证：沟通型用户剖面
import { match } from '../js/layers/matcher.js';
import { readFileSync } from 'fs';

const profile = {
  userId: 'test-com',
  generatedAt: Date.now(),
  dimensions: {
    nAch: 0.55, nPow: 0.72, nAff: 0.85,
    TF: 0.25, GM: 0.75, AU: 0.35, SE: 0.50,
    EC: 0.55, SV: 0.85, CH: 0.50, LS: 0.55,
    wholistAnalytic: 0.45,
    presence: 0.75, search: 0.50,
  },
  raw: {},
  meta: { totalDuration: 0, completedGames: ['g1','g2','g3','g4'], completedCount: 4, allCompleted: true },
};

const jobsData = JSON.parse(readFileSync(new URL('../mock/ideal-profiles.json', import.meta.url)));
const report = match(profile, jobsData.jobs);

console.log('=== 沟通型用户测试 ===');
console.log(`剖面: nAff=${profile.dimensions.nAff} nPow=${profile.dimensions.nPow} SV=${profile.dimensions.SV} GM=${profile.dimensions.GM}`);
report.ranking.forEach((r, i) => {
  console.log(`  ${i+1}. ${r.jobName} ${r.jobIcon} → ${r.score}% (线性:${r.linearScore})`);
});

if (report.ranking[0].jobId === 'communication') {
  console.log('✅ 沟通型用户正确匹配到沟通型岗位');
} else {
  console.log(`⚠️ 沟通型用户排名第一是 ${report.ranking[0].jobName}，可能权重需调整`);
}
