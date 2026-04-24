import { useMemo, useCallback, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronRight, ChevronDown, Edit2, Trash2, Plus,
  Link2, Link2Off, PanelLeftClose, PanelLeftOpen, GripVertical,
  Eye, EyeOff,
} from 'lucide-react'
import { useStore } from '../store'
import { getBranchColor } from '../utils/layout'
import { nanoid } from '../utils/nanoid'
import type { KnowledgeNode } from '../types'

// ── Data ─────────────────────────────────────────────────────────────────────

interface SidebarBranch {
  id: string
  label: string
  depth: number
  collapseKey: string
  color: string
  children: SidebarBranch[]
  leaves: KnowledgeNode[]
  pathArray: string[]
}

function buildTree(knodes: KnowledgeNode[]): SidebarBranch[] {
  const root: SidebarBranch = {
    id: '__root__', label: '', depth: -1, collapseKey: '', color: '',
    children: [], leaves: [], pathArray: [],
  }
  const sorted = [...knodes].sort((a, b) => a.timeYear - b.timeYear || a.label.localeCompare(b.label))
  for (const kn of sorted) {
    const branches = kn.branches.filter(Boolean) as string[]
    if (!branches.length) continue
    let cur = root
    for (let i = 0; i < branches.length; i++) {
      const pathId = branches.slice(0, i + 1).join('///')
      let child = cur.children.find(c => c.id === pathId)
      if (!child) {
        child = {
          id: pathId, label: branches[i], depth: i,
          collapseKey: `${i}:${branches[i]}`,
          color: getBranchColor(i).dot,
          children: [], leaves: [],
          pathArray: branches.slice(0, i + 1),
        }
        cur.children.push(child)
      }
      cur = child
    }
    cur.leaves.push(kn)
  }
  return root.children
}

// ── Insert gap ─────────────────────────────────────────────────────────────

