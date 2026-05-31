import type { Node, Edge } from '@xyflow/react'
import type { KnowledgeNode } from '../types'

// Exported so Timeline and other components can use the same coordinate system
export const LAYOUT_CONSTANTS = {
  LEVEL_HEIGHT: 78,
  LEAF_GAP: 72,
  BASE_YEAR: 1940,
  PX_PER_YEAR: 9,
  MAX_YEAR: 2035,
  COL_WIDTH: 300,
} as const

// 节点标签最大宽度（px），超出截断；确保单个节点不越出所在列、避免相邻列横向重叠
export const LABEL_MAX_W = 210

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

export const MIN_YEAR = -20000

// ── 非线性时间轴 ──────────────────────────────────────────────────────────
// 近代（>= BASE_YEAR）保持线性 9px/年，密度与原来一致；
// 古代（< BASE_YEAR）按锚点分段压缩，使上万年的脉络能落进约 560px 的带内。
// yearToOffset 返回相对“叶子区起点”的像素偏移（古代为负，越早越靠上）。
const YEAR_ANCHORS: [number, number][] = [
  [-20000, -560],
  [-3000, -470],
  [-300, -410],
  [600, -372],
  [900, -350],
  [1200, -330],
  [1450, -300],
  [1600, -258],
  [1650, -236],
  [1700, -214],
  [1750, -190],
  [1800, -165],
  [1850, -130],
  [1900, -80],
  [1940, 0],
]

export function yearToOffset(year: number): number {
  const { BASE_YEAR, PX_PER_YEAR } = LAYOUT_CONSTANTS
  if (year >= BASE_YEAR) return (year - BASE_YEAR) * PX_PER_YEAR
  const A = YEAR_ANCHORS
  if (year <= A[0][0]) return A[0][1]
  for (let i = 0; i < A.length - 1; i++) {
    const [y0, o0] = A[i]
    const [y1, o1] = A[i + 1]
    if (year >= y0 && year <= y1) {
      const t = (year - y0) / (y1 - y0)
      return o0 + t * (o1 - o0)
    }
  }
  return 0
}

export function offsetToYear(offset: number): number {
  const { BASE_YEAR, PX_PER_YEAR } = LAYOUT_CONSTANTS
  if (offset >= 0) return BASE_YEAR + offset / PX_PER_YEAR
  const A = YEAR_ANCHORS
  if (offset <= A[0][1]) return A[0][0]
  for (let i = 0; i < A.length - 1; i++) {
    const [y0, o0] = A[i]
    const [y1, o1] = A[i + 1]
    if (offset >= o0 && offset <= o1) {
      const t = (offset - o0) / (o1 - o0)
      return y0 + t * (y1 - y0)
    }
  }
  return BASE_YEAR
}

export function canvasYToYear(canvasY: number, maxDepth: number): number {
  const { LEVEL_HEIGHT, LEAF_GAP } = LAYOUT_CONSTANTS
  const leafAreaStart = (maxDepth + 1) * LEVEL_HEIGHT + LEAF_GAP
  return offsetToYear(canvasY - leafAreaStart)
}

// ── 数据驱动（密度自适应）时间标尺 ───────────────────────────────────────────
// 痛点：节点密集的时间段，防重叠堆叠会把节点压到远低于其真实时间位置，
// 固定 9px/年 的标尺就对不上了。这里按“每列累计节点数”给密集年份额外预留竖向空间，
// 稀疏处仍保持线性；布局与左侧标尺共用同一标尺 → 刻度永远落在节点真实位置上。
export interface TimeScale {
  yearToOffset: (year: number) => number
  offsetToYear: (offset: number) => number
}

// 静态线性标尺（无数据时的回退）
export const STATIC_SCALE: TimeScale = { yearToOffset, offsetToYear }

const GAP_PER_NODE = 34 // 每个堆叠节点为标尺预留的像素（与叶子最小间距 MIN_LEAF_GAP 一致）

