import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { buildBranchTree, type BranchTreeNode } from '../utils/branches'
import { getBranchColor } from '../utils/layout'

function BranchRow({ branch, collapsed, onToggle }: {
  branch: BranchTreeNode
  collapsed: Set<string>
  onToggle: (key: string) => void
}) {
  const addBranch    = useStore(s => s.addBranch)
  const renameBranch = useStore(s => s.renameBranch)
  const deleteBranch = useStore(s => s.deleteBranch)
  const [hovered, setHovered] = useState(false)

  const isCollapsed = collapsed.has(branch.key)
  const hasChildren = branch.children.length > 0
  const color = getBranchColor(branch.depth).dot

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation()
    const name = window.prompt(`在「${branch.label}」下新建子分支`)?.trim()
    if (name) addBranch(branch.path, name)
  }
  function handleRename(e: React.MouseEvent) {
    e.stopPropagation()
    const name = window.prompt('重命名分支（其下所有节点会同步更新）', branch.label)?.trim()
    if (name && name !== branch.label) renameBranch(branch.path, name)
  }
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirm(`删除分支「${branch.label}」及其下所有子分支与 ${branch.nodeCount} 个节点？`)) {
      deleteBranch(branch.path)
    }
  }

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 pr-1.5 rounded cursor-pointer transition-colors text-[12px] select-none hover:bg-slate-800/50"
        style={{ paddingLeft: branch.depth * 13 + 6, color: 'var(--text-2)' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => hasChildren && onToggle(branch.key)}
      >
        <span className="w-3 flex-shrink-0 text-slate-600 flex items-center justify-center">
          {hasChildren ? (isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />) : null}
        </span>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="truncate flex-1" title={branch.label}>{branch.label}</span>
        {hovered ? (
          <span className="flex items-center gap-0.5 flex-shrink-0">
            <button onClick={handleAdd} title="新建子分支" className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400"><Plus size={12} /></button>
            <button onClick={handleRename} title="重命名" className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-indigo-400"><Pencil size={11} /></button>
            <button onClick={handleDelete} title="删除分支" className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400"><Trash2 size={11} /></button>
          </span>
        ) : (
          <span className="text-[10px] text-slate-600 flex-shrink-0 tabular-nums">{branch.nodeCount || ''}</span>
        )}
      </div>
      {hasChildren && !isCollapsed && (
        <div>
          {branch.children.map(c => (
            <BranchRow key={c.key} branch={c} collapsed={collapsed} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function BranchManager() {
  const nodes = useStore(s => s.nodes)
  const branchRegistry = useStore(s => s.branchRegistry)
  const addBranch = useStore(s => s.addBranch)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const tree = useMemo(() => buildBranchTree(nodes, branchRegistry), [nodes, branchRegistry])

  function toggle(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function addTop() {
    const name = window.prompt('新建一级分支')?.trim()
    if (name) addBranch([], name)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-2)', borderRight: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 flex-shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>分支管理</span>
        <button onClick={addTop} title="新建一级分支"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-slate-400 hover:text-emerald-400 hover:bg-slate-800">
          <Plus size={12} /> 分支
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 py-2">
        {tree.length === 0
          ? <p className="text-[11px] text-slate-600 px-2 py-4">暂无分支，点击右上角「＋ 分支」新建</p>
          : tree.map(b => <BranchRow key={b.key} branch={b} collapsed={collapsed} onToggle={toggle} />)
        }
      </div>
    </div>
  )
}
