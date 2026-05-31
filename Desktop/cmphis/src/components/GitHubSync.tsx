import { useState, useRef, useEffect } from 'react'
import { Cloud, CloudUpload, CloudDownload, Check, AlertTriangle, Loader2, ExternalLink } from 'lucide-react'
import { useStore } from '../store'
import {
  getToken, setToken, pushToGitHub, pullFromGitHub, getGitHubConfig, nodesSignature,
  getSyncBaseline, setSyncBaseline,
} from '../data/githubSync'

type Status = { kind: 'idle' | 'busy' | 'ok' | 'err' | 'pending'; msg: string }

const AUTO_KEY = 'cmphis_gh_auto'
const AUTO_DELAY = 30_000 // 变更后 30s 自动提交

export default function GitHubSync() {
  const [open, setOpen] = useState(false)
  const [token, setTok] = useState(getToken())
  const [auto, setAuto] = useState<boolean>(() => localStorage.getItem(AUTO_KEY) === 'true')
  const [status, setStatus] = useState<Status>({ kind: 'idle', msg: '' })
  const wrapRef = useRef<HTMLDivElement>(null)

  const setAllNodes = useStore(s => s.setAllNodes)
  const nodes = useStore(s => s.nodes)

  const hasToken = !!token.trim()
  const cfg = getGitHubConfig()

  // 自动同步用的引用（基线签名用模块级共享，loadData/拉取都会更新）
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function saveToken(v: string) { setTok(v); setToken(v) }
  function toggleAuto() {
    setAuto(a => { localStorage.setItem(AUTO_KEY, String(!a)); return !a })
  }

  async function runPush(isAuto: boolean) {
    setStatus({ kind: 'busy', msg: isAuto ? '正在自动提交…' : '正在提交…' })
    const sig = nodesSignature(useStore.getState().nodes)
    const r = await pushToGitHub(useStore.getState().nodes)
    if (r.ok) setSyncBaseline(sig)
    setStatus({ kind: r.ok ? 'ok' : 'err', msg: (isAuto ? '自动同步：' : '') + r.message })
  }

  async function doPull(silent = false) {
    if (!silent && !confirm('从 GitHub 拉取将覆盖当前数据（可撤销）。继续？')) return
    setStatus({ kind: 'busy', msg: '正在拉取…' })
    const r = await pullFromGitHub()
    if (r.ok && r.nodes) {
      setSyncBaseline(nodesSignature(r.nodes)) // 拉取后立即更新基线，避免触发自动回推
      setAllNodes(r.nodes)
      setStatus({ kind: 'ok', msg: `${r.message}（${r.nodes.length} 节点）` })
    } else {
      setStatus({ kind: 'err', msg: r.message })
    }
  }

  // 自动同步：检测到内容变更后防抖 30s 提交
  useEffect(() => {
    if (!auto || !hasToken) { clearTimeout(timerRef.current); return }
    const base = getSyncBaseline()
    if (base === null) return // 数据尚未完成首次加载（基线未建立）
    const sig = nodesSignature(nodes)
    if (sig === base) return  // 内容无变化

    clearTimeout(timerRef.current)
    setStatus({ kind: 'pending', msg: '检测到变更，30s 后自动同步…' })
    timerRef.current = setTimeout(() => { void runPush(true) }, AUTO_DELAY)
    return () => clearTimeout(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, auto, hasToken])

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center rounded-lg transition-colors relative"
        style={{ width: 34, height: 34, background: 'var(--surface-3)', color: 'var(--text-2)' }}
        title="GitHub 同步"
      >
        <Cloud size={16} />
        <span
          className="absolute"
          style={{
            right: 6, bottom: 6, width: 7, height: 7, borderRadius: '50%',
            background: status.kind === 'pending' ? '#f59e0b'
              : hasToken ? (auto ? '#22c55e' : '#64748b') : 'var(--text-faint)',
            border: '1px solid var(--surface-3)',
          }}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-xl p-3 flex flex-col gap-2.5 z-50"
          style={{ width: 308, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>GitHub 同步</span>
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{cfg.owner}/{cfg.repo}</span>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>个人访问令牌 (PAT)</span>
            <input
              type="password"
              value={token}
              onChange={e => saveToken(e.target.value)}
              placeholder="ghp_… 或 github_pat_…"
              className="px-2 py-1.5 rounded-md text-[12px] outline-none"
              style={{ background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
          </label>

          {/* 自动同步开关 */}
          <button
            onClick={toggleAuto}
            disabled={!hasToken}
            className="flex items-center justify-between px-2 py-1.5 rounded-md text-[12px] disabled:opacity-40"
            style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
          >
            <span>自动同步（变更后 30s）</span>
            <span
              className="relative inline-block transition-colors"
              style={{ width: 32, height: 18, borderRadius: 999, background: auto ? 'var(--accent)' : 'var(--text-faint)' }}
            >
              <span
                className="absolute transition-all"
                style={{ top: 2, left: auto ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff' }}
              />
            </span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => runPush(false)}
              disabled={!hasToken || status.kind === 'busy'}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              <CloudUpload size={13} /> 立即同步
            </button>
            <button
              onClick={() => doPull()}
              disabled={status.kind === 'busy'}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] transition-colors disabled:opacity-40"
              style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}
              title="从 GitHub 拉取最新数据"
            >
              <CloudDownload size={13} /> 拉取
            </button>
          </div>

          {status.kind !== 'idle' && (
            <div className="flex items-start gap-1.5 text-[11px]" style={{
              color: status.kind === 'err' ? '#ef4444'
                : status.kind === 'ok' ? '#22c55e'
                : status.kind === 'pending' ? '#f59e0b' : 'var(--text-muted)',
            }}>
              {status.kind === 'busy' && <Loader2 size={12} className="animate-spin mt-0.5 flex-shrink-0" />}
              {status.kind === 'ok' && <Check size={12} className="mt-0.5 flex-shrink-0" />}
              {status.kind === 'err' && <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />}
              {status.kind === 'pending' && <Loader2 size={12} className="animate-spin mt-0.5 flex-shrink-0" />}
              <span className="break-all">{status.msg}</span>
            </div>
          )}

          <a
            href="https://github.com/settings/tokens?type=beta"
            target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-[10px] hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            <ExternalLink size={10} /> 创建细粒度令牌（仅授予本仓库 Contents 读写）
          </a>
          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
            令牌仅保存在本浏览器。开启自动同步后，每次改动停下 30s 会自动提交回仓库；换设备点「拉取」获取最新。
          </p>
        </div>
      )}
    </div>
  )
}
