import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Plus } from 'lucide-react'
import { useStore } from '../store'
import { nanoid } from '../utils/nanoid'
import type { HistoryEvent } from '../types'

interface HistoryTrackData {
  track: string
  label: string
  color: string
}

export default function HistoryTrackNode({ data }: { data: HistoryTrackData }) {
  const [hovered, setHovered] = useState(false)

  function handleAddEvent(e: React.MouseEvent) {
    e.stopPropagation()
    const year = 1900
    const newEvent: HistoryEvent = {
      id: nanoid(),
      timeYear: year,
      time: String(year),
      track: data.track as 'theory' | 'engineering',
      label: '新事件',
      significance: '',
      content: '',
      tags: [],
    }
    useStore.getState().addHistoryEvent(newEvent)
    useStore.getState().selectHistoryEvent(newEvent.id)
  }

  return (
    <div
      className="flex items-center gap-1.5 select-none cursor-default px-2 py-1 relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Top}    id="top"    style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0, width: 1, height: 1 }} />

      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{
          backgroundColor: data.color,
          outline: `2px solid ${data.color}40`,
          outlineOffset: 2,
        }}
      />
      <span className="text-xs font-bold whitespace-nowrap" style={{ color: data.color }}>
        {data.label}
      </span>

      {hovered && (
        <button
          className="absolute flex items-center justify-center rounded-full transition-all hover:scale-110"
          style={{
            bottom: -22,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 18, height: 18,
            backgroundColor: `${data.color}22`,
            border: `1.5px solid ${data.color}88`,
            color: data.color,
            zIndex: 50,
          }}
          onClick={handleAddEvent}
          title={`在「${data.label}」添加事件`}
        >
          <Plus size={10} />
        </button>
      )}
    </div>
  )
}
