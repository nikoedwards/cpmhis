import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Edit2, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import type { KnowledgeNode } from '../types'

interface LeafNodeData {
  node: KnowledgeNode
  depth: number
  color: string
}

export default function LeafNode({ data }: { data: LeafNodeData }) {
  const selectedId = useStore(s => s.selectedId)
  const { node, color } = data
  const isSelected = selectedId === node.id
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="relative flex items-center gap-2 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Top}    id="top"    style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0, width: 1, height: 1 }} />

      {/* Dot */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0 transition-all duration-150"
        style={{
          backgroundColor: isSelected ? color : 'transparent',
          border: `2px solid ${color}`,
          boxShadow: isSelected ? `0 0 8px ${color}80` : 'none',
        }}
      />

      {/* Label + time + tags */}
      <div className="flex flex-col leading-none gap-0.5">
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-xs font-medium whitespace-nowrap"
            style={{ color: isSelected ? '#f1f5f9' : '#cbd5e1' }}
          >
            {node.label}
          </span>
          <span className="text-[10px] text-slate-500 whitespace-nowrap">{node.time}</span>
        </div>
        {node.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {node.tags.map(tag => (
              <span
                key={tag}
                className="text-[9px] px-1 rounded-sm whitespace-nowrap"
                style={{ color: `${color}cc`, backgroundColor: `${color}18` }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hover toolbar — appears to the right on hover */}
      {hovered && (
        <div
          className="absolute flex items-center gap-0.5 bg-slate-900 border border-slate-700 rounded px-0.5"
          style={{ right: -52, top: '50%', transform: 'translateY(-50%)' }}
        >
          <button
            className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors"
            title="编辑"
            onClick={e => {
              e.stopPropagation()
              useStore.getState().selectNode(isSelected ? null : node.id)
            }}
          >
            <Edit2 size={10} />
          </button>
          <button
            className="p-1 rounded hover:bg-red-900/60 text-slate-500 hover:text-red-400 transition-colors"
            title="删除"
            onClick={e => {
              e.stopPropagation()
              if (confirm(`删除「${node.label}」？`)) useStore.getState().deleteNode(node.id)
            }}
          >
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  )
}
