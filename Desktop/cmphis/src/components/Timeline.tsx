import { useRef, useEffect, useState, useCallback } from 'react'
import { useViewport, useReactFlow } from '@xyflow/react'
import { useStore } from '../store'
import { LAYOUT_CONSTANTS } from '../utils/layout'

const { LEVEL_HEIGHT, LEAF_GAP, BASE_YEAR, PX_PER_YEAR, MAX_YEAR } = LAYOUT_CONSTANTS

// Choose a "nice" label step given how many years are visible
function niceLabelStep(visibleYears: number): number {
  if (visibleYears <= 5)   return 1
  if (visibleYears <= 12)  return 2
  if (visibleYears <= 25)  return 3
  if (visibleYears <= 55)  return 5
  if (visibleYears <= 110) return 10
  if (visibleYears <= 220) return 20
  return 50
}

export default function Timeline() {
  const viewport        = useViewport()   // re-renders on every viewport change
  const { setViewport } = useReactFlow()
  const nodes           = useStore(s => s.nodes)
  const selectNode      = useStore(s => s.selectNode)

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerH, setContainerH] = useState(800)
  const drag = useRef<{ startPtrY: number; startVpY: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setContainerH(e.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const maxDepth = nodes.length > 0
    ? nodes.reduce((m, n) => Math.max(m, n.branches.filter(Boolean).length - 1), 0)
    : 3
  const leafAreaStart = (maxDepth + 1) * LEVEL_HEIGHT + LEAF_GAP

  // ── Visible canvas Y range ──
  // screen_y = canvas_y * zoom + viewport.y  →  canvas_y = (screen_y - viewport.y) / zoom
  const visTop = (-viewport.y) / viewport.zoom
  const visBot = (containerH - viewport.y) / viewport.zoom

  // ── Coordinate helpers (viewport-mirror mode) ──
  // canvas Y → timeline Y  (everything in view fills the full timeline height)
  function c2t(cy: number): number {
    if (visBot === visTop) return 0
    return ((cy - visTop) / (visBot - visTop)) * containerH
  }

  // year → canvas Y → timeline Y
  function yearToTL(year: number): number {
    return c2t(leafAreaStart + (year - BASE_YEAR) * PX_PER_YEAR)
  }

  // canvas Y → year
  function canvasToYear(cy: number): number {
    return BASE_YEAR + (cy - leafAreaStart) / PX_PER_YEAR
  }

  // ── Adaptive year labels ──
  const visTopYear = canvasToYear(visTop)
  const visBotYear = canvasToYear(visBot)
  const step = niceLabelStep(Math.max(1, visBotYear - visTopYear))
  const labelStart = Math.ceil(Math.max(BASE_YEAR - 10, visTopYear) / step) * step
  const labelEnd   = Math.min(MAX_YEAR + 5, visBotYear)

  const yearLabels: number[] = []
  for (let y = labelStart; y <= labelEnd; y += step) yearLabels.push(y)

  // ── Drag-to-scroll (panning the canvas) ──
  // Dragging TL down → show later content → canvas viewport.y decreases
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.nodedot) return
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
    drag.current = { startPtrY: e.clientY, startVpY: viewport.y }
  }, [viewport.y])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    const dy = e.clientY - drag.current.startPtrY
    // dy timeline-px → dy canvas-units = dy * (visBot-visTop) / containerH
    const canvasDelta = (dy / containerH) * (visBot - visTop)
    // panning down = viewport.y decreases
    setViewport({
      x: viewport.x,
      y: drag.current.startVpY - canvasDelta * viewport.zoom,
      zoom: viewport.zoom,
    }, { duration: 0 })
  }, [containerH, visBot, visTop, viewport.x, viewport.zoom, setViewport])

  const handlePointerUp = useCallback(() => { drag.current = null }, [])

  return (
    <div
      ref={containerRef}
      className="w-[64px] flex-shrink-0 h-full border-r border-slate-800/60 relative overflow-hidden select-none"
      style={{ cursor: drag.current ? 'grabbing' : 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Center guide */}
      <div className="absolute top-0 bottom-0 pointer-events-none"
        style={{ left: 38, width: 1, background: '#1e2533' }} />

      {/* Year labels — adapt to current zoom */}
      {yearLabels.map(year => {
        const tlY = yearToTL(year)
        if (tlY < -16 || tlY > containerH + 4) return null
        return (
          <div
            key={year}
            className="absolute flex items-center pointer-events-none"
            style={{ top: Math.round(tlY) - 6, left: 0, right: 0 }}
          >
            <span className="text-[9px] text-slate-500 font-mono leading-none pl-1.5 w-9 text-right tabular-nums">
              {year}
            </span>
            <div className="w-2 h-px ml-1" style={{ background: '#2d3748' }} />
          </div>
        )
      })}

      {/* Node dots — only show nodes in visible time range */}
      {nodes.map(n => {
        if (n.timeYear < visTopYear - 2 || n.timeYear > visBotYear + 2) return null
        const tlY = yearToTL(n.timeYear)
        if (tlY < 0 || tlY > containerH) return null
        return (
          <button
            key={n.id}
            data-nodedot="1"
            className="absolute rounded-full z-10 transition-all hover:scale-150"
            style={{
              top: Math.round(tlY) - 3,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 6,
              height: 6,
              backgroundColor: '#4f46e5',
              opacity: 0.7,
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
            title={`${n.label} (${n.time})`}
            onClick={e => {
              e.stopPropagation()
              // Center canvas on this node
              const cy = leafAreaStart + (n.timeYear - BASE_YEAR) * PX_PER_YEAR
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