export function buildTimeScale(nodes: KnowledgeNode[]): TimeScale {
  const { BASE_YEAR, PX_PER_YEAR } = LAYOUT_CONSTANTS

  // 收集近代（>=BASE_YEAR）时间带节点（branches 多于一级），按列分组
  const colYears = new Map<string, number[]>()
  for (const kn of nodes) {
    const b = kn.branches.filter(Boolean) as string[]
    if (b.length <= 1) continue
    if (kn.timeYear < BASE_YEAR) continue
    const key = b.join('///')
    const arr = colYears.get(key)
    if (arr) arr.push(kn.timeYear)
    else colYears.set(key, [kn.timeYear])
  }
  const cols = [...colYears.values()].map(a => a.sort((x, y) => x - y))

  // cumBefore(y) = 各列中「年份 < y」的节点数的最大值（密集列决定该处需要的竖向空间）
  const cumBefore = (y: number): number => {
    let m = 0
    for (const arr of cols) {
      let lo = 0, hi = arr.length
      while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < y) lo = mid + 1; else hi = mid }
      if (lo > m) m = lo
    }
    return m
  }

  // 锚点：所有出现的近代年份（含 BASE_YEAR），offset = 线性 + 累计密度拉伸
  const yearSet = new Set<number>([BASE_YEAR])
  for (const arr of cols) for (const y of arr) yearSet.add(y)
  const years = [...yearSet].sort((a, b) => a - b)
  const anchors: [number, number][] = years.map(y => [
    y, (y - BASE_YEAR) * PX_PER_YEAR + cumBefore(y) * GAP_PER_NODE,
  ])
  if (anchors.length === 0) anchors.push([BASE_YEAR, 0])
  const last = anchors[anchors.length - 1]

  return {
    yearToOffset(year) {
      if (year < BASE_YEAR) return yearToOffset(year)           // 古代用静态分段
      if (year <= anchors[0][0]) return (year - BASE_YEAR) * PX_PER_YEAR
      for (let i = 0; i < anchors.length - 1; i++) {
        const [y0, o0] = anchors[i], [y1, o1] = anchors[i + 1]
        if (year >= y0 && year <= y1) {
          const t = (year - y0) / (y1 - y0 || 1)
          return o0 + t * (o1 - o0)
        }
      }
      return last[1] + (year - last[0]) * PX_PER_YEAR           // 超出末锚点：线性延续
    },
    offsetToYear(offset) {
      if (offset < 0) return offsetToYear(offset)
      if (offset <= anchors[0][1]) return BASE_YEAR + offset / PX_PER_YEAR
      for (let i = 0; i < anchors.length - 1; i++) {
        const [y0, o0] = anchors[i], [y1, o1] = anchors[i + 1]
        if (offset >= o0 && offset <= o1) {
          const t = (offset - o0) / (o1 - o0 || 1)
          return y0 + t * (y1 - y0)
        }
      }
      return last[0] + (offset - last[1]) / PX_PER_YEAR
    },
  }
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

// DFS column order: siblings are always adjacent → short edges, no crossing.
// branchOrder 为用户手动调整的同级横向顺序（key=父路径），未列出的子级按原序追加在后。
function dfsColumns(root: TN, branchOrder: Record<string, string[]> = {}): string[] {
  const order: string[] = []
  const seen = new Set<string>()

  function sortedChildren(node: TN, path: string[]): [string, TN][] {
    const entries = [...node.children.entries()]
    const custom = branchOrder[path.join('///')]
    if (!custom || custom.length === 0) return entries
    const rank = new Map(custom.map((l, i) => [l, i]))
    return entries
      .map((e, i) => ({ e, i }))
      .sort((a, b) => {
        const ra = rank.has(a.e[0]) ? rank.get(a.e[0])! : custom.length + a.i
        const rb = rank.has(b.e[0]) ? rank.get(b.e[0])! : custom.length + b.i
        return ra - rb
      })
      .map(x => x.e)
  }

  function dfs(node: TN, path: string[]) {
    // Direct leaves first (before child branches), keeps leaf column left of sub-branches
    if (node.hasDirect) {
      const col = path.join('///')
      if (!seen.has(col)) { seen.add(col); order.push(col) }
    }
    for (const [label, child] of sortedChildren(node, path)) {
      dfs(child, [...path, label])
    }
  }

  dfs(root, [])
  return order
}

const { LEVEL_HEIGHT, LEAF_GAP, COL_WIDTH } = LAYOUT_CONSTANTS

function leafTimeY(maxDepth: number, year: number, scale: TimeScale = STATIC_SCALE) {
  return (maxDepth + 1) * LEVEL_HEIGHT + LEAF_GAP + scale.yearToOffset(year)
}

export interface BranchMetaItem { x: number; depth: number; parentKey: string; label: string }

