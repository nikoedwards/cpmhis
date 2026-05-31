import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useViewport, useReactFlow } from '@xyflow/react'
import { useStore } from '../store'
import { LAYOUT_CONSTANTS, buildTimeScale } from '../utils/layout'

const { LEVEL_HEIGHT, LEAF_GAP } = LAYOUT_CONSTANTS

function fmtYear(y: number): string {
  return y < 0 ? `前${-y}` : String(y)
}

// ── 自适应刻度：依据当前可视时间跨度，在 年/月/日 之间自动切换粒度 ──
const NICE_YEAR_STEPS = [1, 2, 3, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 25000]
const DAY_MS = 86400000

function fracYearToDate(fy: number): Date {
  const y = Math.floor(fy)
  return new Date(new Date(y, 0, 1).getTime() + (fy - y) * 365 * DAY_MS)
}
function dateToFracYear(d: Date): number {
  const y = d.getFullYear()
  return y + (d.getTime() - new Date(y, 0, 1).getTime()) / (365 * DAY_MS)
}

interface TimeTick { tlY: number; label: string; minor: boolean }

// top/bot：可视范围（年，可能为负=公元前）；H：标尺像素高；yearToTL：年→标尺Y
function buildTimeTicks(top: number, bot: number, H: number, yearToTL: (y: number) => number): TimeTick[] {
  const span = Math.max(1e-6, bot - top)
  const pxPerYear = H / span
  const minStep = 34 / pxPerYear           // 标签间至少 ~34px，反推所需的最小“年”步长
  const within = (tlY: number) => tlY >= -18 && tlY <= H + 18
  const out: TimeTick[] = []

  if (minStep >= 1) {
    // 年粒度
    const step = NICE_YEAR_STEPS.find(s => s >= minStep) ?? 25000
    const start = Math.ceil(top / step) * step
    for (let y = start; y <= bot; y += step) {
      const tlY = yearToTL(y)
      if (within(tlY)) out.push({ tlY, label: fmtYear(y), minor: false })
    }
  } else if (minStep >= 1 / 12) {
    // 月粒度（1/2/3/6 个月）
    const sm = [1, 2, 3, 6].find(s => s >= minStep * 12) ?? 6
    const startMi = Math.ceil(Math.floor(top * 12) / sm) * sm
    const endMi = Math.ceil(bot * 12)
    for (let mi = startMi; mi <= endMi; mi += sm) {
      const y = Math.floor(mi / 12)
      const m0 = ((mi % 12) + 12) % 12
      const tlY = yearToTL(y + m0 / 12)
      if (within(tlY)) out.push({ tlY, label: m0 === 0 ? fmtYear(y) : `${m0 + 1}月`, minor: m0 !== 0 })
    }
  } else {
    // 日粒度（1/2/5/10/15 天）
    const sd = [1, 2, 5, 10, 15].find(s => s >= minStep * 365) ?? 15
    let d = fracYearToDate(top)
    d.setHours(0, 0, 0, 0)
    for (let guard = 0; guard < 4000 && dateToFracYear(d) <= bot; guard++) {
      const tlY = yearToTL(dateToFracYear(d))
      const day = d.getDate()
      const mon = d.getMonth() + 1
      if (within(tlY)) out.push({ tlY, label: day === 1 ? `${mon}月` : `${mon}/${day}`, minor: day !== 1 })
      d = new Date(d.getTime() + sd * DAY_MS)
      d.setHours(0, 0, 0, 0)
    }
  }

  // 像素去重，避免重叠
  out.sort((a, b) => a.tlY - b.tlY)
  return out.filter((o, i, arr) => i === 0 || o.tlY - arr[i - 1].tlY >= 13)
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

  // 与画布共用的密度自适应时间标尺（同一份 nodes → 同一标尺，刻度与节点对齐）
  const scale = useMemo(() => buildTimeScale(nodes), [nodes])

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

  // year → canvas Y → timeline Y（密度自适应映射）
  function yearToTL(year: number): number {
    return c2t(leafAreaStart + scale.yearToOffset(year))
  }

  // canvas Y → year（密度自适应反映射）
  function canvasToYear(cy: number): number {
    return scale.offsetToYear(cy - leafAreaStart)
  }

  // ── 自适应刻度：可视跨度小→自动细分到月/日 ──
  const visTopYear = canvasToYear(visTop)
  const visBotYear = canvasToYear(visBot)
  const ticks = buildTimeTicks(visTopYear, visBotYear, containerH, yearToTL)

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
      style={{ cursor: drag.current ? 'grabbing' : 'grab', background: 'var(--surface-2)' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Center guide */}
      <div className="absolute top-0 bottom-0 pointer-events-none"
        style={{ left: 38, width: 1, background: 'var(--border)' }} />

      {/* 刻度标签 — 年/月/日 自适应，主刻度更醒目 */}
      {ticks.map(({ tlY, label, minor }, i) => (
        <div
          key={`${i}-${label}`}
          className="absolute flex items-center pointer-events-none z-20"
          style={{ top: Math.round(tlY) - 6, left: 0, right: 0 }}
        >
          <span
            className="font-mono leading-none pl-1.5 w-9 text-right tabular-nums"
            style={{ fontSize: minor ? 8 : 9, color: minor ? 'var(--text-muted)' : 'var(--text-2)', opacity: minor ? 0.7 : 1 }}
          >
            {label}
          </span>
          <div className="ml-1 h-px" style={{ width: minor ? 5 : 8, background: 'var(--edge)' }} />
        </div>
      ))}

      {/* Today marker line */}
      {(() => {
        const d = new Date()
        const todayFrac = d.getFullYear() + d.getMonth() / 12 + (d.getDate() - 1) / 365
        const tlY = yearToTL(todayFrac)
        if (tlY < -4 || tlY > containerH + 4) return null
        return (
          <div
            key="today"
            className="absolute left-0 right-0 pointer-events-none z-30"
            style={{ top: Math.round(tlY), borderTop: '1px dashed color-mix(in srgb, var(--today) 60%, transparent)' }}
          >
            <span style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              top: -13,
              fontSize: 8,
              color: 'var(--today)',
              background: 'var(--surface-2)',
              padding: '1px 3px',
              borderRadius: 3,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
            }}>今</span>
          </div>
        )
      })()}

      {/* Node dots — 仅时间带内的学科节点（史前主脊节点不在标尺上） */}
      {nodes.map(n => {
        if (n.branches.filter(Boolean).length <= 1) return null
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
              left: 38,
              transform: 'translateX(-50%)',
              width: 6,
              height: 6,
              backgroundColor: 'var(--accent)',
              opacity: 0.7,
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
            title={`${n.label} (${n.time})`}
            onClick={e => {
              e.stopPropagation()
              // Center canvas on this node
              const cy = leafAreaStart + scale.yearToOffset(n.timeYear)
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
