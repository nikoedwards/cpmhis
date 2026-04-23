import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  type NodeTypes,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '../store'
import { buildGraph } from '../utils/layout'
import BranchNode from './BranchNode'
import LeafNode from './LeafNode'
import Toolbar from './Toolbar'
import Timeline from './Timeline'

const nodeTypes: NodeTypes = {
  branchNode: BranchNode as any,
  leafNode: LeafNode as any,
}

export default function Canvas() {
  const knodes           = useStore(s => s.nodes)
  const collapsedBranches = useStore(s => s.collapsedBranches)
  const toggleCollapse   = useStore(s => s.toggleCollapse)
  const selectNode       = useStore(s => s.selectNode)
  const selectedId       = useStore(s => s.selectedId)

  const { nodes, edges } = useMemo(
    () => buildGraph(knodes, collapsedBranches),
    [knodes, collapsedBranches],
  )

  const onNodeClick = useCallback((_: React.MouseEvent, rfNode: Node) => {
    if (rfNode.type === 'branchNode') {
      const data = rfNode.data as { collapseKey: string }
      toggleCollapse(data.collapseKey)
    } else if (rfNode.type === 'leafNode') {
      const data = rfNode.data as { node: { id: string } }
      selectNode(data.node.id === selectedId ? null : data.node.id)
    }
  }, [toggleCollapse, selectNode, selectedId])

  return (
    <div className="flex flex-1 h-full overflow-hidden relative">
      <Timeline />

      <div className="flex-1 h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
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
