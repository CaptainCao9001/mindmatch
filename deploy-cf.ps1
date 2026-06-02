# ============================================================
# MindMatch CloudBase 云函数部署脚本
# 在项目根目录 (mindmatch-demo) 运行此脚本
# ============================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MindMatch CloudBase 云函数部署" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$envId = "mindmatch-d0gz847n4e29e3181"
$tcb = "C:\Users\27653\.workbuddy\binaries\node\versions\22.22.2\tcb.cmd"

# 检查 tcb CLI 是否存在
if (-not (Test-Path $tcb)) {
    Write-Host "[ERROR] tcb CLI 未找到: $tcb" -ForegroundColor Red
    Write-Host "先运行: npm install -g @cloudbase/cli" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/3] 部署云函数 proxy..." -ForegroundColor Green
& $tcb fn deploy proxy -e $envId 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] 云函数部署返回非零退出码，继续下一步..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[2/3] 配置 HTTP 访问服务..." -ForegroundColor Green
Write-Host "  CloudBase HTTP 访问服务需要在控制台手动配置："
Write-Host "  1. 打开 https://console.cloud.tencent.com/tcb/env/index"
Write-Host "  2. 选择环境: $envId"
Write-Host "  3. 左侧菜单 → 云函数 → HTTP 访问服务"
Write-Host "  4. 新建路由: 路径 /proxy → 云函数 proxy"
Write-Host "  5. 保存 → 获取访问 URL"
Write-Host ""

Write-Host "[3/3] 部署静态文件到 CDN..." -ForegroundColor Green
& $tcb hosting deploy ./index.html index.html -e $envId 2>&1
& $tcb hosting deploy ./tools/inject-data.html tools/inject-data.html -e $envId 2>&1
& $tcb hosting deploy ./tools/setup-api.html tools/setup-api.html -e $envId 2>&1
& $tcb hosting deploy ./results.html results.html -e $envId 2>&1
& $tcb hosting deploy ./css css -e $envId 2>&1
& $tcb hosting deploy ./js js -e $envId 2>&1
& $tcb hosting deploy ./games games -e $envId 2>&1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  部署完成 ✅" -ForegroundColor Green
Write-Host ""
Write-Host "  测试链接:"
Write-Host "  静态站: https://${envId}-1438477634.tcloudbaseapp.com" -ForegroundColor Yellow
Write-Host "  云函数: https://${envId}.service.tcloudbase.com/proxy/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "  重要：请确认控制台 HTTP 访问服务已正确配置"
Write-Host "========================================" -ForegroundColor Cyan
