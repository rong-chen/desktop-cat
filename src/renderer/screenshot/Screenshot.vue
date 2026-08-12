<template>
  <div class="screenshot-root" @contextmenu.prevent>
    <!-- Background screenshot -->
    <canvas ref="bgCanvas" class="layer"></canvas>

    <!-- Selection overlay (phase 1) -->
    <canvas
      v-show="!showEditor"
      ref="overlayCanvas"
      class="layer sel-layer"
      @mousemove="onMouseMove"
      @mousedown.prevent="onMouseDown"
      @mouseup="onMouseUp"
      @dblclick="onDblClick"
    ></canvas>

    <!-- Dark mask over non-selected area (phase 2) -->
    <div v-show="showEditor" class="mask-top" :style="maskTopStyle"></div>
    <div v-show="showEditor" class="mask-bottom" :style="maskBottomStyle"></div>
    <div v-show="showEditor" class="mask-left" :style="maskLeftStyle"></div>
    <div v-show="showEditor" class="mask-right" :style="maskRightStyle"></div>

    <!-- Selection resize/move layer -->
    <div
      v-show="showEditor && phase === 'selected'"
      class="move-overlay"
      :style="[fabricWrapStyle, { pointerEvents: activeTool === 'select' ? 'auto' : 'none' }]"
      @mousedown.prevent="onResizeMouseDown('move', $event)"
    ></div>
    <template v-if="showEditor && phase === 'selected'">
      <div
        v-for="h in handlePositions"
        :key="h.key"
        class="resize-handle"
        :style="{ left: h.x + 'px', top: h.y + 'px', cursor: h.cursor }"
        @mousedown.prevent.stop="onResizeMouseDown(h.key, $event)"
      ></div>
    </template>

    <!-- Fabric editor container -->
    <div
      v-show="showEditor"
      class="fabric-wrap"
      :style="fabricWrapStyle"
      @contextmenu.prevent="onRightClick"
    >
      <canvas ref="fabricEl"></canvas>
    </div>

    <!-- Magnifier -->
    <div v-show="showMagnifier" class="magnifier" :style="magnifierStyle">
      <canvas ref="magCanvas" width="130" height="130"></canvas>
      <div class="mag-info">
        <div class="mag-swatch" :style="{ background: currentColor }"></div>
        <span class="mag-text">{{ colorText }}</span>
      </div>
      <div class="mag-pos">{{ mousePos.x }}, {{ mousePos.y }}</div>
    </div>

    <!-- Size indicator -->
    <div v-show="phase !== 'idle'" class="size-label" :style="sizeLabelStyle">
      {{ selW }} × {{ selH }}
    </div>

    <!-- Toolbar -->
    <div ref="toolbarEl" v-show="showEditor" class="toolbar" :style="toolbarStyle" @mousedown.stop>
      <div class="tg">
        <button
          v-for="t in toolList"
          :key="t.id"
          :class="{ active: activeTool === t.id }"
          @click="setTool(t.id)"
          @mouseenter="tooltip = t.title"
          @mouseleave="tooltip = ''"
          v-html="t.icon"
        ></button>
      </div>
      <i class="sep"></i>
      <div class="tg">
        <button
          v-for="c in palette"
          :key="c"
          class="cbtn"
          :class="{ active: activeColor === c }"
          :style="{ background: c }"
          @click="activeColor = c"
        ></button>
      </div>
      <i class="sep"></i>
      <div class="tg">
        <button
          v-for="s in [2, 4, 6]"
          :key="s"
          :class="{ active: activeWidth === s }"
          @click="activeWidth = s"
          @mouseenter="tooltip = s === 2 ? '细' : s === 4 ? '中' : '粗'"
          @mouseleave="tooltip = ''"
        >
          <span class="dot" :style="{ width: s * 2 + 'px', height: s * 2 + 'px' }"></span>
        </button>
      </div>
      <i class="sep"></i>
      <div class="tg">
        <button @click="undo" @mouseenter="tooltip = '撤销 Ctrl+Z'" @mouseleave="tooltip = ''">
          ↩
        </button>
        <button @click="redo" @mouseenter="tooltip = '重做 Ctrl+Y'" @mouseleave="tooltip = ''">
          ↪
        </button>
      </div>
      <i class="sep"></i>
      <div class="tg acts">
        <button
          class="pin"
          @click="doPin"
          @mouseenter="tooltip = '贴图 Ctrl+T'"
          @mouseleave="tooltip = ''"
        >
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z" fill="currentColor"/></svg>
        </button>
        <button
          class="ok"
          @click="doCopy"
          @mouseenter="tooltip = '复制 Enter'"
          @mouseleave="tooltip = ''"
        >
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg>
        </button>
        <button @click="doSave" @mouseenter="tooltip = '保存 Ctrl+S'" @mouseleave="tooltip = ''">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/></svg>
        </button>
        <button
          class="no"
          @click="doClose"
          @mouseenter="tooltip = '关闭 Esc'"
          @mouseleave="tooltip = ''"
        >
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="currentColor"/></svg>
        </button>
      </div>
      <div v-show="tooltip" class="custom-tooltip">{{ tooltip }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  Canvas,
  Rect,
  Ellipse,
  Line,
  Polyline,
  IText,
  Circle,
  PencilBrush,
  SprayBrush,
  FabricImage
} from 'fabric'

const bgCanvas = ref(null)
const overlayCanvas = ref(null)
const fabricEl = ref(null)
const magCanvas = ref(null)
const toolbarEl = ref(null)
const toolbarW = ref(0)

