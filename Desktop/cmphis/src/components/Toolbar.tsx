import { Trash2 } from 'lucide-react'
import { useStore } from '../store'

export default function Toolbar() {
  const { nodes, clearAll } = useStore()

  if (!nodes.length) return null

  return (
    <div className="absolute top-3 right-3 z-10">
      <button
        onClick={() => { if (confirm('清空所有数据？')) clearAll() }}
        className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-red-900/60 text-slate-600 hover:text-red-400 transition-colors border border-slate-700/60 backdrop-blur"
        title="清空数据"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}
