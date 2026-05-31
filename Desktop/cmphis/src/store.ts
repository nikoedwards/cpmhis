import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { KnowledgeNode } from './types'
import { loadNodesFromXlsx, saveNodesToXlsx } from './data/dataSource'

const STORAGE_KEY           = 'cmphis_nodes'
const COLLAPSED_KEY         = 'cmphis_collapsed'
const SIDEBAR_COLLAPSED_KEY = 'cmphis_sidebar_collapsed'
const HIDDEN_KEY            = 'cmphis_hidden'
const BRANCHORDER_KEY       = 'cmphis_branchorder'
const BRANCHREG_KEY         = 'cmphis_branches'
const VIEWPORT_KEY          = 'cmphis_viewport'

// 画布缩放/平移状态（跨视图切换记忆，离开/从 wiki·数据库切回来都还原）
export type CanvasViewport = { x: number; y: number; zoom: number }

function loadViewport(): CanvasViewport | null {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

// 同级分支的手动横向排序：key = 父分支路径 join('///')（根的子级父key='计算机科学'），value = 有序的子分支 label 列表
export type BranchOrder = Record<string, string[]>

function loadBranchOrder(): BranchOrder {
  try {
    const raw = localStorage.getItem(BRANCHORDER_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}
function saveBranchOrder(o: BranchOrder) {
  try { localStorage.setItem(BRANCHORDER_KEY, JSON.stringify(o)) } catch {}
}

// 分支注册表：分支作为一等实体（key = 路径 join('///')），可独立于节点存在（用于"新建空分支"+下拉选项）
function loadBranchRegistry(): string[] {
  try {
    const raw = localStorage.getItem(BRANCHREG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}
function saveBranchRegistry(arr: string[]) {
  try { localStorage.setItem(BRANCHREG_KEY, JSON.stringify(arr)) } catch {}
}

// localStorage 仅作离线缓存：真正的数据库是 public/data.xlsx
function loadCachedNodes(): KnowledgeNode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function loadCollapsed(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return new Set(JSON.parse(raw))
  } catch {}
  return new Set()
}

function loadBool(key: string, def: boolean): boolean {
  const v = localStorage.getItem(key)
  return v === null ? def : v === 'true'
}

// 写入：缓存到 localStorage + 防抖写回 data.xlsx
let saveTimer: ReturnType<typeof setTimeout> | undefined
function saveNodes(nodes: KnowledgeNode[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes)) } catch {}
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { void saveNodesToXlsx(nodes) }, 500)
}

function saveCollapsed(key: string, s: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...s]))
}

interface AppState {
  nodes: KnowledgeNode[]
  selectedId: string | null

  // 数据加载状态
  dataLoaded: boolean

  // Canvas collapse state (what the canvas uses)
  collapsedBranches: Set<string>
  // Sidebar collapse state (independent when sync=off)
  sidebarCollapsed: Set<string>
  // Whether sidebar and canvas collapse are synced
  collapseSync: boolean

  // Explicitly hidden node IDs (hidden from canvas)
  hiddenNodes: Set<string>

  // 同级分支的手动横向排序（只改顺序，不跨层级）。布局据此排列列序，子节点自动跟随。
  branchOrder: BranchOrder

  // 分支注册表：额外的分支路径（可能尚无节点）。有效分支树 = 节点派生 ∪ 注册表。
  branchRegistry: string[]

  // 当前鼠标悬浮的节点（用于时间轴贯穿辅助线，瞬时状态、不持久化）
  hoveredId: string | null

  // 画布缩放/平移状态（持久化，跨视图记忆）
  canvasViewport: CanvasViewport | null

  // 撤销 / 重做历史（文档快照）
  past: Snapshot[]
  future: Snapshot[]

  // Actions
  loadData: () => Promise<void>
  addNode: (node: KnowledgeNode) => void
  updateNode: (id: string, patch: Partial<KnowledgeNode>) => void
  deleteNode: (id: string) => void
  deleteBranch: (pathPrefix: string[]) => void
  renameBranch: (pathPrefix: string[], newLabel: string) => void
  addBranch: (parentPath: string[], label: string) => void
  selectNode: (id: string | null) => void

  toggleCollapse: (key: string) => void
  toggleSidebarCollapse: (key: string) => void
  setCollapseSync: (v: boolean) => void

  toggleHide: (id: string) => void

  reorderBranch: (parentKey: string, orderedLabels: string[]) => void

  setHoveredId: (id: string | null) => void

  setCanvasViewport: (vp: CanvasViewport) => void

  undo: () => void
  redo: () => void

  clearAll: () => void
  resetToSeed: () => void
}

interface Snapshot {
  nodes: KnowledgeNode[]
  branchOrder: BranchOrder
  branchRegistry: string[]
  hiddenNodes: string[]
}

