"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
import { usePathname } from "next/navigation"
import type { ServiceBusConnection } from "@/types/azure"
import {
  loadConnections,
  addConnection as addConnectionStorage,
  updateConnection as updateConnectionStorage,
  deleteConnection as deleteConnectionStorage,
  loadCurrentConnectionId,
  saveCurrentConnectionId,
} from "@/lib/storage/connections"
import { MOCK_CONNECTION } from "@/lib/demo/mockData"
import { useDemoMode } from "@/contexts/DemoModeContext"

interface ConnectionsContextType {
  connections: ServiceBusConnection[]
  connectionsVersion: number
  currentConnection: ServiceBusConnection | null
  currentConnectionId: string | null
  setCurrentConnectionId: (id: string | null) => void
  addConnection: (connection: ServiceBusConnection) => Promise<void>
  updateConnection: (connectionId: string, updates: Partial<ServiceBusConnection>) => Promise<void>
  removeConnection: (connectionId: string) => Promise<void>
  loading: boolean
}

const ConnectionsContext = createContext<ConnectionsContextType | undefined>(undefined)

export function ConnectionsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isDemoMode } = useDemoMode()
  const [connections, setConnections] = useState<ServiceBusConnection[]>([])
  const [connectionsVersion, setConnectionsVersion] = useState(0)
  const [currentConnectionId, setCurrentConnectionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const reloadingRef = useRef(false)

  // Extract connection name from URL if present
  const getConnectionNameFromUrl = useCallback(() => {
    if (!pathname || pathname === "/") return null
    const match = pathname.match(/^\/([^/]+)\/(queues|topics)/)
    if (match) {
      return decodeURIComponent(match[1])
    }
    return null
  }, [pathname])

  // Reload connections from storage and update state
  const reloadConnections = useCallback(async () => {
    if (reloadingRef.current) {
      return
    }
    reloadingRef.current = true
    
    try {
      const { migrateConnectionsToKeychain } = await import("@/lib/storage/connections")
      await migrateConnectionsToKeychain()
      
      const loaded = await loadConnections()
      
      let connectionsToUse: ServiceBusConnection[]
      if (isDemoMode) {
        const hasDemoConnection = loaded.some(c => c.id === MOCK_CONNECTION.id)
        if (!hasDemoConnection) {
          connectionsToUse = [MOCK_CONNECTION, ...loaded]
          await addConnectionStorage(MOCK_CONNECTION)
        } else {
          connectionsToUse = [MOCK_CONNECTION, ...loaded.filter(c => c.id !== MOCK_CONNECTION.id)]
        }
      } else {
        connectionsToUse = loaded.filter(c => c.id !== MOCK_CONNECTION.id)
      }
      
      const newConnections = connectionsToUse.map(c => ({ ...c }))
      setConnections(newConnections)
      setConnectionsVersion(prev => prev + 1)
      
      if (connectionsToUse.length > 0) {
        if (isDemoMode) {
          setCurrentConnectionId(MOCK_CONNECTION.id)
          saveCurrentConnectionId(MOCK_CONNECTION.id)
          return
        }
        
        const urlConnectionName = getConnectionNameFromUrl()
        if (urlConnectionName) {
          const urlConnection = connectionsToUse.find((c) => c.name === urlConnectionName)
          if (urlConnection) {
            setCurrentConnectionId(urlConnection.id)
            return
          }
        }
        
        const savedConnectionId = await loadCurrentConnectionId()
        if (savedConnectionId && connectionsToUse.some((c) => c.id === savedConnectionId)) {
          setCurrentConnectionId(savedConnectionId)
        } else {
          setCurrentConnectionId(connectionsToUse[0].id)
        }
      } else {
        setCurrentConnectionId(null)
      }
    } finally {
      reloadingRef.current = false
    }
  }, [isDemoMode, getConnectionNameFromUrl])

  // Initial load
  useEffect(() => {
    let mounted = true
    reloadConnections().then(() => {
      if (mounted) {
        setLoading(false)
      }
    })
    return () => {
      mounted = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update connections when demo mode changes
  useEffect(() => {
    if (!loading) {
      reloadConnections()
    }
  }, [isDemoMode, loading, reloadConnections])

  // Sync connection ID with URL when pathname changes
  useEffect(() => {
    if (loading || connections.length === 0) return
    
    const urlConnectionName = getConnectionNameFromUrl()
    if (urlConnectionName) {
      const urlConnection = connections.find((c) => c.name === urlConnectionName)
      if (urlConnection && urlConnection.id !== currentConnectionId) {
        setCurrentConnectionId(urlConnection.id)
        saveCurrentConnectionId(urlConnection.id)
      }
    }
  }, [pathname, connections, loading, getConnectionNameFromUrl, currentConnectionId])

  // Save connection ID whenever it changes
  useEffect(() => {
    const urlConnectionName = getConnectionNameFromUrl()
    if (!urlConnectionName && currentConnectionId) {
      saveCurrentConnectionId(currentConnectionId)
    }
  }, [currentConnectionId, getConnectionNameFromUrl])

  const addConnection = useCallback(async (connection: ServiceBusConnection) => {
    await addConnectionStorage(connection)
    await reloadConnections()
    if (!currentConnectionId) {
      setCurrentConnectionId(connection.id)
    }
  }, [currentConnectionId, reloadConnections])

  const updateConnection = useCallback(async (connectionId: string, updates: Partial<ServiceBusConnection>) => {
    await updateConnectionStorage(connectionId, updates)
    await reloadConnections()
  }, [reloadConnections])

  const removeConnection = useCallback(async (connectionId: string) => {
    if (isDemoMode && connectionId === MOCK_CONNECTION.id) {
      throw new Error("Cannot delete demo connection while demo mode is active")
    }
    
    try {
      await deleteConnectionStorage(connectionId)
      await reloadConnections()
    } catch (error) {
      console.error("Failed to remove connection:", error)
      throw error
    }
  }, [isDemoMode, reloadConnections])

  const currentConnection = connections.find((c) => c.id === currentConnectionId) || null

  return (
    <ConnectionsContext.Provider
      value={{
        connections,
        connectionsVersion,
        currentConnection,
        currentConnectionId,
        setCurrentConnectionId,
        addConnection,
        updateConnection,
        removeConnection,
        loading,
      }}
    >
      {children}
    </ConnectionsContext.Provider>
  )
}

export function useConnections() {
  const context = useContext(ConnectionsContext)
  if (context === undefined) {
    throw new Error("useConnections must be used within a ConnectionsProvider")
  }
  return context
}

