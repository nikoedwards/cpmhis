import { useMemo, useCallback, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useReactFlow,
  useViewport,
  type NodeTypes,
  type Node,
  type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus } from 'lucide-react'
import { useStore } from '../store'
import { buildGraph, canvasYToYear, LAYOUT_CONSTANTS } from '../utils/layout'
import type { KnowledgeNode } from '../types'
import { nanoid } from '../utils/nanoid'
import BranchNode from './BranchNode'
import LeafNode from './LeafNode'
import Toolbar from './Toolbar'
import Timeline from './Timeline'

const nodeTypes: NodeTypes = {
  branchNode: BranchNode as any,
  leafNode: LeafNode as any,
}

const { BASE_YEAR, MAX_YEAR, LEVEL_HEIGHT, LEAF_GAP, PX_PER_YEAR, COL_WIDTH } = LAYOUT_CONSTANTS
const TIMELINE_W = 64 // must match Timeline's w-[64px]

// Fractional year for today: e.g. 2026 + 4.16/12 ≈ 2026.35
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
  const addNode           = useStore(s => s.addNode)

  const { screenToFlowPosition } = useReactFlow()
  const viewport = useViewport()

  const { nodes, edges, columnXMap } = useMemo(
    () => buildGraph(knodes, collapsedBranches, hiddenNodes),
    [knodes, collapsedBranches, hiddenNodes],
  )

  const maxDepth = knodes.length > 0
    ? knodes.reduce((m, n) => Math.max(m, n.branches.filter(Boolean).length - 1), 0)
    : 3

  // Refs so callbacks always read fresh values without stale closures
  const columnXMapRef = useRef(columnXMap)
  columnXMapRef.current = columnXMap
  const maxDepthRef = useRef(maxDepth)
  maxDepthRef.current = maxDepth
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  // ── Today line ──
  // canvas Y for today → screen Y (same coordinate system as snap guides)
  const todayCanvasY = (maxDepth + 1) * LEVEL_HEIGHT + LEAF_GAP + (TODAY_FRAC - BASE_YEAR) * PX_PER_YEAR
  const todayScreenY = todayCanvasY * viewport.zoom + viewport.y

  // ── Snap guide state ──
  const [dragSnap, setDragSnap] = useState<{
    screenX: number   // relative to ReactFlow container left edge
    screenY: number   // relative to parent top (same as ReactFlow container top)
    year: number
  } | null>(null)

  const onNodeClick = useCallback((_: React.MouseEvent, rfNode: Node) => {
    if (rfNode.type === 'branchNode') {
      const data = rfNode.data as { collapseKey: string }
      toggleCollapse(data.collapseKey)
    } else if (rfNode.type === 'leafNode') {
      const data = rfNode.data as { node: { id: string } }
      selectNode(data.node.id === selectedId ? null : data.node.id)
    }
  }, [toggleCollapse, selectNode, selectedId])

  // During drag: compute snap targets (nearest column + nearest year)
  const onNodeDrag: OnNodeDrag = useCallback((_e, rfNode) => {
    if (rfNode.type !== 'leafNode') return
    const vp = viewportRef.current
    const cxMap = columnXMapRef.current
    const md = maxDepthRef.current

    // Nearest column center (canvas coords)
    let nearestColX = rfNode.position.x
    let nearestColDist = Infinity
    for (const [, cx] of cxMap) {
      const d = Math.abs(cx - rfNode.position.x)
      if (d < nearestColDist) { nearestColDist = d; nearestColX = cx }
    }

    // Snap year from current Y
    const leafAreaStart = (md + 1) * LEVEL_HEIGHT + LEAF_GAP
    const rawYear = BASE_YEAR + (rfNode.position.y - leafAreaStart) / PX_PER_YEAR
    const snapYear = Math.max(BASE_YEAR, Math.min(MAX_YEAR, Math.round(rawYear)))
    const snapCanvasY = leafAreaStart + (snapYear - BASE_YEAR) * PX_PER_YEAR

    setDragSnap({
      screenX: nearestColX * vp.zoom + vp.x,   // relative to ReactFlow container
      screenY: snapCanvasY * vp.zoom + vp.y,    // relative to parent top
      year: snapYear,
    })
  }, [])

  // On drop: update branch from X position only — never update time
  const onNodeDragStop: OnNodeDrag = useCallback((_e, rfNode) => {
    if (rfNode.type !== 'leafNode') return
    setDragSnap(null)

    const data = rfNode.data as { node: KnowledgeNode }
    const cxMap = columnXMapRef.current

    let nearestPathKey = ''
    let nearestDist = Infinity
    for (const [pathKey, cx] of cxMap) {
      const d = Math.abs(cx - rfNode.position.x)
      if (d < nearestDist) { nearestDist = d; nearestPathKey = pathKey }
    }

    if (!nearestPathKey || nearestDist > COL_WIDTH) return
    const currentPath = (data.node.branches.filter(Boolean) as string[]).join('///')
    if (nearestPathKey === currentPath) return

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
  }, [updateNode])

  // Add node at the current viewport center
  const handleAddNode = useCallback(() => {
    const canvasPos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const year = Math.round(canvasYToYear(canvasPos.y, maxDepthRef.current))
    const clamped = Math.max(BASE_YEAR, Math.min(MAX_YEAR, year))
    const newNode = {
      id: nanoid(),
      branches: [undefined, undefined, undefined, undefined, undefined, undefined] as const,
      phase: '',
      time: String(clamped),
      timeYear: clamped,
      label: '新节点',
      tags: [],
      significance: '',
      content: '',
    }
    addNode(newNode as any)
    selectNode(newNode.id)
  }, [screenToFlowPosition, addNode, selectNode])

  // Double-click on canvas background → same as add node but at click position
  const onPaneDoubleClick = useCallback((e: React.MouseEvent) => {
    const canvasPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const year = Math.round(canvasYToYear(canvasPos.y, maxDepthRef.current))
    const clamped = Math.max(BASE_YEAR, Math.min(MAX_YEAR, year))
    const newNode = {
      id: nanoid(),
      branches: [undefined, undefined, undefined, undefined, undefined, undefined] as const,
      phase: '',
      time: String(clamped),
      timeYear: clamped,
      label: '新节点',
      tags: [],
      significance: '',
      content: '',
    }
    addNode(newNode as any)
    selectNode(newNode.id)
  }, [screenToFlowPosition, addNode, selectNode])

  return (
    // Parent div — spans Timeline + Canvas, used as reference for full-width overlays
    <div className="flex flex-1 h-full overflow-hidden relative">
      <Timeline />

      {/* ReactFlow canvas */}
      <div className="flex-1 h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onDoubleClick={onPaneDoubleClick}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.05}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e2533" />
          <Controls position="bottom-right" showInteractive={false} />
        </ReactFlow>
        <Toolbar />

        {/* Add node button — always visible, top-left of canvas */}
        <button
          onClick={handleAddNode}
          className="absolute top-3 left-3 z-10 w-7 h-7 rounded-lg bg-slate-900/80 hover:bg-indigo-600/80 text-slate-500 hover:text-white flex items-center justify-center border border-slate-700/60 hover:border-indigo-500/60 backdrop-blur transition-all"
          title="添加节点（或双击画布）"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* ── Today line — spans full width including Timeline ── */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{ top: todayScreenY, zIndex: 40, borderTop: '1px dashed rgba(234,179,8,0.4)' }}
      >
        <span style={{
          position: 'absolute',
          left: TIMELINE_W + 6,
          top: -11,
          fontSize: 9,
          color: 'rgba(234,179,8,0.85)',
          background: '#0f1117',
          padding: '1px 5px',
          borderRadius: 2,
          fontFamily: 'monospace',
          pointerEvents: 'none',
        }}>
          今天 {new Date().getFullYear()}
        </span>
      </div>

      {/* ── Snap guide overlay — spans full width including Timeline ── */}
      {dragSnap && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 100 }}>
          {/* Horizontal year line — full width */}
          <div
            className="absolute left-0 right-0 flex items-center"
            style={{ top: dragSnap.screenY }}
          >
            <div style={{ flex: 1, borderTop: '1px dashed rgba(99,102,241,0.65)' }} />
            <span style={{
              flexShrink: 0,
              marginRight: 6,
              fontSize: 9,
              color: 'rgba(139,92,246,0.95)',
              background: '#0f1117',
              padding: '1px 5px',
              borderRadius: 2,
              fontFamily: 'monospace',
            }}>
              {dragSnap.year}
            </span>
          </div>
          {/* Vertical column line — offset by Timeline width so it sits over the correct column */}
          <div
            className="absolute top-0 bottom-0"
            style={{ left: dragSnap.screenX + TIMELINE_W, borderLeft: '1px dashed rgba(99,102,241,0.4)' }}
          />
        </div>
      )}
    </div>
  )
}
