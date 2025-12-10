"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
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
  const pathname = usePathname()
  const [connections, setConnections] = useState<ServiceBusConnection[]>([])
  // Always start with null to avoid hydration mismatch
  const [currentConnectionId, setCurrentConnectionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Extract connection name from URL if present
  const getConnectionNameFromUrl = useCallback(() => {
    if (!pathname || pathname === "/") return null
    // Match patterns like /DEV/queues or /DEV/topics
    const match = pathname.match(/^\/([^/]+)\/(queues|topics)/)
    if (match) {
      return decodeURIComponent(match[1])
    }
    return null
  }, [pathname])

  useEffect(() => {
    const loaded = loadConnections()
    setConnections(loaded)
    
    if (loaded.length > 0) {
      // First, check if URL contains a connection name
      const urlConnectionName = getConnectionNameFromUrl()
      if (urlConnectionName) {
        const urlConnection = loaded.find((c) => c.name === urlConnectionName)
        if (urlConnection) {
          setCurrentConnectionId(urlConnection.id)
          setLoading(false)
          return
        }
      }
      
      // If no URL connection, load saved connection ID from localStorage
      const savedConnectionId = loadCurrentConnectionId()
      if (savedConnectionId && loaded.some((c) => c.id === savedConnectionId)) {
        setCurrentConnectionId(savedConnectionId)
      } else {
        // Default to first connection if no saved ID or saved ID doesn't exist
        setCurrentConnectionId(loaded[0].id)
      }
    } else {
      setCurrentConnectionId(null)
    }
    
    setLoading(false)
  }, [getConnectionNameFromUrl]) // Include getConnectionNameFromUrl in dependencies

  // Sync connection ID with URL when pathname changes (priority over localStorage)
  useEffect(() => {
    if (loading || connections.length === 0) return
    
    const urlConnectionName = getConnectionNameFromUrl()
    if (urlConnectionName) {
      const urlConnection = connections.find((c) => c.name === urlConnectionName)
      if (urlConnection && urlConnection.id !== currentConnectionId) {
        setCurrentConnectionId(urlConnection.id)
        // Also save to localStorage so it persists
        saveCurrentConnectionId(urlConnection.id)
      }
    }
  }, [pathname, connections, loading, getConnectionNameFromUrl]) // Removed currentConnectionId from deps to avoid loops

  // Save connection ID whenever it changes (for non-URL routes)
  useEffect(() => {
    const urlConnectionName = getConnectionNameFromUrl()
    // Save if not on a connection-specific route, or if it's a manual change
    if (!urlConnectionName && currentConnectionId) {
      saveCurrentConnectionId(currentConnectionId)
    }
  }, [currentConnectionId, getConnectionNameFromUrl])

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

