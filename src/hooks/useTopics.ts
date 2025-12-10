"use client"

import { useState, useEffect, useCallback } from "react"
import type { TopicProperties, SubscriptionProperties } from "@/types/azure"
import { apiClient } from "@/lib/api/client"
import { useConnections } from "./useConnections"

export function useTopics() {
  const { currentConnection, currentConnectionId, loading: connectionsLoading } = useConnections()
  const [topics, setTopics] = useState<TopicProperties[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTopics = useCallback(async () => {
    if (!currentConnection) {
      setTopics([])
      return
    }

    setLoading(true)
    setError(null)
    setTopics([]) // Clear existing topics
    
    try {
      // Topics are loaded with names first, then counts updated progressively
      const loadedTopics = await apiClient.listTopics(currentConnection)
      setTopics(loadedTopics)
    } catch (err: any) {
      setError(err.message || "Failed to load topics")
    } finally {
      setLoading(false)
    }
  }, [currentConnection])

  useEffect(() => {
    // Wait for connections to finish loading before trying to load topics
    if (connectionsLoading) {
      return
    }
    
    if (currentConnection && currentConnectionId) {
      loadTopics()
    } else {
      setTopics([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConnectionId, currentConnection, connectionsLoading]) // Depend on both ID and connection object

  const getTopic = useCallback(
    async (topicName: string): Promise<TopicProperties | null> => {
      if (!currentConnection) return null
      try {
        return await apiClient.getTopic(currentConnection, topicName)
      } catch (err: any) {
        setError(err.message || "Failed to get topic properties")
        return null
      }
    },
    [currentConnection]
  )

  const listSubscriptions = useCallback(
    async (topicName: string): Promise<SubscriptionProperties[]> => {
      if (!currentConnection) return []
      try {
        return await apiClient.listSubscriptions(currentConnection, topicName)
      } catch (err: any) {
        setError(err.message || "Failed to list subscriptions")
        return []
      }
    },
    [currentConnection]
  )

  const updateTopic = useCallback(
    async (topicName: string, properties: Partial<TopicProperties>): Promise<boolean> => {
      if (!currentConnection) return false
      try {
        await apiClient.updateTopic(currentConnection, topicName, properties)
        await loadTopics()
        return true
      } catch (err: any) {
        setError(err.message || "Failed to update topic")
        return false
      }
    },
    [currentConnection, loadTopics]
  )

  const createTopic = useCallback(
    async (topicName: string, properties?: Partial<TopicProperties>): Promise<boolean> => {
      if (!currentConnection) return false
      try {
        await apiClient.createTopic(currentConnection, topicName, properties)
        await loadTopics()
        return true
      } catch (err: any) {
        setError(err.message || "Failed to create topic")
        return false
      }
    },
    [currentConnection, loadTopics]
  )

  const deleteTopic = useCallback(
    async (topicName: string): Promise<boolean> => {
      if (!currentConnection) return false
      try {
        await apiClient.deleteTopic(currentConnection, topicName)
        await loadTopics()
        return true
      } catch (err: any) {
        setError(err.message || "Failed to delete topic")
        return false
      }
    },
    [currentConnection, loadTopics]
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

