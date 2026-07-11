/**
 * OCR 文字识别模块
 * 使用 esearch-ocr + onnxruntime-node 实现离线 PaddleOCR 推理
 */

import { join } from 'path'
import { readFileSync } from 'fs'
import { app } from 'electron'

let ocrEngine = null

/**
 * 获取模型文件目录路径
 */
function getModelDir() {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'onnx')
  }
  return join(app.getAppPath(), 'resources/onnx')
}

/**
 * 初始化 OCR 引擎（懒加载，只初始化一次）
 * @returns {Promise} OCR 引擎实例
 */
export async function initOCR() {
  if (ocrEngine) return ocrEngine

  const ort = require('onnxruntime-node')
  const ocr = require('esearch-ocr')
  const modelDir = getModelDir()

  const dictPath = join(modelDir, 'ppocr_keys_v1.txt')
  const dictContent = readFileSync(dictPath, 'utf-8')

  // 为 Node.js 环境提供 canvas 和 imageData 实现
  // esearch-ocr 内部需要完整的 canvas 2d context（scale, drawImage, getImageData 等）
  const canvasFactory = (w, h) => {
    const buf = new Uint8ClampedArray(w * h * 4)
    let scaleX = 1, scaleY = 1
    let curW = w, curH = h

    const ctx = {
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      scale(sx, sy) { scaleX = sx; scaleY = sy },
      drawImage(source) {
        // source 是一个有 width, height, _buf 的 canvas 对象
        const srcData = source._buf || (source.data ? source.data : null)
        if (!srcData) return
        const sw = source.width, sh = source.height
        const dw = Math.round(sw * scaleX), dh = Math.round(sh * scaleY)
        // 最近邻缩放
        for (let y = 0; y < Math.min(dh, curH); y++) {
          for (let x = 0; x < Math.min(dw, curW); x++) {
            const sx = Math.floor(x / scaleX)
            const sy = Math.floor(y / scaleY)
            const si = (sy * sw + sx) * 4
            const di = (y * curW + x) * 4
            buf[di] = srcData[si]
            buf[di + 1] = srcData[si + 1]
            buf[di + 2] = srcData[si + 2]
            buf[di + 3] = srcData[si + 3]
          }
        }
      },
      getImageData(x, y, gw, gh) {
        const out = new Uint8ClampedArray(gw * gh * 4)
        for (let row = 0; row < gh; row++) {
          const srcOff = ((y + row) * curW + x) * 4
          const dstOff = row * gw * 4
          out.set(buf.slice(srcOff, srcOff + gw * 4), dstOff)
        }
        return { data: out, width: gw, height: gh, colorSpace: 'srgb' }
      },
      putImageData(img, dx, dy) {
        dx = dx || 0; dy = dy || 0
        const iw = img.width
        for (let row = 0; row < img.height; row++) {
          const srcOff = row * iw * 4
          const dstOff = ((dy + row) * curW + dx) * 4
          buf.set(img.data.slice(srcOff, srcOff + iw * 4), dstOff)
        }
      },
      createImageData(iw, ih) {
        return { data: new Uint8ClampedArray(iw * ih * 4), width: iw, height: ih, colorSpace: 'srgb' }
      }
    }

    return {
      width: w,
      height: h,
      _buf: buf,
      getContext() {
        curW = w; curH = h; scaleX = 1; scaleY = 1
        return ctx
      }
    }
  }

  const imageDataFactory = (data, width, height) => {
    return { data, width, height, colorSpace: 'srgb' }
  }

  // 设置环境
  if (ocr.setOCREnv) {
    ocr.setOCREnv({ canvas: canvasFactory, imageData: imageDataFactory })
  }

  ocrEngine = await ocr.init({
    det: {
      input: join(modelDir, 'ppocr_det.onnx'),
      ratio: 0.75
    },
    rec: {
      input: join(modelDir, 'ppocr_rec.onnx'),
      decodeDic: dictContent
    },
    ort,
    ortOption: { executionProviders: [{ name: 'cpu' }] }
  })

  return ocrEngine
}

/**
 * 识别图片中的文字
 * @param {Object} imageData - 包含 data(Uint8ClampedArray), width, height 的对象
 * @returns {Promise<string[]>} 识别出的文字数组（每段一个元素）
 */
export async function recognizeText(imageData) {
  const engine = await initOCR()
  const result = await engine.ocr(imageData)
  return result.columns
    .flatMap((c) => c.parragraphs)
    .map((p) => p.parse.text)
}
