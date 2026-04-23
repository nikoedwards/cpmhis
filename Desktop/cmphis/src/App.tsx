import { useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import Canvas from './components/Canvas'
import DetailDrawer from './components/DetailDrawer'
import TreeSidebar from './components/TreeSidebar'
import './index.css'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    return localStorage.getItem('cmphis_sidebar_open') !== 'false'
  })

  function handleToggleSidebar() {
    const next = !sidebarOpen
    setSidebarOpen(next)
    localStorage.setItem('cmphis_sidebar_open', String(next))
  }

  return (
    <ReactFlowProvider>
      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#0f1117' }}>
        <TreeSidebar open={sidebarOpen} onToggleOpen={handleToggleSidebar} />
        <Canvas />
        <DetailDrawer />
      </div>
    </ReactFlowProvider>
  )
}
