@echo off
chcp 65001 >nul
echo =========================================
echo   MindMatch 本地开发环境一键启动
echo =========================================
echo.
echo 将启动两个服务：
echo   1. HTTP 文件服务器 (端口 8090) — 提供网页
echo   2. API 代理服务器 (端口 8100) — 转发混元 API
echo.

REM 启动 Python HTTP 服务器（新窗口）
start "MindMatch HTTP Server" cmd /k "cd /d H:\program\mindmatch-demo && python -m http.server 8090"

REM 启动 API 代理（新窗口）
start "MindMatch API Proxy" cmd /k "C:\Users\27653\.workbuddy\binaries\node\versions\22.22.2\node.exe H:\program\mindmatch-demo\server\proxy.js"

echo 服务正在启动...
echo.
echo 请稍等 2 秒后打开浏览器访问：
echo   http://127.0.0.1:8090/tools/setup-api.html
echo.
pause
