import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Edit2, Trash2, Eye, EyeOff, Plus } from 'lucide-react'
import { useStore } from '../store'
import { nanoid } from '../utils/nanoid'
import { LABEL_MAX_W } from '../utils/layout'
import type { KnowledgeNode } from '../types'

interface LeafNodeData {
  node: KnowledgeNode
  depth: number
  color: string
}

// 理论节点统一识别色（不随分支色变化，便于一眼扫出）
const THEORY = '#f59e0b'

export default function LeafNode({ data }: { data: LeafNodeData }) {
  const selectedId   = useStore(s => s.selectedId)
  const hiddenNodes  = useStore(s => s.hiddenNodes)
  const setHoveredId = useStore(s => s.setHoveredId)
  const { node, color } = data
  const isSelected = selectedId === node.id
  const isHidden   = hiddenNodes.has(node.id)
  const isTheory   = node.phase === '理论' || node.phase === '逻辑'
  const visibleTags = node.tags.filter(t => t !== '理论' && t !== '逻辑')
  const [hovered, setHovered] = useState(false)

  function handleAddSibling(e: React.MouseEvent) {
    e.stopPropagation()
    const year = new Date().getFullYear()
    const newNode = {
      id: nanoid(),
      branches: [...node.branches] as KnowledgeNode['branches'],
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
      className="relative flex items-center gap-2 group"
      onMouseEnter={() => { setHovered(true); setHoveredId(node.id) }}
      onMouseLeave={() => { setHovered(false); setHoveredId(null) }}
      style={{
        opacity: isHidden ? 0.35 : 1,
        // 背景遮挡，避免相邻列文字穿透
        background: 'color-mix(in srgb, var(--canvas-bg) 88%, transparent)',
        borderRadius: 6,
        padding: '2px 6px 2px 0',
      }}
    >
      <Handle type="target" position={Position.Top}    id="top"    style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0, width: 1, height: 1 }} />

      {/* 标记：理论=实心菱形（带光晕），其它=空心圆点 */}
      <div
        className="flex-shrink-0 transition-all duration-150"
        title={isTheory ? '理论节点' : undefined}
        style={{
          width: 12,
          height: 12,
          borderRadius: isTheory ? 2 : '50%',
          transform: isTheory ? 'rotate(45deg)' : undefined,
          backgroundColor: (isTheory || isSelected) ? (isTheory ? THEORY : color) : 'transparent',
          border: `2px solid ${isTheory ? THEORY : color}`,
          boxShadow: isSelected ? `0 0 8px ${color}80` : (isTheory ? `0 0 6px ${THEORY}99` : 'none'),
        }}
      />

      {/* Label + time + tags */}
      <div
        className="flex flex-col leading-none gap-0.5"
        style={isTheory ? {
          paddingLeft: 6,
          borderLeft: `3px solid ${THEORY}`,
          background: `${THEORY}14`,
          borderRadius: 4,
          paddingRight: 4,
          paddingTop: 2,
          paddingBottom: 2,
        } : undefined}
      >
        <div className="flex items-baseline gap-1.5">
          {isTheory && (
            <span
              className="text-[9px] px-1 rounded-sm font-bold whitespace-nowrap leading-none"
              style={{ color: '#1b1205', backgroundColor: THEORY }}
            >
              {node.phase}
            </span>
          )}
          <span
            className="text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap"
            style={{
              color: isTheory ? 'var(--text)' : (isSelected ? 'var(--text)' : 'var(--text-2)'),
              maxWidth: LABEL_MAX_W,
            }}
            title={node.label}
          >
            {node.label}
          </span>
          <span className="text-[10px] text-slate-500 whitespace-nowrap flex-shrink-0">{node.time}</span>
        </div>
        {visibleTags.length > 0 && (
          <div className="flex gap-1 flex-wrap" style={{ maxWidth: LABEL_MAX_W + 48 }}>
            {visibleTags.map(tag => (
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

      {/* Hover toolbar — appears to the right on hover.
          外层 left:100% + paddingLeft 做“透明桥”，避免鼠标移到按钮途中触发 mouseleave；
          z-index 抬高避免被相邻节点压住。 */}
      {hovered && (
        <div
          className="nodrag absolute"
          style={{ left: '100%', top: '50%', transform: 'translateY(-50%)', paddingLeft: 6, zIndex: 1000 }}
        >
          <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-700 rounded px-0.5">
            <button
              className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-emerald-400 transition-colors"
              title="添加同级节点"
              onClick={handleAddSibling}
            >
              <Plus size={10} />
            </button>
            <button
              className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors"
              title={isHidden ? '显示节点' : '隐藏节点'}
              onClick={e => {
                e.stopPropagation()
                useStore.getState().toggleHide(node.id)
              }}
            >
              {isHidden ? <Eye size={10} /> : <EyeOff size={10} />}
            </button>
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
        </div>
      )}
    </div>
  )
}
