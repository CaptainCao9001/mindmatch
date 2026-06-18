# MindMatch 云端部署指南

## 当前架构问题

本地开发依赖两个服务：

| 服务 | 端口 | 用途 |
|---|---|---|
| Python HTTP Server | 8090 | 静态文件托管 |
| Node.js Proxy | 8100 | 转发 API 请求绕过 CORS |

CloudBase 静态托管**只能托管静态文件**，无法运行 Node.js proxy（端口 8100）。

## 解决方案：云函数代理

已创建 `cloudfunctions/proxy/`，与本地 `server/proxy.js` 接口完全一致。

### 部署步骤

> **前提**：确保 `tcb` CLI 已安装且已登录
> ```bash
> # Git Bash 下检查
> /c/Users/27653/.workbuddy/binaries/node/versions/22.22.2/tcb --version
> ```

#### 方法一：tcb CLI 部署（推荐）

```bash
cd /h/program/mindmatch-demo

# 1. 确保在项目目录
pwd

# 2. 部署云函数
/c/Users/27653/.workbuddy/binaries/node/versions/22.22.2/tcb fn deploy proxy \
  --envId mindmatch-d0gz847n4e29e3181 \
  --path ./cloudfunctions/proxy \
  --runtime Nodejs18.15

# 3. 创建 HTTP 触发器，获取函数 URL
# 在腾讯云控制台 → 云函数 → proxy → 触发管理 → 创建 HTTP 触发器
# 记下触发器 URL，格式如: https://mindmatch-xxx.ap-shanghai.....
```

#### 方法二：控制台手动创建

1. 打开 [腾讯云 CloudBase 控制台](https://console.cloud.tencent.com/tcb)
2. 进入 `mindmatch-d0gz847n4e29e3181` 环境
3. 左侧菜单 → 云函数 → 新建云函数
4. 函数名：`proxy`
5. 运行时：`Node.js 18.15`
6. 上传 `cloudfunctions/proxy/index.js` 为入口文件
7. 创建 HTTP 触发器
8. 获得触发 URL

### 配置前端使用云函数

1. 将云函数 URL 填入 api.js：
   ```js
   // 在浏览器控制台运行，或添加到初始化代码：
   import('./js/core/api.js').then(m => {
     m.setCloudFunctionUrl('https://你的云函数URL');
   });
   ```

2. 或者在 `results.html` 的 `<head>` 中添加：
   ```html
   <script>
   window.__MM_CLOUD_FN__ = 'https://你的云函数URL';
   </script>
   ```

### 验证

1. 部署云函数后，访问 `https://你的云函数URL/health`
2. 应返回 `{"status":"ok","env":"cloud-function",...}`
3. CloudBase 上的 MindMatch 页面点击 AI 解读按钮，应正常生成

## 备选方案

如果云函数部署有困难，可以使用以下备选：

### 方案 B：直连模式（仅限支持的浏览器 + CORS）

部分 LLM API 支持跨域调用。尝试设置 `useProxy: false`：

```js
import('./js/core/api.js').then(m => {
  m.configure({ useProxy: false });
});
```

### 方案 C：第三方 CORS 代理

使用免费 CORS 代理服务（不推荐用于生产，仅用于 Demo 演示）。

---

## 本地开发保持

本地开发无需改变：
1. `python -m http.server 8090` — 静态文件
2. `node server/proxy.js` — API 代理

访问 `http://localhost:8090` 即可。