let bgCtx = null
let ovCtx = null
let fabricCanvas = null
let scaleFactor = 1
let screenW = 0
let screenH = 0
let workAreaBottom = 0

const phase = ref('idle')
const mousePos = reactive({ x: 0, y: 0 })
const selection = reactive({ x: 0, y: 0, w: 0, h: 0 })
const activeTool = ref('select')
const activeColor = ref('#ff0000')
const activeWidth = ref(2)
const colorFormat = ref('hex')
const currentColor = ref('#000000')
const tooltip = ref('')
let numberCounter = 1
let undoStack = []
let redoStack = []
let isLoadingState = false
let windowRects = []
let hoveredRect = null
let dragStartPos = null
let resizeMode = null
let resizeStart = null

const palette = ['#ff0000', '#ff8800', '#ffee00', '#00cc44', '#0088ff', '#ffffff', '#000000']
const toolList = [
  {
    id: 'select',
    title: '选择/移动',
    icon: '<svg viewBox="0 0 20 20"><path d="M4 2l12 8-5 1.5L9 17l-1.5-5L2 14z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
  },
  {
    id: 'rect',
    title: '矩形',
    icon: '<svg viewBox="0 0 20 20"><rect x="2" y="4" width="16" height="12" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
  },
  {
    id: 'ellipse',
    title: '椭圆',
    icon: '<svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="8" ry="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
  },
  {
    id: 'arrow',
    title: '箭头',
    icon: '<svg viewBox="0 0 20 20"><line x1="3" y1="17" x2="17" y2="3" stroke="currentColor" stroke-width="1.8"/><polyline points="9,3 17,3 17,11" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
  },
  {
    id: 'line',
    title: '直线',
    icon: '<svg viewBox="0 0 20 20"><line x1="3" y1="17" x2="17" y2="3" stroke="currentColor" stroke-width="1.8"/></svg>'
  },
  {
    id: 'brush',
    title: '画笔',
    icon: '<svg viewBox="0 0 20 20"><path d="M3 14.5l9.5-9.5 3 3-9.5 9.5H3v-3z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
  },
  {
    id: 'eraser',
    title: '橡皮擦',
    icon: '<svg viewBox="0 0 20 20"><path d="M7 17h10M3 14l8-8 4 4-6 6H4l-1-1v-1z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
  },
  {
    id: 'spray',
    title: '喷刷',
    icon: '<svg viewBox="0 0 20 20"><circle cx="6" cy="8" r="1" fill="currentColor"/><circle cx="10" cy="5" r="1" fill="currentColor"/><circle cx="14" cy="7" r="1" fill="currentColor"/><circle cx="8" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="11" r="1" fill="currentColor"/><circle cx="5" cy="15" r="1" fill="currentColor"/><circle cx="10" cy="16" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/></svg>'
  },
  {
    id: 'mosaic',
    title: '马赛克',
    icon: '<svg viewBox="0 0 20 20"><rect x="2" y="2" width="7" height="7" fill="currentColor"/><rect x="11" y="11" width="7" height="7" fill="currentColor"/><rect x="2" y="11" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="11" y="2" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>'
  },
  {
    id: 'blur',
    title: '模糊',
    icon: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="2 2"/></svg>'
  },
  {
    id: 'text',
    title: '文本',
    icon: '<svg viewBox="0 0 20 20"><text x="4" y="16" font-size="15" font-weight="bold" fill="currentColor">A</text></svg>'
  },
  {
    id: 'number',
    title: '序号',
    icon: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><text x="7" y="14" font-size="11" font-weight="bold" fill="currentColor">1</text></svg>'
  }
]

// --- Computed ---
const showMagnifier = computed(() => phase.value === 'idle' || phase.value === 'selecting')
const showEditor = computed(() => phase.value === 'selected' || phase.value === 'annotating')
const selW = computed(() => Math.abs(selection.w))
const selH = computed(() => Math.abs(selection.h))

const selRect = computed(() => ({
  x: Math.min(selection.x, selection.x + selection.w),
  y: Math.min(selection.y, selection.y + selection.h),
  w: Math.abs(selection.w),
  h: Math.abs(selection.h)
}))

const handlePositions = computed(() => {
  const r = selRect.value
  const hs = 4 // half handle size
  return [
    { key: 'nw', x: r.x - hs, y: r.y - hs, cursor: 'nwse-resize' },
    { key: 'n', x: r.x + r.w / 2 - hs, y: r.y - hs, cursor: 'ns-resize' },
    { key: 'ne', x: r.x + r.w - hs, y: r.y - hs, cursor: 'nesw-resize' },
    { key: 'w', x: r.x - hs, y: r.y + r.h / 2 - hs, cursor: 'ew-resize' },
    { key: 'e', x: r.x + r.w - hs, y: r.y + r.h / 2 - hs, cursor: 'ew-resize' },
    { key: 'sw', x: r.x - hs, y: r.y + r.h - hs, cursor: 'nesw-resize' },
    { key: 's', x: r.x + r.w / 2 - hs, y: r.y + r.h - hs, cursor: 'ns-resize' },
    { key: 'se', x: r.x + r.w - hs, y: r.y + r.h - hs, cursor: 'nwse-resize' }
  ]
})

const fabricWrapStyle = computed(() => ({
  left: selRect.value.x + 'px',
  top: selRect.value.y + 'px',
  width: selRect.value.w + 'px',
  height: selRect.value.h + 'px'
}))

