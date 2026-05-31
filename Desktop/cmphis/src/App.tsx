import { useState, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import Canvas from './components/Canvas'
import DetailDrawer from './components/DetailDrawer'
import TreeSidebar from './components/TreeSidebar'
import NavBar, { type ViewId } from './components/NavBar'
import DatabaseView from './views/DatabaseView'
import WikiView from './views/WikiView'
import { useStore } from './store'
import { getInitialTheme, setTheme as persistTheme, type Theme } from './theme'
import './index.css'

export default function App() {
  const loadData = useStore(s => s.loadData)
  const dataLoaded = useStore(s => s.dataLoaded)
  const undo = useStore(s => s.undo)
  const redo = useStore(s => s.redo)

  // 启动时从 data.xlsx 加载数据库
  useEffect(() => { void loadData() }, [loadData])

  // 全局撤销 / 重做快捷键
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      // 在输入框内编辑时不拦截（交给原生撤销）
      const t = e.target as HTMLElement | null
      const editing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (editing) return
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme())
  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    persistTheme(next)
  }

  const [view, setView] = useState<ViewId>(() => {
    return (localStorage.getItem('cmphis_view') as ViewId) || 'canvas'
  })

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    return localStorage.getItem('cmphis_sidebar_open') !== 'false'
  })

  function handleSetView(v: ViewId) {
    setView(v)
    localStorage.setItem('cmphis_view', v)
  }

  function handleToggleSidebar() {
    const next = !sidebarOpen
    setSidebarOpen(next)
    localStorage.setItem('cmphis_sidebar_open', String(next))
  }

  return (
    <ReactFlowProvider>
      <div className="theme-anim" style={{
        display: 'flex', flexDirection: 'column',
        height: '100vh', width: '100vw',
        overflow: 'hidden', background: 'var(--bg)',
      }}>
        <NavBar view={view} setView={handleSetView} theme={theme} onToggleTheme={toggleTheme} />

        {!dataLoaded && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--bg) 75%, transparent)', color: 'var(--text-muted)', fontSize: 13,
          }}>
            正在从 data.xlsx 加载数据…
          </div>
        )}

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {view === 'canvas' && (
            <>
              <TreeSidebar open={sidebarOpen} onToggleOpen={handleToggleSidebar} />
              <Canvas />
              <DetailDrawer onViewWiki={() => handleSetView('wiki')} />
            </>
          )}
          {view === 'database' && <DatabaseView />}
          {view === 'wiki'     && <WikiView />}
        </div>
      </div>
    </ReactFlowProvider>
  )
}
