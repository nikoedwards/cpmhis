import { useState, useEffect, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Edit2, Trash2, Check, X } from 'lucide-react'
import { useStore } from '../store'
import type { HistoryEvent } from '../types'

interface HistoryEventNodeData {
  event: HistoryEvent
  color: string
}

type Draft = { label: string; time: string; significance: string }

export default function HistoryEventNode({ data }: { data: HistoryEventNodeData }) {
  const { event, color } = data
  const selectedHistoryId = useStore(s => s.selectedHistoryId)
  const isSelected = selectedHistoryId === event.id
  const [hovered, setHovered] = useState(false)
  const [draft, setDraft]   = useState<Draft | null>(null)
  // Delay timer so mouse can travel from node → toolbar without gap-flicker
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const enterHover  = () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); setHovered(true) }
  const leaveHover  = () => { leaveTimer.current = setTimeout(() => setHovered(false), 120) }

  // Close edit form when this event is deselected from outside
  useEffect(() => { if (!isSelected) setDraft(null) }, [isSelected])

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setDraft({ label: event.label, time: event.time, significance: event.significance })
  }

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation()
    if (!draft) return
    const timeYear = parseInt(draft.time) || event.timeYear
    useStore.getState().updateHistoryEvent(event.id, {
      label: draft.label, time: draft.time.trim(), timeYear, significance: draft.significance,
    })
    setDraft(null)
  }

  function handleCancel(e: React.MouseEvent) { e.stopPropagation(); setDraft(null) }

  const inputCls = "w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[12px] text-slate-200 outline-none focus:border-indigo-500/60"

  if (draft !== null) {
    return (
      <div
        className="bg-slate-900 border border-slate-700 rounded p-2 flex flex-col gap-1.5"
        style={{ minWidth: 200, zIndex: 200 }}
        onClick={e => e.stopPropagation()}
      >
        <Handle type="target" position={Position.Top}    id="top"    style={{ opacity: 0, width: 1, height: 1 }} />
        <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0, width: 1, height: 1 }} />
        <input
          className={inputCls}
          value={draft.label}
          onChange={e => setDraft(d => d && ({ ...d, label: e.target.value }))}
          placeholder="事件名称"
          autoFocus
          onKeyDown={e => { if (e.key === 'Escape') handleCancel(e as any) }}
        />
        <input
          className={inputCls}
          value={draft.time}
          onChange={e => setDraft(d => d && ({ ...d, time: e.target.value }))}
          placeholder="年份"
          onKeyDown={e => { if (e.key === 'Escape') handleCancel(e as any) }}
        />
        <textarea
          className={`${inputCls} resize-none`}
          value={draft.significance}
          onChange={e => setDraft(d => d && ({ ...d, significance: e.target.value }))}
          placeholder="简介"
          rows={2}
        />
        <div className="flex gap-1 justify-end">
          <button
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-700/50 text-indigo-300 text-[10px] hover:bg-indigo-700/80"
            onClick={handleSave}
          >
            <Check size={10} /> 保存
          </button>
          <button
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 text-[10px] hover:bg-slate-700"
            onClick={handleCancel}
          >
            <X size={10} /> 取消
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative flex items-center gap-2 group"
      onMouseEnter={enterHover}
      onMouseLeave={leaveHover}
      style={{ background: 'rgba(9,9,15,0.88)', borderRadius: 4, padding: '2px 6px 2px 0' }}
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

      {/* Label + time */}
      <div className="flex flex-col leading-none gap-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: isSelected ? '#f1f5f9' : '#cbd5e1' }}>
            {event.label}
          </span>
          <span className="text-[10px] text-slate-500 whitespace-nowrap">{event.time}</span>
        </div>
        {event.significance && (
          <span
            className="text-[9px] text-slate-600 whitespace-nowrap"
            style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {event.significance}
          </span>
        )}
      </div>

      {/* Hover toolbar — uses same enter/leave to prevent gap-flicker */}
      {hovered && (
        <div
          className="absolute flex items-center gap-0.5 bg-slate-900 border border-slate-700 rounded px-0.5"
          style={{ right: -56, top: '50%', transform: 'translateY(-50%)', zIndex: 50 }}
          onMouseEnter={enterHover}
          onMouseLeave={leaveHover}
        >
          <button
            className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors"
            title="编辑"
            onClick={startEdit}
          >
            <Edit2 size={10} />
          </button>
          <button
            className="p-1 rounded hover:bg-red-900/60 text-slate-500 hover:text-red-400 transition-colors"
            title="删除"
            onClick={e => {
              e.stopPropagation()
              if (confirm(`删除「${event.label}」？`)) useStore.getState().deleteHistoryEvent(event.id)
            }}
          >
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  )
}
