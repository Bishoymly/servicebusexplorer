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
import { MOCK_CONNECTION } from "@/lib/demo/mockData"
import { useDemoMode } from "@/contexts/DemoModeContext"

export function useConnections() {
  const pathname = usePathname()
  const { isDemoMode } = useDemoMode()
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

  // Function to update connections based on demo mode
  const updateConnectionsForDemoMode = useCallback(() => {
    const loaded = loadConnections()
    
    // In demo mode, ensure mock connection exists
    let connectionsToUse = loaded
    if (isDemoMode) {
      const hasDemoConnection = loaded.some(c => c.id === MOCK_CONNECTION.id)
      if (!hasDemoConnection) {
        // Add demo connection if it doesn't exist
        connectionsToUse = [MOCK_CONNECTION, ...loaded]
        addConnectionStorage(MOCK_CONNECTION)
      } else {
        // Update demo connection to ensure it's first
        connectionsToUse = [MOCK_CONNECTION, ...loaded.filter(c => c.id !== MOCK_CONNECTION.id)]
      }
    } else {
      // Remove demo connection if demo mode is disabled
      connectionsToUse = loaded.filter(c => c.id !== MOCK_CONNECTION.id)
    }
    
    setConnections(connectionsToUse)
    
    if (connectionsToUse.length > 0) {
      // In demo mode, always use demo connection
      if (isDemoMode) {
        setCurrentConnectionId(MOCK_CONNECTION.id)
        saveCurrentConnectionId(MOCK_CONNECTION.id)
        return
      }
      
      // First, check if URL contains a connection name
      const urlConnectionName = getConnectionNameFromUrl()
      if (urlConnectionName) {
        const urlConnection = connectionsToUse.find((c) => c.name === urlConnectionName)
        if (urlConnection) {
          setCurrentConnectionId(urlConnection.id)
          return
        }
      }
      
      // If no URL connection, load saved connection ID from localStorage
      const savedConnectionId = loadCurrentConnectionId()
      if (savedConnectionId && connectionsToUse.some((c) => c.id === savedConnectionId)) {
        setCurrentConnectionId(savedConnectionId)
      } else {
        // Default to first connection if no saved ID or saved ID doesn't exist
        setCurrentConnectionId(connectionsToUse[0].id)
      }
    } else {
      setCurrentConnectionId(null)
    }
  }, [isDemoMode, getConnectionNameFromUrl])

  // Initial load
  useEffect(() => {
    updateConnectionsForDemoMode()
    setLoading(false)
  }, [updateConnectionsForDemoMode])

  // Update connections when demo mode changes
  useEffect(() => {
    if (!loading) {
      updateConnectionsForDemoMode()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, loading])

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
    // Don't allow deleting the demo connection if demo mode is active
    if (isDemoMode && connectionId === MOCK_CONNECTION.id) {
      console.log("Cannot delete demo connection while demo mode is active")
      return
    }
    
    console.log("Removing connection from storage:", connectionId)
    deleteConnectionStorage(connectionId)
    
    setConnections((prev) => {
      console.log("Previous connections:", prev.map(c => c.id))
      const filtered = prev.filter((c) => c.id !== connectionId)
      console.log("Filtered connections:", filtered.map(c => c.id))
      
      if (currentConnectionId === connectionId) {
        if (filtered.length > 0) {
          setCurrentConnectionId(filtered[0].id)
        } else {
          setCurrentConnectionId(null)
          saveCurrentConnectionId(null)
        }
      }
      // If demo mode is active and we removed a non-demo connection, ensure demo connection is still first
      if (isDemoMode && filtered.some(c => c.id === MOCK_CONNECTION.id)) {
        const demoConnection = filtered.find(c => c.id === MOCK_CONNECTION.id)
        const otherConnections = filtered.filter(c => c.id !== MOCK_CONNECTION.id)
        const result = demoConnection ? [demoConnection, ...otherConnections] : filtered
        console.log("Final connections (with demo first):", result.map(c => c.id))
        return result
      }
      console.log("Final connections:", filtered.map(c => c.id))
      return filtered
    })
  }, [currentConnectionId, isDemoMode])

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

