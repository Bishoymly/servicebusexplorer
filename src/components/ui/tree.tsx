"use client"

import * as React from "react"
import { ChevronRight, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
  data?: any
  icon?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  refreshAction?: React.ReactNode
  onBadgeClick?: (node: TreeNode, badgeType: string) => void
  isLoading?: boolean
}

interface TreeProps {
  nodes: TreeNode[]
  expanded?: Set<string>
  onToggle?: (id: string) => void
  onSelect?: (node: TreeNode) => void
  onBadgeClick?: (node: TreeNode, badgeType: string) => void
  selectedId?: string
  className?: string
  searchTerm?: string
}

function matchesSearch(node: TreeNode, searchTerm: string): boolean {
  if (!searchTerm) return true
  const term = searchTerm.toLowerCase()
  if (node.label.toLowerCase().includes(term)) return true
  if (node.children?.some(child => matchesSearch(child, searchTerm))) return true
  return false
}

function filterTree(nodes: TreeNode[], searchTerm: string): TreeNode[] {
  if (!searchTerm) return nodes
  
  const filtered: TreeNode[] = []
  for (const node of nodes) {
    const matches = matchesSearch(node, searchTerm)
    if (!matches) continue
    
    const filteredChildren = node.children ? filterTree(node.children, searchTerm) : undefined
    filtered.push({
      ...node,
      children: filteredChildren && filteredChildren.length > 0 ? filteredChildren : undefined,
    })
  }
  return filtered
}

const TreeNodeComponent: React.FC<{
  node: TreeNode
  level: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect?: (node: TreeNode) => void
  selectedId?: string
  onBadgeClick?: (node: TreeNode, badgeType: string) => void
}> = ({ node, level, expanded, onToggle, onSelect, selectedId, onBadgeClick }) => {
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expanded.has(node.id)
  const isSelected = selectedId === node.id

  const isParent = level === 0 || (level === 1 && hasChildren)
  
  // Calculate sticky positioning
  // Level 0 (connections) stick at top-0
  // Level 1 (queues/topics headers) stick below connections
  const stickyStyle: React.CSSProperties = { paddingLeft: `${level * 16 + 8}px` }
  if (isParent) {
    if (level === 0) {
      stickyStyle.top = 0
      stickyStyle.zIndex = 20
    } else if (level === 1) {
      // Level 1 headers stick below the connection node (approximately 32px height)
      stickyStyle.top = 32
      stickyStyle.zIndex = 10
    }
  }
  
  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 px-2 py-1 text-sm hover:bg-accent cursor-pointer select-none",
          isSelected && "bg-accent",
          isParent ? "sticky bg-card border-b shadow-sm -mx-2 px-2" : "rounded"
        )}
        style={stickyStyle}
        onClick={(e) => {
          // Don't toggle/select if clicking on action buttons
          const target = e.target as HTMLElement
          if (target.closest('button') || target.closest('[role="button"]')) {
            return
          }
          if (hasChildren) {
            onToggle(node.id)
          }
          onSelect?.(node)
        }}
      >
        {hasChildren ? (
          <button
            className="p-0.5 hover:bg-accent rounded"
            onClick={(e) => {
              e.stopPropagation()
              onToggle(node.id)
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        {node.icon && <span className="mr-1">{node.icon}</span>}
        <span className="flex-1 truncate">{node.label}</span>
        <span className="ml-auto flex items-center gap-1">
          {node.actions && (
            <span 
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {node.actions}
            </span>
          )}
          {node.refreshAction && (
            <span 
              className={cn(
                "transition-opacity",
                node.isLoading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              {node.refreshAction}
            </span>
          )}
          {node.badge && (
            <span 
              onClick={(e) => {
                e.stopPropagation()
                // Check if the clicked element is a dead letter badge
                const target = e.target as HTMLElement
                const deadLetterBadge = target.closest('[data-badge-type="deadletter"]')
                if (deadLetterBadge) {
                  onBadgeClick?.(node, "deadletter")
                }
              }}
            >
              {node.badge}
            </span>
          )}
        </span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              onBadgeClick={onBadgeClick}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function Tree({ nodes, expanded, onToggle, onSelect, onBadgeClick, selectedId, className, searchTerm }: TreeProps) {
  const [internalExpanded, setInternalExpanded] = React.useState<Set<string>>(new Set())
  const actualExpanded = expanded ?? internalExpanded
  const actualOnToggle = onToggle ?? ((id: string) => {
    setInternalExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  })

  // Memoize filteredNodes to prevent unnecessary recalculations
  const filteredNodes = React.useMemo(() => {
    return searchTerm ? filterTree(nodes, searchTerm) : nodes
  }, [nodes, searchTerm])

  // Auto-expand nodes that match search
  React.useEffect(() => {
    if (searchTerm) {
      const expandIds = (nodes: TreeNode[]): string[] => {
        const ids: string[] = []
        nodes.forEach(node => {
          if (matchesSearch(node, searchTerm)) {
            ids.push(node.id)
            if (node.children) {
              ids.push(...expandIds(node.children))
            }
          }
        })
        return ids
      }
      const idsToExpand = expandIds(filteredNodes)
      setInternalExpanded(prev => {
        const next = new Set(prev)
        let hasChanges = false
        idsToExpand.forEach(id => {
          if (!next.has(id)) {
            next.add(id)
            hasChanges = true
          }
        })
        // Only update state if there are actual changes
        return hasChanges ? next : prev
      })
    }
  }, [searchTerm, filteredNodes])

  return (
    <div className={cn("", className)}>
      {filteredNodes.map((node) => (
        <TreeNodeComponent
          key={node.id}
          node={node}
          level={0}
          expanded={actualExpanded}
          onToggle={actualOnToggle}
          onSelect={onSelect}
          onBadgeClick={onBadgeClick}
          selectedId={selectedId}
        />
      ))}
    </div>
  )
}

