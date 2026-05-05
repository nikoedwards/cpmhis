import { Monitor, Database, BookOpen } from 'lucide-react'

export type ViewId = 'canvas' | 'database' | 'wiki'

const TABS: { id: ViewId; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: 'canvas',   label: '知识图谱', Icon: Monitor  },
  { id: 'database', label: '数据库',   Icon: Database },
  { id: 'wiki',     label: 'Wiki',     Icon: BookOpen },
]

export default function NavBar({ view, setView }: {
  view: ViewId
  setView: (v: ViewId) => void
}) {
  return (
    <div
      className="flex-shrink-0 flex items-center border-b border-slate-800/60 px-4 gap-1 select-none"
      style={{ height: 40, background: '#09090f', zIndex: 50 }}
    >
      <span className="text-[10px] font-bold text-slate-700 tracking-[0.2em] uppercase mr-3">
        CMPHIS
      </span>
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => setView(id)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
            view === id
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
          }`}
        >
          <Icon size={12} />
          {label}
        </button>
      ))}
    </div>
  )
}
