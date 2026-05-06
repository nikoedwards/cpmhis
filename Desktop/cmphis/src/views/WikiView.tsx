import { useState, useMemo, useEffect } from 'react'
import { ChevronRight, ChevronDown, Edit2, Check, X } from 'lucide-react'
import { useStore } from '../store'
import type { KnowledgeNode } from '../types'
import { getBranchColor } from '../utils/layout'

// ── Tree data structures ───────────────────────────────────────────────────

interface WikiBranch {
  id: string
  label: string
  depth: number
  collapseKey: string
  color: string
  children: WikiBranch[]
  leaves: KnowledgeNode[]
  pathArray: string[]
}

function buildWikiTree(knodes: KnowledgeNode[]): WikiBranch[] {
  const root: WikiBranch = {
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

// ── Selection type ─────────────────────────────────────────────────────────

type WikiSel =
  | { type: 'leaf'; id: string }
  | { type: 'branch'; path: string[] }
  | null

// ── Left panel: tree ───────────────────────────────────────────────────────

function WikiLeafRow({ leaf, sel, onSelect }: {
  leaf: KnowledgeNode
  sel: WikiSel
  onSelect: (s: WikiSel) => void
}) {
  const isSel = sel?.type === 'leaf' && sel.id === leaf.id
  const color = getBranchColor(leaf.branches.filter(Boolean).length - 1).dot

  return (
    <div
      className="flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer transition-colors text-[12px]"
      style={{
        paddingLeft: leaf.branches.filter(Boolean).length * 14 + 8,
        background: isSel ? `${color}22` : undefined,
        color: isSel ? '#e2e8f0' : '#64748b',
      }}
      onClick={() => onSelect({ type: 'leaf', id: leaf.id })}
      onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.color = '#94a3b8' }}
      onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.color = '#64748b' }}
    >
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: isSel ? color : '#334155' }} />
      <span className="truncate flex-1">{leaf.label}</span>
      <span className="text-[10px] flex-shrink-0" style={{ color: '#334155' }}>{leaf.time}</span>
    </div>
  )
}

