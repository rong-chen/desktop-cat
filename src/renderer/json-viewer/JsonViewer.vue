<template>
  <div class="json-page">
    <div class="titlebar"></div>
    <div class="tab-bar">
      <div class="tabs-scroll">
        <div
          v-for="(tab, index) in tabs"
          :key="tab.id"
          class="tab"
          :class="{ active: activeTabId === tab.id }"
          @click="switchTab(tab.id)"
          @dblclick="startRename(tab)"
        >
          <span class="tab-title" v-if="renamingTabId !== tab.id">{{ tab.title }}</span>
          <input
            v-else
            class="tab-rename-input"
            v-model="renameValue"
            @blur="finishRename(tab)"
            @keydown.enter="finishRename(tab)"
            @keydown.escape="cancelRename"
            ref="renameInput"
          />
          <span class="tab-close" @click.stop="closeTab(tab.id)" v-if="tabs.length > 1">&times;</span>
        </div>
      </div>
      <button class="tab-add" @click="addTab">+</button>
    </div>
    <div class="toolbar">
      <button @click="formatJson">格式化</button>
      <button @click="compressJson">压缩</button>
      <button @click="copyOutput">复制</button>
      <button @click="clearAll">清空</button>
      <button @click="openFile">打开文件</button>
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
      <span class="match-count">{{ matchInfo }}</span>
      <button class="close-search" @click="closeSearch">关闭</button>
    </div>
    <div class="editor-wrapper" ref="editorEl"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, shallowRef, nextTick, onBeforeUnmount } from 'vue'
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { highlightSelectionMatches, SearchQuery, setSearchQuery, findNext, findPrevious, search } from '@codemirror/search'

const editorEl = ref(null)
const searchInput = ref(null)
const renameInput = ref(null)
const view = shallowRef(null)
const hasError = ref(false)
const statusText = ref('')
const showSearch = ref(false)
const searchText = ref('')
const matchInfo = ref('无内容')

const tabs = ref([])
const activeTabId = ref(null)
const renamingTabId = ref(null)
const renameValue = ref('')

let tabIdCounter = 0
let saveTimer = null

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', background: '#fff' },
  '.cm-scroller': {
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace",
    lineHeight: '1.7'
  },
  '.cm-content': { caretColor: '#3a2a1a', color: '#3a2a1a' },
  '.cm-gutters': { background: '#faf6f0', color: '#b0a090', border: 'none', borderRight: '1px solid #e8ddd0' },
  '.cm-activeLineGutter': { background: '#f0e6d6', color: '#5a4a3a' },
  '.cm-activeLine': { background: '#faf5ef' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#3a2a1a' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { background: '#e8ddd0' },
  '.cm-searchMatch': { background: '#f9e2af80', outline: '1px solid #d0b798' },
  '.cm-searchMatch.cm-searchMatch-selected': { background: '#d0b79860' },
  '.cm-selectionMatch': { background: '#d0b79830' },
  '.cm-matchingBracket': { background: '#f0e6d6', color: '#8a5a2a', outline: '1px solid #d0b798' }
})

function createEditorExtensions() {
  return [
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
    theme,
    EditorView.updateListener.of(() => { scheduleSave() })
  ]
}

function createTab(title, content) {
  const id = ++tabIdCounter
  return { id, title: title || `标签 ${id}`, content: content || '' }
}

function getActiveTab() {
  return tabs.value.find(t => t.id === activeTabId.value)
}

function initEditor(doc) {
  if (view.value) {
    view.value.destroy()
  }
  const state = EditorState.create({ doc: doc || '', extensions: createEditorExtensions() })
  view.value = new EditorView({ state, parent: editorEl.value })
}

function switchTab(id) {
  const current = getActiveTab()
  if (current && view.value) {
    current.content = view.value.state.doc.toString()
  }
  activeTabId.value = id
  const tab = tabs.value.find(t => t.id === id)
  if (tab) {
    initEditor(tab.content)
  }
  hasError.value = false
  statusText.value = ''
}

function addTab(content, title) {
  const text = typeof content === 'string' ? content : ''
  const tab = createTab(title || `标签 ${tabIdCounter + 1}`, text)
  tabs.value.push(tab)
  switchTab(tab.id)
  scheduleSave()
}

function closeTab(id) {
  const idx = tabs.value.findIndex(t => t.id === id)
  if (idx === -1) return
  tabs.value.splice(idx, 1)
  if (activeTabId.value === id) {
    const newIdx = Math.min(idx, tabs.value.length - 1)
    switchTab(tabs.value[newIdx].id)
  }
  scheduleSave()
}

