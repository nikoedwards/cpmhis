import { useRef, useEffect, useState, useCallback } from 'react'
import { useViewport, useReactFlow } from '@xyflow/react'
import { useStore } from '../store'
import { LAYOUT_CONSTANTS } from '../utils/layout'

const { LEVEL_HEIGHT, LEAF_GAP, BASE_YEAR, PX_PER_YEAR, MAX_YEAR } = LAYOUT_CONSTANTS
const DECADES = [1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030]

export default function Timeline() {
  const viewport   = useViewport()   // re-renders on every viewport change
  const { setViewport } = useReactFlow()
  const nodes      = useStore(s => s.nodes)
  const selectNode = useStore(s => s.selectNode)

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerH, setContainerH] = useState(800)
  const isDragging = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setContainerH(e.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Deepest branch level across all data (for leafAreaStart)
  const maxDepth = nodes.length > 0
    ? nodes.reduce((m, n) => Math.max(m, n.branches.filter(Boolean).length - 1), 0)
    : 3

  // Canvas coordinate system
  const leafAreaStart = (maxDepth + 1) * LEVEL_HEIGHT + LEAF_GAP
  const canvasTotalH  = leafAreaStart + (MAX_YEAR - BASE_YEAR) * PX_PER_YEAR + 200

  // Canvas Y ↔ Timeline Y (0..containerH)
  const c2t = useCallback((cy: number) => (cy / canvasTotalH) * containerH, [canvasTotalH, containerH])
  const t2c = useCallback((ty: number) => (ty / containerH) * canvasTotalH, [canvasTotalH, containerH])

  // Year → canvas Y
  function yearToC(year: number) {
    return leafAreaStart + (year - BASE_YEAR) * PX_PER_YEAR
  }

  // Viewport indicator: which slice of canvas is currently on screen
  // canvas_y_at_screen_top    = (0 - viewport.y) / viewport.zoom
  // canvas_y_at_screen_bottom = (containerH - viewport.y) / viewport.zoom
  const visTop = (-viewport.y) / viewport.zoom
  const visBot = (containerH - viewport.y) / viewport.zoom
  const indTop = Math.max(0, c2t(visTop))
  const indBot = Math.min(containerH, c2t(visBot))
  const indH   = Math.max(6, indBot - indTop)

  // Scroll canvas to align a specific canvas Y to the top of the screen
  const scrollToCanvasY = useCallback((cy: number) => {
    setViewport({ x: viewport.x, y: -cy * viewport.zoom, zoom: viewport.zoom }, { duration: 0 })
  }, [setViewport, viewport.x, viewport.zoom])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.nodedot) return // let node dots handle their own click
    isDragging.current = true
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
    const rect = containerRef.current!.getBoundingClientRect()
    scrollToCanvasY(t2c(e.clientY - rect.top))
  }, [scrollToCanvasY, t2c])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    const rect = containerRef.current!.getBoundingClientRect()
    scrollToCanvasY(t2c(e.clientY - rect.top))
  }, [scrollToCanvasY, t2c])

  const handlePointerUp = useCallback(() => { isDragging.current = false }, [])

  const indicatorVisible = indBot > 0 && indTop < containerH

  return (
    <div
      ref={containerRef}
      className="w-[64px] flex-shrink-0 h-full border-r border-slate-800/60 relative overflow-hidden select-none"
      style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Center guide line */}
      <div className="absolute top-0 bottom-0 pointer-events-none"
        style={{ left: 36, width: 1, background: '#1e2533' }} />

      {/* Viewport indicator — highlights what's currently visible */}
      {indicatorVisible && (
        <div
          className="absolute left-0 right-0 pointer-events-none rounded-sm"
          style={{
            top: indTop,
            height: indH,
            background: 'rgba(99,102,241,0.10)',
            borderTop: '1px solid rgba(99,102,241,0.35)',
            borderBottom: '1px solid rgba(99,102,241,0.35)',
          }}
        />
      )}

      {/* Decade year labels */}
      {DECADES.map(year => {
        const tlY = c2t(yearToC(year))
        if (tlY < -10 || tlY > containerH + 10) return null
        return (
          <div
            key={year}
            className="absolute flex items-center pointer-events-none"
            style={{ top: Math.round(tlY) - 6, left: 0, right: 0 }}
          >
            <span className="text-[9px] text-slate-600 font-mono leading-none pl-1.5 w-8 text-right">
              {year}
            </span>
            <div className="w-2 h-px ml-1" style={{ background: '#2d3748' }} />
          </div>
        )
      })}

      {/* Node dots — one per knowledge node, clickable */}
      {nodes.map(n => {
        const tlY = c2t(yearToC(n.timeYear))
        if (tlY < 0 || tlY > containerH) return null
        return (
          <button
            key={n.id}
            data-nodedot="1"
            className="absolute rounded-full transition-all z-10 hover:scale-125"
            style={{
              top: Math.round(tlY) - 2,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 5,
              height: 5,
              backgroundColor: '#4f46e5',
              opacity: 0.6,
              cursor: 'pointer',
            }}
            title={`${n.label} (${n.time})`}
            onClick={e => {
              e.stopPropagation()
              const cy = yearToC(n.timeYear)
              setViewport(
                { x: viewport.x, y: -cy * viewport.zoom + containerH / 2, zoom: viewport.zoom },
                { duration: 300 },
              )
              selectNode(n.id)
            }}
          />
        )
      })}
    </div>
  )
}