function InsertGap({ parentBranches, afterYear, onInsert }: {
  parentBranches: string[]
  afterYear: number
  onInsert: (branches: string[], year: number) => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      className="relative h-1.5 flex items-center"
      style={{ paddingLeft: parentBranches.length * 14 + 24 }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {hov && (
        <button
          className="flex items-center gap-0.5 text-[9px] text-indigo-400 hover:text-indigo-300 bg-slate-900 border border-indigo-800/60 rounded px-1 z-20 whitespace-nowrap"
          onClick={e => { e.stopPropagation(); onInsert(parentBranches, afterYear) }}
        >
          <Plus size={8} /> 插入
        </button>
      )}
    </div>
  )
}

// ── Draggable leaf row ─────────────────────────────────────────────────────

function DraggableLeafRow({ leaf, parentBranches, selectedId, onSelect, onDelete, onInsertAfter, isDragOverlay }: {
  leaf: KnowledgeNode
  parentBranches: string[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onDelete: (id: string) => void
  onInsertAfter: (branches: string[], year: number) => void
  isDragOverlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `leaf::${leaf.id}`,
    data: { type: 'leaf', nodeId: leaf.id, parentBranches },
  })
  const hiddenNodes = useStore(s => s.hiddenNodes)
  const [hov, setHov] = useState(false)
  const isSel   = selectedId === leaf.id
  const isHidden = hiddenNodes.has(leaf.id)
  const color = getBranchColor(parentBranches.length - 1).dot
  const INDENT = 14

  const style = isDragOverlay ? undefined : {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-1 py-[3px] rounded transition-colors"
        css-indent={`${parentBranches.length * INDENT + 4}px`}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={() => !isDragging && onSelect(isSel ? null : leaf.id)}
      >
        {/* Left padding via inline style */}
        <div style={{ width: parentBranches.length * INDENT + 4, flexShrink: 0 }} />

        {/* Drag handle */}
        <button
          {...listeners}
          {...attributes}
          className="p-0.5 rounded text-slate-700 hover:text-slate-400 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
          onClick={e => e.stopPropagation()}
          tabIndex={-1}
        >
          <GripVertical size={10} />
        </button>

        {/* Dot */}
        <div
          className="w-[5px] h-[5px] rounded-full flex-shrink-0"
          style={{
            backgroundColor: isSel ? color : 'transparent',
            border: `1.5px solid ${isSel ? color : '#475569'}`,
          }}
        />

        {/* Label */}
        <span
          className="text-[11.5px] truncate flex-1 leading-none"
          style={{ color: isSel ? '#f1f5f9' : isHidden ? '#475569' : '#8898aa' }}
        >
          {leaf.label}
        </span>

        {/* Year */}
        <span className="text-[9px] text-slate-700 font-mono flex-shrink-0 mr-1">{leaf.time}</span>

        {/* Hover actions */}
        {(hov || isDragOverlay) && !isDragging && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
              title={isHidden ? '显示节点' : '隐藏节点'}
              onClick={e => { e.stopPropagation(); useStore.getState().toggleHide(leaf.id) }}
            >
              {isHidden ? <Eye size={10} /> : <EyeOff size={10} />}
            </button>
            <button
              className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors"
              title="编辑" onClick={e => { e.stopPropagation(); onSelect(leaf.id) }}
            >
              <Edit2 size={10} />
            </button>
            <button
              className="p-0.5 rounded hover:bg-red-900/60 text-slate-500 hover:text-red-400 transition-colors"
              title="删除"
              onClick={e => {
                e.stopPropagation()
                if (confirm(`删除「${leaf.label}」？`)) onDelete(leaf.id)
              }}
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}
      </div>

      {!isDragOverlay && (
        <InsertGap
          parentBranches={parentBranches}
          afterYear={leaf.timeYear}
          onInsert={onInsertAfter}
        />
      )}
    </>
  )
}

// ── Droppable branch row ──────────────────────────────────────────────────

function DroppableBranchRow({ branch, collapsed, onToggle,
  onDeleteBranch, onInsert, children: renderChildren }: {
  branch: SidebarBranch
  collapsed: Set<string>
  onToggle: (key: string) => void
  onDeleteBranch: (path: string[]) => void
  onInsert: (branches: string[], year: number) => void
  children: (collapsed: boolean) => React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `branch::${branch.id}`,
    data: { type: 'branch', pathArray: branch.pathArray },
  })
  const [hov, setHov] = useState(false)
  const isCollapsed = collapsed.has(branch.collapseKey)
  const hasChildren = branch.children.length > 0 || branch.leaves.length > 0
  const INDENT = 14

  return (
    <div>
      <div
        ref={setNodeRef}
        className="flex items-center gap-1.5 py-[3px] rounded transition-colors"
        style={{
          paddingLeft: branch.depth * INDENT + 8,
          paddingRight: 4,
          background: isOver ? `${branch.color}22` : hov ? '#ffffff06' : undefined,
          cursor: 'pointer',
          outline: isOver ? `1px solid ${branch.color}50` : undefined,
        }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={() => onToggle(branch.collapseKey)}
      >
        <span className="w-3 flex-shrink-0 flex items-center justify-center text-slate-700">
          {hasChildren
            ? (isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />)
            : <span className="w-3" />}
        </span>
        <div className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ backgroundColor: branch.color }} />
        <span className="text-[12px] text-slate-400 truncate flex-1 leading-none">{branch.label}</span>

        {hov && (
          <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
            <button
              className="p-0.5 rounded hover:bg-indigo-900/60 text-slate-600 hover:text-indigo-400"
              title="在此分支下添加节点"
              onClick={e => { e.stopPropagation(); onInsert(branch.pathArray, 0) }}
            >
              <Plus size={10} />
            </button>
            <button
              className="p-0.5 rounded hover:bg-red-900/60 text-slate-600 hover:text-red-400"
              title="删除整个分支"
              onClick={e => {
                e.stopPropagation()
                if (confirm(`删除「${branch.label}」分支及其所有节点？`)) onDeleteBranch(branch.pathArray)
              }}
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}
        {!hov && branch.leaves.length > 0 && (
          <span className="text-[9px] text-slate-700 ml-auto flex-shrink-0">{branch.leaves.length}</span>
        )}
      </div>

      {renderChildren(isCollapsed)}
    </div>
  )
}