export function buildGraph(
  knowledgeNodes: KnowledgeNode[],
  collapsedBranches: Set<string>,
  hiddenNodes: Set<string> = new Set(),
  branchOrder: Record<string, string[]> = {},
  scale: TimeScale = STATIC_SCALE,
): { nodes: Node[]; edges: Edge[]; columnXMap: Map<string, number>; branchMeta: Map<string, BranchMetaItem> } {
  const branchMeta = new Map<string, BranchMetaItem>()
  // Filter out explicitly hidden nodes before any layout work
  const activeNodes = hiddenNodes.size > 0
    ? knowledgeNodes.filter(kn => !hiddenNodes.has(kn.id))
    : knowledgeNodes

  if (activeNodes.length === 0) return { nodes: [], edges: [], columnXMap: new Map(), branchMeta }

  const allSorted = [...activeNodes].sort(
    (a, b) => a.timeYear - b.timeYear || a.label.localeCompare(b.label),
  )

  // ── Step 1: DFS column order ──
  // 根的直属叶子（branches 只有一级）单独成“史前主脊”，竖直挂在根正上方，
  // 不参与列布局；列只由二级及以下的学科节点决定。
  const colNodes = activeNodes.filter(kn => kn.branches.filter(Boolean).length > 1)
  const treeRoot = buildTN(colNodes.length > 0 ? colNodes : activeNodes)
  const columnOrder = dfsColumns(treeRoot, branchOrder)

  const columnX = new Map<string, number>()
  columnOrder.forEach((col, i) => columnX.set(col, i * COL_WIDTH + COL_WIDTH / 2))

  const maxDepth = Math.max(...activeNodes.map(kn => kn.branches.filter(Boolean).length - 1))

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

  // ── Step 2.5: 分支默认纵向位置 = 该分支“最早子节点的时间” ──
  // 取代原先按 depth 的一横排：每个分支落在它最早子节点的时间高度，
  // 略微上抬一点压住第一个节点；父分支恒在子分支之上（至少 MIN_LEVEL_GAP）。
  const HEADER_LIFT = 30
  const MIN_LEVEL_GAP = 30
  const branchFirstYear = new Map<string, number>()
  for (const kn of allSorted) {                 // allSorted 已按时间升序，首次写入即最早
    const branches = kn.branches.filter(Boolean) as string[]
    if (branches.length <= 1) continue
    for (let i = 0; i < branches.length; i++) {
      const key = branches.slice(0, i + 1).join('///')
      if (!branchFirstYear.has(key)) branchFirstYear.set(key, kn.timeYear)
    }
  }
  const branchAutoY = new Map<string, number>()
  const keysByDepth = [...branchFirstYear.keys()]
    .map(k => ({ k, depth: k.split('///').length - 1 }))
    .sort((a, b) => a.depth - b.depth)
  for (const { k, depth } of keysByDepth) {
    let y = leafTimeY(maxDepth, branchFirstYear.get(k)!, scale) - HEADER_LIFT
    if (depth > 0) {
      const parentKey = k.split('///').slice(0, depth).join('///')
      const py = branchAutoY.get(parentKey)
      if (py !== undefined) y = Math.max(y, py + MIN_LEVEL_GAP)
    }
    branchAutoY.set(k, y)
  }

  // ── Step 3: Emit nodes & edges ──
  // Process ALL sorted nodes (not pre-filtered by collapse).
  // The loop handles collapsed branches internally: it creates the collapsed
  // branch node, then sets parentId=null and breaks — so leaves under a
  // collapsed branch are skipped but the branch node itself always appears.
  const flowNodes: Node[] = []
  const flowEdges: Edge[] = []
  const branchCreated = new Set<string>()
  // 根直属叶子收集起来，循环后单独排成竖直主脊
  const spineLeaves: KnowledgeNode[] = []
  // Per-column last-used Y: prevents same-column nodes from stacking on top of each other.
  // Across columns the preferred time-based Y is always used, preserving horizontal alignment.
  const colLastY = new Map<number, number>()
  const MIN_LEAF_GAP = 34

  for (const kn of allSorted) {
    const branches = kn.branches.filter(Boolean) as string[]
    if (branches.length <= 1) { spineLeaves.push(kn); continue }
    const col = branches.join('///')
    const leafX = columnX.get(col)
    if (leafX === undefined) continue

    const preferred = leafTimeY(maxDepth, kn.timeYear, scale)
    const last = colLastY.get(leafX) ?? -Infinity
    let leafY = Math.max(preferred, last + MIN_LEAF_GAP)
    // 叶子永远落在它的直属分支之下
    const parentBranchY = branchAutoY.get(col)
    if (parentBranchY !== undefined) leafY = Math.max(leafY, parentBranchY + 32)

    let parentId: string | null = null

    for (let i = 0; i < branches.length; i++) {
      const pathKey = branches.slice(0, i + 1).join('///')
      const collapseKey = `${i}:${branches[i]}`
      const nodeId = `branch::${pathKey}`
      const isCollapsed = collapsedBranches.has(collapseKey)

      if (!branchCreated.has(pathKey)) {
        branchCreated.add(pathKey)
        const bx = avgX(pathKey)
        const autoY = branchAutoY.get(pathKey) ?? i * LEVEL_HEIGHT
        branchMeta.set(pathKey, {
          x: bx, depth: i,
          parentKey: branches.slice(0, i).join('///'),
          label: branches[i],
        })
        flowNodes.push({
          id: nodeId,
          type: 'branchNode',
          position: { x: bx, y: autoY },
          data: {
            label: branches[i],
            depth: i,
            collapsed: isCollapsed,
            collapseKey,
            color: getBranchColor(i).dot,
            pathArray: branches.slice(0, i + 1),
          },
          draggable: true,
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
            type: 'default',
            style: { stroke: getBranchColor(i - 1).edge, strokeWidth: Math.max(1, 2.4 - i * 0.45) },
          })
        }
      }

      parentId = nodeId
      if (isCollapsed) { parentId = null; break }
    }

    if (parentId === null) continue

    colLastY.set(leafX, leafY)
    const leafId = `leaf::${kn.id}`
    const depth = branches.length
    flowNodes.push({
      id: leafId,
      type: 'leafNode',
      position: { x: leafX, y: leafY },
      data: { node: kn, depth, color: getBranchColor(depth - 1).dot },
      draggable: true,
    })

    flowEdges.push({
      id: `e:${parentId}=>${leafId}`,
      source: parentId,
      target: leafId,
      sourceHandle: 'bottom',
      targetHandle: 'top',
      type: 'default',
      style: { stroke: getBranchColor(depth - 1).edge, strokeWidth: 1.2 },
    })
  }

  // ── Step 4: 史前主脊 ──
  // 根的直属叶子按时间从上到下排成一条竖直链，挂在根节点正上方：
  // 最古老在最上，最新（1936）紧贴根，再由根向下分出各学科。
  if (spineLeaves.length > 0) {
    const rootKey = (spineLeaves[0].branches.filter(Boolean)[0]) as string
    const rootNodeId = `branch::${rootKey}`
    const rootX = avgX(rootKey)
    const rootY = branchAutoY.get(rootKey) ?? 0

    // 根节点可能尚未创建（极端情况下无学科），补建一个
    if (!branchCreated.has(rootKey)) {
      branchCreated.add(rootKey)
      branchMeta.set(rootKey, { x: rootX, depth: 0, parentKey: '', label: rootKey })
      flowNodes.push({
        id: rootNodeId,
        type: 'branchNode',
        position: { x: rootX, y: rootY },
        data: {
          label: rootKey, depth: 0, collapsed: false,
          collapseKey: `0:${rootKey}`, color: getBranchColor(0).dot,
          pathArray: [rootKey],
        },
        draggable: true,
      })
    }

    const SPINE_GAP = 46
    const sorted = [...spineLeaves].sort(
      (a, b) => a.timeYear - b.timeYear || a.label.localeCompare(b.label),
    )
    const N = sorted.length
    sorted.forEach((kn, idx) => {
      flowNodes.push({
        id: `leaf::${kn.id}`,
        type: 'leafNode',
        position: { x: rootX, y: rootY - (N - idx) * SPINE_GAP },
        data: { node: kn, depth: 1, color: getBranchColor(0).dot },
        draggable: true,
      })
    })
    for (let k = 0; k < N; k++) {
      const src = `leaf::${sorted[k].id}`
      const tgt = k < N - 1 ? `leaf::${sorted[k + 1].id}` : rootNodeId
      flowEdges.push({
        id: `spine:${src}=>${tgt}`,
        source: src,
        target: tgt,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'default',
        style: { stroke: getBranchColor(0).edge, strokeWidth: 2 },
      })
    }
  }

  return { nodes: flowNodes, edges: flowEdges, columnXMap: columnX, branchMeta }
}
