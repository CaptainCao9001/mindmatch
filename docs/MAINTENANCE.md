# MindMatch 维护说明

> **版本**: v1.0-submission (2026-06-10)

---

## 一、环境信息

| 项目 | 值 |
|------|------|
| CloudBase 环境 ID | `mindmatch-d0gz847n4e29e3181` |
| 线上地址 | `https://mindmatch-d0gz847n4e29e3181-1438477634.tcloudbaseapp.com` |
| 云函数域名 | `https://mindmatch-d0gz847n4e29e3181.service.tcloudbase.com` |
| 本地开发端口 | 前端 5500（Live Server）/ 代理 8100 |

---

## 二、部署流程

### 前置条件

```bash
# 安装 tcb CLI
npm install -g @cloudbase/cli

# 登录（首次）
tcb login
```

### 部署静态文件（HTML/CSS/JS）

```bash
cd h:/program/mindmatch-demo

# 单文件部署
npx tcb hosting deploy match.html -e mindmatch-d0gz847n4e29e3181

# 目录部署
npx tcb hosting deploy css/ -e mindmatch-d0gz847n4e29e3181
npx tcb hosting deploy js/ -e mindmatch-d0gz847n4e29e3181

# 全量部署（HTML + CSS + JS）
npx tcb hosting deploy . -e mindmatch-d0gz847n4e29e3181
```

### 部署云函数

```bash
cd h:/program/mindmatch-demo

# 1. 先同步 agent-v2 代码到 cloudfunctions/agent/
#    cloudfunctions/agent/ 是 agent-v2/ 的部署副本
#    修改 agent-v2/ 后需手动复制或同步

# 2. 部署云函数
npx tcb fn deploy agent -e mindmatch-d0gz847n4e29e3181
npx tcb fn deploy proxy -e mindmatch-d0gz847n4e29e3181
```

### ⚠️ CDN 缓存问题（必读）

CloudBase CDN 缓存较重，修改 CSS/JS 后**必须**：

1. **更新版本号**：修改 `window.__MM_VER__` 的值（如 `20260610d` → `20260610e`）
2. **更新所有引用**：HTML 中 CSS `<link>` 和 JS `import` 的 `?v=` 参数
3. **重新部署 HTML 文件**：即使只改了 CSS，HTML 中的 `?v=` 变了也需要重传

**如果 `tcb hosting deploy` 没有覆盖旧文件**：

```bash
# 先删除云端旧文件，再重新上传
npx tcb hosting delete css/match.css -e mindmatch-d0gz847n4e29e3181
npx tcb hosting deploy css/match.css css/match.css -e mindmatch-d0gz847n4e29e3181
```

---

## 三、环境变量配置

### 云函数 `agent`

在 CloudBase 控制台 → 云函数 → agent → 配置 → 环境变量：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API Key（主 LLM） |
| `HUNYUAN_API_KEY` | ✅ | 混元 API Key（fallback LLM） |

### 云函数 `proxy`

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `HUNYUAN_API_KEY` | ✅ | 混元 API Key |
| `DEEPSEEK_API_KEY` | 推荐 | DeepSeek API Key |

### 本地开发

本地开发时 API Key 存储在浏览器 `localStorage`：
- `mindmatch_api_keys` → `{ hunyuanKey, deepseekKey }`
- 通过 `tools/setup-api.html` 页面配置

---

## 四、版本号更新规则

当前版本号策略：`YYYYMMDD` + 字母后缀（如 `20260610d`）。

### 更新步骤

1. 确定新版本号（如 `20260610e`）
2. 在以下文件中全局替换旧版本号 → 新版本号：

| 文件 | 需替换的位置 |
|------|-------------|
| `match.html` | `__MM_VER__` + 3个 CSS `<link>` + 8个 JS `import` + 1个 `fetch` |
| `results.html` | `__MM_VER__` + 3个 CSS `<link>`（JS 用动态 `${VER}` 自动继承） |
| `career-guide.html` | `__MM_VER__` + 3个 CSS `<link>` + 2个 JS `import` |
| `export-report.html` | 独立版本号 `?v=export2`，按需更新 |

3. 重新部署所有修改过的 HTML 文件

### 快速替换命令

```bash
# 以 20260610d → 20260610e 为例
cd h:/program/mindmatch-demo
# Windows PowerShell
Get-ChildItem match.html,results.html,career-guide.html | ForEach-Object {
  (Get-Content $_.FullName -Raw) -replace '20260610d','20260610e' | Set-Content $_.FullName -NoNewline
}
```

---

## 五、Agent v2 维护

### 代码同步

`agent-v2/` 是源码目录，`cloudfunctions/agent/` 是部署目录。修改 `agent-v2/` 后需同步：

```bash
# 手动复制（注意排除 sessions 文件）
cp agent-v2/*.mjs cloudfunctions/agent/
cp agent-v2/*.js cloudfunctions/agent/
cp -r agent-v2/prompt/ cloudfunctions/agent/prompt/
```

### 4 阶段对话流程

