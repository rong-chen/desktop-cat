#!/bin/bash

set -e

git fetch --tags origin

LATEST_TAG=$(git describe --tags --abbrev=0 origin/master 2>/dev/null || echo "v0.0.0")

MAJOR=$(echo "$LATEST_TAG" | sed 's/v//' | cut -d. -f1)
MINOR=$(echo "$LATEST_TAG" | sed 's/v//' | cut -d. -f2)
PATCH=$(echo "$LATEST_TAG" | sed 's/v//' | cut -d. -f3)

PATCH=$((PATCH + 1))
NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
NEW_TAG="v${NEW_VERSION}"

echo "当前版本: $LATEST_TAG"
echo "新版本: $NEW_TAG"

# 更新 package.json 中的版本号（兼容 macOS 和 Windows Git Bash）
sed -i "s/\"version\": \".*\"/\"version\": \"${NEW_VERSION}\"/" package.json

git add -A
git commit -m "release: ${NEW_TAG}" || true
git tag "$NEW_TAG"
git push origin master "$NEW_TAG"

echo "已推送 $NEW_TAG，GitHub Actions 将自动构建打包"