// Mask styles (dark overlay around selection in editor mode)
const maskTopStyle = computed(() => ({
  left: 0,
  top: 0,
  width: '100%',
  height: selRect.value.y + 'px'
}))
const maskBottomStyle = computed(() => ({
  left: '0',
  top: selRect.value.y + selRect.value.h + 'px',
  width: '100%',
  height: screenH - selRect.value.y - selRect.value.h + 'px'
}))
const maskLeftStyle = computed(() => ({
  left: '0',
  top: selRect.value.y + 'px',
  width: selRect.value.x + 'px',
  height: selRect.value.h + 'px'
}))
const maskRightStyle = computed(() => ({
  left: selRect.value.x + selRect.value.w + 'px',
  top: selRect.value.y + 'px',
  width: screenW - selRect.value.x - selRect.value.w + 'px',
  height: selRect.value.h + 'px'
}))

const magnifierStyle = computed(() => {
  let x = mousePos.x + 20,
    y = mousePos.y + 20
  if (x + 150 > screenW) x = mousePos.x - 170
  if (y + 190 > screenH) y = mousePos.y - 210
  return { left: x + 'px', top: y + 'px' }
})

const sizeLabelStyle = computed(() => ({
  left: selRect.value.x + 'px',
  top: Math.max(0, selRect.value.y - 24) + 'px'
}))

const toolbarStyle = computed(() => {
  const r = selRect.value
  const tw = toolbarW.value

  let top = r.y + r.h + 8
  if (top + 40 > workAreaBottom) top = r.y - 48
  if (top < 0) top = r.y + r.h - 48

  let left = r.x
  if (tw > 0 && left + tw > screenW) left = screenW - tw - 4
  if (left < 4) left = 4

  return { left: left + 'px', top: top + 'px' }
})

const colorText = computed(() => {
  const c = currentColor.value
  if (!c || c.length < 7) return c
  if (colorFormat.value === 'hex') return c.toUpperCase()
  const r = parseInt(c.slice(1, 3), 16),
    g = parseInt(c.slice(3, 5), 16),
    b = parseInt(c.slice(5, 7), 16)
  return `rgb(${r}, ${g}, ${b})`
})

// --- Magnifier ---
function getPixelColor(x, y) {
  if (!bgCtx) return '#000000'
  const px = Math.min(Math.max(0, Math.round(x * scaleFactor)), bgCanvas.value.width - 1)
  const py = Math.min(Math.max(0, Math.round(y * scaleFactor)), bgCanvas.value.height - 1)
  const d = bgCtx.getImageData(px, py, 1, 1).data
  return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')
}

