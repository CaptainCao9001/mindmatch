<div align="center">

# MindMatch

**AI 驱动的职业方向测评系统**

基于心理学量表与游戏化行为采集，帮你找到更适合自己的职业方向

[🌐 在线体验](https://mindmatch-d0gz847n4e29e3181-1438477634.tcloudbaseapp.com) · [📄 项目文档](MindMatch/docs/competition/mindmatch-competition-doc.md)

</div>

---

## 是什么

MindMatch 是一款职业方向测评工具。它的核心逻辑是：**通过游戏化设计采集用户真实的行为模式**（反应速度、选择序列、决策节奏），而不是让用户直接填问卷——从而生成更客观的 14 维人格画像，再通过双轨匹配算法排序 6 个职业大方向 × 54 个具体职业，最后用 AI Agent 进行个性化解读和行动建议。

**和 MBTI/霍兰德的区别**：不只给标签，而是通过过程数据认识自己，结合实际情况给出可执行的方向建议。

---

## 功能模块

```
4 款游戏化测评
  G1 核心驱动力  (McClelland 三动机)
  G2 职业锚      (Schein 八锚理论)
  G3 认知风格    (Riding CSA)
  G4 意义建构    (Steger MLQ)
        ↓
14 维行为画像 + 行为叙事
        ↓
双轨匹配引擎
  线性加权 + 高斯核 (σ=0.20)
  TOPSIS 多准则决策
  6 方向 × 54 职业 两级匹配
        ↓
AI Agent 四阶段对话
  结果共鸣 → 深度挖掘 → 现实校准 → 行动地图
        ↓
个性化报告（支持导出 PDF/图片）
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | 纯 HTML / CSS / JavaScript（ES Modules），零构建工具 |
| 架构 | `core / games / layers / ui` 四层分离，50+ 源文件 |
| AI | DeepSeek API（主）+ 腾讯混元（Fallback） |
| 后端 | Node.js + 腾讯云 SCF 云函数（API 代理） |
| 部署 | 腾讯云 CloudBase 静态托管 + CDN |
| 数据 | localStorage（浏览器端，无需账号） |

---

## 本地运行

```bash
# 启动静态文件服务
cd MindMatch
python -m http.server 8090
# 访问 http://localhost:8090
```

> ⚠️ 必须通过 HTTP Server 打开，不能直接 `file://` 双击（ES Modules 跨域限制）

**AI 功能本地调试**（需要 API Key）：

```bash
cd MindMatch
node agent-v2/main.js   # 端口 8101
```

**环境变量**（本地 `.env` 或 SCF 控制台配置）：

```
DEEPSEEK_API_KEY=your_key_here
HUNYUAN_API_KEY=your_key_here
```

---

## 项目结构

```
mindmatch/
├── README.md
├── .gitignore
└── MindMatch/
    ├── index.html              # 首页
    ├── match.html              # 职业匹配页
    ├── results.html            # 肖像页（14 维雷达图）
    ├── career-guide.html       # AI Agent 对话入口
    ├── css/                    # 样式表
    ├── games/                  # 4 款游戏页面 + 图片素材
    ├── js/
    │   ├── core/               # 基础设施（store / api / utils）
    │   ├── games/              # 游戏引擎 + 数据 + 策略
    │   ├── layers/             # 数据计算层（积分器 / 匹配 / 翻译）
    │   ├── ui/                 # UI 渲染层
    │   ├── agent/              # 前端 Agent 集成
    │   └── data/               # 职业数据 + 技能路径
    ├── agent-v2/               # AI Agent v2（本地开发版）
    ├── cloudfunctions/         # SCF 云函数（生产部署版）
    │   ├── proxy/              # DeepSeek/混元 API 代理
    │   └── agent/              # Agent 对话云函数
    ├── server/                 # 本地开发代理
    ├── tools/                  # 开发辅助工具
    └── docs/
        ├── competition/        # 竞赛文档 + 简历参考资料
        ├── design/             # 设计方案 / 架构文档
        └── *.md                # 项目说明 / 维护 / 部署指南
```

---

## 算法简介

### 双轨匹配引擎

**轨道一 — 线性加权 + 高斯核**

$$
\text{match}(a, i) = \exp\!\left(-\frac{(a - i)^2}{2\sigma^2}\right),\quad \sigma = 0.20
$$

用连续核函数代替阶跃函数，消除硬截断决策死区。两阶段加权消解游戏间维度数量不平衡。

**轨道二 — TOPSIS**

从"整体剖面距离"角度评估，对维度间协调性更敏感，与线性加权形成互补交叉验证。

**后处理**：对比度拉伸（K=1.4）扩大方向间分数差异；两轨结果不一致时触发 AI 审核标记。

---

## 现状与局限

- 当前为 demo 阶段，匹配逻辑与 Agent 对话流程已完成端到端验证
- 内部小范围测试：方向匹配与用户自评吻合度约 70-75%，Agent 对话完成率约 80%
- 匹配准确度需更多真实用户数据持续校准优化

---

## License

MIT