// ── Recursive branch tree ──────────────────────────────────────────────────

function BranchTree({ branch, collapsed, onToggle, selectedId, onSelect, onDelete,
  onDeleteBranch, onInsert }: {
  branch: SidebarBranch
  collapsed: Set<string>
  onToggle: (key: string) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  onDelete: (id: string) => void
  onDeleteBranch: (path: string[]) => void
  onInsert: (branches: string[], year: number) => void
}) {
  const shared = { collapsed, onToggle, selectedId, onSelect, onDelete, onDeleteBranch, onInsert }
  const branchRowProps = { collapsed, onToggle, onDeleteBranch, onInsert }

  return (
    <DroppableBranchRow branch={branch} {...branchRowProps}>
      {(isCollapsed) => isCollapsed ? null : (
        <div>
          {branch.leaves.length > 0 && (
            <InsertGap
              parentBranches={branch.pathArray}
              afterYear={(branch.leaves[0]?.timeYear ?? 1) - 1}
              onInsert={onInsert}
            />
          )}
          {branch.leaves.map(leaf => (
            <DraggableLeafRow
              key={leaf.id}
              leaf={leaf}
              parentBranches={branch.pathArray}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onInsertAfter={onInsert}
            />
          ))}
          {branch.children.map(child => (
            <BranchTree key={child.id} branch={child} {...shared} />
          ))}
        </div>
      )}
    </DroppableBranchRow>
  )
}

// ── Sidebar root ─────────────────────────────────────────────────────────────

interface TreeSidebarProps {
  open: boolean
  onToggleOpen: () => void
}