function updateMagnifier(x, y) {
  const mag = magCanvas.value
  if (!mag || !bgCtx) return
  const ctx = mag.getContext('2d')
  const grid = 11,
    ps = Math.floor(130 / grid)
  ctx.clearRect(0, 0, 130, 130)
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const sx = Math.round((x - 5 + gx) * scaleFactor)
      const sy = Math.round((y - 5 + gy) * scaleFactor)
      let px = [180, 180, 180, 255]
      if (sx >= 0 && sy >= 0 && sx < bgCanvas.value.width && sy < bgCanvas.value.height)
        px = bgCtx.getImageData(sx, sy, 1, 1).data
      ctx.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`
      ctx.fillRect(gx * ps, gy * ps, ps, ps)
    }
  }
  ctx.strokeStyle = '#ff0000'
  ctx.lineWidth = 2
  ctx.strokeRect(5 * ps, 5 * ps, ps, ps)
}

// --- Overlay drawing ---
function drawOverlay() {
  if (!ovCtx) return
  const w = overlayCanvas.value.width,
    h = overlayCanvas.value.height
  ovCtx.clearRect(0, 0, w, h)
  ovCtx.fillStyle = 'rgba(0,0,0,0.45)'
  ovCtx.fillRect(0, 0, w, h)
  if (phase.value === 'idle') {
    if (hoveredRect) {
      const r = hoveredRect
      const rx = Math.max(0, r.x) * scaleFactor
      const ry = Math.max(0, r.y) * scaleFactor
      const rw = Math.min(r.w, screenW - Math.max(0, r.x)) * scaleFactor
      const rh = Math.min(r.h, screenH - Math.max(0, r.y)) * scaleFactor
      ovCtx.clearRect(rx, ry, rw, rh)
      ovCtx.strokeStyle = '#00cc66'
      ovCtx.lineWidth = 2
      ovCtx.strokeRect(rx, ry, rw, rh)
    }
    return
  }
  const r = selRect.value
  ovCtx.clearRect(r.x * scaleFactor, r.y * scaleFactor, r.w * scaleFactor, r.h * scaleFactor)
  ovCtx.strokeStyle = '#0088ff'
  ovCtx.lineWidth = 1.5
  ovCtx.strokeRect(r.x * scaleFactor, r.y * scaleFactor, r.w * scaleFactor, r.h * scaleFactor)
}

// --- Fabric.js ---
function initFabric() {
  if (fabricCanvas) {
    fabricCanvas.dispose()
    fabricCanvas = null
  }
  const r = selRect.value
  if (r.w < 2 || r.h < 2) return

  nextTick(() => {
    fabricCanvas = new Canvas(fabricEl.value, {
      width: r.w,
      height: r.h,
      backgroundColor: 'transparent',
      selection: activeTool.value === 'select'
    })

    const tmpCanvas = document.createElement('canvas')
    tmpCanvas.width = r.w * scaleFactor
    tmpCanvas.height = r.h * scaleFactor
    const tc = tmpCanvas.getContext('2d')
    tc.drawImage(
      bgCanvas.value,
      r.x * scaleFactor,
      r.y * scaleFactor,
      r.w * scaleFactor,
      r.h * scaleFactor,
      0,
      0,
      tmpCanvas.width,
      tmpCanvas.height
    )

    const bgImg = new Image()
    bgImg.onload = () => {
      const fi = new FabricImage(bgImg, { selectable: false, evented: false })
      fi.scaleToWidth(r.w)
      fabricCanvas.backgroundImage = fi
      fabricCanvas.renderAll()
      saveState()
    }
    bgImg.src = tmpCanvas.toDataURL()

    fabricCanvas.on('object:added', saveState)
    fabricCanvas.on('object:modified', saveState)
    fabricCanvas.on('path:created', onPathCreated)
    setupFabricTool()
  })
}

function saveState() {
  if (!fabricCanvas || isLoadingState) return
  undoStack.push(fabricCanvas.toJSON())
  if (undoStack.length > 50) undoStack.shift()
  redoStack = []
}

function undo() {
  if (!fabricCanvas || undoStack.length < 2) return
  isLoadingState = true
  redoStack.push(undoStack.pop())
  const state = undoStack[undoStack.length - 1]
  fabricCanvas.loadFromJSON(state).then(() => {
    fabricCanvas.renderAll()
    isLoadingState = false
  })
}

function redo() {
  if (!fabricCanvas || redoStack.length === 0) return
  isLoadingState = true
  const state = redoStack.pop()
  undoStack.push(state)
  fabricCanvas.loadFromJSON(state).then(() => {
    fabricCanvas.renderAll()
    isLoadingState = false
  })
}

function setTool(id) {
  activeTool.value = id
  if (fabricCanvas) setupFabricTool()
}

function setupFabricTool() {
  if (!fabricCanvas) return
  const isDrawMode = ['brush', 'eraser', 'spray', 'mosaic', 'blur'].includes(activeTool.value)
  fabricCanvas.isDrawingMode = isDrawMode
  // select 工具用于移动选区框，不用于选择画布上的绘制对象
  fabricCanvas.selection = false

  if (activeTool.value === 'brush') {
    const brush = new PencilBrush(fabricCanvas)
    brush.color = activeColor.value
    brush.width = activeWidth.value
    fabricCanvas.freeDrawingBrush = brush
  } else if (activeTool.value === 'eraser') {
    const brush = new PencilBrush(fabricCanvas)
    brush.color = '#ffffff'
    brush.width = activeWidth.value * 4
    fabricCanvas.freeDrawingBrush = brush
  } else if (activeTool.value === 'spray') {
    const brush = new SprayBrush(fabricCanvas)
    brush.color = activeColor.value
    brush.width = activeWidth.value * 6
    brush.density = 20
    fabricCanvas.freeDrawingBrush = brush
  } else if (activeTool.value === 'mosaic' || activeTool.value === 'blur') {
    const brush = new PencilBrush(fabricCanvas)
    brush.color = 'rgba(255,255,0,0.3)'
    brush.width = 20
    fabricCanvas.freeDrawingBrush = brush
  }

  fabricCanvas.defaultCursor = activeTool.value === 'select' ? 'default' : 'crosshair'

  // 所有绘制对象都不可选择，select 工具只用于移动选区框
  fabricCanvas.forEachObject((obj) => {
    obj.selectable = false
    obj.evented = false
  })

  fabricCanvas.off('mouse:down', onFabricDown)
  fabricCanvas.off('mouse:move', onFabricMove)
  fabricCanvas.off('mouse:up', onFabricUp)
  fabricCanvas.off('mouse:down', onFabricTextClick)

  if (['rect', 'ellipse', 'arrow', 'line', 'number'].includes(activeTool.value)) {
    fabricCanvas.on('mouse:down', onFabricDown)
    fabricCanvas.on('mouse:move', onFabricMove)
    fabricCanvas.on('mouse:up', onFabricUp)
  }
  if (activeTool.value === 'text') {
    fabricCanvas.on('mouse:down', onFabricTextClick)
  }
}

let drawStart = null
let drawObj = null

function onFabricDown(opt) {
  if (activeTool.value === 'select') return
  const p = opt.scenePoint || fabricCanvas.getScenePoint(opt.e)
  drawStart = { x: p.x, y: p.y }
  fabricCanvas.selection = false
  phase.value = 'annotating'

  if (activeTool.value === 'number') {
    const circle = new Circle({
      left: p.x,
      top: p.y,
      radius: 12,
      fill: activeColor.value,
      originX: 'center',
      originY: 'center',
      selectable: true
    })
    const text = new IText(String(numberCounter++), {
      left: p.x,
      top: p.y,
      fontSize: 14,
      fill: '#ffffff',
      fontWeight: 'bold',
      originX: 'center',
      originY: 'center',
      selectable: false,
      editable: false
    })
    fabricCanvas.add(circle, text)
    fabricCanvas.renderAll()
    drawStart = null
    return
  }

  if (activeTool.value === 'rect') {
    drawObj = new Rect({
      left: p.x,
      top: p.y,
      width: 0,
      height: 0,
      fill: 'transparent',
      stroke: activeColor.value,
      strokeWidth: activeWidth.value
    })
  } else if (activeTool.value === 'ellipse') {
    drawObj = new Ellipse({
      left: p.x,
      top: p.y,
      rx: 0,
      ry: 0,
      fill: 'transparent',
      stroke: activeColor.value,
      strokeWidth: activeWidth.value
    })
  } else if (activeTool.value === 'line') {
    drawObj = new Line([p.x, p.y, p.x, p.y], {
      stroke: activeColor.value,
      strokeWidth: activeWidth.value
    })
  } else if (activeTool.value === 'arrow') {
    drawObj = new Line([p.x, p.y, p.x, p.y], {
      stroke: activeColor.value,
      strokeWidth: activeWidth.value,
      _isArrow: true
    })
  }
  if (drawObj) fabricCanvas.add(drawObj)
}

function onFabricMove(opt) {
  if (!drawStart || !drawObj) return
  const p = opt.scenePoint || fabricCanvas.getScenePoint(opt.e)
  const dx = p.x - drawStart.x,
    dy = p.y - drawStart.y

  if (activeTool.value === 'rect') {
    drawObj.set({
      left: Math.min(drawStart.x, p.x),
      top: Math.min(drawStart.y, p.y),
      width: Math.abs(dx),
      height: Math.abs(dy)
    })
  } else if (activeTool.value === 'ellipse') {
    drawObj.set({
      left: Math.min(drawStart.x, p.x),
      top: Math.min(drawStart.y, p.y),
      rx: Math.abs(dx) / 2,
      ry: Math.abs(dy) / 2
    })
  } else if (activeTool.value === 'line' || activeTool.value === 'arrow') {
    drawObj.set({ x2: p.x, y2: p.y })
  }
  fabricCanvas.renderAll()
}

function onFabricUp() {
  if (drawObj) {
    if (drawObj._isArrow) applyArrowHead(drawObj)
  }
  drawObj = null
  drawStart = null
  // select 工具不启用 Fabric 的选择功能
  if (fabricCanvas) fabricCanvas.selection = false
}

function onFabricTextClick(opt) {
  const p = opt.scenePoint || fabricCanvas.getScenePoint(opt.e)
  phase.value = 'annotating'
  const text = new IText('文本', {
    left: p.x,
    top: p.y,
    fontSize: 18,
    fill: activeColor.value,
    fontFamily: 'sans-serif',
    editable: true
  })
  fabricCanvas.add(text)
  fabricCanvas.setActiveObject(text)
  text.enterEditing()
  text.selectAll()
  fabricCanvas.renderAll()
}

function onPathCreated(opt) {
  const path = opt.path
  if (!path) return
  if (activeTool.value === 'mosaic') {
    applyMosaicPath(path)
  } else if (activeTool.value === 'blur') {
    applyBlurPath(path)
  }
}

function applyMosaicPath(path) {
  const bbox = path.getBoundingRect()
  const r = selRect.value
  const x = Math.round((bbox.left + r.x) * scaleFactor)
  const y = Math.round((bbox.top + r.y) * scaleFactor)
  const w = Math.round(bbox.width * scaleFactor)
  const h = Math.round(bbox.height * scaleFactor)
  if (w < 2 || h < 2) {
    fabricCanvas.remove(path)
    return
  }
  const bs = 8 * scaleFactor
  const tmpC = document.createElement('canvas')
  tmpC.width = w
  tmpC.height = h
  const tc = tmpC.getContext('2d')
  tc.drawImage(bgCanvas.value, x, y, w, h, 0, 0, w, h)
  for (let bx = 0; bx < w; bx += bs) {
    for (let by = 0; by < h; by += bs) {
      const px = tc.getImageData(bx, by, 1, 1).data
      tc.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`
      tc.fillRect(bx, by, bs, bs)
    }
  }
  // 用画笔轨迹作为遮罩，只保留涂抹区域
  const maskC = document.createElement('canvas')
  maskC.width = w
  maskC.height = h
  const mc = maskC.getContext('2d')
  mc.translate(-bbox.left * scaleFactor, -bbox.top * scaleFactor)
  mc.scale(scaleFactor, scaleFactor)
  mc.lineCap = 'round'
  mc.lineJoin = 'round'
  mc.lineWidth = path.strokeWidth || 20
  mc.strokeStyle = '#fff'
  const pathEl = new Path2D(path.path.map(seg => seg.join(' ')).join(' '))
  mc.stroke(pathEl)

  // 将马赛克结果按遮罩裁剪
  tc.globalCompositeOperation = 'destination-in'
  tc.drawImage(maskC, 0, 0)

  const mosaicImg = new Image()
  mosaicImg.onload = () => {
    const fi = new FabricImage(mosaicImg, {
      left: bbox.left,
      top: bbox.top,
      scaleX: bbox.width / w,
      scaleY: bbox.height / h
    })
    fabricCanvas.remove(path)
    fabricCanvas.add(fi)
    fabricCanvas.renderAll()
  }
  mosaicImg.src = tmpC.toDataURL()
}

