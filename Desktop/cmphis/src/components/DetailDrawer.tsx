import { useState, useEffect } from 'react'
import { X, Edit2, Trash2, Check, ChevronRight } from 'lucide-react'
import { useStore } from '../store'
import type { KnowledgeNode } from '../types'

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

export default function DetailDrawer() {
  const { nodes, selectedId, selectNode, updateNode, deleteNode } = useStore()
  const node = nodes.find(n => n.id === selectedId) ?? null

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<KnowledgeNode | null>(null)

  useEffect(() => {
    setEditing(false)
    setDraft(node ? { ...node } : null)
  }, [selectedId])

  if (!node || !draft) return null

  function patch<K extends keyof KnowledgeNode>(key: K, value: KnowledgeNode[K]) {
    setDraft(d => d ? { ...d, [key]: value } : d)
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
    <div className="w-[320px] flex-shrink-0 h-full border-l border-slate-800 bg-[#13161f] flex flex-col overflow-hidden">
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
                ? <input
                    className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                    value={draft.branches[i] ?? ''}
                    onChange={e => {
                      const b = [...draft.branches] as KnowledgeNode['branches']
                      b[i] = e.target.value || undefined
                      patch('branches', b)
                    }}
                  />
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