const HISTORY_LIMIT = 80
// 连续同类编辑（如逐字输入）合并为一步：记录上次入栈的 key 与时间
let lastPushKey: string | null = null
let lastPushTime = 0

export const useStore = create<AppState>()(
  subscribeWithSelector((set, get) => {
  // 入栈当前文档状态。coalesceKey 相同且间隔很短则合并（不重复入栈）
  const pushHistory = (coalesceKey?: string) => {
    const now = Date.now()
    if (coalesceKey && coalesceKey === lastPushKey && now - lastPushTime < 900) {
      lastPushTime = now
      return
    }
    lastPushKey = coalesceKey ?? null
    lastPushTime = now
    const { nodes, branchOrder, branchRegistry, hiddenNodes, past } = get()
    const snap: Snapshot = { nodes, branchOrder, branchRegistry, hiddenNodes: [...hiddenNodes] }
    const next = past.length >= HISTORY_LIMIT ? [...past.slice(1), snap] : [...past, snap]
    set({ past: next, future: [] })
  }

  return {
    nodes: loadCachedNodes(),
    selectedId: null,
    dataLoaded: false,
    collapsedBranches: loadCollapsed(COLLAPSED_KEY),
    sidebarCollapsed: loadCollapsed(SIDEBAR_COLLAPSED_KEY),
    collapseSync: loadBool('cmphis_collapse_sync', false),
    hiddenNodes: loadCollapsed(HIDDEN_KEY),
    branchOrder: loadBranchOrder(),
    branchRegistry: loadBranchRegistry(),
    hoveredId: null,
    canvasViewport: loadViewport(),
    past: [],
    future: [],

    // 从 data.xlsx 加载数据（数据源），失败则保留缓存
    loadData: async () => {
      try {
        const nodes = await loadNodesFromXlsx()
        set({ nodes, dataLoaded: true })
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes)) } catch {}
      } catch (e) {
        console.warn('[cmphis] 加载 data.xlsx 失败，使用本地缓存：', e)
        set({ dataLoaded: true })
      }
    },

    addNode: (node) => {
      pushHistory()
      const nodes = [...get().nodes, node]
      set({ nodes })
      saveNodes(nodes)
    },
    updateNode: (id, patch) => {
      pushHistory(`edit:${id}`)
      const nodes = get().nodes.map(n => n.id === id ? { ...n, ...patch } : n)
      set({ nodes })
      saveNodes(nodes)
    },
    deleteNode: (id) => {
      pushHistory()
      const nodes = get().nodes.filter(n => n.id !== id)
      const hiddenNodes = new Set(get().hiddenNodes)
      hiddenNodes.delete(id)
      set({ nodes, hiddenNodes, selectedId: get().selectedId === id ? null : get().selectedId })
      saveNodes(nodes)
      saveCollapsed(HIDDEN_KEY, hiddenNodes)
    },
    deleteBranch: (pathPrefix) => {
      pushHistory()
      const matchesPrefix = (segs: string[]) => {
        if (segs.length < pathPrefix.length) return false
        for (let i = 0; i < pathPrefix.length; i++) {
          if (segs[i] !== pathPrefix[i]) return false
        }
        return true
      }
      const nodes = get().nodes.filter(n => {
        const branches = n.branches.filter(Boolean) as string[]
        return !matchesPrefix(branches)
      })
      // 同步注册表：移除该分支及其所有子孙
      const branchRegistry = get().branchRegistry.filter(k => !matchesPrefix(k.split('///')))
      set({ nodes, branchRegistry })
      saveNodes(nodes)
      saveBranchRegistry(branchRegistry)
    },
    renameBranch: (pathPrefix, newLabel) => {
      pushHistory()
      const depth = pathPrefix.length - 1
      if (depth < 0) return
      const matchesPrefix = (segs: string[]) => {
        if (segs.length < pathPrefix.length) return false
        for (let i = 0; i < pathPrefix.length; i++) {
          if (segs[i] !== pathPrefix[i]) return false
        }
        return true
      }
      // 同步节点：改名后其下所有节点的对应层级一起变更
      const nodes = get().nodes.map(n => {
        const branches = n.branches.filter(Boolean) as string[]
        if (!matchesPrefix(branches)) return n
        const next = [...n.branches] as KnowledgeNode['branches']
        next[depth] = newLabel
        return { ...n, branches: next }
      })
      // 同步注册表
      const branchRegistry = get().branchRegistry.map(k => {
        const segs = k.split('///')
        if (!matchesPrefix(segs)) return k
        segs[depth] = newLabel
        return segs.join('///')
      })
      set({ nodes, branchRegistry })
      saveNodes(nodes)
      saveBranchRegistry(branchRegistry)
    },
    addBranch: (parentPath, label) => {
      const name = label.trim()
      if (!name) return
      const key = [...parentPath.filter(Boolean), name].join('///')
      const reg = get().branchRegistry
      // 已存在（注册表或已有节点路径）则不重复加入
      if (reg.includes(key)) return
      const exists = get().nodes.some(n => {
        const segs = (n.branches.filter(Boolean) as string[])
        return segs.slice(0, parentPath.filter(Boolean).length + 1).join('///') === key
      })
      if (exists) return
      pushHistory()
      const next = [...reg, key]
      set({ branchRegistry: next })
      saveBranchRegistry(next)
    },
    selectNode: (id) => set({ selectedId: id }),

    toggleCollapse: (key) => {
      const s = new Set(get().collapsedBranches)
      s.has(key) ? s.delete(key) : s.add(key)
      set({ collapsedBranches: s })
      saveCollapsed(COLLAPSED_KEY, s)
    },
    toggleSidebarCollapse: (key) => {
      if (get().collapseSync) {
        const s = new Set(get().collapsedBranches)
        s.has(key) ? s.delete(key) : s.add(key)
        set({ collapsedBranches: s, sidebarCollapsed: new Set(s) })
        saveCollapsed(COLLAPSED_KEY, s)
        saveCollapsed(SIDEBAR_COLLAPSED_KEY, s)
      } else {
        const s = new Set(get().sidebarCollapsed)
        s.has(key) ? s.delete(key) : s.add(key)
        set({ sidebarCollapsed: s })
        saveCollapsed(SIDEBAR_COLLAPSED_KEY, s)
      }
    },
    setCollapseSync: (v) => {
      set({ collapseSync: v })
      localStorage.setItem('cmphis_collapse_sync', String(v))
    },

    toggleHide: (id) => {
      pushHistory()
      const s = new Set(get().hiddenNodes)
      s.has(id) ? s.delete(id) : s.add(id)
      set({ hiddenNodes: s })
      saveCollapsed(HIDDEN_KEY, s)
    },

    reorderBranch: (parentKey, orderedLabels) => {
      pushHistory()
      const next = { ...get().branchOrder, [parentKey]: orderedLabels }
      set({ branchOrder: next })
      saveBranchOrder(next)
    },

    setHoveredId: (id) => { if (get().hoveredId !== id) set({ hoveredId: id }) },

    setCanvasViewport: (vp) => {
      set({ canvasViewport: vp })
      try { localStorage.setItem(VIEWPORT_KEY, JSON.stringify(vp)) } catch {}
    },

    undo: () => {
      const { past, future, nodes, branchOrder, branchRegistry, hiddenNodes } = get()
      if (past.length === 0) return
      const prev = past[past.length - 1]
      const cur: Snapshot = { nodes, branchOrder, branchRegistry, hiddenNodes: [...hiddenNodes] }
      lastPushKey = null
      set({
        nodes: prev.nodes,
        branchOrder: prev.branchOrder,
        branchRegistry: prev.branchRegistry ?? [],
        hiddenNodes: new Set(prev.hiddenNodes),
        past: past.slice(0, -1),
        future: [cur, ...future].slice(0, HISTORY_LIMIT),
      })
      saveNodes(prev.nodes)
      saveBranchOrder(prev.branchOrder)
      saveBranchRegistry(prev.branchRegistry ?? [])
      saveCollapsed(HIDDEN_KEY, new Set(prev.hiddenNodes))
    },

    redo: () => {
      const { past, future, nodes, branchOrder, branchRegistry, hiddenNodes } = get()
      if (future.length === 0) return
      const nextSnap = future[0]
      const cur: Snapshot = { nodes, branchOrder, branchRegistry, hiddenNodes: [...hiddenNodes] }
      lastPushKey = null
      set({
        nodes: nextSnap.nodes,
        branchOrder: nextSnap.branchOrder,
        branchRegistry: nextSnap.branchRegistry ?? [],
        hiddenNodes: new Set(nextSnap.hiddenNodes),
        past: [...past, cur].slice(-HISTORY_LIMIT),
        future: future.slice(1),
      })
      saveNodes(nextSnap.nodes)
      saveBranchOrder(nextSnap.branchOrder)
      saveBranchRegistry(nextSnap.branchRegistry ?? [])
      saveCollapsed(HIDDEN_KEY, new Set(nextSnap.hiddenNodes))
    },

    clearAll: () => {
      pushHistory()
      saveNodes([])
      saveCollapsed(COLLAPSED_KEY, new Set())
      saveCollapsed(SIDEBAR_COLLAPSED_KEY, new Set())
      saveCollapsed(HIDDEN_KEY, new Set())
      saveBranchOrder({})
      saveBranchRegistry([])
      set({
        nodes: [], selectedId: null,
        collapsedBranches: new Set(), sidebarCollapsed: new Set(),
        hiddenNodes: new Set(), branchOrder: {}, branchRegistry: [],
      })
    },
    // 从 data.xlsx 重新加载（丢弃未保存的本地改动）
    resetToSeed: () => { void get().loadData() },
  }
  })
)