function applyBlurPath(path) {
  const bbox = path.getBoundingRect()
  const r = selRect.value
  const x = Math.round((bbox.left + r.x) * scaleFactor)
  const y = Math.round((bbox.top + r.y) * scaleFactor)
  const w = Math.round(bbox.width * scaleFactor)
  const h = Math.round(bbox.height * scaleFactor)
  if (w < 2 || h < 2) {
    fabricCanvas.remove(path)
    return
  }
  const tmpC = document.createElement('canvas')
  tmpC.width = w
  tmpC.height = h
  const tc = tmpC.getContext('2d')
  tc.filter = 'blur(8px)'
  tc.drawImage(bgCanvas.value, x, y, w, h, 0, 0, w, h)
  tc.filter = 'none'

  // 用画笔轨迹作为遮罩
  const maskC = document.createElement('canvas')
  maskC.width = w
  maskC.height = h
  const mc = maskC.getContext('2d')
  mc.translate(-bbox.left * scaleFactor, -bbox.top * scaleFactor)
  mc.scale(scaleFactor, scaleFactor)
  mc.lineCap = 'round'
  mc.lineJoin = 'round'
  mc.lineWidth = path.strokeWidth || 20
  mc.strokeStyle = '#fff'
  const pathEl = new Path2D(path.path.map(seg => seg.join(' ')).join(' '))
  mc.stroke(pathEl)

  tc.globalCompositeOperation = 'destination-in'
  tc.drawImage(maskC, 0, 0)

  const blurImg = new Image()
  blurImg.onload = () => {
    const fi = new FabricImage(blurImg, {
      left: bbox.left,
      top: bbox.top,
      scaleX: bbox.width / w,
      scaleY: bbox.height / h
    })
    fabricCanvas.remove(path)
    fabricCanvas.add(fi)
    fabricCanvas.renderAll()
  }
  blurImg.src = tmpC.toDataURL()
}

