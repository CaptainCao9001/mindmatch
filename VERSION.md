# MindMatch v2.0 — 匹配引擎重构版

**存档时间**: 2026-06-02 01:30 GMT+8
**版本号**: 20260602e
**状态**: 已上线，核心匹配算法全面重构

## 上线地址

```
https://mindmatch-d0gz847n4e29e3181-1438477634.tcloudbaseapp.com
```

## v2.0 核心变更（相对 v1.0）

### 匹配算法重构（6 项）

| # | 变更 | 说明 |
|---|------|------|
| 1 | 高斯核替代阶跃函数 | `mapSubDimension()` 死区 → `gaussianMatch(actual, ideal, sigma=0.25)`，连续平滑匹配 |
| 2 | ideal 字段激活 | ideal 从注释变为"最佳匹配点"，高斯核以此为中心衰减 |
| 3 | Top1-3 方向展开 | 职业详情不再仅限 Top1 方向，Top2/3 可折叠查看 |
| 4 | 两阶段权重体系 | Phase1 游戏内归一化 + Phase2 gameWeights 跨游戏加权，解决 G2 八维碾压 G3 一维问题 |
| 5 | 排名徽章修正 | 卡片按 linearScore 排序后用 `idx+1` 显示排名，而非 topsisRank（双引擎排名不一致时错位） |
| 6 | TOPSIS 权重传递 | 沿用首职业权重（影响降低，因高斯核已修复核心匹配逻辑） |

### UI/UX 改进（3 项）

| # | 变更 | 说明 |
|---|------|------|
| 7 | 完成度提示横幅 | 迁移至 results.html（match.html 必须 4/4 才能进入，横幅放那里永不触发） |
| 8 | G2 卡片选中效果修复 | 印章移入 front/back 面，选中态作用于双面 |
| 9 | G1/G2/G3 游戏视觉主题 | 各游戏独立配色方案 |

### 版本号机制强化

- `window.__MM_VER__` 统一为 `20260602e`
- 所有跨文件引用（HTML/CSS/JS/fetch/动态 import）均加 `?v=` 版本号
- 一键部署: `bash tools/bump-version.sh <新版本号>`

## 架构总览

```
用户游戏数据 (localStorage)
       │
       ▼
  integrator.js ─── 14 维 UnifiedProfile
       │
       ├─► translator.js ──→ 肖像文本 (TranslationResult)
       │         │
       │         └─► portrait.js + charts.js ──→ results.html
       │         └─► insight.js ──→ AI 深度解读
       │
       └─► matcher.js ──→ matchExtended()
                 │
                 ├─► matcher_extended.js
                 │     ├─► directionMatch() ── 6 方向匹配
                 │     └─► jobMatch() ── 54 职业匹配
                 │           │
                 │           ├─► matcher_linear.js (主引擎)
                 │           │     ├─ gaussianMatch() 高斯核
                 │           │     ├─ _phase1GameScore() 游戏内归一化
                 │           │     └─ linearScoreForJob() 两阶段加权
                 │           │
                 │           └─► matcher_topsis.js (辅引擎)
                 │                 └─ gaussianMatch() 高斯核
                 │
                 └─► match-ui-extended.js ──→ match.html
```

## 数据模型

### 14 维度 → 4 游戏分组

| 游戏 | 维度 | 维度数 |
|------|------|:------:|
| G1 核心驱动力 | nAch, nPow, nAff | 3 |
| G2 职业锚 | TF, GM, AU, SE, EC, SV, CH, LS | 8 |
| G3 认知风格 | wholistAnalytic | 1 |
| G4 意义建构 | presence, search | 2 |

### 6 方向 × 9 职业（54 个）

| 方向 | 典型职业 |
|------|---------|
| 系统建构者 | 架构师、CTO、系统分析师... |
| 深度解读者 | 研究员、数据科学家、心理咨询师... |
| 创意塑造者 | 产品经理、UX 设计师、创意总监... |
| 人际联结者 | HR、社工、教练... |
| 价值驱动者 | 社会企业家、政策分析师、公益项目官... |
| 赋能陪伴者 | 教师、培训师、职业顾问... |

