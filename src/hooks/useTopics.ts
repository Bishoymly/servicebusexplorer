"use client"

import { useState, useEffect, useCallback } from "react"
import type { TopicProperties, SubscriptionProperties, ServiceBusConnection } from "@/types/azure"
import { apiClient } from "@/lib/api/client"
import { useConnections } from "./useConnections"

export function useTopics(connectionOverride?: ServiceBusConnection | null) {
  const { currentConnection, currentConnectionId, loading: connectionsLoading } = useConnections()
  const connection = connectionOverride ?? currentConnection
  const [topics, setTopics] = useState<TopicProperties[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTopics = useCallback(async () => {
    if (!connection) {
      setTopics([])
      return
    }

    setLoading(true)
    setError(null)
    setTopics([]) // Clear existing topics
    
    try {
      // Topics are loaded with names first, then counts updated progressively
      const loadedTopics = await apiClient.listTopics(connection)
      setTopics(loadedTopics)
    } catch (err: any) {
      setError(err.message || "Failed to load topics")
    } finally {
      setLoading(false)
    }
  }, [connection])

  useEffect(() => {
    // Wait for connections to finish loading before trying to load topics
    if (connectionsLoading && !connectionOverride) {
      return
    }
    
    if (connection) {
      loadTopics()
    } else {
      setTopics([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, connectionsLoading, connectionOverride]) // Depend on connection object

  const getTopic = useCallback(
    async (topicName: string): Promise<TopicProperties | null> => {
      if (!connection) return null
      try {
        return await apiClient.getTopic(connection, topicName)
      } catch (err: any) {
        setError(err.message || "Failed to get topic properties")
        return null
      }
    },
    [connection]
  )

  const listSubscriptions = useCallback(
    async (topicName: string): Promise<SubscriptionProperties[]> => {
      if (!connection) return []
      try {
        return await apiClient.listSubscriptions(connection, topicName)
      } catch (err: any) {
        setError(err.message || "Failed to list subscriptions")
        return []
      }
    },
    [connection]
  )

  const updateTopic = useCallback(
    async (topicName: string, properties: Partial<TopicProperties>): Promise<boolean> => {
      if (!connection) return false
      try {
        await apiClient.updateTopic(connection, topicName, properties)
        await loadTopics()
        return true
      } catch (err: any) {
        setError(err.message || "Failed to update topic")
        return false
      }
    },
    [connection, loadTopics]
  )

  const createTopic = useCallback(
    async (topicName: string, properties?: Partial<TopicProperties>): Promise<boolean> => {
      if (!connection) return false
      try {
        await apiClient.createTopic(connection, topicName, properties)
        await loadTopics()
        return true
      } catch (err: any) {
        setError(err.message || "Failed to create topic")
        return false
      }
    },
    [connection, loadTopics]
  )

  const deleteTopic = useCallback(
    async (topicName: string): Promise<boolean> => {
      if (!connection) return false
      try {
        await apiClient.deleteTopic(connection, topicName)
        await loadTopics()
        return true
      } catch (err: any) {
        setError(err.message || "Failed to delete topic")
        return false
      }
    },
    [connection, loadTopics]
  )

  return {
    topics,
    loading,
    error,
    refresh: loadTopics,
    getTopic,
    listSubscriptions,
    updateTopic,
    createTopic,
    deleteTopic,
  }
}

