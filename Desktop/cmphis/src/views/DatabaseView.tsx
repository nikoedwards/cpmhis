import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import {
  Download, Upload, Trash2, Plus, Search, X,
  ChevronUp, ChevronDown,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useStore } from '../store'
import type { KnowledgeNode } from '../types'
import { nanoid } from '../utils/nanoid'

// ── Column definitions ─────────────────────────────────────────────────────

const COLS = [
  { key: 'branch0',      label: '一级分支', w: 96,  multi: false },
  { key: 'branch1',      label: '二级分支', w: 96,  multi: false },
  { key: 'branch2',      label: '三级分支', w: 96,  multi: false },
  { key: 'branch3',      label: '四级分支', w: 80,  multi: false },
  { key: 'branch4',      label: '五级分支', w: 80,  multi: false },
  { key: 'branch5',      label: '六级分支', w: 80,  multi: false },
  { key: 'phase',        label: '阶段',     w: 80,  multi: false },
  { key: 'time',         label: '时间',     w: 60,  multi: false },
  { key: 'label',        label: '节点',     w: 160, multi: false },
  { key: 'tags',         label: '标签',     w: 130, multi: false },
  { key: 'significance', label: '意义',     w: 200, multi: true  },
  { key: 'content',      label: '详细内容', w: 220, multi: true  },
] as const

type ColKey = typeof COLS[number]['key']

function getCellValue(node: KnowledgeNode, col: ColKey): string {
  if (col.startsWith('branch')) {
    const idx = parseInt(col.slice(6))
    return node.branches[idx as 0|1|2|3|4|5] ?? ''
  }
  if (col === 'tags')    return node.tags.join(', ')
  if (col === 'content') return node.content ?? ''
  return (node as unknown as Record<string, unknown>)[col] as string ?? ''
}

function buildPatch(node: KnowledgeNode, col: ColKey, value: string): Partial<KnowledgeNode> {
  if (col.startsWith('branch')) {
    const idx = parseInt(col.slice(6)) as 0|1|2|3|4|5
    const branches = [...node.branches] as KnowledgeNode['branches']
    branches[idx] = value.trim() || undefined
    return { branches }
  }
  if (col === 'tags')    return { tags: value.split(',').map(t => t.trim()).filter(Boolean) }
  if (col === 'time')    return { time: value.trim(), timeYear: parseInt(value) || 0 }
  if (col === 'content') return { content: value }
  return { [col]: value }
}

// ── Inline cell editor ─────────────────────────────────────────────────────

function CellEditor({ value, multiline, onSave, onCancel }: {
  value: string
  multiline: boolean
  onSave: (v: string) => void
  onCancel: () => void
}) {
  const [val, setVal] = useState(value)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const base = "w-full bg-slate-800 border border-indigo-500/60 rounded px-1.5 py-0.5 text-[12px] text-slate-200 outline-none resize-none"

  if (multiline) {
    return (
      <textarea
        ref={ref as React.RefObject<HTMLTextAreaElement>}
        className={base}
        value={val}
        rows={3}
        onChange={e => setVal(e.target.value)}
        onBlur={() => onSave(val)}
        onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onCancel() } }}
      />
    )
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      className={base}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onKeyDown={e => {
        if (e.key === 'Enter')  { e.preventDefault(); onSave(val) }
        if (e.key === 'Escape') { e.preventDefault(); onCancel() }
      }}
    />
  )
}

// ── Main view ──────────────────────────────────────────────────────────────

