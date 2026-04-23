import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { KnowledgeNode } from './types'
import { seedNodes } from './data/seed'

const STORAGE_KEY   = 'cmphis_nodes'
const COLLAPSED_KEY = 'cmphis_collapsed'
const SIDEBAR_COLLAPSED_KEY = 'cmphis_sidebar_collapsed'
const VERSION_KEY   = 'cmphis_version'
const STORAGE_VERSION = 'v2'

function loadNodes(): KnowledgeNode[] {
  try {
    if (localStorage.getItem(VERSION_KEY) !== STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(COLLAPSED_KEY)
      localStorage.removeItem(SIDEBAR_COLLAPSED_KEY)
      localStorage.setItem(VERSION_KEY, STORAGE_VERSION)
      return []
    }
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

function saveNodes(nodes: KnowledgeNode[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes))
}

function saveCollapsed(key: string, s: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...s]))
}

interface AppState {
  nodes: KnowledgeNode[]
  selectedId: string | null

  // Canvas collapse state (what the canvas uses)
  collapsedBranches: Set<string>
  // Sidebar collapse state (independent when sync=off)
  sidebarCollapsed: Set<string>
  // Whether sidebar and canvas collapse are synced
  collapseSync: boolean

  // Actions
  addNode: (node: KnowledgeNode) => void
  updateNode: (id: string, patch: Partial<KnowledgeNode>) => void
  deleteNode: (id: string) => void
  deleteBranch: (pathPrefix: string[]) => void  // delete all nodes under a branch
  selectNode: (id: string | null) => void

  toggleCollapse: (key: string) => void         // canvas collapse
  toggleSidebarCollapse: (key: string) => void  // sidebar collapse (respects sync)
  setCollapseSync: (v: boolean) => void

  clearAll: () => void
  resetToSeed: () => void
}

export const useStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    nodes: loadNodes(),
    selectedId: null,
    collapsedBranches: loadCollapsed(COLLAPSED_KEY),
    sidebarCollapsed: loadCollapsed(SIDEBAR_COLLAPSED_KEY),
    collapseSync: loadBool('cmphis_collapse_sync', false),

    addNode: (node) => {
      const nodes = [...get().nodes, node]
      set({ nodes })
      saveNodes(nodes)
    },
    updateNode: (id, patch) => {
      const nodes = get().nodes.map(n => n.id === id ? { ...n, ...patch } : n)
      set({ nodes })
      saveNodes(nodes)
    },
    deleteNode: (id) => {
      const nodes = get().nodes.filter(n => n.id !== id)
      set({ nodes, selectedId: get().selectedId === id ? null : get().selectedId })
      saveNodes(nodes)
    },
    deleteBranch: (pathPrefix) => {
      const nodes = get().nodes.filter(n => {
        const branches = n.branches.filter(Boolean) as string[]
        // Keep node if its path doesn't start with pathPrefix
        for (let i = 0; i < pathPrefix.length; i++) {
          if (branches[i] !== pathPrefix[i]) return true
        }
        return false
      })
      set({ nodes })
      saveNodes(nodes)
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
        // Sync mode: update both
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

    clearAll: () => {
      saveNodes([])
      saveCollapsed(COLLAPSED_KEY, new Set())
      saveCollapsed(SIDEBAR_COLLAPSED_KEY, new Set())
      set({ nodes: [], selectedId: null, collapsedBranches: new Set(), sidebarCollapsed: new Set() })
    },
    resetToSeed: () => {
      saveNodes(seedNodes)
      set({ nodes: seedNodes })
    },
  }))
)
