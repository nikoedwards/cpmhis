import { Trash2, Undo2, Redo2 } from 'lucide-react'
import { useStore } from '../store'

export default function Toolbar() {
  const nodes     = useStore(s => s.nodes)
  const clearAll  = useStore(s => s.clearAll)
  const undo      = useStore(s => s.undo)
  const redo      = useStore(s => s.redo)
  const canUndo   = useStore(s => s.past.length > 0)
  const canRedo   = useStore(s => s.future.length > 0)

  if (!nodes.length) return null

  const btn = 'p-1.5 rounded-lg transition-colors border backdrop-blur'
  const enabled = 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)]'
  const disabled = 'opacity-40 cursor-not-allowed text-[var(--text-muted)]'

  return (
    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5"
      style={{ background: 'color-mix(in srgb, var(--surface) 70%, transparent)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
      <button
        onClick={() => canUndo && undo()}
        disabled={!canUndo}
        className={`${btn} ${canUndo ? enabled : disabled}`}
        style={{ borderColor: 'transparent' }}
        title="撤销 (Ctrl+Z)"
      >
        <Undo2 size={13} />
      </button>
      <button
        onClick={() => canRedo && redo()}
        disabled={!canRedo}
        className={`${btn} ${canRedo ? enabled : disabled}`}
        style={{ borderColor: 'transparent' }}
        title="重做 (Ctrl+Y / Ctrl+Shift+Z)"
      >
        <Redo2 size={13} />
      </button>
      <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
      <button
        onClick={() => { if (confirm('清空所有数据？')) clearAll() }}
        className={`${btn} text-[var(--text-muted)] hover:text-red-400 hover:bg-red-900/30`}
        style={{ borderColor: 'transparent' }}
        title="清空数据"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