export default function DatabaseView() {
  const { nodes, addNode, updateNode, deleteNode, clearAll } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<{ id: string; col: ColKey } | null>(null)
  const [search, setSearch]     = useState('')
  const [sortBy, setSortBy]     = useState<{ col: ColKey; dir: 'asc' | 'desc' } | null>(null)
  const [newRowId, setNewRowId] = useState<string | null>(null)

  // ── Filtering + sorting ──────────────────────────────────────────────────
  const filteredNodes = useMemo(() => {
    let list = [...nodes]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n =>
        n.label.toLowerCase().includes(q) ||
        n.branches.some(b => b?.toLowerCase().includes(q)) ||
        n.tags.some(t => t.toLowerCase().includes(q)) ||
        n.significance.toLowerCase().includes(q) ||
        (n.content ?? '').toLowerCase().includes(q)
      )
    }
    if (sortBy) {
      list.sort((a, b) => {
        const av = getCellValue(a, sortBy.col)
        const bv = getCellValue(b, sortBy.col)
        const cmp = av.localeCompare(bv, 'zh')
        return sortBy.dir === 'asc' ? cmp : -cmp
      })
    }
    return list
  }, [nodes, search, sortBy])

  // ── Auto-focus new row ────────────────────────────────────────────────────
  useEffect(() => {
    if (newRowId) {
      setEditingCell({ id: newRowId, col: 'label' })
      setNewRowId(null)
    }
  }, [newRowId, nodes])

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleAddRow() {
    const id = nanoid()
    addNode({
      id,
      branches: [undefined, undefined, undefined, undefined, undefined, undefined],
      phase: '', time: String(new Date().getFullYear()),
      timeYear: new Date().getFullYear(),
      label: '新节点', tags: [], significance: '', content: '',
    })
    setNewRowId(id)
  }

  const saveCell = useCallback((id: string, col: ColKey, value: string) => {
    const node = useStore.getState().nodes.find(n => n.id === id)
    if (!node) return
    updateNode(id, buildPatch(node, col, value))
    setEditingCell(null)
  }, [updateNode])

  function toggleRow(id: string) {
    setSelectedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedRows(
      selectedRows.size === filteredNodes.length && filteredNodes.length > 0
        ? new Set()
        : new Set(filteredNodes.map(n => n.id))
    )
  }

  function deleteSelected() {
    if (!confirm(`删除选中的 ${selectedRows.size} 条记录？`)) return
    selectedRows.forEach(id => deleteNode(id))
    setSelectedRows(new Set())
  }

  function handleSort(col: ColKey) {
    setSortBy(prev =>
      prev?.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' }
    )
  }

  // ── Import / Export ───────────────────────────────────────────────────────
  function handleExport() {
    const rows = nodes.map(n => ({
      一级分支: n.branches[0] ?? '', 二级分支: n.branches[1] ?? '',
      三级分支: n.branches[2] ?? '', 四级分支: n.branches[3] ?? '',
      五级分支: n.branches[4] ?? '', 六级分支: n.branches[5] ?? '',
      阶段: n.phase, 时间: n.time, 节点: n.label,
      标签: n.tags.join(', '), 意义: n.significance,
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
      const wb = XLSX.read(ev.target?.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)
      const newNodes: KnowledgeNode[] = rows
        .filter(row => row['节点']?.trim())
        .map(row => {
          const timeStr = String(row['时间'] ?? '')
          return {
            id: nanoid(),
            branches: [
              row['一级分支'] || undefined, row['二级分支'] || undefined,
              row['三级分支'] || undefined, row['四级分支'] || undefined,
              row['五级分支'] || undefined, row['六级分支'] || undefined,
            ] as KnowledgeNode['branches'],
            phase: row['阶段'] ?? '', time: timeStr,
            timeYear: parseInt(timeStr) || 0,
            label: row['节点'].trim(),
            tags: (row['标签'] ?? '').split(',').map((t: string) => t.trim()).filter(Boolean),
            significance: row['意义'] ?? '', content: row['详细内容'] ?? '',
          }
        })
      if (!newNodes.length) { alert('未读取到有效数据，请确认列名正确'); return }
      clearAll()
      newNodes.forEach(n => useStore.getState().addNode(n))
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  // ── Common cell styles ────────────────────────────────────────────────────
  const tdBase = "px-1 py-0.5 border-r border-slate-800/50 align-top"
  const btnBase = "flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] transition-colors border"

  return (
    <div className="flex flex-col h-full" style={{ background: '#0c0e14' }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-slate-800/60 bg-slate-950/50 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          <input
            type="text" placeholder="搜索…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-7 pr-6 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-[12px] text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-600/50 w-52"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
              <X size={10} />
            </button>
          )}
        </div>

        <button onClick={handleAddRow}
          className={`${btnBase} bg-indigo-900/40 hover:bg-indigo-800/50 text-indigo-300 border-indigo-700/40`}>
          <Plus size={11} /> 添加行
        </button>

        {selectedRows.size > 0 && (
          <button onClick={deleteSelected}
            className={`${btnBase} bg-red-900/40 hover:bg-red-800/50 text-red-400 border-red-800/40`}>
            <Trash2 size={11} /> 删除 ({selectedRows.size})
          </button>
        )}

        <div className="flex-1" />

        <button onClick={handleExport} disabled={!nodes.length}
          className={`${btnBase} bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700/60 disabled:opacity-30 disabled:cursor-not-allowed`}>
          <Download size={11} /> 导出
        </button>
        <button onClick={() => fileRef.current?.click()}
          className={`${btnBase} bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700/60`}>
          <Upload size={11} /> 导入
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse text-[12px]" style={{ minWidth: 1460 }}>
          <thead className="sticky top-0 z-10" style={{ background: '#111318' }}>
            <tr>
              {/* Checkbox */}
              <th className="w-9 px-2 border-b border-r border-slate-800 text-center">
                <input type="checkbox"
                  checked={selectedRows.size === filteredNodes.length && filteredNodes.length > 0}
                  onChange={toggleAll}
                  className="accent-indigo-500 cursor-pointer"
                />
              </th>
              {/* Row number */}
              <th className="w-8 px-2 border-b border-r border-slate-800 text-slate-600 font-normal text-center">#</th>
              {/* Data columns */}
              {COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-2 py-2 border-b border-r border-slate-800 text-left text-slate-500 font-medium cursor-pointer hover:text-slate-300 select-none whitespace-nowrap"
                  style={{ width: col.w, minWidth: col.w }}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortBy?.col === col.key
                      ? sortBy.dir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                      : <span className="w-2.5" />}
                  </span>
                </th>
              ))}
              {/* Actions */}
              <th className="w-10 border-b border-slate-800" />
            </tr>
          </thead>

          <tbody>
            {filteredNodes.map((node, i) => (
              <tr
                key={node.id}
                className={`border-b border-slate-800/40 ${
                  selectedRows.has(node.id) ? 'bg-indigo-950/25' : 'hover:bg-slate-900/30'
                }`}
              >
                {/* Checkbox */}
                <td className={`${tdBase} text-center w-9`}>
                  <input type="checkbox"
                    checked={selectedRows.has(node.id)}
                    onChange={() => toggleRow(node.id)}
                    className="accent-indigo-500 cursor-pointer"
                  />
                </td>
                {/* Row number */}
                <td className={`${tdBase} text-slate-600 tabular-nums text-right pr-2 w-8`}>{i + 1}</td>

                {/* Data cells */}
                {COLS.map(col => {
                  const value = getCellValue(node, col.key)
                  const isEditing = editingCell?.id === node.id && editingCell?.col === col.key
                  return (
                    <td key={col.key} className={tdBase} style={{ width: col.w, maxWidth: col.w }}>
                      {isEditing ? (
                        <CellEditor
                          value={value}
                          multiline={col.multi}
                          onSave={v => saveCell(node.id, col.key, v)}
                          onCancel={() => setEditingCell(null)}
                        />
                      ) : (
                        <div
                          className="px-1 py-0.5 rounded cursor-text hover:bg-slate-800/50 text-slate-300 leading-snug"
                          style={{
                            maxWidth: col.w - 8,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: col.multi ? 2 : 1,
                            WebkitBoxOrient: 'vertical',
                            minHeight: 22,
                          }}
                          onClick={() => setEditingCell({ id: node.id, col: col.key })}
                          title={value}
                        >
                          {value || <span className="text-slate-700">—</span>}
                        </div>
                      )}
                    </td>
                  )
                })}

                {/* Row delete */}
                <td className={`${tdBase} text-center border-r-0`}>
                  <button
                    onClick={() => { if (confirm(`删除「${node.label}」？`)) deleteNode(node.id) }}
                    className="p-1 rounded text-slate-700 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                  >
                    <Trash2 size={10} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredNodes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-600">
            <span className="text-sm">{search ? '没有匹配的记录' : '暂无数据'}</span>
            {!search && (
              <button onClick={handleAddRow}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                点击添加第一行
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Footer count ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center px-4 py-1.5 border-t border-slate-800/60 text-[11px] text-slate-600 gap-3">
        <span>共 {nodes.length} 条</span>
        {search && <span>· 已过滤 {filteredNodes.length} 条</span>}
        {selectedRows.size > 0 && <span>· 已选 {selectedRows.size} 条</span>}
      </div>
    </div>
  )
}
