export interface KnowledgeNode {
  id: string
  branches: [string?, string?, string?, string?, string?, string?] // 一~六级分支
  phase: string       // 阶段
  time: string        // 时间（如 "1950", "1960s"）
  timeYear: number    // 用于排序的数字年份
  label: string       // 节点名称
  tags: string[]      // 标签
  significance: string // 意义/简介
  content?: string    // 详细内容（markdown）
  parentId?: string   // 计算出的父节点 id
}

export interface TreeNodeData {
  node: KnowledgeNode
  collapsed?: boolean
}

export type BranchColor = {
  dot: string
  edge: string
  label: string
}
