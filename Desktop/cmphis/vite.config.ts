import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import * as XLSX from 'xlsx'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// data.xlsx 作为项目的数据库存储位置（随 git 一起提交）
const DATA_FILE = resolve(__dirname, 'public/data.xlsx')

const COLUMNS = [
  '一级分支', '二级分支', '三级分支', '四级分支', '五级分支', '六级分支',
  '阶段', '时间', '节点', '标签', '意义', '详细内容',
]

interface NodeLike {
  branches?: (string | undefined)[]
  phase?: string
  time?: string
  label?: string
  tags?: string[]
  significance?: string
  content?: string
}

// 开发期：POST /api/save-data 时把节点数据写回 public/data.xlsx
function xlsxStoragePlugin(): Plugin {
  return {
    name: 'xlsx-storage',
    configureServer(server) {
      server.middlewares.use('/api/save-data', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const nodes: NodeLike[] = JSON.parse(body || '[]')
            const rows = nodes.map((n) => ({
              一级分支: n.branches?.[0] ?? '',
              二级分支: n.branches?.[1] ?? '',
              三级分支: n.branches?.[2] ?? '',
              四级分支: n.branches?.[3] ?? '',
              五级分支: n.branches?.[4] ?? '',
              六级分支: n.branches?.[5] ?? '',
              阶段: n.phase ?? '',
              时间: n.time ?? '',
              节点: n.label ?? '',
              标签: (n.tags ?? []).join(', '),
              意义: n.significance ?? '',
              详细内容: n.content ?? '',
            }))
            const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS })
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
            writeFileSync(DATA_FILE, buf)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, count: rows.length }))
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), xlsxStoragePlugin()],
})
