import { useRef, useEffect } from 'react'
import { useStore } from '../store'
import { childLabelsOf } from '../utils/branches'

const NEW = '__new__'
const CLEAR = '__clear__'

// 节点分支字段的下拉选择：选项来自「同级已有分支」，并支持新建 / 清空
export default function BranchSelect({
  parentPath, value, onSelect, onClose, autoFocus = true,
}: {
  parentPath: string[]
  value: string
  onSelect: (v: string) => void
  onClose?: () => void
  autoFocus?: boolean
}) {
  const nodes = useStore(s => s.nodes)
  const branchRegistry = useStore(s => s.branchRegistry)
  const addBranch = useStore(s => s.addBranch)
  const ref = useRef<HTMLSelectElement>(null)

  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])

  const options = childLabelsOf(nodes, branchRegistry, parentPath)
  // 当前值可能还不在选项里（旧数据），补进去
  const allOpts = value && !options.includes(value) ? [value, ...options] : options

  function handleChange(v: string) {
    if (v === NEW) {
      const name = window.prompt('新建分支名称')?.trim()
      if (name) { addBranch(parentPath, name); onSelect(name) }
      else onClose?.()
      return
    }
    if (v === CLEAR) { onSelect(''); return }
    onSelect(v)
  }

  return (
    <select
      ref={ref}
      className="w-full bg-slate-800 border border-indigo-500/60 rounded px-1 py-0.5 text-[12px] text-slate-200 outline-none"
      value={value || ''}
      onChange={e => handleChange(e.target.value)}
      onBlur={() => onClose?.()}
      onKeyDown={e => { if (e.key === 'Escape') onClose?.() }}
    >
      <option value="">（空）</option>
      {allOpts.map(o => <option key={o} value={o}>{o}</option>)}
      <option disabled>──────</option>
      <option value={NEW}>＋ 新建分支…</option>
      {value && <option value={CLEAR}>✕ 清空</option>}
    </select>
  )
}
