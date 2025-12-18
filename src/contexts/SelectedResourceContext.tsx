"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface SelectedResource {
  type: "queue" | "topic" | "subscription" | null
  name: string
  connectionId: string
  connectionName: string
  topicName?: string
  subscriptionName?: string
  showDeadLetter?: boolean
}

interface SelectedResourceContextType {
  selectedResource: SelectedResource | null
  setSelectedResource: (resource: SelectedResource | null) => void
}

const SelectedResourceContext = createContext<SelectedResourceContextType | undefined>(undefined)

export function SelectedResourceProvider({ children }: { children: ReactNode }) {
  const [selectedResource, setSelectedResource] = useState<SelectedResource | null>(null)

  return (
    <SelectedResourceContext.Provider value={{ selectedResource, setSelectedResource }}>
      {children}
    </SelectedResourceContext.Provider>
  )
}

export function useSelectedResource() {
  const context = useContext(SelectedResourceContext)
  if (!context) {
    throw new Error("useSelectedResource must be used within SelectedResourceProvider")
  }
  return context
}

