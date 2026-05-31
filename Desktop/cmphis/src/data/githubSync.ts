import * as XLSX from 'xlsx'
import type { KnowledgeNode } from '../types'
import { rowsToNodes } from './dataSource'

// 方案 A：前端用个人访问令牌（PAT）直接把 data.xlsx 提交回 GitHub 仓库（Contents API）。
// 令牌仅存在浏览器 localStorage，建议用「细粒度 PAT」只授予本仓库的 Contents 读写权限。

const TOKEN_KEY = 'cmphis_gh_token'
const CFG_KEY   = 'cmphis_gh_cfg'

export interface GitHubConfig {
  owner: string
  repo: string
  branch: string
  path: string
}

const DEFAULT_CFG: GitHubConfig = {
  owner: 'nikoedwards',
  repo: 'cpmhis',
  branch: 'master',
  path: 'Desktop/cmphis/public/data.xlsx',
}

export function getGitHubConfig(): GitHubConfig {
  try {
    const raw = localStorage.getItem(CFG_KEY)
    if (raw) return { ...DEFAULT_CFG, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_CFG
}
export function setGitHubConfig(cfg: Partial<GitHubConfig>) {
  const next = { ...getGitHubConfig(), ...cfg }
  localStorage.setItem(CFG_KEY, JSON.stringify(next))
}
export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}
export function setToken(t: string) {
  if (t) localStorage.setItem(TOKEN_KEY, t.trim())
  else localStorage.removeItem(TOKEN_KEY)
}

const COLUMNS = ['一级分支','二级分支','三级分支','四级分支','五级分支','六级分支','阶段','时间','节点','标签','意义','详细内容']

// 节点 → xlsx 的 base64（列格式与本地 data.xlsx 保持一致）
function nodesToBase64(nodes: KnowledgeNode[]): string {
  const rows = nodes.map(n => ({
    一级分支: n.branches[0] ?? '', 二级分支: n.branches[1] ?? '',
    三级分支: n.branches[2] ?? '', 四级分支: n.branches[3] ?? '',
    五级分支: n.branches[4] ?? '', 六级分支: n.branches[5] ?? '',
    阶段: n.phase, 时间: n.time, 节点: n.label,
    标签: n.tags.join(', '), 意义: n.significance, 详细内容: n.content ?? '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
}

// 数据内容签名（忽略随机 id，仅看会写入 xlsx 的字段）——用于检测"是否真的有变更"
export function nodesSignature(nodes: KnowledgeNode[]): string {
  return JSON.stringify(nodes.map(n => [
    n.branches, n.phase, n.time, n.label, n.tags, n.significance, n.content ?? '',
  ]))
}

// 同步基线：当前"已知/已同步"的内容签名。loadData / push / pull 后更新，
// 自动同步据此判断是否真的有用户改动（避免加载/拉取后误触发回推）。
let _baseline: string | null = null
export function getSyncBaseline(): string | null { return _baseline }
export function setSyncBaseline(sig: string | null): void { _baseline = sig }

export function isAutoSyncOn(): boolean {
  return localStorage.getItem('cmphis_gh_auto') === 'true'
}

function apiUrl(cfg: GitHubConfig): string {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`
}

async function getRemoteSha(cfg: GitHubConfig, token: string): Promise<string | undefined> {
  const res = await fetch(`${apiUrl(cfg)}?ref=${encodeURIComponent(cfg.branch)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (res.status === 404) return undefined
  if (!res.ok) throw new Error(`读取远端失败 (${res.status})`)
  const json = await res.json()
  return json.sha as string
}

// 提交当前节点到 GitHub
export async function pushToGitHub(nodes: KnowledgeNode[]): Promise<{ ok: boolean; message: string }> {
  const token = getToken()
  if (!token) return { ok: false, message: '未配置访问令牌' }
  const cfg = getGitHubConfig()
  try {
    const sha = await getRemoteSha(cfg, token)
    const res = await fetch(apiUrl(cfg), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `chore: update data.xlsx (${nodes.length} 节点) via web`,
        content: nodesToBase64(nodes),
        branch: cfg.branch,
        ...(sha ? { sha } : {}),
      }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      if (res.status === 401) return { ok: false, message: '令牌无效或已过期 (401)' }
      if (res.status === 403) return { ok: false, message: '权限不足或触发限流 (403)' }
      return { ok: false, message: `提交失败 (${res.status}) ${t.slice(0, 100)}` }
    }
    return { ok: true, message: '已同步到 GitHub' }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}

// 从 GitHub 拉取最新 data.xlsx（公共仓库无需令牌；有令牌则用以提高限额并支持私有仓库）
export async function pullFromGitHub(): Promise<{ ok: boolean; message: string; nodes?: KnowledgeNode[] }> {
  const token = getToken()
  const cfg = getGitHubConfig()
  try {
    const res = await fetch(`${apiUrl(cfg)}?ref=${encodeURIComponent(cfg.branch)}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (!res.ok) return { ok: false, message: `拉取失败 (${res.status})` }
    const json = await res.json()
    const b64 = String(json.content || '').replace(/\n/g, '')
    if (!b64) return { ok: false, message: '远端文件为空' }
    const wb = XLSX.read(b64, { type: 'base64' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
    return { ok: true, message: '已从 GitHub 拉取', nodes: rowsToNodes(rows) }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}
