#!/bin/bash
# bump-version.sh — 一键更新版本号并全量部署到 CloudBase
# 用法: bash tools/bump-version.sh 20260601d
#
# 功能:
#   1. 替换 7 个 HTML 文件中的版本号
#   2. 替换 js/ 目录下所有 JS 文件的版本号
#   3. 部署所有 HTML + 核心 JS 文件到 CloudBase

set -e

NEW_VER="$1"
if [ -z "$NEW_VER" ]; then
  echo "用法: bash tools/bump-version.sh <新版本号>"
  echo "示例: bash tools/bump-version.sh 20260601d"
  exit 1
fi

# 获取当前版本号
CUR_VER=$(grep -oP "window\.__MM_VER__\s*=\s*'\K[^']+" index.html | head -1)
echo "当前版本: $CUR_VER → 新版本: $NEW_VER"
echo ""

HTML_FILES=(
  "index.html"
  "results.html"
  "match.html"
  "games/game1-core-drive.html"
  "games/game2-career-anchor.html"
  "games/game3-cognitive-style.html"
  "games/game4-meaning-construction.html"
)

# 替换 HTML 文件中的版本号
for f in "${HTML_FILES[@]}"; do
  sed -i "s/$CUR_VER/$NEW_VER/g" "$f"
  echo "  ✓ HTML $f"
done

# 替换 JS 文件中的版本号
JS_COUNT=0
for f in $(find js/ -name "*.js" -type f); do
  if grep -q "$CUR_VER" "$f"; then
    sed -i "s/$CUR_VER/$NEW_VER/g" "$f"
    echo "  ✓ JS   $f"
    ((JS_COUNT++))
  fi
done
echo "  共更新 $JS_COUNT 个 JS 文件"
echo ""

echo "版本号已全部更新。开始部署..."

# 部署到 CloudBase
TCB="/c/Users/27653/.workbuddy/binaries/node/versions/22.22.2/tcb"
ENV="mindmatch-d0gz847n4e29e3181"

# 部署 HTML
for f in "${HTML_FILES[@]}"; do
  $TCB hosting deploy "./$f" "$f" -e "$ENV" 2>&1 | tail -1
done

# 部署所有 JS 文件
for f in $(find js/ -name "*.js" -type f); do
  $TCB hosting deploy "./$f" "$f" -e "$ENV" 2>&1 | tail -1
done

echo ""
echo "全部完成！版本号: $NEW_VER"
echo "线上地址: https://mindmatch-d0gz847n4e29e3181-1438477634.tcloudbaseapp.com"
