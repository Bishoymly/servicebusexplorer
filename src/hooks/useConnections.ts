"use client"

import { useState, useEffect, useCallback } from "react"
import type { ServiceBusConnection } from "@/types/azure"
import {
  loadConnections,
  saveConnections,
  addConnection as addConnectionStorage,
  updateConnection as updateConnectionStorage,
  deleteConnection as deleteConnectionStorage,
  loadCurrentConnectionId,
  saveCurrentConnectionId,
} from "@/lib/storage/connections"

export function useConnections() {
  const [connections, setConnections] = useState<ServiceBusConnection[]>([])
  // Initialize currentConnectionId from localStorage synchronously
  const [currentConnectionId, setCurrentConnectionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    const loaded = loadConnections()
    if (loaded.length > 0) {
      const savedConnectionId = loadCurrentConnectionId()
      if (savedConnectionId && loaded.some((c) => c.id === savedConnectionId)) {
        return savedConnectionId
      }
      return loaded[0].id
    }
    return null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loaded = loadConnections()
    setConnections(loaded)
    
    if (loaded.length > 0) {
      // Ensure currentConnectionId is set if not already set
      if (!currentConnectionId) {
        const savedConnectionId = loadCurrentConnectionId()
        if (savedConnectionId && loaded.some((c) => c.id === savedConnectionId)) {
          setCurrentConnectionId(savedConnectionId)
        } else {
          setCurrentConnectionId(loaded[0].id)
        }
      } else {
        // Validate that currentConnectionId still exists
        if (!loaded.some((c) => c.id === currentConnectionId)) {
          const savedConnectionId = loadCurrentConnectionId()
          if (savedConnectionId && loaded.some((c) => c.id === savedConnectionId)) {
            setCurrentConnectionId(savedConnectionId)
          } else {
            setCurrentConnectionId(loaded[0].id)
          }
        }
      }
    } else {
      setCurrentConnectionId(null)
    }
    
    setLoading(false)
  }, []) // Only run on mount

  // Save connection ID whenever it changes
  useEffect(() => {
    saveCurrentConnectionId(currentConnectionId)
  }, [currentConnectionId])

  const addConnection = useCallback((connection: ServiceBusConnection) => {
    addConnectionStorage(connection)
    setConnections((prev) => [...prev, connection])
    if (!currentConnectionId) {
      setCurrentConnectionId(connection.id)
    }
  }, [currentConnectionId])

  const updateConnection = useCallback((connectionId: string, updates: Partial<ServiceBusConnection>) => {
    updateConnectionStorage(connectionId, updates)
    setConnections((prev) =>
      prev.map((c) => (c.id === connectionId ? { ...c, ...updates, updatedAt: Date.now() } : c))
    )
  }, [])

  const removeConnection = useCallback((connectionId: string) => {
    deleteConnectionStorage(connectionId)
    setConnections((prev) => {
      const filtered = prev.filter((c) => c.id !== connectionId)
      if (currentConnectionId === connectionId) {
        if (filtered.length > 0) {
          setCurrentConnectionId(filtered[0].id)
        } else {
          setCurrentConnectionId(null)
          saveCurrentConnectionId(null)
        }
      }
      return filtered
    })
  }, [currentConnectionId])

  const currentConnection = connections.find((c) => c.id === currentConnectionId) || null

  return {
    connections,
    currentConnection,
    currentConnectionId,
    setCurrentConnectionId,
    addConnection,
    updateConnection,
    removeConnection,
    loading,
  }
}