function WikiBranchRow({ branch, collapsed, onToggle, sel, onSelect }: {
  branch: WikiBranch
  collapsed: Set<string>
  onToggle: (key: string) => void
  sel: WikiSel
  onSelect: (s: WikiSel) => void
}) {
  const isCollapsed = collapsed.has(branch.collapseKey)
  const isSel = sel?.type === 'branch' && sel.path.join('///') === branch.pathArray.join('///')
  const INDENT = 14

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1 rounded cursor-pointer transition-colors text-[12px] select-none"
        style={{
          paddingLeft: branch.depth * INDENT + 8,
          paddingRight: 8,
          background: isSel ? `${branch.color}18` : undefined,
          color: isSel ? '#e2e8f0' : '#94a3b8',
        }}
        onClick={() => {
          onToggle(branch.collapseKey)
          onSelect({ type: 'branch', path: branch.pathArray })
        }}
      >
        <span className="w-3 flex-shrink-0 text-slate-600 flex items-center justify-center">
          {branch.children.length > 0 || branch.leaves.length > 0
            ? (isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />)
            : null}
        </span>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: branch.color }} />
        <span className="truncate flex-1 font-medium">{branch.label}</span>
        {branch.leaves.length > 0 && (
          <span className="text-[10px] text-slate-700 flex-shrink-0">{branch.leaves.length}</span>
        )}
      </div>

      {!isCollapsed && (
        <div>
          {branch.leaves.map(leaf => (
            <WikiLeafRow key={leaf.id} leaf={leaf} sel={sel} onSelect={onSelect} />
          ))}
          {branch.children.map(child => (
            <WikiBranchRow
              key={child.id} branch={child}
              collapsed={collapsed} onToggle={onToggle}
              sel={sel} onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Center panel ───────────────────────────────────────────────────────────

function WikiWelcome({ nodeCount }: { nodeCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
      <div className="text-4xl font-light text-slate-800">Wiki</div>
      <p className="text-sm">{nodeCount > 0 ? `共 ${nodeCount} 个节点，点击左侧目录开始浏览` : '暂无数据，请先在数据库视图导入数据'}</p>
    </div>
  )
}

function Breadcrumb({ branches }: { branches: (string | undefined)[] }) {
  const parts = branches.filter(Boolean) as string[]
  return (
    <div className="flex items-center gap-1 text-[11px] text-slate-600 flex-wrap">
      {parts.map((b, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={9} className="text-slate-700" />}
          <span>{b}</span>
        </span>
      ))}
    </div>
  )
}

function WikiNodePage({ node, onJump }: {
  node: KnowledgeNode
  onJump?: (id: string) => void
}) {
  const { updateNode } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<KnowledgeNode>(node)

  useEffect(() => {
    setEditing(false)
    setDraft({ ...node })
  }, [node.id])

  function save() {
    const timeYear = parseInt(draft.time) || node.timeYear
    updateNode(node.id, { ...draft, timeYear })
    setEditing(false)
  }

  const color = getBranchColor(node.branches.filter(Boolean).length - 1).dot

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Breadcrumb branches={node.branches} />
          {editing
            ? <input
                className="text-2xl font-semibold bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 outline-none focus:border-indigo-500"
                value={draft.label}
                onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
              />
            : <h1 className="text-2xl font-semibold text-slate-100">{node.label}</h1>
          }
          {/* Meta row */}
          <div className="flex items-center gap-3 text-[12px] text-slate-500 flex-wrap">
            {editing ? (
              <>
                <input
                  className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-300 outline-none focus:border-indigo-500"
                  placeholder="时间"
                  value={draft.time}
                  onChange={e => setDraft(d => ({ ...d, time: e.target.value }))}
                />
                <input
                  className="w-28 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-300 outline-none focus:border-indigo-500"
                  placeholder="阶段"
                  value={draft.phase}
                  onChange={e => setDraft(d => ({ ...d, phase: e.target.value }))}
                />
                <input
                  className="w-48 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-300 outline-none focus:border-indigo-500"
                  placeholder="标签（逗号分隔）"
                  value={draft.tags.join(', ')}
                  onChange={e => setDraft(d => ({ ...d, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
                />
              </>
            ) : (
              <>
                {node.time && <span className="flex items-center gap-1">📅 {node.time}</span>}
                {node.phase && <span className="px-2 py-0.5 rounded-full text-[11px] border border-slate-700 text-slate-400">{node.phase}</span>}
                {node.tags.map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 rounded text-[11px]" style={{ backgroundColor: `${color}18`, color: `${color}cc` }}>
                    {tag}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Edit / Save / Cancel */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={save}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-400 border border-emerald-700/40 transition-colors">
                <Check size={11} /> 保存
              </button>
              <button onClick={() => { setEditing(false); setDraft({ ...node }) }}
                className="p-1.5 rounded text-slate-600 hover:text-slate-400 hover:bg-slate-800 transition-colors">
                <X size={13} />
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition-colors">
              <Edit2 size={11} /> 编辑
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-slate-800/60" />

      {/* Significance */}
      <section className="flex flex-col gap-2">
        <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">意义 / 简介</h3>
        {editing
          ? <textarea
              className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 resize-y min-h-[80px] leading-relaxed"
              value={draft.significance}
              onChange={e => setDraft(d => ({ ...d, significance: e.target.value }))}
            />
          : <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{node.significance || <span className="text-slate-700">—</span>}</p>
        }
      </section>

      {/* Content */}
      <section className="flex flex-col gap-2">
        <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">详细内容</h3>
        {editing
          ? <textarea
              className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 resize-y min-h-[160px] leading-relaxed font-mono text-[13px]"
              value={draft.content ?? ''}
              onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
            />
          : <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{node.content || <span className="text-slate-700">—</span>}</div>
        }
      </section>

      {/* Branch path (edit) */}
      {editing && (
        <section className="flex flex-col gap-2">
          <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">分支层级</h3>
          <div className="grid grid-cols-2 gap-2">
            {(['一','二','三','四','五','六'] as const).map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-600 w-8">{label}级</span>
                <input
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-[12px] text-slate-200 outline-none focus:border-indigo-500"
                  value={draft.branches[i as 0|1|2|3|4|5] ?? ''}
                  onChange={e => {
                    const b = [...draft.branches] as KnowledgeNode['branches']
                    b[i as 0|1|2|3|4|5] = e.target.value || undefined
                    setDraft(d => ({ ...d, branches: b }))
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {onJump && (
        <div className="pt-2">
          <button onClick={() => onJump(node.id)}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
            在画布中定位此节点 →
          </button>
        </div>
      )}
    </div>
  )
}

function WikiBranchPage({ path, nodes, onSelectLeaf }: {
  path: string[]
  nodes: KnowledgeNode[]
  onSelectLeaf: (id: string) => void
}) {
  const pathKey = path.join('///')
  const label = path[path.length - 1]
  const color = getBranchColor(path.length - 1).dot

  // Direct leaves under this branch
  const directLeaves = nodes.filter(n => n.branches.filter(Boolean).join('///') === pathKey)

  // Unique sub-branch names at next depth
  const subBranchNames = [...new Set(
    nodes
      .filter(n => {
        const b = n.branches.filter(Boolean)
        return b.length > path.length && b.slice(0, path.length).join('///') === pathKey
      })
      .map(n => n.branches.filter(Boolean)[path.length] as string)
  )]

  const total = nodes.filter(n => {
    const b = n.branches.filter(Boolean)
    return b.length >= path.length && b.slice(0, path.length).join('///') === pathKey
  }).length

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Breadcrumb branches={path.slice(0, -1).map((_, i) => path[i])} />
        <h1 className="text-2xl font-semibold" style={{ color }}>
          {label}
        </h1>
        <p className="text-sm text-slate-600">共 {total} 个节点</p>
      </div>

      <div className="border-t border-slate-800/60" />

      {subBranchNames.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">子分支</h3>
          <div className="flex flex-wrap gap-2">
            {subBranchNames.map(name => {
              const count = nodes.filter(n => {
                const b = n.branches.filter(Boolean)
                return b.length > path.length + 1 || (b.length === path.length + 1 && b[path.length] === name)
                  ? b.slice(0, path.length + 1).join('///') === [...path, name].join('///')
                  : false
              }).length
              return (
                <div key={name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-[12px] text-slate-400"
                  style={{ backgroundColor: `${getBranchColor(path.length).dot}10` }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getBranchColor(path.length).dot }} />
                  {name}
                  <span className="text-slate-700 text-[10px]">{count}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {directLeaves.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">节点列表</h3>
          <div className="flex flex-col gap-1">
            {directLeaves.map(leaf => (
              <div key={leaf.id}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-slate-800/50 hover:border-slate-700/60 hover:bg-slate-900/40 cursor-pointer transition-colors group"
                onClick={() => onSelectLeaf(leaf.id)}>
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] text-slate-200 group-hover:text-white font-medium">{leaf.label}</span>
                    <span className="text-[11px] text-slate-600">{leaf.time}</span>
                  </div>
                  {leaf.significance && (
                    <p className="text-[12px] text-slate-500 leading-snug line-clamp-2">{leaf.significance}</p>
                  )}
                </div>
                <ChevronRight size={13} className="text-slate-700 group-hover:text-slate-500 mt-1 flex-shrink-0" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Right panel: sub-directory ─────────────────────────────────────────────

function WikiSubDir({ sel, nodes, onSelect }: {
  sel: WikiSel
  nodes: KnowledgeNode[]
  onSelect: (s: WikiSel) => void
}) {
  if (!sel) return <p className="text-[11px] text-slate-700 mt-2">点击左侧目录查看</p>

  if (sel.type === 'leaf') {
    const node = nodes.find(n => n.id === sel.id)
    if (!node) return null
    const pathKey = node.branches.filter(Boolean).join('///')
    const siblings = nodes.filter(n => n.id !== node.id && n.branches.filter(Boolean).join('///') === pathKey)

    return (
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-2 font-medium">同级节点</div>
        {siblings.length === 0
          ? <p className="text-[11px] text-slate-700">无同级节点</p>
          : siblings.map(s => (
            <div key={s.id}
              className="flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer hover:bg-slate-800/50 transition-colors group"
              onClick={() => onSelect({ type: 'leaf', id: s.id })}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-slate-700 group-hover:bg-slate-500" />
              <span className="text-[11px] text-slate-500 group-hover:text-slate-300 truncate flex-1">{s.label}</span>
              <span className="text-[10px] text-slate-700 flex-shrink-0">{s.time}</span>
            </div>
          ))
        }
      </div>
    )
  }

  // Branch selected: show sub-branches and direct leaves
  const pathKey = sel.path.join('///')
  const directLeaves = nodes.filter(n => n.branches.filter(Boolean).join('///') === pathKey)
  const subBranchNames = [...new Set(
    nodes
      .filter(n => {
        const b = n.branches.filter(Boolean)
        return b.length > sel.path.length && b.slice(0, sel.path.length).join('///') === pathKey
      })
      .map(n => n.branches.filter(Boolean)[sel.path.length] as string)
  )]

  return (
    <div className="flex flex-col gap-1">
      {subBranchNames.map(name => {
        const childPath = [...sel.path, name]
        const childColor = getBranchColor(sel.path.length).dot
        return (
          <div key={name}
            className="flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer hover:bg-slate-800/50 transition-colors group"
            onClick={() => onSelect({ type: 'branch', path: childPath })}>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: childColor }} />
            <span className="text-[11px] text-slate-400 group-hover:text-slate-200 truncate flex-1 font-medium">{name}</span>
            <ChevronRight size={9} className="text-slate-700 flex-shrink-0" />
          </div>
        )
      })}
      {directLeaves.map(leaf => (
        <div key={leaf.id}
          className="flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer hover:bg-slate-800/50 transition-colors group"
          onClick={() => onSelect({ type: 'leaf', id: leaf.id })}>
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-slate-700 group-hover:bg-slate-500" />
          <span className="text-[11px] text-slate-500 group-hover:text-slate-300 truncate flex-1">{leaf.label}</span>
          <span className="text-[10px] text-slate-700 flex-shrink-0">{leaf.time}</span>
        </div>
      ))}
      {subBranchNames.length === 0 && directLeaves.length === 0 && (
        <p className="text-[11px] text-slate-700">无子节点</p>
      )}
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────

export default function WikiView() {
  const nodes = useStore(s => s.nodes)
  const selectNode = useStore(s => s.selectNode)

  const [sel, setSel] = useState<WikiSel>(null)
  const [wikiCollapsed, setWikiCollapsed] = useState<Set<string>>(new Set())

  const tree = useMemo(() => buildWikiTree(nodes), [nodes])

  function toggleCollapse(key: string) {
    setWikiCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const selNode = sel?.type === 'leaf' ? nodes.find(n => n.id === sel.id) ?? null : null

  // Jump to canvas: set the canvas selectedId so DetailDrawer opens
  function jumpToCanvas(id: string) {
    selectNode(id)
  }

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>

      {/* ── Left: tree navigation ────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 border-r border-slate-800/60 overflow-y-auto"
        style={{ width: 240, background: '#0a0c12' }}
      >
        <div className="px-3 py-3">
          <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider mb-3 px-1">目录</div>
          {tree.length === 0
            ? <p className="text-[11px] text-slate-700 px-1">暂无数据</p>
            : tree.map(branch => (
              <WikiBranchRow
                key={branch.id} branch={branch}
                collapsed={wikiCollapsed} onToggle={toggleCollapse}
                sel={sel} onSelect={setSel}
              />
            ))
          }
        </div>
      </div>

      {/* ── Center: content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ background: '#0f1117' }}>
        {selNode ? (
          <WikiNodePage node={selNode} onJump={jumpToCanvas} />
        ) : sel?.type === 'branch' ? (
          <WikiBranchPage
            path={sel.path} nodes={nodes}
            onSelectLeaf={id => setSel({ type: 'leaf', id })}
          />
        ) : (
          <WikiWelcome nodeCount={nodes.length} />
        )}
      </div>

      {/* ── Right: sub-directory ─────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 border-l border-slate-800/60 overflow-y-auto"
        style={{ width: 200, background: '#0a0c12' }}
      >
        <div className="px-3 py-3">
          <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider mb-3 px-1">子目录</div>
          <WikiSubDir sel={sel} nodes={nodes} onSelect={setSel} />
        </div>
      </div>
    </div>
  )
}
