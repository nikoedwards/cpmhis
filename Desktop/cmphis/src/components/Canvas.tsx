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
import { buildGraph, LAYOUT_CONSTANTS } from '../utils/layout'
import type { KnowledgeNode } from '../types'
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
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  // ── Today line ──
  const todayCanvasY = (maxDepth + 1) * LEVEL_HEIGHT + LEAF_GAP + (TODAY_FRAC - BASE_YEAR) * PX_PER_YEAR
  const todayScreenY = todayCanvasY * viewport.zoom + viewport.y

  // ── Snap guide state ──
  const [dragSnap, setDragSnap] = useState<{
    screenX: number
    screenY: number
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

  // During drag: compute snap targets and show guide lines
  const onNodeDrag: OnNodeDrag = useCallback((_e, rfNode) => {
    if (rfNode.type !== 'leafNode') return
    const vp = viewportRef.current
    const cxMap = columnXMapRef.current

    let nearestColX = rfNode.position.x
    let nearestColDist = Infinity
    for (const [, cx] of cxMap) {
      const d = Math.abs(cx - rfNode.position.x)
      if (d < nearestColDist) { nearestColDist = d; nearestColX = cx }
    }

    const md = knodes.length > 0
      ? knodes.reduce((m, n) => Math.max(m, n.branches.filter(Boolean).length - 1), 0)
      : 3
    const leafAreaStart = (md + 1) * LEVEL_HEIGHT + LEAF_GAP
    const rawYear = BASE_YEAR + (rfNode.position.y - leafAreaStart) / PX_PER_YEAR
    const snapYear = Math.max(BASE_YEAR, Math.min(MAX_YEAR, Math.round(rawYear)))
    const snapCanvasY = leafAreaStart + (snapYear - BASE_YEAR) * PX_PER_YEAR

    setDragSnap({
      screenX: nearestColX * vp.zoom + vp.x,
      screenY: snapCanvasY * vp.zoom + vp.y,
      year: snapYear,
    })
  }, [knodes])

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
          <div
            className="absolute top-0 bottom-0"
            style={{ left: dragSnap.screenX + TIMELINE_W, borderLeft: '1px dashed rgba(99,102,241,0.4)' }}
          />
        </div>
      )}
    </div>
  )
}