function applyMosaic(rect) {
  const r = selRect.value
  const x = Math.round((rect.left + r.x) * scaleFactor)
  const y = Math.round((rect.top + r.y) * scaleFactor)
  const w = Math.round(rect.width * scaleFactor)
  const h = Math.round(rect.height * scaleFactor)
  if (w < 2 || h < 2) {
    fabricCanvas.remove(rect)
    return
  }
  const bs = 8 * scaleFactor
  const tmpC = document.createElement('canvas')
  tmpC.width = w
  tmpC.height = h
  const tc = tmpC.getContext('2d')
  tc.drawImage(bgCanvas.value, x, y, w, h, 0, 0, w, h)
  for (let bx = 0; bx < w; bx += bs) {
    for (let by = 0; by < h; by += bs) {
      const px = tc.getImageData(bx, by, 1, 1).data
      tc.fillStyle = `rgb(${px[0]},${px[1]},${px[2]})`
      tc.fillRect(bx, by, bs, bs)
    }
  }
  const mosaicImg = new Image()
  mosaicImg.onload = () => {
    const fi = new FabricImage(mosaicImg, {
      left: rect.left,
      top: rect.top,
      scaleX: rect.width / w,
      scaleY: rect.height / h
    })
    fabricCanvas.remove(rect)
    fabricCanvas.add(fi)
    fabricCanvas.renderAll()
  }
  mosaicImg.src = tmpC.toDataURL()
}

function applyBlur(rect) {
  const r = selRect.value
  const x = Math.round((rect.left + r.x) * scaleFactor)
  const y = Math.round((rect.top + r.y) * scaleFactor)
  const w = Math.round(rect.width * scaleFactor)
  const h = Math.round(rect.height * scaleFactor)
  if (w < 2 || h < 2) {
    fabricCanvas.remove(rect)
    return
  }
  const tmpC = document.createElement('canvas')
  tmpC.width = w
  tmpC.height = h
  const tc = tmpC.getContext('2d')
  tc.filter = 'blur(8px)'
  tc.drawImage(bgCanvas.value, x, y, w, h, 0, 0, w, h)
  const blurImg = new Image()
  blurImg.onload = () => {
    const fi = new FabricImage(blurImg, {
      left: rect.left,
      top: rect.top,
      scaleX: rect.width / w,
      scaleY: rect.height / h
    })
    fabricCanvas.remove(rect)
    fabricCanvas.add(fi)
    fabricCanvas.renderAll()
  }
  blurImg.src = tmpC.toDataURL()
}

function applyArrowHead(line) {
  const x1 = line.x1,
    y1 = line.y1,
    x2 = line.x2,
    y2 = line.y2
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const hl = 14
  const head = new Polyline(
    [
      { x: x2, y: y2 },
      { x: x2 - hl * Math.cos(angle - Math.PI / 6), y: y2 - hl * Math.sin(angle - Math.PI / 6) },
      { x: x2 - hl * Math.cos(angle + Math.PI / 6), y: y2 - hl * Math.sin(angle + Math.PI / 6) }
    ],
    { fill: line.stroke, stroke: line.stroke, strokeWidth: 1, selectable: false, evented: false }
  )
  fabricCanvas.add(head)
  fabricCanvas.renderAll()
}

// --- Selection events ---
function onMouseMove(e) {
  mousePos.x = e.clientX
  mousePos.y = e.clientY
  if (showMagnifier.value) {
    currentColor.value = getPixelColor(e.clientX, e.clientY)
    updateMagnifier(e.clientX, e.clientY)
  }
  if (phase.value === 'selecting') {
    selection.w = e.clientX - selection.x
    selection.h = e.clientY - selection.y
    drawOverlay()
  } else if (phase.value === 'idle') {
    const mx = e.clientX
    const my = e.clientY
    let best = null
    let bestArea = Infinity
    for (const r of windowRects) {
      if (mx >= r.x && my >= r.y && mx < r.x + r.w && my < r.y + r.h) {
        const area = r.w * r.h
        if (area < bestArea) {
          bestArea = area
          best = r
        }
      }
    }
    if (best !== hoveredRect) {
      hoveredRect = best
      drawOverlay()
    }
  }
}

function onMouseDown(e) {
  if (e.button === 2) {
    onRightClick()
    return
  }
  if (e.button !== 0) return
  if (phase.value === 'idle') {
    dragStartPos = { x: e.clientX, y: e.clientY }
    phase.value = 'selecting'
    selection.x = e.clientX
    selection.y = e.clientY
    selection.w = 0
    selection.h = 0
  }
}

