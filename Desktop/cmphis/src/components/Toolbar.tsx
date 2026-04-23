import { useRef } from 'react'
import { Download, Upload, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useStore } from '../store'
import type { KnowledgeNode } from '../types'
import { nanoid } from '../utils/nanoid'

export default function Toolbar() {
  const { nodes, clearAll } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    const rows = nodes.map(n => ({
      一级分支: n.branches[0] ?? '',
      二级分支: n.branches[1] ?? '',
      三级分支: n.branches[2] ?? '',
      四级分支: n.branches[3] ?? '',
      五级分支: n.branches[4] ?? '',
      六级分支: n.branches[5] ?? '',
      阶段: n.phase,
      时间: n.time,
      节点: n.label,
      标签: n.tags.join(', '),
      意义: n.significance,
      详细内容: n.content ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '知识树')
    XLSX.writeFile(wb, 'cmphis_知识树.xlsx')
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result
      const wb = XLSX.read(data, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)
      const newNodes: KnowledgeNode[] = rows
        .filter(row => row['节点']?.trim())
        .map(row => {
          const timeStr = String(row['时间'] ?? '')
          const year = parseInt(timeStr) || 0
          return {
            id: nanoid(),
            branches: [
              row['一级分支'] || undefined,
              row['二级分支'] || undefined,
              row['三级分支'] || undefined,
              row['四级分支'] || undefined,
              row['五级分支'] || undefined,
              row['六级分支'] || undefined,
            ] as KnowledgeNode['branches'],
            phase: row['阶段'] ?? '',
            time: timeStr,
            timeYear: year,
            label: row['节点'].trim(),
            tags: (row['标签'] ?? '').split(',').map((t: string) => t.trim()).filter(Boolean),
            significance: row['意义'] ?? '',
            content: row['详细内容'] ?? '',
          }
        })
      if (!newNodes.length) { alert('未读取到有效数据，请确认列名正确'); return }
      clearAll()
      newNodes.forEach(n => useStore.getState().addNode(n))
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  return (
    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
      <button
        onClick={handleExport}
        disabled={!nodes.length}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] transition-colors border border-slate-700/60 backdrop-blur disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Download size={11} /> 导出
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] transition-colors border border-slate-700/60 backdrop-blur"
      >
        <Upload size={11} /> 导入
      </button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
      {nodes.length > 0 && (
        <button
          onClick={() => { if (confirm('清空所有数据？')) clearAll() }}
          className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-red-900/60 text-slate-600 hover:text-red-400 transition-colors border border-slate-700/60 backdrop-blur"
          title="清空数据"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  )
}
