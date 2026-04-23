import type { Node, Edge } from '@xyflow/react'
import type { KnowledgeNode } from '../types'

// Exported so Timeline and other components can use the same coordinate system
export const LAYOUT_CONSTANTS = {
  LEVEL_HEIGHT: 78,
  LEAF_GAP: 72,
  BASE_YEAR: 1940,
  PX_PER_YEAR: 9,
  MAX_YEAR: 2035,
} as const

export const BRANCH_COLORS: Record<number, { dot: string; edge: string }> = {
  0: { dot: '#6366f1', edge: '#6366f155' },
  1: { dot: '#8b5cf6', edge: '#8b5cf655' },
  2: { dot: '#06b6d4', edge: '#06b6d455' },
  3: { dot: '#10b981', edge: '#10b98155' },
  4: { dot: '#f59e0b', edge: '#f59e0b55' },
  5: { dot: '#ef4444', edge: '#ef444455' },
  6: { dot: '#ec4899', edge: '#ec489955' },
}

export function getBranchColor(depth: number) {
  return BRANCH_COLORS[Math.min(depth, 6)]
}

// ── Internal tree used for DFS column ordering ──
interface TN {
  children: Map<string, TN>
  hasDirect: boolean // has KnowledgeNode leaves directly at this depth
}

function buildTN(knodes: KnowledgeNode[]): TN {
  const root: TN = { children: new Map(), hasDirect: false }
  for (const kn of knodes) {
    const branches = kn.branches.filter(Boolean) as string[]
    let cur = root
    for (const b of branches) {
      if (!cur.children.has(b)) cur.children.set(b, { children: new Map(), hasDirect: false })
      cur = cur.children.get(b)!
    }
    cur.hasDirect = true
  }
  return root
}

// DFS column order: siblings are always adjacent → short edges, no crossing
function dfsColumns(root: TN): string[] {
  const order: string[] = []
  const seen = new Set<string>()

  function dfs(node: TN, path: string[]) {
    // Direct leaves first (before child branches), keeps leaf column left of sub-branches
    if (node.hasDirect) {
      const col = path.join('///')
      if (!seen.has(col)) { seen.add(col); order.push(col) }
    }
    for (const [label, child] of node.children) {
      dfs(child, [...path, label])
    }
  }

  dfs(root, [])
  return order
}

// Layout constants (internal layout vars + re-use exported ones)
const COL_WIDTH    = 200
const MIN_LEAF_GAP = 34
const { LEVEL_HEIGHT, LEAF_GAP, BASE_YEAR, PX_PER_YEAR } = LAYOUT_CONSTANTS

function leafTimeY(maxDepth: number, year: number) {
  return (maxDepth + 1) * LEVEL_HEIGHT + LEAF_GAP + (year - BASE_YEAR) * PX_PER_YEAR
}

export function buildGraph(
  knowledgeNodes: KnowledgeNode[],
  collapsedBranches: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  if (knowledgeNodes.length === 0) return { nodes: [], edges: [] }

  function isHidden(kn: KnowledgeNode): boolean {
    const branches = kn.branches.filter(Boolean) as string[]
    for (let i = 0; i < branches.length - 1; i++) {
      if (collapsedBranches.has(`${i}:${branches[i]}`)) return true
    }
    return false
  }

  const allSorted = [...knowledgeNodes].sort(
    (a, b) => a.timeYear - b.timeYear || a.label.localeCompare(b.label),
  )

  // ── Step 1: DFS column order from ALL nodes (layout stable on collapse) ──
  const treeRoot = buildTN(knowledgeNodes)
  const columnOrder = dfsColumns(treeRoot)

  const columnX = new Map<string, number>()
  columnOrder.forEach((col, i) => columnX.set(col, i * COL_WIDTH + COL_WIDTH / 2))

  const maxDepth = Math.max(...knowledgeNodes.map(kn => kn.branches.filter(Boolean).length - 1))

  // ── Step 2: Branch node X = average X of all leaf columns under it ──
  const branchSpan = new Map<string, Set<number>>()
  for (const kn of allSorted) {
    const branches = kn.branches.filter(Boolean) as string[]
    const cx = columnX.get(branches.join('///'))!
    if (cx === undefined) continue
    for (let i = 0; i < branches.length; i++) {
      const key = branches.slice(0, i + 1).join('///')
      const set = branchSpan.get(key) ?? new Set<number>()
      set.add(cx)
      branchSpan.set(key, set)
    }
  }

  function avgX(pathKey: string): number {
    const spans = branchSpan.get(pathKey)
    if (!spans || spans.size === 0) return 0
    const arr = [...spans]
    return arr.reduce((a, b) => a + b, 0) / arr.length
  }

  // ── Step 3: Emit nodes & edges ──
  const flowNodes: Node[] = []
  const flowEdges: Edge[] = []
  const branchCreated = new Set<string>()
  const colLastY = new Map<number, number>()

  const visibleSorted = allSorted.filter(kn => !isHidden(kn))

  for (const kn of visibleSorted) {
    const branches = kn.branches.filter(Boolean) as string[]
    const col = branches.join('///')
    const leafX = columnX.get(col)
    if (leafX === undefined) continue

    const preferred = leafTimeY(maxDepth, kn.timeYear)
    const last = colLastY.get(leafX) ?? -Infinity
    const leafY = Math.max(preferred, last + MIN_LEAF_GAP)
    colLastY.set(leafX, leafY)

    let parentId: string | null = null

    for (let i = 0; i < branches.length; i++) {
      const pathKey = branches.slice(0, i + 1).join('///')
      const collapseKey = `${i}:${branches[i]}`
      const nodeId = `branch::${pathKey}`
      const isCollapsed = collapsedBranches.has(collapseKey)

      if (!branchCreated.has(pathKey)) {
        branchCreated.add(pathKey)
        flowNodes.push({
          id: nodeId,
          type: 'branchNode',
          position: { x: avgX(pathKey), y: i * LEVEL_HEIGHT },
          data: {
            label: branches[i],
            depth: i,
            collapsed: isCollapsed,
            collapseKey,
            color: getBranchColor(i).dot,
          },
          draggable: false,
        })
      }

      if (parentId) {
        const eid = `e:${parentId}=>${nodeId}`
        if (!flowEdges.find(e => e.id === eid)) {
          flowEdges.push({
            id: eid,
            source: parentId,
            target: nodeId,
            sourceHandle: 'bottom',
            targetHandle: 'top',
            type: 'bezier',
            style: { stroke: getBranchColor(i - 1).edge, strokeWidth: 1.5 },
          })
        }
      }

      parentId = nodeId
      if (isCollapsed) { parentId = null; break }
    }

    if (parentId === null) continue

    const leafId = `leaf::${kn.id}`
    const depth = branches.length
    flowNodes.push({
      id: leafId,
      type: 'leafNode',
      position: { x: leafX, y: leafY },
      data: { node: kn, depth, color: getBranchColor(depth - 1).dot },
      draggable: false,
    })

    flowEdges.push({
      id: `e:${parentId}=>${leafId}`,
      source: parentId,
      target: leafId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: 'bezier',
      style: { stroke: getBranchColor(depth - 1).edge, strokeWidth: 1.2 },
    })
  }

  return { nodes: flowNodes, edges: flowEdges }
}