function onMouseUp(e) {
  if (e.button !== 0) return
  if (phase.value === 'selecting') {
    if (Math.abs(selection.w) < 3 || Math.abs(selection.h) < 3) {
      if (hoveredRect) {
        selection.x = Math.max(0, hoveredRect.x)
        selection.y = Math.max(0, hoveredRect.y)
        selection.w = Math.min(hoveredRect.w, screenW - selection.x)
        selection.h = Math.min(hoveredRect.h, screenH - selection.y)
        phase.value = 'selected'
        hoveredRect = null
        dragStartPos = null
        initFabric()
        return
      }
      phase.value = 'idle'
      selection.w = 0
      selection.h = 0
      dragStartPos = null
      drawOverlay()
      return
    }
    if (selection.w < 0) {
      selection.x += selection.w
      selection.w = -selection.w
    }
    if (selection.h < 0) {
      selection.y += selection.h
      selection.h = -selection.h
    }
    phase.value = 'selected'
    hoveredRect = null
    dragStartPos = null
    initFabric()
  }
}

function onDblClick() {
  if (phase.value === 'idle') {
    selection.x = 0
    selection.y = 0
    selection.w = screenW
    selection.h = screenH
    phase.value = 'selected'
    initFabric()
  }
}

// --- Resize / Move selection ---
function onResizeMouseDown(mode, e) {
  resizeMode = mode
  resizeStart = {
    mx: e.clientX,
    my: e.clientY,
    x: selection.x,
    y: selection.y,
    w: selection.w,
    h: selection.h
  }
  document.addEventListener('mousemove', onResizeMouseMove)
  document.addEventListener('mouseup', onResizeMouseUp)
}

let moveBgCanvas = null
function updateFabricBackground() {
  if (!fabricCanvas || !bgCanvas.value) return
  const r = selRect.value
  if (!moveBgCanvas) moveBgCanvas = document.createElement('canvas')
  moveBgCanvas.width = r.w * scaleFactor
  moveBgCanvas.height = r.h * scaleFactor
  const tc = moveBgCanvas.getContext('2d')
  tc.drawImage(
    bgCanvas.value,
    r.x * scaleFactor,
    r.y * scaleFactor,
    r.w * scaleFactor,
    r.h * scaleFactor,
    0, 0,
    moveBgCanvas.width,
    moveBgCanvas.height
  )
  const fi = new FabricImage(moveBgCanvas, { selectable: false, evented: false })
  fi.scaleToWidth(r.w)
  fabricCanvas.backgroundImage = fi
  fabricCanvas.renderAll()
}

function onResizeMouseMove(e) {
  if (!resizeStart) return
  const dx = e.clientX - resizeStart.mx
  const dy = e.clientY - resizeStart.my
  const MIN = 10

  if (resizeMode === 'move') {
    let nx = resizeStart.x + dx
    let ny = resizeStart.y + dy
    nx = Math.max(0, Math.min(nx, screenW - resizeStart.w))
    ny = Math.max(0, Math.min(ny, screenH - resizeStart.h))
    selection.x = nx
    selection.y = ny
    updateFabricBackground()
  } else {
    let { x, y, w, h } = resizeStart

    if (resizeMode.includes('w')) {
      const newX = Math.max(0, x + dx)
      const newW = w - (newX - x)
      if (newW >= MIN) { selection.x = newX; selection.w = newW }
    }
    if (resizeMode.includes('e')) {
      const newW = Math.min(screenW - x, w + dx)
      if (newW >= MIN) { selection.w = newW }
    }
    if (resizeMode.includes('n')) {
      const newY = Math.max(0, y + dy)
      const newH = h - (newY - y)
      if (newH >= MIN) { selection.y = newY; selection.h = newH }
    }
    if (resizeMode.includes('s')) {
      const newH = Math.min(screenH - y, h + dy)
      if (newH >= MIN) { selection.h = newH }
    }
    if (fabricCanvas) {
      const r = selRect.value
      fabricCanvas.setDimensions({ width: r.w, height: r.h })
      updateFabricBackground()
    }
  }
}

function onResizeMouseUp() {
  document.removeEventListener('mousemove', onResizeMouseMove)
  document.removeEventListener('mouseup', onResizeMouseUp)
  if (resizeMode && resizeStart) {
    const moved = resizeStart.x !== selection.x || resizeStart.y !== selection.y ||
                  resizeStart.w !== selection.w || resizeStart.h !== selection.h
    if (moved) initFabric()
  }
  resizeMode = null
  resizeStart = null
}

function onRightClick() {
  if (fabricCanvas && fabricCanvas.getObjects().length > 0) {
    const objs = fabricCanvas.getObjects()
    fabricCanvas.remove(objs[objs.length - 1])
    fabricCanvas.renderAll()
    return
  }
  if (showEditor.value) {
    phase.value = 'idle'
    selection.w = 0
    selection.h = 0
    hoveredRect = null
    numberCounter = 1
    if (fabricCanvas) {
      fabricCanvas.dispose()
      fabricCanvas = null
    }
    undoStack = []
    redoStack = []
    drawOverlay()
    return
  }
  doClose()
}

// --- Actions ---
function getCompositeDataUrl() {
  if (!fabricCanvas) return ''
  return fabricCanvas.toDataURL({ format: 'png', multiplier: scaleFactor })
}

function doCopy() {
  window.api.screenshotCapture(getCompositeDataUrl())
}
function doSave() {
  window.api.screenshotSave(getCompositeDataUrl())
}
function doPin() {
  window.api.screenshotPin(getCompositeDataUrl(), selRect.value)
}
function doClose() {
  window.api.screenshotCancel()
}