export default function TreeSidebar({ open, onToggleOpen }: TreeSidebarProps) {
  const knodes          = useStore(s => s.nodes)
  const collapsedCanvas = useStore(s => s.collapsedBranches)
  const collapsedSb     = useStore(s => s.sidebarCollapsed)
  const collapseSync    = useStore(s => s.collapseSync)
  const toggleSidebar   = useStore(s => s.toggleSidebarCollapse)
  const setSync         = useStore(s => s.setCollapseSync)
  const selectedId      = useStore(s => s.selectedId)
  const selectNode      = useStore(s => s.selectNode)
  const addNode         = useStore(s => s.addNode)
  const deleteNode      = useStore(s => s.deleteNode)
  const deleteBranch    = useStore(s => s.deleteBranch)
  const updateNode      = useStore(s => s.updateNode)

  const collapsed = collapseSync ? collapsedCanvas : collapsedSb

  const [draggingLeafId, setDraggingLeafId] = useState<string | null>(null)
  const draggingLeaf = knodes.find(n => n.id === draggingLeafId) ?? null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const onDragStart = useCallback((e: DragStartEvent) => {
    const d = e.active.data.current
    if (d?.type === 'leaf') setDraggingLeafId(d.nodeId)
  }, [])

  const onDragEnd = useCallback((e: DragEndEvent) => {
    setDraggingLeafId(null)
    const { active, over } = e
    if (!over) return
    const src = active.data.current
    const dst = over.data.current
    if (src?.type === 'leaf' && dst?.type === 'branch') {
      const targetPath: string[] = dst.pathArray
      updateNode(src.nodeId, {
        branches: [
          targetPath[0] || undefined,
          targetPath[1] || undefined,
          targetPath[2] || undefined,
          targetPath[3] || undefined,
          targetPath[4] || undefined,
          targetPath[5] || undefined,
        ] as KnowledgeNode['branches'],
      })
    }
  }, [updateNode])

  const onInsert = useCallback((branches: string[], afterYear: number) => {
    const year = afterYear > 0 ? afterYear + 1 : new Date().getFullYear()
    const node: KnowledgeNode = {
      id: nanoid(),
      branches: [
        branches[0] || undefined,
        branches[1] || undefined,
        branches[2] || undefined,
        branches[3] || undefined,
        branches[4] || undefined,
        branches[5] || undefined,
      ] as KnowledgeNode['branches'],
      phase: '', time: String(year), timeYear: year,
      label: '新节点', tags: [], significance: '', content: '',
    }
    addNode(node)
    selectNode(node.id)
  }, [addNode, selectNode])

  const topBranches = useMemo(() => buildTree(knodes), [knodes])

  const shared = {
    collapsed,
    onToggle: toggleSidebar,
    selectedId,
    onSelect: selectNode,
    onDelete: deleteNode,
    onDeleteBranch: deleteBranch,
    onInsert,
  }

  // ── Collapsed panel ──
  if (!open) {
    return (
      <div className="w-8 flex-shrink-0 h-full border-r border-slate-800/70 flex flex-col items-center pt-3 bg-[#0c0f18]">
        <button
          onClick={onToggleOpen}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors"
          title="展开目录"
        >
          <PanelLeftOpen size={13} />
        </button>
      </div>
    )
  }

  return (
    <div className="w-[248px] flex-shrink-0 h-full border-r border-slate-800/70 flex flex-col overflow-hidden bg-[#0c0f18]">
      {/* Header */}
      <div className="px-2.5 py-2 border-b border-slate-800/70 flex-shrink-0 flex items-center gap-1">
        <button
          onClick={onToggleOpen}
          className="p-1 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors"
          title="收起目录"
        >
          <PanelLeftClose size={12} />
        </button>
        <span className="text-[10px] font-semibold tracking-[0.1em] text-slate-600 uppercase flex-1 ml-0.5 select-none">
          知识树
        </span>
        <button
          onClick={() => setSync(!collapseSync)}
          className={`p-1 rounded transition-colors flex items-center gap-0.5 ${
            collapseSync
              ? 'bg-indigo-900/60 text-indigo-400 hover:bg-indigo-900'
              : 'hover:bg-slate-800 text-slate-600 hover:text-slate-400'
          }`}
          title={collapseSync ? '折叠与画布同步（点击切为独立）' : '折叠独立于画布（点击切为同步）'}
        >
          {collapseSync ? <Link2 size={11} /> : <Link2Off size={11} />}
        </button>
      </div>

      {/* Tree with DND */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
          {knodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
              <span className="text-slate-600 text-lg">↑</span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                右上角导入 Excel<br />树结构将在此显示
              </p>
            </div>
          ) : (
            topBranches.map(branch => (
              <BranchTree key={branch.id} branch={branch} {...shared} />
            ))
          )}
        </div>

        {/* Drag ghost overlay */}
        <DragOverlay dropAnimation={null}>
          {draggingLeaf && (() => {
            const branches = draggingLeaf.branches.filter(Boolean) as string[]
            return (
              <div className="bg-slate-800 border border-slate-600 rounded px-2 py-1 flex items-center gap-1.5 shadow-xl opacity-90">
                <GripVertical size={10} className="text-slate-500" />
                <div
                  className="w-[5px] h-[5px] rounded-full"
                  style={{ backgroundColor: getBranchColor(branches.length - 1).dot }}
                />
                <span className="text-[11px] text-slate-200">{draggingLeaf.label}</span>
                <span className="text-[9px] text-slate-500 font-mono">{draggingLeaf.time}</span>
              </div>
            )
          })()}
        </DragOverlay>
      </DndContext>

      {/* Footer */}
      {knodes.length > 0 && (
        <div className="px-3 py-1.5 border-t border-slate-800/70 flex-shrink-0">
          <span className="text-[10px] text-slate-700">
            {knodes.length} 个节点 · {collapseSync ? '折叠同步' : '折叠独立'}
          </span>
        </div>
      )}
    </div>
  )
}
