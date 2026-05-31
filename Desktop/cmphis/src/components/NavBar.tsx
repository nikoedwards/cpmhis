import { Network, Database, BookOpen, Sun, Moon } from 'lucide-react'
import type { Theme } from '../theme'
import GitHubSync from './GitHubSync'

export type ViewId = 'canvas' | 'database' | 'wiki'

const TABS: { id: ViewId; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: 'canvas',   label: '知识图谱', Icon: Network  },
  { id: 'database', label: '数据库',   Icon: Database },
  { id: 'wiki',     label: 'Wiki',     Icon: BookOpen },
]

export default function NavBar({ view, setView, theme, onToggleTheme }: {
  view: ViewId
  setView: (v: ViewId) => void
  theme: Theme
  onToggleTheme: () => void
}) {
  return (
    <div
      className="theme-anim flex-shrink-0 flex items-center px-3 gap-2 select-none"
      style={{
        height: 48,
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--border)',
        zIndex: 50,
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 mr-2 pl-1">
        <div
          className="flex items-center justify-center rounded-lg"
          style={{ width: 26, height: 26, background: 'var(--accent)', boxShadow: 'var(--shadow-sm)' }}
        >
          <Network size={15} color="#fff" />
        </div>
        <span className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
          计算简史
        </span>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-0.5 p-0.5 rounded-xl"
        style={{ background: 'var(--surface-3)' }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = view === id
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12.5px] font-medium transition-all"
              style={active ? {
                background: 'var(--surface)',
                color: 'var(--accent)',
                boxShadow: 'var(--shadow-sm)',
              } : {
                background: 'transparent',
                color: 'var(--text-muted)',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          )
        })}
      </div>

      <div className="flex-1" />

      {/* GitHub 同步 */}
      <GitHubSync />

      {/* Theme toggle */}
      <button
        onClick={onToggleTheme}
        className="flex items-center justify-center rounded-lg transition-colors"
        style={{
          width: 34, height: 34,
          background: 'var(--surface-3)',
          color: 'var(--text-2)',
        }}
        title={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  )
}
