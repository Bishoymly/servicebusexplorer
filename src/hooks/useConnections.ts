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
  const updateConnectionsForDemoMode = useCallback(async () => {
    // Run migration on first load
    const { migrateConnectionsToKeychain } = await import("@/lib/storage/connections")
    await migrateConnectionsToKeychain()
    
    const loaded = await loadConnections()
    
    // In demo mode, ensure mock connection exists
    let connectionsToUse = loaded
    if (isDemoMode) {
      const hasDemoConnection = loaded.some(c => c.id === MOCK_CONNECTION.id)
      if (!hasDemoConnection) {
        // Add demo connection if it doesn't exist
        connectionsToUse = [MOCK_CONNECTION, ...loaded]
        await addConnectionStorage(MOCK_CONNECTION)
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
      const savedConnectionId = await loadCurrentConnectionId()
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

  const addConnection = useCallback(async (connection: ServiceBusConnection) => {
    await addConnectionStorage(connection)
    // Reload connections to ensure consistency
    await updateConnectionsForDemoMode()
    if (!currentConnectionId) {
      setCurrentConnectionId(connection.id)
    }
  }, [currentConnectionId, updateConnectionsForDemoMode])

  const updateConnection = useCallback(async (connectionId: string, updates: Partial<ServiceBusConnection>) => {
    await updateConnectionStorage(connectionId, updates)
    setConnections((prev) =>
      prev.map((c) => (c.id === connectionId ? { ...c, ...updates, updatedAt: Date.now() } : c))
    )
  }, [])

  const removeConnection = useCallback(async (connectionId: string) => {
    // Don't allow deleting the demo connection if demo mode is active
    if (isDemoMode && connectionId === MOCK_CONNECTION.id) {
      console.log("Cannot delete demo connection while demo mode is active")
      throw new Error("Cannot delete demo connection while demo mode is active")
    }
    
    try {
      console.log("Removing connection from storage:", connectionId)
      await deleteConnectionStorage(connectionId)
      
      // Reload connections from storage to ensure consistency
      await updateConnectionsForDemoMode()
    } catch (error) {
      console.error("Failed to remove connection:", error)
      throw error
    }
  }, [isDemoMode, updateConnectionsForDemoMode])

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

