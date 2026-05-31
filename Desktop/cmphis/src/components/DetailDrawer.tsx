import { useState, useEffect } from 'react'
import { X, Edit2, Trash2, Check, ChevronRight, BookOpen } from 'lucide-react'
import { useStore } from '../store'
import type { KnowledgeNode } from '../types'
import BranchSelect from './BranchSelect'

const DRAWER_W_KEY = 'cmphis_drawer_w'
const MIN_W = 280
const MAX_W = 760

function loadDrawerWidth(): number {
  const v = parseInt(localStorage.getItem(DRAWER_W_KEY) || '', 10)
  return Number.isFinite(v) ? Math.min(MAX_W, Math.max(MIN_W, v)) : 320
}

function Field({ label, value, editing, onChange }: {
  label: string; value: string; editing: boolean; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      {editing
        ? <input
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 outline-none focus:border-indigo-500"
            value={value}
            onChange={e => onChange(e.target.value)}
          />
        : <span className="text-sm text-slate-200">{value || '—'}</span>
      }
    </div>
  )
}

function TextAreaField({ label, value, editing, onChange }: {
  label: string; value: string; editing: boolean; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      {editing
        ? <textarea
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 outline-none focus:border-indigo-500 resize-y min-h-[80px]"
            value={value}
            onChange={e => onChange(e.target.value)}
          />
        : <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{value || '—'}</p>
      }
    </div>
  )
}

export default function DetailDrawer({ onViewWiki }: { onViewWiki?: () => void }) {
  const { nodes, selectedId, selectNode, updateNode, deleteNode } = useStore()
  const node = nodes.find(n => n.id === selectedId) ?? null

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<KnowledgeNode | null>(null)
  const [width, setWidth] = useState<number>(loadDrawerWidth)

  useEffect(() => {
    setEditing(false)
    setDraft(node ? { ...node } : null)
  }, [selectedId])

  useEffect(() => {
    localStorage.setItem(DRAWER_W_KEY, String(width))
  }, [width])

  // 左侧手柄拖拽调整宽度（抽屉在右侧，宽度 = 视窗宽 - 鼠标 X）
  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    const onMove = (ev: MouseEvent) => {
      setWidth(Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - ev.clientX)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  if (!node || !draft) return null

  function patch<K extends keyof KnowledgeNode>(key: K, value: KnowledgeNode[K]) {
    setDraft(d => d ? { ...d, [key]: value } : d)
  }

  // 选择分支：设置该层级并清空更深层级，保持路径合法
  function setBranchLevel(i: number, value: string) {
    setDraft(d => {
      if (!d) return d
      const b = [...d.branches] as KnowledgeNode['branches']
      b[i as 0|1|2|3|4|5] = value.trim() || undefined
      for (let j = i + 1; j < 6; j++) b[j as 0|1|2|3|4|5] = undefined
      return { ...d, branches: b }
    })
  }

  function save() {
    if (!draft) return
    updateNode(draft.id, draft)
    setEditing(false)
  }

  function remove() {
    if (confirm(`删除「${node!.label}」？`)) {
      deleteNode(node!.id)
    }
  }

  const branchLabels = ['一级', '二级', '三级', '四级', '五级', '六级']

  return (
    <div
      className="theme-anim flex-shrink-0 h-full flex flex-col overflow-hidden relative"
      style={{ width, borderLeft: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      {/* 左边缘拖拽手柄：调整抽屉宽度 */}
      <div
        onMouseDown={startResize}
        title="拖动调整宽度"
        className="group"
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 20 }}
      >
        <div
          className="group-hover:opacity-100 opacity-0 transition-opacity"
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--accent)' }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-1 text-[11px] text-slate-500 flex-wrap">
          {draft.branches.filter(Boolean).map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={10} />}
              <span>{b}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {onViewWiki && (
            <button onClick={onViewWiki} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-400" title="在 Wiki 中查看详情"><BookOpen size={14} /></button>
          )}
          {editing
            ? <button onClick={save} className="p-1.5 rounded hover:bg-emerald-900 text-emerald-400" title="保存"><Check size={14} /></button>
            : <button onClick={() => setEditing(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400" title="编辑"><Edit2 size={14} /></button>
          }
          <button onClick={remove} className="p-1.5 rounded hover:bg-red-900 text-slate-400 hover:text-red-400" title="删除"><Trash2 size={14} /></button>
          <button onClick={() => selectNode(null)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><X size={14} /></button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <Field label="节点名称" value={draft.label} editing={editing} onChange={v => patch('label', v)} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="时间" value={draft.time} editing={editing} onChange={v => patch('time', v)} />
          <Field label="阶段" value={draft.phase} editing={editing} onChange={v => patch('phase', v)} />
        </div>

        {/* Branches */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">分支层级</span>
          {branchLabels.map((bl, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600 w-6">{bl}</span>
              {editing
                ? <div className="flex-1">
                    <BranchSelect
                      parentPath={(draft.branches.slice(0, i).filter(Boolean) as string[])}
                      value={draft.branches[i] ?? ''}
                      onSelect={v => setBranchLevel(i, v)}
                      autoFocus={false}
                    />
                  </div>
                : <span className="text-xs text-slate-400">{draft.branches[i] || <span className="text-slate-700">—</span>}</span>
              }
            </div>
          ))}
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">标签</span>
          {editing
            ? <input
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 outline-none focus:border-indigo-500"
                value={draft.tags.join(', ')}
                onChange={e => patch('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                placeholder="#里程碑, #应用"
              />
            : <div className="flex flex-wrap gap-1">
                {draft.tags.map(tag => (
                  <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-900/40 text-indigo-400">{tag}</span>
                ))}
              </div>
          }
        </div>

        <TextAreaField label="意义/简介" value={draft.significance} editing={editing} onChange={v => patch('significance', v)} />
        <TextAreaField label="详细内容" value={draft.content ?? ''} editing={editing} onChange={v => patch('content', v)} />
      </div>
    </div>
  )
}
