<template>
  <div class="json-page">
    <div class="titlebar"></div>
    <div class="toolbar">
      <button @click="formatJson">格式化</button>
      <button @click="compressJson">压缩</button>
      <button @click="copyOutput">复制</button>
      <button @click="clearAll">清空</button>
      <div class="toolbar-right">
        <span class="status" :class="{ error: hasError }">{{ statusText }}</span>
      </div>
    </div>
    <div class="search-bar" v-show="showSearch">
      <input
        ref="searchInput"
        v-model="searchText"
        placeholder="搜索..."
        @input="doSearch"
        @keydown.enter="goNext"
        @keydown.escape="closeSearch"
      />
      <button @click="goPrev">上一个</button>
      <button @click="goNext">下一个</button>
      <span class="match-count" >{{ matchInfo }}</span>
      <button class="close-search" @click="closeSearch">关闭</button>
    </div>
    <div class="editor-wrapper" ref="editorEl"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, shallowRef, nextTick } from 'vue'
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { highlightSelectionMatches, SearchQuery, setSearchQuery, findNext, findPrevious, search } from '@codemirror/search'

const editorEl = ref(null)
const searchInput = ref(null)
const view = shallowRef(null)
const hasError = ref(false)
const statusText = ref('')
const showSearch = ref(false)
const searchText = ref('')
const matchInfo = ref('无内容')

const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    background: '#fff'
  },
  '.cm-scroller': {
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace",
    lineHeight: '1.7'
  },
  '.cm-content': {
    caretColor: '#3a2a1a',
    color: '#3a2a1a'
  },
  '.cm-gutters': {
    background: '#faf6f0',
    color: '#b0a090',
    border: 'none',
    borderRight: '1px solid #e8ddd0'
  },
  '.cm-activeLineGutter': {
    background: '#f0e6d6',
    color: '#5a4a3a'
  },
  '.cm-activeLine': {
    background: '#faf5ef'
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#3a2a1a'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    background: '#e8ddd0'
  },
  '.cm-searchMatch': {
    background: '#f9e2af80',
    outline: '1px solid #d0b798'
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    background: '#d0b79860'
  },
  '.cm-selectionMatch': {
    background: '#d0b79830'
  },
  '.cm-matchingBracket': {
    background: '#f0e6d6',
    color: '#8a5a2a',
    outline: '1px solid #d0b798'
  }
})

onMounted(() => {
  const state = EditorState.create({
    doc: '',
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      bracketMatching(),
      json(),
      syntaxHighlighting(defaultHighlightStyle),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        { key: 'Mod-f', run: () => { toggleSearch(); return true } }
      ]),
      search({ top: true }),
      highlightSelectionMatches(),
      theme
    ]
  })

  view.value = new EditorView({
    state,
    parent: editorEl.value
  })

  navigator.clipboard.readText().then(text => {
    if (text && text.trim()) {
      setText(text)
      try {
        const obj = JSON.parse(text)
        setText(JSON.stringify(obj, null, 2))
        statusText.value = '已从剪贴板粘贴并格式化'
      } catch (e) {
        statusText.value = '已从剪贴板粘贴'
      }
    }
  }).catch(() => {})
})

function getText() {
  return view.value.state.doc.toString()
}

function setText(text) {
  view.value.dispatch({
    changes: { from: 0, to: view.value.state.doc.length, insert: text }
  })
}

function formatJson() {
  try {
    const obj = JSON.parse(getText())
    setText(JSON.stringify(obj, null, 2))
    hasError.value = false
    statusText.value = '格式化成功'
  } catch (e) {
    hasError.value = true
    statusText.value = 'JSON 错误: ' + e.message
  }
}

function compressJson() {
  try {
    const obj = JSON.parse(getText())
    setText(JSON.stringify(obj))
    hasError.value = false
    statusText.value = '压缩成功'
  } catch (e) {
    hasError.value = true
    statusText.value = 'JSON 错误: ' + e.message
  }
}

function copyOutput() {
  const text = getText()
  if (text) {
    navigator.clipboard.writeText(text)
    statusText.value = '已复制'
  }
}

function clearAll() {
  setText('')
  hasError.value = false
  statusText.value = ''
}

function toggleSearch() {
  showSearch.value = !showSearch.value
  if (showSearch.value) {
    nextTick(() => searchInput.value?.focus())
  } else {
    clearSearchHighlight()
  }
}

function closeSearch() {
  showSearch.value = false
  searchText.value = ''
  clearSearchHighlight()
}

function doSearch() {
  if (!searchText.value || !view.value) {
    clearSearchHighlight()
    matchInfo.value = '无内容'
    return
  }
  const query = new SearchQuery({ search: searchText.value, caseSensitive: false })
  view.value.dispatch({ effects: setSearchQuery.of(query) })
  countMatches()
}

function goNext() {
  if (!view.value) return
  findNext(view.value)
  countMatches()
}

function goPrev() {
  if (!view.value) return
  findPrevious(view.value)
  countMatches()
}

function clearSearchHighlight() {
  if (!view.value) return
  const query = new SearchQuery({ search: '' })
  view.value.dispatch({ effects: setSearchQuery.of(query) })
}

function countMatches() {
  if (!searchText.value || !view.value) {
    matchInfo.value = '无内容'
    return
  }
  const text = getText()
  const term = searchText.value.toLowerCase()
  let count = 0
  let idx = 0
  while ((idx = text.toLowerCase().indexOf(term, idx)) !== -1) {
    count++
    idx += term.length
  }
  matchInfo.value = count > 0 ? `${count} 个匹配` : '无匹配'
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #fffaf3;
  color: #3a2a1a;
}

.titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 44px;
  background: rgba(255, 250, 243, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(208, 183, 152, 0.3);
  z-index: 100;
  -webkit-app-region: drag;
}

.json-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  padding-top: 44px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  background: #fffaf3;
  border-bottom: 1px solid #e8ddd0;
  flex-shrink: 0;
}

.toolbar button {
  padding: 5px 12px;
  font-size: 12px;
  border: 1px solid #d0b798;
  border-radius: 6px;
  background: #fff;
  color: #5a4a3a;
  cursor: pointer;
  transition: background 0.15s;
}

.toolbar button:hover {
  background: #f0e6d6;
}

.toolbar-right {
  margin-left: auto;
}

.status {
  font-size: 11px;
  color: #6a8a5a;
}

.status.error {
  color: #a05050;
}

.search-bar {
  position: absolute;
  top: 46px;
  right: 12px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fffaf3;
  border: 1px solid #d0b798;
  border-radius: 8px;
  padding: 6px 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.search-bar input {
  background: #fff;
  color: #3a2a1a;
  border: 1px solid #d0b798;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  width: 180px;
  outline: none;
}

.search-bar input:focus {
  border-color: #b08968;
}

.search-bar button {
  background: #fff;
  color: #5a4a3a;
  border: 1px solid #d0b798;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s;
}

.search-bar button:hover {
  background: #f0e6d6;
}

.match-count {
  font-size: 11px;
  color: #8a7a6a;
  white-space: nowrap;
}

.editor-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.editor-wrapper .cm-editor {
  height: 100%;
}

.cm-panels {
  display: none !important;
}
</style>
