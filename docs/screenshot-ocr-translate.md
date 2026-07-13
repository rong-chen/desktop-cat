# eSearch 截屏提取 + 翻译 实现方案分析

## 整体架构

eSearch 的截屏翻译功能由以下模块组成：

```
截屏界面 (clip_window.ts)
    ↓ 用户选区并点击"翻译"
主进程 (main.ts)
    ↓ 创建翻译窗口
翻译窗口 (translator.ts)
    ↓ 定时截屏 → OCR → 翻译 → 覆盖显示
```

---

## 核心流程

### 1. 触发翻译

在截图编辑界面 `clip_window.ts` 中，用户选中区域后点击"屏幕翻译"按钮：

```typescript
async function translate() {
    // 获取选区截图
    const c = getClipPhoto()
    
    // 两种模式：
    // "ding" 模式 → 贴图+翻译覆盖
    // "live" 模式 → 创建独立翻译窗口，实时刷新翻译
    
    renderSend("clip_translate", [{
        rect: { x, y, w, h },           // 物理像素坐标
        dipRect: { x, y, w, h },        // 逻辑像素坐标（用于窗口定位）
        displayId: nowScreenId,          // 所在显示器 ID
        img: getClipPhoto().toDataURL()  // 选区截图
    }])
}
```

### 2. 主进程创建翻译窗口

`main.ts` 收到 `clip_translate` 事件后：

```typescript
function createTranslator(op) {
    const win = new BrowserWindow({
        transparent: true,     // 透明背景
        frame: false,          // 无边框
        alwaysOnTop: true,     // 置顶
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })
    
    // 窗口定位：紧贴选区旁边（横向文本放下方，纵向文本放右侧）
    win.setBounds({ x, y, width: w, height: h })
    win.setAlwaysOnTop(true, "screen-saver")
    
    // 加载翻译页面，传入显示器和选区信息
    win.webContents.on("did-finish-load", () => {
        mainSend(win.webContents, "translatorInit", [displayId, displays, rect])
    })
}
```

### 3. 翻译窗口的实时翻译逻辑

`translator.ts` 是翻译窗口的核心：

```typescript
// 依赖
import initScreenShots from "../screenShot/screenShot"  // 截屏
import { loadOCR } from "../ocr/ocr"                    // 离线 OCR (esearch-ocr + onnxruntime)
import { loadTranslator } from "../lib/translate"        // 翻译 (xtranslator)

// 初始化
const screenShots = initScreenShots(...)  // node-screenshots 截屏
const translateE = loadTranslator(store)  // 翻译引擎
const OCR = await ocrX.ocr.init(config)   // OCR 引擎

// 核心运行循环（每 3 秒刷新一次）
async function run() {
    // 1. 截取指定区域
    const data = screenshot(screenId, rect)
    
    // 2. OCR 识别文字
    const ocrData = await OCR.ocr(data)
    
    // 3. 解析识别结果（带位置信息）
    for (const paragraph of ocrData.columns.flatMap(c => c.parragraphs)) {
        const text = paragraph.parse.text
        const box = paragraph.parse.box  // [[x0,y0], [x1,y0], [x1,y1], [x0,y1]]
        
        // 4. 创建定位元素覆盖在原文位置
        const item = view().style({
            position: "absolute",
            left: `${box[0][0]}px`,
            top: `${box[0][1]}px`,
            width: `${box[2][0] - box[0][0]}px`,
            height: `${box[2][1] - box[0][1]}px`,
            fontSize: `${lineHeight}px`
        })
    }
    
    // 5. 调用翻译API
    const translated = await translateE(textList.map(i => i.text))
    
    // 6. 显示翻译结果覆盖原文
    translated.forEach((tran, i) => {
        textList[i].el.innerText = tran
    })
}

// 定时循环运行
const runRun = () => {
    if (!pause) {
        run()
        setTimeout(runRun, 3000)  // 每3秒刷新
    }
}
```

---

## 关键技术组件

### OCR 引擎

eSearch 支持两种 OCR：