### 两阶段匹配公式

```
Phase 1 — 游戏内归一化:
  gameScore_g = Σ(profile[dim] × profile.weight[dim]) / Σ(weight[dim])   ∈ [0, 1]

Phase 2 — 跨游戏加权:
  finalScore = Σ(gameScore_g × gameWeights[g]) × 100                     ∈ [0, 100]
```

### 高斯核匹配函数

```
gaussianMatch(actual, ideal, σ=0.25) = exp(-(actual - ideal)² / (2σ²))
```

- actual=ideal 时 match=1.0（完美匹配）
- 差距 0.25 时 match≈0.61
- 差距 0.5 时 match≈0.14
- 可通过 per-dimension `bandwidth` 字段覆盖全局 σ

## 技术栈

- 纯 HTML/CSS/JS + ES Modules，零构建
- CloudBase 静态网站托管 + SCF 云函数代理
- 混元 API（hunyuan-lite），服务端 Key 管理
- ECharts 5 (CDN) 图表渲染
- localStorage 唯一数据桥梁

## 部署信息

| 项目 | 值 |
|------|-----|
| CloudBase 环境 ID | `mindmatch-d0gz847n4e29e3181` |
| 线上域名 | `https://mindmatch-d0gz847n4e29e3181-1438477634.tcloudbaseapp.com` |
| 云函数 API | `https://mindmatch-d0gz847n4e29e3181.service.tcloudbase.com/proxy` |
| CLI 工具 | `tcb` v3.5.3 |

### 部署命令

```bash
cd /h/program/mindmatch-demo
tcb hosting deploy ./index.html index.html -e mindmatch-d0gz847n4e29e3181
tcb hosting deploy ./results.html results.html -e mindmatch-d0gz847n4e29e3181
tcb hosting deploy ./match.html match.html -e mindmatch-d0gz847n4e29e3181
tcb hosting deploy ./css css -e mindmatch-d0gz847n4e29e3181
tcb hosting deploy ./js js -e mindmatch-d0gz847n4e29e3181
tcb hosting deploy ./games games -e mindmatch-d0gz847n4e29e3181
```

## v1.0 → v2.0 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `js/layers/matcher_linear.js` | 重写 | gaussianMatch + _phase1GameScore + 两阶段 linearScoreForJob |
| `js/layers/matcher_topsis.js` | 重写 | mapSubDimension → gaussianMatch |
| `js/layers/matcher.js` | 修改 | matchExtended Top1-3 展开 |
| `js/layers/matcher_extended.js` | 修改 | 版本号更新 |
| `js/ui/match-ui-extended.js` | 修改 | Top2/3 折叠 + 移除无效横幅 |
| `js/ui/match-ui.js` | 修改 | 辅助函数改 export |
| `match.html` | 修改 | 版本号 + 移除 completedCount 参数 |
| `results.html` | 修改 | 完成度横幅 + 版本号 |
| `css/match.css` | 修改 | 移除旧横幅样式 |
| `css/results.css` | 修改 | 新增横幅样式 |
| `js/games/strategies/discard.js` | 修改 | G2 印章位置修复 |
| `games/game2-career-anchor.html` | 修改 | G2 CSS 选中效果修复 |
| 所有 HTML/JS | 修改 | 版本号统一 20260602e |

## 已知遗留问题

| # | 问题 | 优先级 | 影响 |
|---|------|--------|------|
| P1-2 | 方向画像区分度模糊（14 维中仅 7-8 维有效区分） | P1 | 6 个方向得分相近时排序不够分明 |
| P1-4 | TOPSIS 取首职业权重 | P1 | 高斯核已缓解，影响降低 |
| P2-9 | delta 只调幅度不改方向 | P2 | 职业微调粒度有限 |
| P2-10 | AI 审核触发过于敏感 | P2 | 误触发 AI 审核 |
