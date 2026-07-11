/**
 * 翻译模块
 * 使用 xtranslator 库支持多翻译引擎
 */

import { loadAiConfig } from '../../shared/store'
import xtranslator from 'xtranslator'

/**
 * 翻译文本
 * @param {string[]} texts - 待翻译文本数组
 * @param {string} from - 源语言（'auto' 自动检测）
 * @param {string} to - 目标语言
 * @returns {Promise<string[]>} 翻译结果数组
 */
export async function translateText(texts, from, to) {
  const config = loadAiConfig()
  const translateConfig = config.translate || { type: 'llm', from: 'auto', to: 'zh', keys: {} }

  const type = translateConfig.type || 'llm'
  const engineType = type === 'llm' ? 'chatgpt' : type

  const engine = xtranslator.es[engineType]()

  if (!engine) {
    throw new Error(`不支持的翻译引擎: ${type}`)
  }

  if (type === 'llm') {
    const model = config.translate?.llm || {}
    engine.setKeys({
      url: (config.baseUrl || '').replace(/\/+$/, '') + '/chat/completions',
      key: config.apiKey,
      config: { model: model.model || config.model }
    })
  } else if (translateConfig.keys) {
    engine.setKeys(translateConfig.keys)
  }

  const srcLang = from || translateConfig.from || 'auto'
  const tgtLang = to || translateConfig.to || 'zh'

  return engine.run(texts, srcLang, tgtLang)
}
