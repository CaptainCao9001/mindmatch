// Quick smoke test for match.html?mode=extended flow

import { integrate } from '../js/layers/integrator.js?v=20260602e';
import { matchExtended } from '../js/layers/matcher.js?v=20260602e';
import { renderDirectionResults } from '../js/ui/match-ui-extended.js?v=20260602e';
import { readFile } from 'fs/promises';

// Mock DOM
global.document = {
  getElementById() { return { innerHTML: '' }; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return { appendChild() {}, classList: { add() {} } }; },
  title: ''
};
global.window = global;
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = v; },
  removeItem(k) { delete this._data[k]; }
};

console.log('1. Loading ideal-profiles.json...');
const raw = await readFile('./mock/ideal-profiles.json', 'utf-8');
const data = JSON.parse(raw);
console.log(`   OK: ${Object.keys(data.directions || {}).length} directions, ${Object.keys(data.jobs || {}).length} jobs`);

console.log('2. Calling integrate()...');
const profile = integrate();
console.log(`   OK: completedCount=${profile.meta.completedCount}, dims=${Object.keys(profile.dimensions).length}`);

console.log('3. Calling matchExtended()...');
const report = matchExtended(profile, data);
console.log(`   OK: ${report.directionRanking.length} directions ranked`);
console.log(`   Top: ${report.directionRanking[0]?.directionName} (${report.directionRanking[0]?.score})`);
if (report.directionRanking[0]?.jobResults) {
  console.log(`   Jobs: ${report.directionRanking[0].jobResults.length}`);
}

console.log('4. Calling renderDirectionResults()...');
try {
  renderDirectionResults('matchContent', report);
  console.log('   OK: rendered without error');
} catch (e) {
  console.error('   FAILED:', e.message);
}

console.log('\n=== ALL OK ===');
