import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useReactFlow,
  type NodeTypes,
  type Node,
  type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '../store'
import { buildGraph, canvasYToYear, LAYOUT_CONSTANTS } from '../utils/layout'
import { nanoid } from '../utils/nanoid'
import BranchNode from './BranchNode'
import LeafNode from './LeafNode'
import Toolbar from './Toolbar'
import Timeline from './Timeline'

const nodeTypes: NodeTypes = {
  branchNode: BranchNode as any,
  leafNode: LeafNode as any,
}

const { BASE_YEAR, MAX_YEAR } = LAYOUT_CONSTANTS

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

  const { nodes, edges } = useMemo(
    () => buildGraph(knodes, collapsedBranches, hiddenNodes),
    [knodes, collapsedBranches, hiddenNodes],
  )

  const maxDepth = knodes.length > 0
    ? knodes.reduce((m, n) => Math.max(m, n.branches.filter(Boolean).length - 1), 0)
    : 3

  const onNodeClick = useCallback((_: React.MouseEvent, rfNode: Node) => {
    if (rfNode.type === 'branchNode') {
      const data = rfNode.data as { collapseKey: string }
      toggleCollapse(data.collapseKey)
    } else if (rfNode.type === 'leafNode') {
      const data = rfNode.data as { node: { id: string } }
      selectNode(data.node.id === selectedId ? null : data.node.id)
    }
  }, [toggleCollapse, selectNode, selectedId])

  // Drag leaf node → update timeYear from new Y position
  const onNodeDragStop: OnNodeDrag = useCallback((_e, rfNode) => {
    if (rfNode.type !== 'leafNode') return
    const data = rfNode.data as { node: { id: string } }
    const newYear = Math.round(canvasYToYear(rfNode.position.y, maxDepth))
    const clamped = Math.max(BASE_YEAR, Math.min(MAX_YEAR, newYear))
    updateNode(data.node.id, {
      timeYear: clamped,
      time: String(clamped),
    })
  }, [maxDepth, updateNode])

  // Double-click on canvas background → create new node at that position
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
      </div>
    </div>
  )
}
