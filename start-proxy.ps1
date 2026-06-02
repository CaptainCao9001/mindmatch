# MindMatch 本地 API 代理启动脚本
# 解决浏览器 CORS 限制，让前端能调用混元 API

$nodePath = "C:\Users\27653\.workbuddy\binaries\node\versions\22.22.2\node.exe"
$proxyPath = "H:\program\mindmatch-demo\server\proxy.js"

Write-Host "========================================="
Write-Host "  MindMatch API 代理启动器"
Write-Host "========================================="
Write-Host ""

# 检查 Node.js
if (-not (Test-Path $nodePath)) {
    Write-Host "错误：找不到 Node.js，路径: $nodePath" -ForegroundColor Red
    exit 1
}

# 检查代理脚本
if (-not (Test-Path $proxyPath)) {
    Write-Host "错误：找不到代理脚本，路径: $proxyPath" -ForegroundColor Red
    exit 1
}

Write-Host "启动代理服务器..." -ForegroundColor Cyan
Write-Host "端口: 8100"
Write-Host "代理目标: api.hunyuan.cloud.tencent.com"
Write-Host ""

# 启动代理（保持前台运行）
& $nodePath $proxyPath
