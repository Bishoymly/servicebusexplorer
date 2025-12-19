"use client"

import { createContext, useContext, ReactNode } from "react"

interface TreeRefreshContextType {
  refreshConnection: (connectionId: string) => void | Promise<void>
}

const TreeRefreshContext = createContext<TreeRefreshContextType | undefined>(undefined)

export function TreeRefreshProvider({ 
  children, 
  refreshConnection 
}: { 
  children: ReactNode
  refreshConnection: (connectionId: string) => void | Promise<void>
}) {
  return (
    <TreeRefreshContext.Provider value={{ refreshConnection }}>
      {children}
    </TreeRefreshContext.Provider>
  )
}

export function useTreeRefresh() {
  const context = useContext(TreeRefreshContext)
  if (!context) {
    // Return a no-op function if context is not available
    return { refreshConnection: async () => {} }
  }
  return context
}

