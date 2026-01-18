"use client"

import { createContext, useContext, ReactNode } from "react"

interface TreeRefreshContextType {
  refreshConnection: (connectionId: string) => void | Promise<void>
  updateQueueInTree?: (connectionId: string, queueName: string) => void | Promise<void>
  removeQueueFromTree?: (connectionId: string, queueName: string) => void
}

const TreeRefreshContext = createContext<TreeRefreshContextType | undefined>(undefined)

export function TreeRefreshProvider({ 
  children, 
  refreshConnection,
  updateQueueInTree,
  removeQueueFromTree
}: { 
  children: ReactNode
  refreshConnection: (connectionId: string) => void | Promise<void>
  updateQueueInTree?: (connectionId: string, queueName: string) => void | Promise<void>
  removeQueueFromTree?: (connectionId: string, queueName: string) => void
}) {
  return (
    <TreeRefreshContext.Provider value={{ refreshConnection, updateQueueInTree, removeQueueFromTree }}>
      {children}
    </TreeRefreshContext.Provider>
  )
}

export function useTreeRefresh() {
  const context = useContext(TreeRefreshContext)
  if (!context) {
    // Return no-op functions if context is not available
    return { 
      refreshConnection: async () => {}, 
      updateQueueInTree: async () => {},
      removeQueueFromTree: () => {}
    }
  }
  return context
}

