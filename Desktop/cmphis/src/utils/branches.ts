import type { KnowledgeNode } from '../types'

export interface BranchTreeNode {
  label: string
  path: string[]      // 完整路径，例如 ['计算机科学','计算机理论','可计算性理论']
  key: string         // path.join('///')
  depth: number       // 0 = 一级
  children: BranchTreeNode[]
  nodeCount: number   // 该分支（含子孙）下的节点总数
}

// 合并「节点派生的分支路径」与「分支注册表」，构建统一分支树
export function buildBranchTree(nodes: KnowledgeNode[], registry: string[] = []): BranchTreeNode[] {
  const root: BranchTreeNode = { label: '', path: [], key: '', depth: -1, children: [], nodeCount: 0 }

  function ensurePath(segs: string[]): BranchTreeNode {
    let cur = root
    for (let i = 0; i < segs.length; i++) {
      const path = segs.slice(0, i + 1)
      const key = path.join('///')
      let child = cur.children.find(c => c.key === key)
      if (!child) {
        child = { label: segs[i], path, key, depth: i, children: [], nodeCount: 0 }
        cur.children.push(child)
      }
      cur = child
    }
    return cur
  }

  // 注册表分支（可能没有节点）
  for (const k of registry) {
    const segs = k.split('///').filter(Boolean)
    if (segs.length) ensurePath(segs)
  }

  // 节点派生分支 + 计数（节点落在其完整分支路径，并为所有祖先 +1）
  for (const n of nodes) {
    const segs = n.branches.filter(Boolean) as string[]
    if (!segs.length) continue
    ensurePath(segs)
    let cur = root
    for (let i = 0; i < segs.length; i++) {
      const key = segs.slice(0, i + 1).join('///')
      cur = cur.children.find(c => c.key === key)!
      cur.nodeCount++
    }
  }

  return root.children
}

// 查找某父路径下的子分支 label 列表（用于节点分支字段的下拉选项）
export function childLabelsOf(nodes: KnowledgeNode[], registry: string[], parentPath: string[]): string[] {
  const parent = parentPath.filter(Boolean)
  const tree = buildBranchTree(nodes, registry)
  let level = tree
  for (const seg of parent) {
    const found = level.find(b => b.label === seg)
    if (!found) return []
    level = found.children
  }
  return level.map(b => b.label)
}
