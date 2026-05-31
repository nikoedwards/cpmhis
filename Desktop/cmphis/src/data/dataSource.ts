import * as XLSX from 'xlsx'
import type { KnowledgeNode } from '../types'
import { nanoid } from '../utils/nanoid'

// data.xlsx 作为数据库：开发期由 Vite 提供在 /data.xlsx，并通过 /api/save-data 写回。
// 部署到 GitHub Pages（子路径 /cpmhis/）时用 BASE_URL 拼出正确路径。
const DATA_URL = `${import.meta.env.BASE_URL}data.xlsx`
const SAVE_URL = '/api/save-data'

// 随节点一起持久化的"元数据"：分支手动排序、空分支注册表（这些原本只在 localStorage）
export interface SyncMeta {
  branchOrder: Record<string, string[]>
  branchRegistry: string[]
}

const META_SHEET = 'meta'
const COLUMNS = ['一级分支','二级分支','三级分支','四级分支','五级分支','六级分支','阶段','时间','节点','标签','意义','详细内容']

function s(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

function nodesToRows(nodes: KnowledgeNode[]): Record<string, string>[] {
  return nodes.map((n) => ({
    一级分支: n.branches[0] ?? '', 二级分支: n.branches[1] ?? '',
    三级分支: n.branches[2] ?? '', 四级分支: n.branches[3] ?? '',
    五级分支: n.branches[4] ?? '', 六级分支: n.branches[5] ?? '',
    阶段: n.phase, 时间: n.time, 节点: n.label,
    标签: n.tags.join(', '), 意义: n.significance, 详细内容: n.content ?? '',
  }))
}

// 节点 + 元数据 → 工作簿（Sheet1 存节点，meta 表 A1 存 JSON 元数据）
export function buildWorkbook(nodes: KnowledgeNode[], meta?: SyncMeta | null): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(nodesToRows(nodes), { header: COLUMNS })
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  if (meta) {
    const mws = XLSX.utils.aoa_to_sheet([[JSON.stringify(meta)]])
    XLSX.utils.book_append_sheet(wb, mws, META_SHEET)
  }
  return wb
}

// 工作簿 → 节点 + 元数据
export function parseWorkbook(wb: XLSX.WorkBook): { nodes: KnowledgeNode[]; meta: SyncMeta | null } {
  const nodeSheet = wb.SheetNames.find((n) => n !== META_SHEET) ?? wb.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[nodeSheet])
  let meta: SyncMeta | null = null
  const mws = wb.Sheets[META_SHEET]
  if (mws && mws['A1']) {
    try {
      const parsed = JSON.parse(String(mws['A1'].v))
      meta = {
        branchOrder: parsed.branchOrder ?? {},
        branchRegistry: parsed.branchRegistry ?? [],
      }
    } catch {}
  }
  return { nodes: rowsToNodes(rows), meta }
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

// 从 data.xlsx 读取节点 + 元数据
export async function loadAllFromXlsx(): Promise<{ nodes: KnowledgeNode[]; meta: SyncMeta | null }> {
  const res = await fetch(DATA_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`加载 data.xlsx 失败: ${res.status}`)
  const buf = await res.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  return parseWorkbook(wb)
}

// 把节点 + 元数据写回 data.xlsx（开发期通过 Vite 中间件）
export async function saveNodesToXlsx(nodes: KnowledgeNode[], meta?: SyncMeta | null): Promise<boolean> {
  try {
    const res = await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes, meta: meta ?? null }),
    })
    return res.ok
  } catch {
    return false
  }
}
