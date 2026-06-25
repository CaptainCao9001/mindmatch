# MindMatch 云端上线与 GitHub 说明文档

> **版本**: v1.0-submission (2026-06-10)

---

## 一、GitHub 仓库

### 基本信息

| 项目 | 值 |
|------|------|
| 仓库地址 | https://github.com/CaptainCao9001/mindmatch |
| 分支 | `main` |
| 标签 | `v1.0-submission`（竞赛提交版）、`before-day8-test` |
| 协议 | SSH（`git@github.com:CaptainCao9001/mindmatch.git`） |
| 推送方式 | SSH 密钥认证（ed25519） |

### 克隆项目

```bash
# SSH 方式（推荐，国内更稳定）
git clone git@github.com:CaptainCao9001/mindmatch.git

# HTTPS 方式（国内可能需要代理）
git clone https://github.com/CaptainCao9001/mindmatch.git
```

### SSH 密钥配置

首次使用需将本机 SSH 公钥添加到 GitHub：

1. 检查是否已有密钥：`ls ~/.ssh/id_ed25519.pub`
2. 如无密钥，生成：`ssh-keygen -t ed25519 -C "你的用户名"`
3. 复制公钥：`cat ~/.ssh/id_ed25519.pub`
4. 打开 https://github.com/settings/keys → 「New SSH key」 → 粘贴
5. 测试连通：`ssh -T git@github.com`

### 日常提交与推送

```bash
cd mindmatch-demo

# 修改代码后
git add -A
git commit -m "描述你的改动"
git push

# 查看历史
git log --oneline -10

# 回到竞赛提交版本
git checkout v1.0-submission
```

### 仓库结构

```
mindmatch/                      ← GitHub 仓库根
├── README.md                   ← GitHub 首页展示
├── .gitignore                  ← 排除规则
└── MindMatch/                  ← 项目全部源码
    ├── index.html              ← 首页
    ├── games/                  ← 4 款游戏页面
    ├── js/                     ← 前端源码（4层架构）
    ├── agent-v2/               ← Agent v2 源码
    ├── cloudfunctions/         ← 云函数部署版
    └── docs/                   ← 文档
        ├── competition/        ← 竞赛文档 + 简历参考
        ├── design/             ← 设计/架构文档
        └── *.md                ← 项目说明/维护/部署指南
```

---

## 二、云端架构总览

MindMatch 采用**腾讯云 CloudBase** 部署，架构分三层：

| 层 | 技术 | 说明 |
|----|------|------|
| 静态托管 + CDN | CloudBase Hosting | HTML/CSS/JS/图片，全球加速 |
| API 代理 | 云函数 `proxy`（Node.js 18） | 转发 LLM API 请求，绕过 CORS |
| Agent 引擎 | 云函数 `agent`（Node.js 18） | 4 阶段对话编排 + Function Calling |

**线上地址**：https://mindmatch-d0gz847n4e29e3181-1438477634.tcloudbaseapp.com

---

## 三、云端上线流程

### 前置条件

```bash
# 安装 tcb CLI
npm install -g @cloudbase/cli

# 登录腾讯云（首次）
tcb login
```

> 环境ID：`mindmatch-d0gz847n4e29e3181`
> 所有命令都需带 `-e mindmatch-d0gz847n4e29e3181`

### 步骤 1：部署静态文件

```bash
cd mindmatch-demo/MindMatch

# 全量部署（推荐，一次搞定）
npx tcb hosting deploy . -e mindmatch-d0gz847n4e29e3181

# 按目录部署（增量更新）
npx tcb hosting deploy css/ -e mindmatch-d0gz847n4e29e3181
npx tcb hosting deploy js/ -e mindmatch-d0gz847n4e29e3181
npx tcb hosting deploy games/ -e mindmatch-d0gz847n4e29e3181

# 单文件部署
npx tcb hosting deploy match.html -e mindmatch-d0gz847n4e29e3181
```

### 步骤 2：同步并部署云函数

Agent v2 源码在 `agent-v2/`，部署版在 `cloudfunctions/agent/`。**修改 agent-v2 后必须手动同步**：

```bash
cd mindmatch-demo/MindMatch

# 同步 agent-v2 → cloudfunctions/agent
cp agent-v2/*.mjs cloudfunctions/agent/
cp agent-v2/*.js cloudfunctions/agent/
cp agent-v2/*.cjs cloudfunctions/agent/
cp -r agent-v2/prompt/ cloudfunctions/agent/prompt/

# 部署云函数
npx tcb fn deploy proxy -e mindmatch-d0gz847n4e29e3181
npx tcb fn deploy agent -e mindmatch-d0gz847n4e29e3181
```

