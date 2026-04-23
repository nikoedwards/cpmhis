import { Handle, Position } from '@xyflow/react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface BranchNodeData {
  label: string
  depth: number
  collapsed: boolean
  collapseKey: string
  color: string
}

export default function BranchNode({ data }: { data: BranchNodeData }) {
  return (
    <div className="flex items-center gap-1.5 select-none cursor-pointer group px-1">
      <Handle type="target" position={Position.Top} id="top" style={{ opacity: 0, width: 1, height: 1 }} />

      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform group-hover:scale-125"
        style={{ backgroundColor: data.color, outline: `2px solid ${data.color}40`, outlineOffset: 2 }}
      />
      <span className="text-xs font-medium whitespace-nowrap" style={{ color: data.collapsed ? data.color : '#94a3b8' }}>
        {data.label}
      </span>
      <span className="opacity-50 group-hover:opacity-90 transition-opacity" style={{ color: data.color }}>
        {data.collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
      </span>

      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0, width: 1, height: 1 }} />
    </div>
  )
}
