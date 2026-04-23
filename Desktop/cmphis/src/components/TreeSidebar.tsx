import { useMemo, useCallback, useState } from 'react'
import {
  ChevronRight, ChevronDown, Edit2, Trash2, Plus,
  Link2, Link2Off, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { useStore } from '../store'
import { getBranchColor } from '../utils/layout'
import { nanoid } from '../utils/nanoid'
import type { KnowledgeNode } from '../types'

// ── Data model ──────────────────────────────────────────────────────────────

interface SidebarBranch {
  id: string          // full path key e.g. "A///B///C"
  label: string
  depth: number
  collapseKey: string
  color: string
  children: SidebarBranch[]
  leaves: KnowledgeNode[]
  pathArray: string[] // e.g. ["A","B","C"]
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

// ── Insert-between "+" gap ───────────────────────────────────────────────────

function InsertGap({
  parentBranches, afterTimeYear, onInsert,
}: {
  parentBranches: string[]
  afterTimeYear: number
  onInsert: (branches: string[], year: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="relative h-1.5 flex items-center justify-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ paddingLeft: (parentBranches.length) * 14 + 8 }}
    >
      {hovered && (
        <button
          className="absolute flex items-center gap-0.5 text-[9px] text-indigo-400 hover:text-indigo-300 bg-slate-900 border border-indigo-800/60 rounded px-1 z-20"
          onClick={(e) => { e.stopPropagation(); onInsert(parentBranches, afterTimeYear) }}
        >
          <Plus size={8} /> 插入
        </button>
      )}
    </div>
  )
}

// ── Leaf row with hover actions ──────────────────────────────────────────────

function LeafRow({
  leaf, parentBranches, selectedId, onSelect, onDelete, onInsertAfter,
}: {
  leaf: KnowledgeNode
  parentBranches: string[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onInsertAfter: (branches: string[], afterYear: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  const isSel = selectedId === leaf.id
  const color = getBranchColor(parentBranches.length - 1).dot
  const INDENT = 14

  return (
    <>
      <div
        className="flex items-center gap-1.5 py-[3px] rounded transition-colors"
        style={{
          paddingLeft: `${parentBranches.length * INDENT + 8}px`,
          paddingRight: 4,
          background: isSel ? `${color}18` : hovered ? '#ffffff08' : undefined,
          cursor: 'pointer',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onSelect(isSel ? null as any : leaf.id)}
      >
        {/* Dot */}
        <div
          className="w-3 flex-shrink-0 flex items-center justify-center"
        >
          <div
            className="w-[5px] h-[5px] rounded-full transition-all"
            style={{
              backgroundColor: isSel ? color : 'transparent',
              border: `1.5px solid ${isSel ? color : '#475569'}`,
            }}
          />
        </div>

        {/* Label */}
        <span
          className="text-[11.5px] truncate flex-1 leading-none"
          style={{ color: isSel ? '#f1f5f9' : '#8898aa' }}
        >
          {leaf.label}
        </span>

        {/* Time badge */}
        <span className="text-[9px] text-slate-700 font-mono flex-shrink-0 ml-1">{leaf.time}</span>

        {/* Hover actions */}
        {hovered && (
          <div className="flex items-center gap-0.5 ml-1 flex-shrink-0">
            <button
              className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300"
              title="编辑"
              onClick={e => { e.stopPropagation(); onSelect(leaf.id) }}
            >
              <Edit2 size={10} />
            </button>
            <button
              className="p-0.5 rounded hover:bg-red-900/60 text-slate-500 hover:text-red-400"
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

      {/* Insert-after gap */}
      <InsertGap
        parentBranches={parentBranches}
        afterTimeYear={leaf.timeYear}
        onInsert={onInsertAfter}
      />
    </>
  )
}

// ── Branch row (recursive) ───────────────────────────────────────────────────

function BranchRow({
  branch, collapsed, onToggle, selectedId, onSelect, onDelete, onDeleteBranch, onInsert,
}: {
  branch: SidebarBranch
  collapsed: Set<string>
  onToggle: (key: string) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  onDelete: (id: string) => void
  onDeleteBranch: (pathArray: string[]) => void
  onInsert: (branches: string[], afterYear: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  const isCollapsed = collapsed.has(branch.collapseKey)
  const hasChildren = branch.children.length > 0 || branch.leaves.length > 0
  const INDENT = 14

  return (
    <div>
      {/* Branch header row */}
      <div
        className="flex items-center gap-1.5 py-[3px] rounded transition-colors"
        style={{
          paddingLeft: `${branch.depth * INDENT + 8}px`,
          paddingRight: 4,
          background: hovered ? '#ffffff06' : undefined,
          cursor: 'pointer',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onToggle(branch.collapseKey)}
      >
        {/* Collapse chevron */}
        <span className="w-3 flex-shrink-0 flex items-center justify-center text-slate-700">
          {hasChildren
            ? (isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />)
            : <span className="w-3" />}
        </span>

        {/* Color dot */}
        <div
          className="w-[7px] h-[7px] rounded-full flex-shrink-0 transition-transform"
          style={{ backgroundColor: branch.color }}
        />

        {/* Label */}
        <span className="text-[12px] text-slate-400 truncate flex-1 leading-none">
          {branch.label}
        </span>

        {/* Leaf count */}
        {branch.leaves.length > 0 && !hovered && (
          <span className="text-[9px] text-slate-700 ml-auto flex-shrink-0">{branch.leaves.length}</span>
        )}

        {/* Hover actions */}
        {hovered && (
          <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
            <button
              className="p-0.5 rounded hover:bg-indigo-900/60 text-slate-600 hover:text-indigo-400"
              title="在此分支下添加节点"
              onClick={e => {
                e.stopPropagation()
                onInsert(branch.pathArray, 0)
              }}
            >
              <Plus size={10} />
            </button>
            <button
              className="p-0.5 rounded hover:bg-red-900/60 text-slate-600 hover:text-red-400"
              title="删除整个分支"
              onClick={e => {
                e.stopPropagation()
                if (confirm(`删除整个「${branch.label}」分支及其所有节点？`)) {
                  onDeleteBranch(branch.pathArray)
                }
              }}
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Children (when expanded) */}
      {!isCollapsed && (
        <div>
          {/* Insert-at-top gap */}
          {branch.leaves.length > 0 && (
            <InsertGap
              parentBranches={branch.pathArray}
              afterTimeYear={(branch.leaves[0]?.timeYear ?? 1) - 1}
              onInsert={onInsert}
            />
          )}

          {branch.leaves.map((leaf) => (
            <LeafRow
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
            <BranchRow
              key={child.id}
              branch={child}
              collapsed={collapsed}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onDeleteBranch={onDeleteBranch}
              onInsert={onInsert}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sidebar root ─────────────────────────────────────────────────────────────

interface TreeSidebarProps {
  open: boolean
  onToggleOpen: () => void
}

export default function TreeSidebar({ open, onToggleOpen }: TreeSidebarProps) {
  const knodes         = useStore(s => s.nodes)
  const collapsedCanvas = useStore(s => s.collapsedBranches)
  const collapsedSidebar = useStore(s => s.sidebarCollapsed)
  const collapseSync   = useStore(s => s.collapseSync)
  const toggleSidebar  = useStore(s => s.toggleSidebarCollapse)
  const setCollapseSync = useStore(s => s.setCollapseSync)
  const selectedId     = useStore(s => s.selectedId)
  const selectNode     = useStore(s => s.selectNode)
  const addNode        = useStore(s => s.addNode)
  const deleteNode     = useStore(s => s.deleteNode)
  const deleteBranch   = useStore(s => s.deleteBranch)

  // Which collapse set to use in sidebar
  const collapsed = collapseSync ? collapsedCanvas : collapsedSidebar

  const onToggle = useCallback((key: string) => toggleSidebar(key), [toggleSidebar])
  const onSelect = useCallback((id: string | null) => selectNode(id), [selectNode])
  const onDelete = useCallback((id: string) => deleteNode(id), [deleteNode])
  const onDeleteBranch = useCallback((pathArray: string[]) => deleteBranch(pathArray), [deleteBranch])

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
      phase: '',
      time: String(year),
      timeYear: year,
      label: '新节点',
      tags: [],
      significance: '',
      content: '',
    }
    addNode(node)
    selectNode(node.id)
  }, [addNode, selectNode])

  const topBranches = useMemo(() => buildTree(knodes), [knodes])

  // ── Collapsed panel (just a strip with reopen button) ──
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
        {/* Collapse panel button */}
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

        {/* Collapse sync toggle */}
        <button
          onClick={() => setCollapseSync(!collapseSync)}
          className={`p-1 rounded transition-colors text-[9px] flex items-center gap-0.5 ${
            collapseSync
              ? 'bg-indigo-900/60 text-indigo-400 hover:bg-indigo-900'
              : 'hover:bg-slate-800 text-slate-600 hover:text-slate-400'
          }`}
          title={collapseSync ? '折叠状态：与画布同步（点击切换为独立）' : '折叠状态：独立（点击切换为与画布同步）'}
        >
          {collapseSync ? <Link2 size={11} /> : <Link2Off size={11} />}
          <span className="hidden">{collapseSync ? '同步' : '独立'}</span>
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {knodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
            <div className="w-8 h-8 rounded-full border border-slate-800 flex items-center justify-center">
              <span className="text-slate-600">↑</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              右上角导入 Excel<br />树结构将在此显示
            </p>
          </div>
        ) : (
          topBranches.map(branch => (
            <BranchRow
              key={branch.id}
              branch={branch}
              collapsed={collapsed}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onDeleteBranch={onDeleteBranch}
              onInsert={onInsert}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {knodes.length > 0 && (
        <div className="px-3 py-1.5 border-t border-slate-800/70 flex-shrink-0 flex items-center justify-between">
          <span className="text-[10px] text-slate-700">{knodes.length} 个节点</span>
          <span className="text-[9px] text-slate-800">
            {collapseSync ? '🔗 同步' : '— 独立'}
          </span>
        </div>
      )}
    </div>
  )
}