### 步骤 3：配置环境变量

在 **CloudBase 控制台** → 云函数 → 配置 → 环境变量：

**云函数 `agent`**：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API Key（主 LLM） |
| `HUNYUAN_API_KEY` | ✅ | 混元 API Key（fallback） |

**云函数 `proxy`**：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `HUNYUAN_API_KEY` | ✅ | 混元 API Key |
| `DEEPSEEK_API_KEY` | 推荐 | DeepSeek API Key |

### 步骤 4：验证上线

```bash
# 检查页面可访问性
curl -s -o /dev/null -w "%{http_code}" https://mindmatch-d0gz847n4e29e3181-1438477634.tcloudbaseapp.com/

# 检查云函数健康
curl https://mindmatch-d0gz847n4e29e3181.service.tcloudbase.com/proxy/health
# 应返回 {"status":"ok",...}

# 用无痕浏览器完整走一遍流程：首页 → 游戏 → 肖像 → 匹配 → Agent 对话
```

---

## 四、CDN 缓存处理（必读）

CloudBase CDN 缓存较重，修改 CSS/JS 后**必须**：

1. **更新版本号**：修改 `window.__MM_VER__`（如 `20260610d` → `20260610e`）
2. **更新所有引用**：HTML 中 CSS `<link>` 和 JS `import` 的 `?v=` 参数
3. **重新部署 HTML 文件**：即使只改 CSS，HTML 中 `?v=` 变了也需重传

**如果 `tcb hosting deploy` 没覆盖旧文件**：

```bash
# 先删再传
npx tcb hosting delete css/match.css -e mindmatch-d0gz847n4e29e3181
npx tcb hosting deploy css/match.css -e mindmatch-d0gz847n4e29e3181
```

### 版本号快速替换

```powershell
# PowerShell — 以 20260610d → 20260610e 为例
cd mindmatch-demo\MindMatch
Get-ChildItem match.html,results.html,career-guide.html | ForEach-Object {
  (Get-Content $_.FullName -Raw) -replace '20260610d','20260610e' | Set-Content $_.FullName -NoNewline
}
```

### 版本号需更新的文件

| 文件 | 替换位置 |
|------|---------|
| `match.html` | `__MM_VER__` + 3个 CSS `<link>` + 8个 JS `import` + 1个 `fetch` |
| `results.html` | `__MM_VER__` + 3个 CSS `<link>` |
| `career-guide.html` | `__MM_VER__` + 3个 CSS `<link>` + 2个 JS `import` |

---

## 五、本地开发 vs 云端

| 项目 | 本地 | 云端 |
|------|------|------|
| 静态文件 | `python -m http.server 8090` | CloudBase Hosting |
| API 代理 | `node agent-v2/server.mjs`（端口 8100） | 云函数 proxy |
| Agent 引擎 | `agent-v2/` 直接运行 | 云函数 agent（从 cloudfunctions/agent/） |
| API Key 来源 | localStorage | 云函数环境变量 |

---

## 六、回滚与备份

### Git 回滚

```bash
# 查看历史版本
git tag -l
git log --oneline -10

# 回到竞赛提交版
git checkout v1.0-submission

# 回到主线继续开发
git checkout main
```

### 云端回滚

```bash
# 切到目标版本后重新全量部署
cd mindmatch-demo/MindMatch
npx tcb hosting deploy . -e mindmatch-d0gz847n4e29e3181
npx tcb fn deploy agent -e mindmatch-d0gz847n4e29e3181
npx tcb fn deploy proxy -e mindmatch-d0gz847n4e29e3181
```

---

## 七、常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 改了 CSS 线上没变化 | CDN 缓存 | 更新版本号 + 重传 HTML |
| Agent 对话无响应 | API Key / 云函数异常 | 检查控制台日志 + 环境变量 |
| DeepSeek 频繁超时 | DeepSeek 高峰期不稳定 | 混元 fallback 自动保底 |
| `git push` 报 connection refused | HTTPS 被墙 | 确认使用 SSH 协议 |
| tcb hosting deploy 没覆盖旧文件 | CDN 缓存冲突 | 先 delete 再 deploy |
