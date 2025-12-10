"use client"

import { useState, useEffect, useCallback } from "react"
import type { QueueProperties, QueueSortOption } from "@/types/azure"
import { apiClient } from "@/lib/api/client"
import { useConnections } from "./useConnections"
import { loadQueueSortPreference, saveQueueSortPreference } from "@/lib/storage/preferences"

export function useQueues() {
  const { currentConnection, currentConnectionId, loading: connectionsLoading, connections } = useConnections()
  const [queues, setQueues] = useState<QueueProperties[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<QueueSortOption>(() => loadQueueSortPreference())

  const loadQueues = useCallback(async () => {
    if (!currentConnection) {
      setQueues([])
      return
    }

    setLoading(true)
    setError(null)
    setQueues([]) // Clear existing queues
    
    try {
      // Start loading queues - the API will return queues progressively
      // Show names immediately, then update with counts as they load
      const loadedQueues = await apiClient.listQueues(currentConnection)
      
      // Set all queues at once - they're already loaded with names first, then counts
      // This is faster than progressive rendering since the API handles batching
      setQueues(loadedQueues)
    } catch (err: any) {
      setError(err.message || "Failed to load queues")
    } finally {
      setLoading(false)
    }
  }, [currentConnection])

  useEffect(() => {
    // Wait for connections to finish loading before trying to load queues
    if (connectionsLoading) {
      return
    }
    
    // Clear queues immediately when connection changes
    if (!currentConnectionId) {
      setQueues([])
      return
    }
    
    // Find the connection object - this ensures we always use the latest connection
    const connection = connections.find((c) => c.id === currentConnectionId) || null
    
    if (connection) {
      // Use the connection directly instead of relying on currentConnection
      setLoading(true)
      setError(null)
      setQueues([])
      
      apiClient.listQueues(connection)
        .then((loadedQueues) => {
          setQueues(loadedQueues)
        })
        .catch((err: any) => {
          setError(err.message || "Failed to load queues")
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setQueues([])
    }
  }, [currentConnectionId, connectionsLoading, connections])

  const sortedQueues = [...queues].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name)
      case "messageCount":
        return (b.messageCount || 0) - (a.messageCount || 0)
      case "deadLetterCount":
        return (b.deadLetterMessageCount || 0) - (a.deadLetterMessageCount || 0)
      default:
        return 0
    }
  })

  const getQueue = useCallback(
    async (queueName: string): Promise<QueueProperties | null> => {
      if (!currentConnection) return null
      try {
        return await apiClient.getQueue(currentConnection, queueName)
      } catch (err: any) {
        setError(err.message || "Failed to get queue properties")
        return null
      }
    },
    [currentConnection]
  )

  const updateQueue = useCallback(
    async (queueName: string, properties: Partial<QueueProperties>): Promise<boolean> => {
      if (!currentConnection) return false
      try {
        await apiClient.updateQueue(currentConnection, queueName, properties)
        await loadQueues()
        return true
      } catch (err: any) {
        setError(err.message || "Failed to update queue")
        return false
      }
    },
    [currentConnection, loadQueues]
  )

  const createQueue = useCallback(
    async (queueName: string, properties?: Partial<QueueProperties>): Promise<boolean> => {
      if (!currentConnection) return false
      try {
        await apiClient.createQueue(currentConnection, queueName, properties)
        await loadQueues()
        return true
      } catch (err: any) {
        setError(err.message || "Failed to create queue")
        return false
      }
    },
    [currentConnection, loadQueues]
  )

  const deleteQueue = useCallback(
    async (queueName: string): Promise<boolean> => {
      if (!currentConnection) return false
      try {
        await apiClient.deleteQueue(currentConnection, queueName)
        await loadQueues()
        return true
      } catch (err: any) {
        setError(err.message || "Failed to delete queue")
        return false
      }
    },
    [currentConnection, loadQueues]
  )

  const refreshQueue = useCallback(
    async (queueName: string): Promise<boolean> => {
      if (!currentConnection) return false
      try {
        const updatedQueue = await apiClient.getQueue(currentConnection, queueName)
        setQueues((prev) => prev.map((q) => (q.name === queueName ? updatedQueue : q)))
        return true
      } catch (err: any) {
        setError(err.message || "Failed to refresh queue")
        return false
      }
    },
    [currentConnection]
  )

  const purgeQueue = useCallback(
    async (queueName: string, purgeDeadLetter: boolean = false): Promise<number> => {
      if (!currentConnection) return 0
      try {
        const purgedCount = await apiClient.purgeQueue(currentConnection, queueName, purgeDeadLetter)
        // Refresh the queue to update message counts
        await refreshQueue(queueName)
        return purgedCount
      } catch (err: any) {
        setError(err.message || "Failed to purge queue")
        return 0
      }
    },
    [currentConnection, refreshQueue]
  )

  const handleSetSortBy = useCallback((value: QueueSortOption) => {
    setSortBy(value)
    saveQueueSortPreference(value)
  }, [])

  // Create a refresh function that always uses the latest connection
  const refresh = useCallback(async () => {
    if (!currentConnectionId) {
      setQueues([])
      return
    }
    
    // Get the latest connection from the connections array
    const connection = connections.find((c) => c.id === currentConnectionId) || null
    
    if (!connection) {
      setQueues([])
      return
    }

    setLoading(true)
    setError(null)
    setQueues([])
    
    try {
      const loadedQueues = await apiClient.listQueues(connection)
      setQueues(loadedQueues)
    } catch (err: any) {
      setError(err.message || "Failed to load queues")
    } finally {
      setLoading(false)
    }
  }, [currentConnectionId, connections])

  return {
    queues: sortedQueues,
    loading,
    error,
    sortBy,
    setSortBy: handleSetSortBy,
    refresh,
    refreshQueue,
    purgeQueue,
    getQueue,
    updateQueue,
    createQueue,
    deleteQueue,
  }
}