| 阶段 | ID | 标签 | 目的 |
|------|------|------|------|
| 1 | 探索期 | 自由探索 | 了解用户的兴趣、价值观 |
| 2 | 深挖期 | 聚焦深挖 | 追问核心动机、关键经历 |
| 3 | 确认期 | 交叉验证 | 验证推断、消除矛盾 |
| 4 | 收束期 | 归纳收束 | 总结人格画像、准备生成 |

### 工具（Function Calling）

| 工具 | 用途 |
|------|------|
| `save_collected` | 从用户回答提取关键字段 + 深度评级 |
| `advance_phase` | 推进到下一对话阶段 |

### Fallback 策略

```
DeepSeek 调用成功 → 正常流程（含 Function Calling）
DeepSeek 失败 → 尝试混元（纯对话，无 FC，直接返回文本回复）
两者都失败 → 返回错误提示
```

---

## 六、常见问题排查

### 1. 页面样式不对 / 新功能没生效

**症状**：改了 CSS 但线上没变化，或新 HTML 元素没有样式

**排查**：
1. 确认版本号是否更新（`__MM_VER__` + `?v=` 参数）
2. 确认 HTML 文件是否重新部署（即使只改 CSS）
3. 用无痕窗口 + `?v=新版本号` 验证
4. 如果 `tcb hosting deploy` 没覆盖 → 先 `delete` 再 `deploy`

```bash
# 验证线上 CSS 内容
curl -s "https://mindmatch-d0gz847n4e29e3181-1438477634.tcloudbaseapp.com/css/match.css?v=版本号" | grep "目标类名"
```

### 2. AI 对话无响应 / 报错

**排查**：
1. 检查云函数日志：CloudBase 控制台 → 云函数 → agent → 日志
2. 检查 API Key 是否有效
3. 检查云函数环境变量是否配置
4. 健康检查：`curl https://mindmatch-d0gz847n4e29e3181.service.tcloudbase.com/proxy/health`

### 3. DeepSeek 频繁超时

**现象**：Agent 对话经常 fallback 到混元

**处理**：
1. 混元 fallback 是正常保底机制，不影响核心功能
2. 如需改善：在 `config.mjs` 中增大 `API_TIMEOUT_MS`
3. DeepSeek 高峰期不稳定是已知问题

### 4. 导出报告空白

**排查**：
1. 确认从肖像页/匹配页点击「导出报告」时数据已打包到 `localStorage`
2. 在 export-report.html 打开浏览器控制台，检查 `localStorage['mindmatch_export_data']`
3. 确认 html2pdf.js 和 html2canvas CDN 可访问

### 5. 冷启动 thinking 文字不动

**症状**：对话页 loading 文字一直显示"AI 正在思考"

**排查**：
1. `chat-renderer.js` 中 `showThinking()` 维护 3 个定时器（0s/3s/8s）
2. 如果文字不切换 → 检查 JS 是否加载成功（版本号问题）
3. 如果一直转圈 → 后端 API 不通，检查云函数状态

---

## 七、本地开发

```bash
cd h:/program/mindmatch-demo

# 启动 Agent v2 本地服务（端口 8100）
node agent-v2/server.mjs

# 启动前端（Live Server 或任意静态服务器，端口 5500）
# 访问 http://localhost:5500/index.html

# 配置 API Key
# 访问 http://localhost:5500/tools/setup-api.html
```

### 本地 vs 云端差异

| 项目 | 本地 | 云端 |
|------|------|------|
| API Key 来源 | localStorage | 云函数环境变量 |
| LLM 代理 | localhost:8100 | 云函数 proxy |
| Agent 引擎 | agent-v2/server.mjs | 云函数 agent |
| 对话模式 | DeepSeek FC + 混元 fallback | 同 |

---

## 八、备份与回滚

### Git 版本管理

```bash
# 当前提交版本
git tag -l                    # 查看所有 tag
git log --oneline -5          # 查看最近提交

# 回滚到上交版本
git checkout v1.0-submission

# 查看某次提交的改动
git show d4b8d74 --stat
```

### 重新部署历史版本

```bash
# 1. 切到目标版本
git checkout v1.0-submission

# 2. 重新部署
npx tcb hosting deploy . -e mindmatch-d0gz847n4e29e3181
npx tcb fn deploy agent -e mindmatch-d0gz847n4e29e3181
npx tcb fn deploy proxy -e mindmatch-d0gz847n4e29e3181

# 3. 切回开发分支
git checkout main
```

---

## 九、监控与告警

当前无自动监控。建议关注：

1. **DeepSeek API 可用率**：Agent fallback 频率反映 DeepSeek 稳定性
2. **云函数执行时长**：agent 超时阈值 60s，proxy 30s
3. **CDN 缓存命中率**：版本号更新后用户是否加载到新资源
4. **localStorage 容量**：导出报告打包数据约 10-50KB，不会溢出

---

## 十、安全注意事项

1. **API Key 严禁提交到 Git**：`.gitignore` 已排除 `.env` 文件
2. **云函数环境变量**：通过 CloudBase 控制台管理，不要硬编码
3. **CORS 配置**：当前 proxy 云函数允许所有来源（`*`），生产环境建议限制域名
4. **localStorage 数据**：仅存储用户画像和匹配结果，不含敏感信息
