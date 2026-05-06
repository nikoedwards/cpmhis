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

  // Refs to read latest values inside drag callbacks without stale closures
  const columnXMapRef = useRef(columnXMap)
  columnXMapRef.current = columnXMap
  const maxDepthRef = useRef(maxDepth)
  maxDepthRef.current = maxDepth
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  // Snap guide: screen-space coords for the dashed guide lines
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

  // During drag: compute nearest column + nearest year and show snap guides
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

    // canvas → screen (within ReactFlow container)
    setDragSnap({
      screenX: nearestColX * vp.zoom + vp.x,
      screenY: snapCanvasY * vp.zoom + vp.y,
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

  // Double-click on canvas background → create new node at that Y position
  const onPaneDoubleClick = useCallback((e: React.MouseEvent) => {
    const canvasPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const year = Math.round(canvasYToYear(canvasPos.y, maxDepth))
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
  }, [screenToFlowPosition, maxDepth, addNode, selectNode])

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

        {/* Snap guide overlay — shown while dragging a leaf */}
        {dragSnap && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 100 }}>
            {/* Horizontal year line */}
            <div
              className="absolute left-0 right-0"
              style={{ top: dragSnap.screenY, borderTop: '1px dashed rgba(99,102,241,0.55)' }}
            >
              <span style={{
                position: 'absolute', right: 10, top: -14,
                fontSize: 9, color: 'rgba(139,92,246,0.9)',
                background: '#0f1117', padding: '1px 4px',
                borderRadius: 2, fontFamily: 'monospace',
              }}>
                {dragSnap.year}
              </span>
            </div>
            {/* Vertical column line */}
            <div
              className="absolute top-0 bottom-0"
              style={{ left: dragSnap.screenX, borderLeft: '1px dashed rgba(99,102,241,0.35)' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
