import * as XLSX from 'xlsx'
import type { KnowledgeNode } from '../types'
import { nanoid } from '../utils/nanoid'

// data.xlsx 作为数据库：开发期由 Vite 提供在 /data.xlsx，并通过 /api/save-data 写回。
// 部署到 GitHub Pages（子路径 /cpmhis/）时用 BASE_URL 拼出正确路径。
const DATA_URL = `${import.meta.env.BASE_URL}data.xlsx`
const SAVE_URL = '/api/save-data'

function s(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

// 解析年份：支持 "约前20000"/"公元前300"/"628"/"1620s"/"2023.02" → 数字（公元前为负）
function parseYear(time: string): number {
  if (!time) return 0
  const m = time.match(/\d+/)
  if (!m) return 0
  const n = parseInt(m[0], 10)
  return /前|B\.?C/i.test(time) ? -n : n
}

export function rowsToNodes(rows: Record<string, unknown>[]): KnowledgeNode[] {
  return rows
    .filter((r) => s(r['节点']))
    .map((r) => {
      const time = s(r['时间'])
      return {
        id: nanoid(),
        branches: [
          s(r['一级分支']) || undefined,
          s(r['二级分支']) || undefined,
          s(r['三级分支']) || undefined,
          s(r['四级分支']) || undefined,
          s(r['五级分支']) || undefined,
          s(r['六级分支']) || undefined,
        ] as KnowledgeNode['branches'],
        phase: s(r['阶段']),
        time,
        timeYear: parseYear(time),
        label: s(r['节点']),
        tags: s(r['标签']).split(/[,，、]/).map((t) => t.trim()).filter(Boolean),
        significance: s(r['意义']),
        content: s(r['详细内容']),
      }
    })
}

// 从 data.xlsx 读取全部节点
export async function loadNodesFromXlsx(): Promise<KnowledgeNode[]> {
  const res = await fetch(DATA_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`加载 data.xlsx 失败: ${res.status}`)
  const buf = await res.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
  return rowsToNodes(rows)
}

// 把节点写回 data.xlsx（开发期通过 Vite 中间件）
export async function saveNodesToXlsx(nodes: KnowledgeNode[]): Promise<boolean> {
  try {
    const res = await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nodes),
    })
    return res.ok
  } catch {
    return false
  }
}
