import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { nanoid } from '../utils/nanoid'
import { LABEL_MAX_W } from '../utils/layout'

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

  function handleRename(e: React.MouseEvent) {
    e.stopPropagation()
    const name = window.prompt('重命名分支', data.label)
    const v = name?.trim()
    if (v && v !== data.label) useStore.getState().renameBranch(data.pathArray, v)
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirm(`删除分支「${data.label}」及其下所有节点？此操作不可撤销。`)) {
      useStore.getState().deleteBranch(data.pathArray)
    }
  }

  const depth = data.depth
  const isRoot = depth === 0
  // 层级递减：圆点 / 字号 / 字重
  const sz = depth === 0 ? { dot: 11, font: 14, weight: 700 }
           : depth === 1 ? { dot: 9,  font: 13, weight: 600 }
           : depth === 2 ? { dot: 7,  font: 12, weight: 500 }
           :               { dot: 6,  font: 11, weight: 400 }
  const chevron = isRoot ? 12 : 10
  const labelColor = data.collapsed || depth <= 1
    ? data.color
    : depth === 2 ? 'var(--text)' : 'var(--text-2)'

  return (
    <div
      className="flex items-center gap-1.5 select-none cursor-pointer group relative transition-transform"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={isRoot ? {
        padding: '3px 11px',
        borderRadius: 999,
        background: `${data.color}14`,
        border: `1px solid ${data.color}55`,
        boxShadow: 'var(--shadow-sm)',
      } : { padding: '0 4px' }}
    >
      <Handle type="target" position={Position.Top} id="top" style={{ opacity: 0, width: 1, height: 1 }} />

      <div
        className="rounded-full flex-shrink-0 transition-transform group-hover:scale-125"
        style={{
          width: sz.dot,
          height: sz.dot,
          backgroundColor: data.color,
          outline: isRoot ? 'none' : `2px solid ${data.color}40`,
          outlineOffset: 2,
        }}
      />
      <span
        className="overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ fontSize: sz.font, fontWeight: sz.weight, color: labelColor, maxWidth: isRoot ? LABEL_MAX_W + 40 : LABEL_MAX_W }}
        title={data.label}
      >
        {data.label}
      </span>
      <span className="opacity-50 group-hover:opacity-90 transition-opacity" style={{ color: data.color }}>
        {data.collapsed ? <ChevronRight size={chevron} /> : <ChevronDown size={chevron} />}
      </span>

      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0, width: 1, height: 1 }} />

      {/* Hover 工具条：增（子节点）/ 改（重命名）/ 删（分支）
          外层用 top:100% + paddingTop 做“透明桥”，鼠标从节点滑到按钮全程在同一子树内，
          不会触发 mouseleave 提前收起；z-index 抬高，避免被相邻节点压住。 */}
      {hovered && (
        <div
          className="nodrag absolute"
          style={{ top: '100%', left: '50%', transform: 'translateX(-50%)', paddingTop: 5, zIndex: 1000 }}
        >
          <div
            className="flex items-center gap-0.5 rounded-md px-0.5 py-0.5"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <button
              className="p-1 rounded hover:bg-slate-800/50 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onClick={handleAddChild}
              title={`在「${data.label}」下添加节点`}
            >
              <Plus size={11} />
            </button>
            <button
              className="p-1 rounded hover:bg-slate-800/50 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onClick={handleRename}
              title="重命名分支"
            >
              <Pencil size={11} />
            </button>
            <button
              className="p-1 rounded hover:bg-red-900/40 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onClick={handleDelete}
              title="删除分支"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