#### 离线 OCR（esearch-ocr）
- 基于 **PaddleOCR** 的 ONNX 模型
- 使用 **onnxruntime-node** 运行推理
- 模型文件：`ppocr_det.onnx`（检测）+ `ppocr_rec.onnx`（识别）+ `ppocr_keys_v1.txt`（字典）
- 支持 CPU / GPU 后端

```typescript
const localOCR = require("esearch-ocr")
const ort = require("onnxruntime-node")

const ocr = await localOCR.init({
    det: { input: "ppocr_det.onnx", ratio: 0.75 },
    rec: { input: "ppocr_rec.onnx", decodeDic: dictContent },
    ort,
    ortOption: { executionProviders: [{ name: "cpu" }] }
})

const result = await ocr.ocr(imageData)
// result.columns[].parragraphs[].parse.text  → 识别文字
// result.columns[].parragraphs[].parse.box   → 文字位置
```

#### 在线 OCR
- 百度 OCR API
- 有道 OCR API
- LLM 视觉模型（GPT-4V 等）

```typescript
// LLM OCR
const prompt = "recognize the text in the image and return it in text raw"
runAI([{ role: "user", content: { text: prompt, img: base64Image } }], aiConfig)
```

### 翻译引擎

使用 [xtranslator](https://github.com/xushengfeng/xtranslator) 库，支持：
- DeepL
- Google Translate
- 百度翻译
- 有道翻译
- LLM 翻译（通过 OpenAI-compatible API）

```typescript
import xtranslator from "xtranslator"

// 初始化翻译器
const translator = xtranslator.es["chatgpt"]()
translator.setKeys({
    url: "https://api.openai.com/v1/chat/completions",
    key: apiKey,
    config: { model: "gpt-4" }
})

// 执行翻译
const result = await translator.run(
    ["Hello", "World"],  // 输入文本数组
    "auto",              // 源语言
    "zh"                 // 目标语言
)
```

### 截屏模块

使用 `node-screenshots`（Rust 原生库）：

```typescript
import { Monitor } from "node-screenshots"

const monitors = Monitor.all()
const monitor = monitors[0]
const image = monitor.captureImageSync()  // 同步截屏
const imageData = image.toRawSync(true)   // 获取原始像素数据
```

---

## 翻译结果显示方式

翻译窗口覆盖在原始内容上方，使用半透明白色背景 + 定位文字：

```
┌─────────────────────────────────────┐
│  [暂停] [刷新] [复制] [关闭]          │  ← 工具栏
├─────────────────────────────────────┤
│                                     │
│  翻译后的文字                         │  ← 按 OCR 识别位置覆盖
│  覆盖在原始位置                       │
│                                     │
│  每一段文字都精确定位                  │
│  到原文对应的坐标位置                  │
│                                     │
└─────────────────────────────────────┘
    (半透明白色背景，可拖动)
```

---

## 要在我们项目中实现需要的依赖

| 功能 | 库 | 说明 |
|------|-----|------|
| 截屏 | `node-screenshots` | 已安装 ✅ |
| 离线 OCR | `esearch-ocr` + `onnxruntime-node` | 需要安装 + 下载模型文件(~10MB) |
| 在线 OCR | LLM API（我们已有 AI 配置） | 可复用现有 deepseek 配置 |
| 翻译 | `xtranslator` 或直接用 LLM | 可用现有 AI 模型做翻译 |

### 最简实现路径（利用已有 AI 配置）

由于项目已有 DeepSeek AI 配置，最快的方案是：

1. **OCR**：截图 → 转 base64 → 发给 LLM（"识别图片中的文字"）
2. **翻译**：OCR 结果 → 发给 LLM（"翻译成中文/英文"）

这样不需要额外安装 OCR 模型，直接复用现有的 AI 接口。

---

## 建议实现步骤

1. 在截图工具栏添加"提取文字"和"翻译"按钮
2. 点击后将选区截图转为 base64
3. 调用已配置的 AI API 进行 OCR / 翻译
4. 结果显示在新窗口或复制到剪贴板
