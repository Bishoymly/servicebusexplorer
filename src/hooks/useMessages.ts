"use client"

import { useState, useCallback } from "react"
import type { ServiceBusMessage } from "@/types/azure"
import { apiClient } from "@/lib/api/client"
import { useConnections } from "./useConnections"

export function useMessages() {
  const { currentConnection } = useConnections()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const peekMessages = useCallback(
    async (queueName: string, maxCount: number = 10): Promise<ServiceBusMessage[]> => {
      if (!currentConnection) return []

      setLoading(true)
      setError(null)
      try {
        return await apiClient.peekMessages(currentConnection, queueName, undefined, undefined, maxCount)
      } catch (err: any) {
        setError(err.message || "Failed to peek messages")
        return []
      } finally {
        setLoading(false)
      }
    },
    [currentConnection]
  )

  const peekMessagesFromSubscription = useCallback(
    async (
      topicName: string,
      subscriptionName: string,
      maxCount: number = 10
    ): Promise<ServiceBusMessage[]> => {
      if (!currentConnection) return []

      setLoading(true)
      setError(null)
      try {
        return await apiClient.peekMessages(currentConnection, undefined, topicName, subscriptionName, maxCount)
      } catch (err: any) {
        setError(err.message || "Failed to peek messages")
        return []
      } finally {
        setLoading(false)
      }
    },
    [currentConnection]
  )

  const peekDeadLetterMessages = useCallback(
    async (queueName: string, maxCount: number = 10): Promise<ServiceBusMessage[]> => {
      if (!currentConnection) return []

      setLoading(true)
      setError(null)
      try {
        return await apiClient.peekDeadLetterMessages(currentConnection, queueName, maxCount)
      } catch (err: any) {
        setError(err.message || "Failed to peek dead letter messages")
        return []
      } finally {
        setLoading(false)
      }
    },
    [currentConnection]
  )

  const sendMessage = useCallback(
    async (queueName: string, message: ServiceBusMessage): Promise<boolean> => {
      if (!currentConnection) return false

      setLoading(true)
      setError(null)
      try {
        await apiClient.sendMessage(currentConnection, queueName, message)
        return true
      } catch (err: any) {
        setError(err.message || "Failed to send message")
        return false
      } finally {
        setLoading(false)
      }
    },
    [currentConnection]
  )

  const sendMessageToTopic = useCallback(
    async (topicName: string, message: ServiceBusMessage): Promise<boolean> => {
      if (!currentConnection) return false

      setLoading(true)
      setError(null)
      try {
        await apiClient.sendMessageToTopic(currentConnection, topicName, message)
        return true
      } catch (err: any) {
        setError(err.message || "Failed to send message")
        return false
      } finally {
        setLoading(false)
      }
    },
    [currentConnection]
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