// --- Keyboard ---
function onKeyDown(e) {
  if (e.key === 'Escape') {
    doClose()
    return
  }
  if (e.key === 'Enter' || ((e.ctrlKey || e.metaKey) && e.key === 'c')) {
    if (showEditor.value) {
      doCopy()
      return
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    if (showEditor.value) doSave()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 't') {
    e.preventDefault()
    if (showEditor.value) doPin()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    undo()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault()
    redo()
    return
  }
  if (e.key === 'Shift' && !e.repeat)
    colorFormat.value = colorFormat.value === 'hex' ? 'rgb' : 'hex'
}

watch(activeTool, () => {
  if (fabricCanvas) setupFabricTool()
})
watch(activeColor, (c) => {
  if (fabricCanvas && fabricCanvas.freeDrawingBrush && activeTool.value !== 'eraser')
    fabricCanvas.freeDrawingBrush.color = c
})
watch(activeWidth, (w) => {
  if (fabricCanvas && fabricCanvas.freeDrawingBrush) {
    if (activeTool.value === 'eraser') fabricCanvas.freeDrawingBrush.width = w * 4
    else if (activeTool.value === 'spray') fabricCanvas.freeDrawingBrush.width = w * 6
    else fabricCanvas.freeDrawingBrush.width = w
  }
})

let toolbarObserver = null

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  toolbarObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      toolbarW.value = entry.contentRect.width + 14
    }
  })
  if (toolbarEl.value) toolbarObserver.observe(toolbarEl.value)
  window.api.onScreenshotCopy(() => {
    if (showEditor.value) {
      doCopy()
    }
  })
  window.api.onScreenshotData((data) => {
    scaleFactor = data.scaleFactor
    screenW = data.width
    screenH = data.height
    const wa = data.workArea
    workAreaBottom = wa ? wa.y + wa.height : screenH
    windowRects = data.windowRects || []
    hoveredRect = null
    dragStartPos = null
    const img = new Image()
    img.onload = () => {
      const bg = bgCanvas.value
      bg.width = data.width * scaleFactor
      bg.height = data.height * scaleFactor
      bg.style.width = data.width + 'px'
      bg.style.height = data.height + 'px'
      bgCtx = bg.getContext('2d', { willReadFrequently: true })
      bgCtx.drawImage(img, 0, 0, bg.width, bg.height)
      const ov = overlayCanvas.value
      ov.width = bg.width
      ov.height = bg.height
      ov.style.width = data.width + 'px'
      ov.style.height = data.height + 'px'
      ovCtx = ov.getContext('2d')
      drawOverlay()
      window.api.screenshotShow()
    }
    if (data.imagePath) {
      img.src = 'file://' + data.imagePath
    } else {
      img.src = data.imageDataUrl
    }
  })
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('mousemove', onResizeMouseMove)
  document.removeEventListener('mouseup', onResizeMouseUp)
  if (toolbarObserver) toolbarObserver.disconnect()
  if (fabricCanvas) fabricCanvas.dispose()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html,
body,
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

.screenshot-root {
  position: relative;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  user-select: none;
}
.layer {
  position: absolute;
  top: 0;
  left: 0;
}
.sel-layer {
  z-index: 2;
  cursor: crosshair;
}

.fabric-wrap {
  position: absolute;
  z-index: 10;
  outline: 1.5px solid #0088ff;
  outline-offset: 0px;
  overflow: visible;
}

.move-overlay {
  position: absolute;
  z-index: 11;
  cursor: move;
  background: transparent;
}

.resize-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #fff;
  border: 1.5px solid #0088ff;
  z-index: 12;
}
.fabric-wrap canvas {
  display: block;
}

.mask-top,
.mask-bottom,
.mask-left,
.mask-right {
  position: absolute;
  background: rgba(0, 0, 0, 0.45);
  z-index: 5;
  pointer-events: none;
}

.magnifier {
  position: fixed;
  z-index: 200;
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 4px;
  pointer-events: none;
}
.mag-info {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  padding: 2px 4px;
}
.mag-swatch {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  border: 1px solid #555;
  flex-shrink: 0;
}
.mag-text {
  color: #fff;
  font-size: 11px;
  font-family: monospace;
}
.mag-pos {
  color: #999;
  font-size: 10px;
  font-family: monospace;
  padding: 0 4px 2px;
}

.size-label {
  position: fixed;
  z-index: 200;
  background: rgba(0, 136, 255, 0.85);
  color: #fff;
  font-size: 11px;
  font-family: monospace;
  padding: 2px 6px;
  border-radius: 3px;
  pointer-events: none;
}

.toolbar {
  position: fixed;
  z-index: 300;
  display: flex;
  align-items: center;
  gap: 2px;
  background: #222;
  border: 1px solid #444;
  border-radius: 5px;
  padding: 4px 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}
.tg {
  display: flex;
  gap: 2px;
}
.sep {
  display: block;
  width: 1px;
  height: 22px;
  background: #444;
  margin: 0 4px;
}

.toolbar button {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: #bbb;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  font-size: 13px;
}
.toolbar button:hover {
  background: #3a3a3a;
  color: #fff;
}
.toolbar button.active {
  background: #0078d4;
  color: #fff;
}
.toolbar button svg {
  width: 16px;
  height: 16px;
}

.cbtn {
  border-radius: 50% !important;
  border: 2px solid #555 !important;
  width: 18px !important;
  height: 18px !important;
  min-width: 18px;
  padding: 0 !important;
}
.cbtn.active {
  border-color: #fff !important;
}
.dot {
  display: block;
  background: currentColor;
  border-radius: 50%;
}

.acts button {
  font-weight: bold;
}
.acts .ok {
  color: #4caf50;
}
.acts .ok:hover {
  background: #4caf50;
  color: #fff;
}
.acts .no {
  color: #f44;
}
.acts .no:hover {
  background: #f44;
  color: #fff;
}
.acts .pin:hover {
  background: #ff9800;
}

.custom-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #111;
  color: #eee;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 999;
}
</style>
