// P1-2 权重调整验证：方向匹配区分度测试
// 用 Node.js 运行，测试所有 synthetic users 的 6 方向得分分布
import { directionMatch } from '../js/layers/matcher_extended.js';
import { readFileSync } from 'fs';

const profilesData = JSON.parse(
  readFileSync(new URL('../mock/ideal-profiles.json', import.meta.url))
);
const usersData = JSON.parse(
  readFileSync(new URL('../mock/synthetic-users.json', import.meta.url))
);

console.log('='.repeat(60));
console.log('P1-2 权重调整后 — 方向匹配区分度验证');
console.log('='.repeat(60));

let correctCount = 0;
let avgGap = 0;

for (const user of usersData.users) {
  const profile = {
    userId: user.id,
    dimensions: user.dimensions,
    meta: { completedGames: ['game1','game2','game3','game4'], completedCount: 4, allCompleted: true },
  };

  const results = directionMatch(profile, profilesData.directions);
  const top1 = results[0];
  const top2 = results[1];
  const gap = top1.score - top2.score;
  avgGap += gap;
  const correct = top1.directionId === user.expectedTopDirection;

  if (correct) correctCount++;

  const marker = correct ? '✅' : '❌';
  console.log(`\n${marker} ${user.label} (预期: ${user.expectedTopDirection})`);
  console.log(`  Top1: ${top1.directionName} ${top1.directionIcon}  score=${top1.score}`);
  console.log(`  Top2: ${top2.directionName} ${top2.directionIcon}  score=${top2.score}`);
  console.log(`  Gap: ${gap} | Spread:${results[0].directionName}=${results[0].score} → ${results[5].directionName}=${results[5].score}`);

  // Show all 6 directions
  const line = results.map(r => `${r.directionName.slice(0,2)}:${r.score}`).join(' ');
  console.log(`  Rankings: ${line}`);
}

avgGap /= usersData.users.length;
console.log(`\n${'='.repeat(60)}`);
console.log(`Summary: ${correctCount}/${usersData.users.length} 正确 | 平均 Top1-Top2 差距 = ${avgGap.toFixed(1)}`);
console.log(`${'='.repeat(60)}`);
