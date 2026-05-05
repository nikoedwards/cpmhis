import { useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import Canvas from './components/Canvas'
import DetailDrawer from './components/DetailDrawer'
import TreeSidebar from './components/TreeSidebar'
import NavBar, { type ViewId } from './components/NavBar'
import DatabaseView from './views/DatabaseView'
import WikiView from './views/WikiView'
import './index.css'

export default function App() {
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
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100vh', width: '100vw',
        overflow: 'hidden', background: '#0f1117',
      }}>
        <NavBar view={view} setView={handleSetView} />

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {view === 'canvas' && (
            <>
              <TreeSidebar open={sidebarOpen} onToggleOpen={handleToggleSidebar} />
              <Canvas />
              <DetailDrawer />
            </>
          )}
          {view === 'database' && <DatabaseView />}
          {view === 'wiki'     && <WikiView />}
        </div>
      </div>
    </ReactFlowProvider>
  )
}
