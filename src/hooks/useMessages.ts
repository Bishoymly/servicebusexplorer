"use client"

import { useState, useCallback } from "react"
import type { ServiceBusMessage, ServiceBusConnection } from "@/types/azure"
import { apiClient } from "@/lib/api/client"
import { useConnections } from "./useConnections"

export function useMessages(connectionOverride?: ServiceBusConnection | null) {
  const { currentConnection } = useConnections()
  const connection = connectionOverride ?? currentConnection
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const peekMessages = useCallback(
    async (queueName: string, maxCount: number = 10): Promise<ServiceBusMessage[]> => {
      if (!connection) return []

      setLoading(true)
      setError(null)
      try {
        return await apiClient.peekMessages(connection, queueName, undefined, undefined, maxCount)
      } catch (err: any) {
        setError(err.message || "Failed to peek messages")
        return []
      } finally {
        setLoading(false)
      }
    },
    [connection]
  )

  const peekMessagesFromSubscription = useCallback(
    async (
      topicName: string,
      subscriptionName: string,
      maxCount: number = 10
    ): Promise<ServiceBusMessage[]> => {
      if (!connection) return []

      setLoading(true)
      setError(null)
      try {
        return await apiClient.peekMessages(connection, undefined, topicName, subscriptionName, maxCount)
      } catch (err: any) {
        setError(err.message || "Failed to peek messages")
        return []
      } finally {
        setLoading(false)
      }
    },
    [connection]
  )

  const peekDeadLetterMessages = useCallback(
    async (queueName: string, maxCount: number = 10): Promise<ServiceBusMessage[]> => {
      if (!connection) return []

      setLoading(true)
      setError(null)
      try {
        return await apiClient.peekDeadLetterMessages(connection, queueName, maxCount)
      } catch (err: any) {
        setError(err.message || "Failed to peek dead letter messages")
        return []
      } finally {
        setLoading(false)
      }
    },
    [connection]
  )

  const sendMessage = useCallback(
    async (queueName: string, message: ServiceBusMessage): Promise<boolean> => {
      if (!connection) return false

      setLoading(true)
      setError(null)
      try {
        await apiClient.sendMessage(connection, queueName, message)
        return true
      } catch (err: any) {
        setError(err.message || "Failed to send message")
        return false
      } finally {
        setLoading(false)
      }
    },
    [connection]
  )

  const sendMessageToTopic = useCallback(
    async (topicName: string, message: ServiceBusMessage): Promise<boolean> => {
      if (!connection) return false

      setLoading(true)
      setError(null)
      try {
        await apiClient.sendMessageToTopic(connection, topicName, message)
        return true
      } catch (err: any) {
        setError(err.message || "Failed to send message")
        return false
      } finally {
        setLoading(false)
      }
    },
    [connection]
  )

  return {
    loading,
    error,
    peekMessages,
    peekMessagesFromSubscription,
    peekDeadLetterMessages,
    sendMessage,
    sendMessageToTopic,
  }
}

