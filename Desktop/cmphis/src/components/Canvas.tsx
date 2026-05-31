import { useMemo, useCallback, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useViewport,
  type NodeTypes,
  type Node,
  type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '../store'
import { buildGraph, buildTimeScale, LAYOUT_CONSTANTS, MIN_YEAR } from '../utils/layout'
import type { KnowledgeNode } from '../types'
import BranchNode from './BranchNode'
import LeafNode from './LeafNode'
import Toolbar from './Toolbar'
import Timeline from './Timeline'

const nodeTypes: NodeTypes = {
  branchNode: BranchNode as any,
  leafNode: LeafNode as any,
}

const { MAX_YEAR, LEVEL_HEIGHT, LEAF_GAP, COL_WIDTH } = LAYOUT_CONSTANTS
const TIMELINE_W = 64 // must match Timeline's w-[64px]

function getTodayFracYear(): number {
  const d = new Date()
  return d.getFullYear() + d.getMonth() / 12 + (d.getDate() - 1) / 365
}
const TODAY_FRAC = getTodayFracYear()

export default function Canvas() {
  const knodes            = useStore(s => s.nodes)
  const collapsedBranches = useStore(s => s.collapsedBranches)
  const hiddenNodes       = useStore(s => s.hiddenNodes)
  const toggleCollapse    = useStore(s => s.toggleCollapse)
  const selectNode        = useStore(s => s.selectNode)
  const selectedId        = useStore(s => s.selectedId)
  const updateNode        = useStore(s => s.updateNode)
  const branchOrder       = useStore(s => s.branchOrder)
  const reorderBranch     = useStore(s => s.reorderBranch)
  const hoveredId         = useStore(s => s.hoveredId)
  const setCanvasViewport = useStore(s => s.setCanvasViewport)

  const viewport = useViewport()

  // 进入画布时冻结一次"初始视口"决策：有记忆则还原、无记忆则 fitView（避免移动后反复 refit）
  const [initialViewport] = useState(() => useStore.getState().canvasViewport)

  // 拖拽结束后强制按系统规则重排归位（即使没有发生顺序变化也吸附回去）
  const [tidyTick, setTidyTick] = useState(0)

  // 密度自适应时间标尺：与左侧时间轴共用同一标尺，保证刻度与节点对齐
  const scale = useMemo(() => buildTimeScale(knodes), [knodes])

  const { nodes, edges, columnXMap, branchMeta } = useMemo(
    () => buildGraph(knodes, collapsedBranches, hiddenNodes, branchOrder, scale),
    // tidyTick: 拖拽结束后即使数据未变也重建一次，让节点吸附回系统排布位置
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [knodes, collapsedBranches, hiddenNodes, branchOrder, scale, tidyTick],
  )

  const maxDepth = knodes.length > 0
    ? knodes.reduce((m, n) => Math.max(m, n.branches.filter(Boolean).length - 1), 0)
    : 3

  // Refs so callbacks always read fresh values without stale closures
  const columnXMapRef = useRef(columnXMap)
  columnXMapRef.current = columnXMap
  const branchMetaRef = useRef(branchMeta)
  branchMetaRef.current = branchMeta
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  // ── Today line ──
  const todayCanvasY = (maxDepth + 1) * LEVEL_HEIGHT + LEAF_GAP + scale.yearToOffset(TODAY_FRAC)
  const todayScreenY = todayCanvasY * viewport.zoom + viewport.y

  // ── Hover 贯穿辅助线：悬浮节点 → 横向虚线贯穿时间轴+画布，时间轴上高亮该时刻 ──
  const hoverGuide = useMemo(() => {
    if (!hoveredId) return null
    const fn = nodes.find(n => n.id === `leaf::${hoveredId}`)
    if (!fn) return null
    const kn = knodes.find(k => k.id === hoveredId)
    const screenY = (fn.position.y + 8) * viewport.zoom + viewport.y
    return { screenY, time: kn?.time ?? '', label: kn?.label ?? '' }
  }, [hoveredId, nodes, knodes, viewport.zoom, viewport.y])

  // ── Snap guide state ──
  // 叶子拖拽：年份横线 + 目标列竖线
  const [dragSnap, setDragSnap] = useState<{
    screenX: number
    screenY: number
    year: number
  } | null>(null)
  // 分支拖拽：同级重排，竖直插入位置磁吸线
  const [branchSnap, setBranchSnap] = useState<{ screenX: number } | null>(null)

  // 记忆画布缩放/平移：平移或缩放结束后持久化到 store（跨视图切换还原）
  const onMoveEnd = useCallback((_e: unknown, vp: { x: number; y: number; zoom: number }) => {
    setCanvasViewport(vp)
  }, [setCanvasViewport])

  const onNodeClick = useCallback((_: React.MouseEvent, rfNode: Node) => {
    if (rfNode.type === 'branchNode') {
      const data = rfNode.data as { collapseKey: string }
      toggleCollapse(data.collapseKey)
    } else if (rfNode.type === 'leafNode') {
      const data = rfNode.data as { node: { id: string } }
      selectNode(data.node.id === selectedId ? null : data.node.id)
    }
  }, [toggleCollapse, selectNode, selectedId])

  const leafAreaStartY = useCallback(() => {
    const md = knodes.length > 0
      ? knodes.reduce((m, n) => Math.max(m, n.branches.filter(Boolean).length - 1), 0)
      : 3
    return (md + 1) * LEVEL_HEIGHT + LEAF_GAP
  }, [knodes])

  // 分支拖拽 → 计算在同级兄弟中的插入位置（只改横向顺序，不跨层级）
  const computeBranchReorder = useCallback((key: string, draggedX: number) => {
    const meta = branchMetaRef.current.get(key)
    if (!meta) return null
    const sibs = [...branchMetaRef.current.values()].filter(m => m.parentKey === meta.parentKey)
    if (sibs.length <= 1) return null
    const others = sibs.filter(m => m.label !== meta.label).sort((a, b) => a.x - b.x)
    const insertIdx = others.filter(m => m.x < draggedX).length
    const leftX  = insertIdx > 0              ? others[insertIdx - 1].x : others[0].x - COL_WIDTH
    const rightX = insertIdx < others.length  ? others[insertIdx].x     : others[others.length - 1].x + COL_WIDTH
    const boundaryX = (leftX + rightX) / 2
    const orderedLabels = others.map(m => m.label)
    orderedLabels.splice(insertIdx, 0, meta.label)
    return { boundaryX, orderedLabels, parentKey: meta.parentKey }
  }, [])

  // During drag: compute snap targets and show guide lines
  const onNodeDrag: OnNodeDrag = useCallback((_e, rfNode) => {
    const vp = viewportRef.current

    if (rfNode.type === 'branchNode') {
      // 分支：磁吸到同级插入位置（竖线提示），不自由摆放
      setDragSnap(null)
      const data = rfNode.data as { pathArray: string[] }
      const key = (data.pathArray.filter(Boolean) as string[]).join('///')
      const r = computeBranchReorder(key, rfNode.position.x)
      setBranchSnap(r ? { screenX: r.boundaryX * vp.zoom + vp.x } : null)
      return
    }
    if (rfNode.type !== 'leafNode') return
    setBranchSnap(null)
    const sc = scaleRef.current
    const leafAreaStart = leafAreaStartY()
    const rawYear = sc.offsetToYear(rfNode.position.y - leafAreaStart)
    const snapYear = Math.max(MIN_YEAR, Math.min(MAX_YEAR, Math.round(rawYear)))
    const snapCanvasY = leafAreaStart + sc.yearToOffset(snapYear)
    const cxMap = columnXMapRef.current

    let nearestColX = rfNode.position.x
    let nearestColDist = Infinity
    for (const [, cx] of cxMap) {
      const d = Math.abs(cx - rfNode.position.x)
      if (d < nearestColDist) { nearestColDist = d; nearestColX = cx }
    }

    setDragSnap({
      screenX: nearestColX * vp.zoom + vp.x,
      screenY: snapCanvasY * vp.zoom + vp.y,
      year: snapYear,
    })
  }, [leafAreaStartY, computeBranchReorder])

  // On drop: leaf → re-parent by column; branch → reorder among same-level siblings
  const onNodeDragStop: OnNodeDrag = useCallback((_e, rfNode) => {
    setDragSnap(null)
    setBranchSnap(null)

    if (rfNode.type === 'branchNode') {
      const data = rfNode.data as { pathArray: string[] }
      const key = (data.pathArray.filter(Boolean) as string[]).join('///')
      const r = computeBranchReorder(key, rfNode.position.x)
      if (r) reorderBranch(r.parentKey, r.orderedLabels)
      // 无论是否改变顺序，都强制按系统规则重排归位（吸附回去，不留在乱放位置）
      setTidyTick(t => t + 1)
      return
    }

    if (rfNode.type !== 'leafNode') return

    const data = rfNode.data as { node: KnowledgeNode }
    const cxMap = columnXMapRef.current

    let nearestPathKey = ''
    let nearestDist = Infinity
    for (const [pathKey, cx] of cxMap) {
      const d = Math.abs(cx - rfNode.position.x)
      if (d < nearestDist) { nearestDist = d; nearestPathKey = pathKey }
    }

    const currentPath = (data.node.branches.filter(Boolean) as string[]).join('///')
    if (!nearestPathKey || nearestDist > COL_WIDTH || nearestPathKey === currentPath) {
      // 没有有效重定向：吸附回原列
      setTidyTick(t => t + 1)
      return
    }

    const parts = nearestPathKey.split('///')
    const branches = [
      parts[0] || undefined,
      parts[1] || undefined,
      parts[2] || undefined,
      parts[3] || undefined,
      parts[4] || undefined,
      parts[5] || undefined,
    ] as KnowledgeNode['branches']
    updateNode(data.node.id, { branches })
  }, [updateNode, reorderBranch, leafAreaStartY, computeBranchReorder])

  return (
    <div className="flex flex-1 h-full overflow-hidden relative">
      <Timeline />

      <div className="flex-1 h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onMoveEnd={onMoveEnd}
          {...(initialViewport
            ? { defaultViewport: initialViewport }
            : { fitView: true, fitViewOptions: { padding: 0.15 } })}
          minZoom={0.05}
          maxZoom={40}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--canvas-dot)" />
          <Controls position="bottom-right" showInteractive={false} />
        </ReactFlow>
        <Toolbar />
      </div>

      {/* ── Today line — spans full width including Timeline ── */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{ top: todayScreenY, zIndex: 40, borderTop: '1px dashed color-mix(in srgb, var(--today) 45%, transparent)' }}
      >
        <span style={{
          position: 'absolute',
          left: TIMELINE_W + 6,
          top: -11,
          fontSize: 9,
          color: 'var(--today)',
          background: 'var(--bg)',
          padding: '1px 5px',
          borderRadius: 4,
          fontFamily: 'monospace',
          pointerEvents: 'none',
        }}>
          今天 {new Date().getFullYear()}
        </span>
      </div>

      {/* ── Hover 贯穿辅助线 — spans full width including Timeline ── */}
      {hoverGuide && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 60 }}>
          <div
            className="absolute left-0 right-0"
            style={{ top: hoverGuide.screenY, borderTop: '1px dashed color-mix(in srgb, var(--accent) 70%, transparent)' }}
          />
          {/* 时间轴上的“放大镜”：高亮该节点的精确时刻 */}
          <span style={{
            position: 'absolute',
            top: hoverGuide.screenY - 9,
            left: 2,
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--accent-fg)',
            background: 'var(--accent)',
            padding: '1px 5px',
            borderRadius: 4,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-md)',
          }}>
            {hoverGuide.time}
          </span>
          {hoverGuide.label && (
            <span style={{
              position: 'absolute',
              top: hoverGuide.screenY - 9,
              left: TIMELINE_W + 8,
              fontSize: 10,
              color: 'var(--accent)',
              background: 'var(--bg)',
              padding: '0 5px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
            }}>
              {hoverGuide.label}
            </span>
          )}
        </div>
      )}

      {/* ── Snap guide overlay — spans full width including Timeline ── */}
      {dragSnap && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 100 }}>
          <div
            className="absolute left-0 right-0 flex items-center"
            style={{ top: dragSnap.screenY }}
          >
            <div style={{ flex: 1, borderTop: '1px dashed var(--accent)' }} />
            <span style={{
              flexShrink: 0,
              marginRight: 6,
              fontSize: 9,
              color: 'var(--accent-fg)',
              background: 'var(--accent)',
              padding: '1px 6px',
              borderRadius: 4,
              fontFamily: 'monospace',
            }}>
              {dragSnap.year}
            </span>
          </div>
          <div
            className="absolute top-0 bottom-0"
            style={{ left: dragSnap.screenX + TIMELINE_W, borderLeft: '1px dashed var(--accent-border)' }}
          />
        </div>
      )}

      {/* ── 分支重排磁吸线 — 竖直插入位置提示 ── */}
      {branchSnap && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 100 }}>
          <div
            className="absolute top-0 bottom-0"
            style={{
              left: branchSnap.screenX + TIMELINE_W,
              borderLeft: '2px dashed var(--accent)',
              filter: 'drop-shadow(0 0 4px var(--accent))',
            }}
          />
        </div>
      )}
    </div>
  )
}
