import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useStore } from '../store'
import { nanoid } from '../utils/nanoid'

interface BranchNodeData {
  label: string
  depth: number
  collapsed: boolean
  collapseKey: string
  color: string
  pathArray: string[]
}

export default function BranchNode({ data }: { data: BranchNodeData }) {
  const [hovered, setHovered] = useState(false)

  function handleAddChild(e: React.MouseEvent) {
    e.stopPropagation()
    const year = new Date().getFullYear()
    // Build branch array: copy current path, add one sub-branch level if room
    const branches: (string | undefined)[] = [undefined, undefined, undefined, undefined, undefined, undefined]
    data.pathArray.forEach((seg, i) => { branches[i] = seg })
    if (data.pathArray.length < 5) {
      branches[data.pathArray.length] = '新分支'
    }
    const newNode = {
      id: nanoid(),
      branches: branches as any,
      phase: '',
      time: String(year),
      timeYear: year,
      label: '新节点',
      tags: [],
      significance: '',
      content: '',
    }
    useStore.getState().addNode(newNode as any)
    useStore.getState().selectNode(newNode.id)
  }

  return (
    <div
      className="flex items-center gap-1.5 select-none cursor-pointer group px-1 relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
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

      {/* Hover "+" button — appears below, adds a child node under this branch */}
      {hovered && (
        <button
          className="absolute flex items-center justify-center rounded-full transition-all hover:scale-110"
          style={{
            bottom: -22,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 18,
            height: 18,
            backgroundColor: `${data.color}22`,
            border: `1.5px solid ${data.color}88`,
            color: data.color,
            zIndex: 50,
          }}
          onClick={handleAddChild}
          title={`在「${data.label}」下添加节点`}
        >
          <Plus size={10} />
        </button>
      )}
    </div>
  )
}
