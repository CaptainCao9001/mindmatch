// ============================================================
// agent-v2/prompt/profile-context.js — 画像数据注入
// 将 profile 对象格式化为 prompt 片段
// ============================================================

/**
 * 构建画像上下文（按需注入，仅在 profile 存在时）
 * @param {object} profile - 来自前端的画像摘要
 * @returns {string}
 */
export function buildProfileContext(profile) {
  if (!profile) return '';

  const lines = [];

  lines.push('');
  lines.push('## 用户测评画像（参考使用，非结论）');
  lines.push('');

  // 核心特质
  if (profile.topNames) {
    lines.push(`**核心特质**：${profile.topNames}`);
    lines.push('');
  }

  // 突出维度
  if (profile.topDims && profile.topDims.length > 0) {
    lines.push('**突出维度**：');
    profile.topDims.forEach(d => lines.push(`- ${d.name}：${d.score}分`));
    lines.push('');
  }

  // 游戏行为摘要
  const gs = profile.gameSummaries || {};
  const summaries = [
    gs.game1 && `核心驱动力：${gs.game1.summary}`,
    gs.game2 && `职业锚：${gs.game2.summary}`,
    gs.game3 && `认知风格：${gs.game3.summary}`,
    gs.game4 && `意义建构：${gs.game4.summary}`,
  ].filter(Boolean);
  if (summaries.length > 0) {
    lines.push('**游戏测评行为摘要**（请在对话中自然引用）：');
    summaries.forEach(s => lines.push(`- ${s}`));
    lines.push('');
  }

  // 行为指标
  if (profile.behavioralNotes && profile.behavioralNotes.length > 0) {
    lines.push('**行为指标**（供你理解用户的决策风格）：');
    profile.behavioralNotes.forEach(n => lines.push(`- ${n}`));
    lines.push('');
  }

  // 匹配结果
  if (profile.topDirections && profile.topDirections.length > 0) {
    lines.push('**算法匹配结果**（双轨混合引擎计算）：');
    lines.push('');
    lines.push('Top 3 匹配方向：');
    profile.topDirections.forEach((dir, idx) => {
      lines.push(`${idx + 1}. ${dir.name} ${dir.icon || ''} — 匹配度 ${dir.score}分`);
    });
    lines.push('');

    if (profile.topJobs) {
      lines.push('每个方向下的推荐职业：');
      profile.topDirections.forEach(dir => {
        const jobs = profile.topJobs[dir.id] || profile.topJobs[dir.key] || [];
        if (jobs.length > 0) {
          lines.push(`${dir.name}：`);
          jobs.forEach((j, i) => {
            lines.push(`  ${i + 1}. ${j.name} ${j.icon || ''}（匹配度 ${j.score}分）`);
          });
        }
      });
      lines.push('');
    }
  }

  // 画像使用规则
  lines.push('### 画像使用规则');
  lines.push('1. 自然地引用测评结果，如"你测评显示出很强的成就动机，和你说的想做有挑战性的事很一致"');
  lines.push('2. 把测评结果当追问的切入点，不当结论');
  lines.push('3. **如果用户说的和画像有矛盾，相信用户说的**——用户才是自己人生的专家');
  lines.push('4. ❌ 不要直接说"你的匹配结果是XXX"——太生硬，像算命');

  return lines.join('\n');
}