function startRename(tab) {
  renamingTabId.value = tab.id
  renameValue.value = tab.title
  nextTick(() => {
    const inputs = document.querySelectorAll('.tab-rename-input')
    if (inputs.length) inputs[inputs.length - 1].focus()
  })
}

function finishRename(tab) {
  if (renameValue.value.trim()) {
    tab.title = renameValue.value.trim()
  }
  renamingTabId.value = null
  scheduleSave()
}

function cancelRename() {
  renamingTabId.value = null
}

function getText() {
  return view.value?.state.doc.toString() || ''
}

function setText(text) {
  if (!view.value) return
  view.value.dispatch({ changes: { from: 0, to: view.value.state.doc.length, insert: text } })
}

function smartParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    const unescaped = text.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    return JSON.parse(unescaped)
  }
}

function formatJson() {
  try {
    const obj = smartParse(getText())
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
    const obj = smartParse(getText())
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

async function openFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.multiple = true
  input.onchange = async () => {
    for (const file of input.files) {
      const text = await file.text()
      let formatted = text
      try {
        formatted = JSON.stringify(smartParse(text), null, 2)
      } catch {}
      addTab(formatted, file.name)
    }
  }
  input.click()
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

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => persistCache(), 1000)
}

function persistCache() {
  const current = getActiveTab()
  if (current && view.value) {
    current.content = view.value.state.doc.toString()
  }
  const data = {
    tabs: tabs.value.map(t => ({ id: t.id, title: t.title, content: t.content })),
    activeTabId: activeTabId.value
  }
  window.api.jsonViewerSaveCache(data)
}

onMounted(async () => {
  const cache = await window.api.jsonViewerLoadCache()
  if (cache && cache.tabs && cache.tabs.length > 0) {
    tabIdCounter = Math.max(...cache.tabs.map(t => t.id))
    tabs.value = cache.tabs
    activeTabId.value = cache.activeTabId || cache.tabs[0].id
    const tab = getActiveTab() || tabs.value[0]
    activeTabId.value = tab.id
    initEditor(tab.content)
    statusText.value = '已恢复上次内容'
  } else {
    const tab = createTab('标签 1', '')
    tabs.value.push(tab)
    activeTabId.value = tab.id
    initEditor('')
    // Auto paste from clipboard
    try {
      const text = await navigator.clipboard.readText()
      if (text && text.trim()) {
        setText(text)
        try {
          const obj = smartParse(text)
          const formatted = JSON.stringify(obj, null, 2)
          setText(formatted)
          tab.content = formatted
          statusText.value = '已从剪贴板粘贴并格式化'
        } catch {
          tab.content = text
          statusText.value = '已从剪贴板粘贴'
        }
      }
    } catch {}
  }

  window.api.onJsonViewerOpenTab((content) => {
    let formatted = content
    try {
      formatted = JSON.stringify(smartParse(content), null, 2)
    } catch {}
    addTab(formatted, '新标签')
  })
})

onBeforeUnmount(() => {
  persistCache()
  if (view.value) view.value.destroy()
})
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
  z-index: 100;
  -webkit-app-region: drag;
}

.titlebar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  background: rgba(208, 183, 152, 0.3);
}

.json-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  padding-top: 44px;
}

.tab-bar {
  display: flex;
  align-items: center;
  background: #f8f3eb;
  border-bottom: 1px solid #e8ddd0;
  padding: 0 8px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.tabs-scroll {
  display: flex;
  overflow-x: auto;
  flex: 1;
  gap: 2px;
  padding: 6px 0;
  -webkit-app-region: no-drag;
}

.tabs-scroll::-webkit-scrollbar {
  height: 0;
}

.tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  font-size: 12px;
  color: #7a6a5a;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
  max-width: 160px;
}

.tab:hover {
  background: #f0e6d6;
  color: #3a2a1a;
}

.tab.active {
  background: #fff;
  color: #3a2a1a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-rename-input {
  width: 80px;
  font-size: 11px;
  border: 1px solid #d0b798;
  border-radius: 3px;
  padding: 1px 4px;
  outline: none;
  background: #fff;
}

.tab-close {
  font-size: 14px;
  line-height: 1;
  color: #b0a090;
  cursor: pointer;
  border-radius: 3px;
  padding: 0 2px;
}

.tab-close:hover {
  background: #e8ddd0;
  color: #5a4a3a;
}

.tab-add {
  -webkit-app-region: no-drag;
  background: none;
  border: none;
  font-size: 16px;
  color: #8a7a6a;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}

.tab-add:hover {
  background: #f0e6d6;
  color: #3a2a1a;
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
