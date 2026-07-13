# 喵助手 (Desktop Cat)

桌面猫咪助手应用，集成截图、剪贴板管理、定时任务、JSON 查看器、AI 聊天、工作报告生成等功能。

## macOS 安装说明

由于应用未进行 Apple 开发者签名，macOS 会阻止打开。请按以下方式解决：

### 方式一：移除隔离属性（推荐）

```bash
xattr -cr /Applications/喵助手.app
```

执行后即可正常双击打开。

### 方式二：开启"任何来源"选项

macOS Sequoia (15.x) 默认隐藏了"允许任何来源"选项，需要手动开启：

```bash
sudo spctl --master-disable
```

执行后前往 **系统设置 → 隐私与安全性**，选择"任何来源"即可。

## 开发

### 安装依赖

```bash
npm install
```

### 启动开发模式

```bash
npm run dev
```

### 打包

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### 发布

```bash
./push.sh
```

自动递增 patch 版本号、提交、打 tag 并推送，GitHub Actions 会自动构建发布。
