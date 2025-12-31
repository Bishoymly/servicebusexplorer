"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import * as React from "react"
import { useConnections } from "./useConnections"
import { apiClient } from "@/lib/api/client"
import type { TreeNode } from "@/components/ui/tree"
import type { QueueProperties, TopicProperties, SubscriptionProperties, QueueSortOption, TopicSortOption, SubscriptionSortOption } from "@/types/azure"
import { Database, MessageSquare, FolderTree, Mail, RefreshCw, ArrowUpDown, Trash2, Plus, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  loadQueueSortPreference,
  saveQueueSortPreference,
  loadTopicSortPreference,
  saveTopicSortPreference,
  loadSubscriptionSortPreference,
  saveSubscriptionSortPreference,
} from "@/lib/storage/connectionPreferences"

interface ConnectionTreeData {
  queues: QueueProperties[]
  topics: TopicProperties[]
  subscriptions: Record<string, SubscriptionProperties[]>
}

export function useTreeData(
  onConnectionRemoved?: (connectionId: string) => void,
  onDeleteRequest?: (connectionId: string, connectionName: string) => void,
  onCreateQueue?: (connectionId: string) => void,
  onCreateTopic?: (connectionId: string) => void,
  onCreateSubscription?: (connectionId: string, topicName: string) => void
) {
  const { connections, connectionsVersion, currentConnectionId, removeConnection } = useConnections()
  const [connectionData, setConnectionData] = useState<Record<string, ConnectionTreeData>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [connectionErrors, setConnectionErrors] = useState<Record<string, boolean>>({})
  const [sortPreferences, setSortPreferences] = useState<Record<string, {
    queueSort?: QueueSortOption
    topicSort?: TopicSortOption
    subscriptionSort?: SubscriptionSortOption
  }>>({})
  const loadedConnectionsRef = useRef<Set<string>>(new Set())

  const loadConnectionData = useCallback(async (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId)
    if (!connection) return

    setLoading(prev => ({ ...prev, [connectionId]: true }))
    setConnectionErrors(prev => ({ ...prev, [connectionId]: false }))

    try {
      // Load queues and topics in parallel
      const [queues, topics] = await Promise.all([
        apiClient.listQueues(connection),
        apiClient.listTopics(connection),
      ])

      // Load subscriptions for each topic
      const subscriptions: Record<string, SubscriptionProperties[]> = {}
      await Promise.all(
        topics.map(async (topic) => {
          try {
            const subs = await apiClient.listSubscriptions(connection, topic.name)
            subscriptions[topic.name] = subs
          } catch (err) {
            subscriptions[topic.name] = []
          }
        })
      )

      setConnectionData(prev => ({
        ...prev,
        [connectionId]: { queues, topics, subscriptions },
      }))
      setConnectionErrors(prev => ({ ...prev, [connectionId]: false }))
      loadedConnectionsRef.current.add(connectionId)
    } catch (err) {
      console.error(`Failed to load data for connection ${connectionId}:`, err)
      setConnectionErrors(prev => ({ ...prev, [connectionId]: true }))
    } finally {
      setLoading(prev => ({ ...prev, [connectionId]: false }))
    }
  }, [connections])

  // Load data for all connections
  useEffect(() => {
    const connectionIds = connections.map(c => c.id)
    
    // Check if demo mode changed (demo connection added/removed)
    const hasDemoConnection = connectionIds.includes("demo-connection")
    const hadDemoConnection = Array.from(loadedConnectionsRef.current).some(id => id === "demo-connection")
    
    // If demo mode state changed, clear the demo connection from ref to force reload
    if (hasDemoConnection !== hadDemoConnection) {
      if (hasDemoConnection) {
        loadedConnectionsRef.current.delete("demo-connection")
        // Clear demo connection data
        setConnectionData(prev => {
          const next = { ...prev }
          delete next["demo-connection"]
          return next
        })
      } else {
        loadedConnectionsRef.current.delete("demo-connection")
        setConnectionData(prev => {
          const next = { ...prev }
          delete next["demo-connection"]
          return next
        })
      }
    }
    
    connectionIds.forEach(connectionId => {
      if (!loadedConnectionsRef.current.has(connectionId)) {
        loadedConnectionsRef.current.add(connectionId)
        const connection = connections.find(c => c.id === connectionId)
        if (connection) {
          loadConnectionData(connectionId)
        }
      }
    })
    // Clean up ref when connections are removed
    const currentIds = new Set(connectionIds)
    loadedConnectionsRef.current.forEach(id => {
      if (!currentIds.has(id)) {
        loadedConnectionsRef.current.delete(id)
        // Also clean up the data and related state
        setConnectionData(prev => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        setLoading(prev => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        setConnectionErrors(prev => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        setSortPreferences(prev => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }
    })
  }, [connections, loadConnectionData])

  // Load sort preferences on mount
  useEffect(() => {
    const prefs: Record<string, {
      queueSort?: QueueSortOption
      topicSort?: TopicSortOption
      subscriptionSort?: SubscriptionSortOption
    }> = {}
    connections.forEach(conn => {
      prefs[conn.id] = {
        queueSort: loadQueueSortPreference(conn.id),
        topicSort: loadTopicSortPreference(conn.id),
        subscriptionSort: loadSubscriptionSortPreference(conn.id),
      }
    })
    setSortPreferences(prefs)
  }, [connections])

  const handleRefreshQueues = useCallback((connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId)
    if (!connection) return
    
    setLoading(prev => ({ ...prev, [connectionId]: true }))
    apiClient.listQueues(connection)
      .then(queues => {
        setConnectionData(prev => ({
          ...prev,
          [connectionId]: {
            ...prev[connectionId],
            queues,
          },
        }))
      })
      .catch(err => console.error(`Failed to refresh queues for ${connectionId}:`, err))
      .finally(() => {
        setLoading(prev => ({ ...prev, [connectionId]: false }))
      })
  }, [connections])

  const handleRefreshTopics = useCallback((connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId)
    if (!connection) return
    
    setLoading(prev => ({ ...prev, [connectionId]: true }))
    Promise.all([
      apiClient.listTopics(connection),
      apiClient.listQueues(connection).then(queues => ({ queues })),
    ])
      .then(([topics, { queues }]) => {
        const subscriptions: Record<string, SubscriptionProperties[]> = {}
        return Promise.all(
          topics.map(async (topic) => {
            try {
              const subs = await apiClient.listSubscriptions(connection, topic.name)
              subscriptions[topic.name] = subs
            } catch (err) {
              subscriptions[topic.name] = []
            }
          })
        ).then(() => ({
          topics,
          subscriptions,
          queues,
        }))
      })
      .then(({ topics, subscriptions, queues }) => {
        setConnectionData(prev => ({
          ...prev,
          [connectionId]: {
            queues: queues || prev[connectionId]?.queues || [],
            topics,
            subscriptions,
          },
        }))
      })
      .catch(err => console.error(`Failed to refresh topics for ${connectionId}:`, err))
      .finally(() => {
        setLoading(prev => ({ ...prev, [connectionId]: false }))
      })
  }, [connections])

  const handleSortChange = useCallback((connectionId: string, type: "queues" | "topics" | "subscriptions", sortBy: QueueSortOption | TopicSortOption | SubscriptionSortOption) => {
    setSortPreferences(prev => ({
      ...prev,
      [connectionId]: {
        ...prev[connectionId],
        [type === "queues" ? "queueSort" : type === "topics" ? "topicSort" : "subscriptionSort"]: sortBy,
      },
    }))
    
    if (type === "queues") {
      saveQueueSortPreference(connectionId, sortBy as QueueSortOption)
    } else if (type === "topics") {
      saveTopicSortPreference(connectionId, sortBy as TopicSortOption)
    } else {
      saveSubscriptionSortPreference(connectionId, sortBy as SubscriptionSortOption)
    }
  }, [])

  const refreshConnection = useCallback((connectionId: string) => {
    // Don't delete data - keep old data visible while refreshing
    // Just reload the data
    loadConnectionData(connectionId)
  }, [loadConnectionData])

  const treeNodes = React.useMemo(() => {
    return connections.map(connection => {
      const data = connectionData[connection.id] || { queues: [], topics: [], subscriptions: {} }
      const prefs = sortPreferences[connection.id] || {}
      const queueSort = prefs.queueSort || "name"
      const topicSort = prefs.topicSort || "name"
      const subscriptionSort = prefs.subscriptionSort || "name"

      // Sort queues
      const sortedQueues = [...data.queues].sort((a, b) => {
        switch (queueSort) {
          case "name":
            return a.name.localeCompare(b.name)
          case "messageCount":
            return (b.activeMessageCount || 0) - (a.activeMessageCount || 0)
          case "deadLetterCount":
            return (b.deadLetterMessageCount || 0) - (a.deadLetterMessageCount || 0)
          default:
            return 0
        }
      })

      const queueNodes: TreeNode[] = sortedQueues.map(queue => {
        const badges: React.ReactNode[] = []
        if (queue.activeMessageCount !== undefined && queue.activeMessageCount > 0) {
          badges.push(React.createElement(Badge, { key: "count", variant: "secondary", className: "h-4 px-1 text-xs" }, queue.activeMessageCount))
        }
        if (queue.deadLetterMessageCount !== undefined && queue.deadLetterMessageCount > 0) {
          badges.push(React.createElement(
            "div",
            {
              key: "dl-wrapper",
              "data-badge-type": "deadletter",
              className: "cursor-pointer hover:opacity-80"
            },
            React.createElement(Badge, { 
              variant: "destructive", 
              className: "h-4 px-1 text-xs"
            }, queue.deadLetterMessageCount)
          ))
        }
        if (queue.scheduledMessageCount !== undefined && queue.scheduledMessageCount > 0) {
          badges.push(React.createElement(Badge, { key: "scheduled", variant: "outline", className: "h-4 px-1 text-xs" }, `S: ${queue.scheduledMessageCount}`))
        }
        return {
          id: `queue-${connection.id}-${queue.name}`,
          label: queue.name,
          icon: React.createElement(MessageSquare, { className: "h-3 w-3" }),
          badge: badges.length > 0 ? React.createElement("div", { className: "flex gap-1 text-xs" }, ...badges) : undefined,
          data: { type: "queue", connection, queue },
        }
      })

      // Sort topics
      const sortedTopics = [...data.topics].sort((a, b) => {
        switch (topicSort) {
          case "name":
            return a.name.localeCompare(b.name)
          case "subscriptionCount":
            return (b.subscriptionCount || 0) - (a.subscriptionCount || 0)
          default:
            return 0
        }
      })

      const topicNodes: TreeNode[] = sortedTopics.map(topic => {
        const subs = data.subscriptions[topic.name] || []
        
        const sortedSubs = [...subs].sort((a, b) => {
          switch (subscriptionSort) {
            case "name":
              const aName = a.subscriptionName || ""
              const bName = b.subscriptionName || ""
              return aName.localeCompare(bName)
            case "messageCount":
              return (b.activeMessageCount || 0) - (a.activeMessageCount || 0)
            case "deadLetterCount":
              return (b.deadLetterMessageCount || 0) - (a.deadLetterMessageCount || 0)
            default:
              return 0
          }
        })
        
        const subscriptionNodes: TreeNode[] = sortedSubs.map(sub => {
          const badges: React.ReactNode[] = []
          if (sub.activeMessageCount !== undefined && sub.activeMessageCount > 0) {
            badges.push(React.createElement(Badge, { key: "count", variant: "secondary", className: "h-4 px-1 text-xs" }, sub.activeMessageCount))
          }
          if (sub.deadLetterMessageCount !== undefined && sub.deadLetterMessageCount > 0) {
            badges.push(React.createElement(
              "div",
              {
                key: "dl-wrapper",
                "data-badge-type": "deadletter",
                className: "cursor-pointer hover:opacity-80"
              },
              React.createElement(Badge, { 
                variant: "destructive", 
                className: "h-4 px-1 text-xs"
              }, sub.deadLetterMessageCount)
            ))
          }
          if (sub.transferMessageCount !== undefined && sub.transferMessageCount > 0) {
            badges.push(React.createElement(Badge, { key: "scheduled", variant: "outline", className: "h-4 px-1 text-xs" }, `S: ${sub.transferMessageCount}`))
          }
          return {
            id: `subscription-${connection.id}-${topic.name}-${sub.subscriptionName || "unknown"}`,
            label: sub.subscriptionName || "Unknown Subscription",
            icon: React.createElement(Mail, { className: "h-3 w-3" }),
            badge: badges.length > 0 ? React.createElement("div", { className: "flex gap-1 text-xs" }, ...badges) : undefined,
            data: { type: "subscription", connection, topic, subscription: sub },
          }
        })

        const topicCreateSubscriptionAction = React.createElement(
          Button,
          {
            variant: "ghost",
            size: "sm",
            className: "h-5 w-5 p-0 opacity-0 group-hover:opacity-100",
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation()
              if (onCreateSubscription) {
                onCreateSubscription(connection.id, topic.name)
              }
            },
          },
          React.createElement(Plus, { className: "h-3 w-3" })
        )

        return {
          id: `topic-${connection.id}-${topic.name}`,
          label: topic.name,
          icon: React.createElement(FolderTree, { className: "h-3 w-3" }),
          children: subscriptionNodes.length > 0 ? subscriptionNodes : undefined,
          actions: topicCreateSubscriptionAction,
          data: { type: "topic", connection, topic },
        }
      })

      const children: TreeNode[] = []
      if (queueNodes.length > 0) {
        const queueSortAction = React.createElement(
          DropdownMenu,
          {
            key: `queue-sort-${connection.id}`,
            children: [
              React.createElement(
                DropdownMenuTrigger,
                { key: "trigger", asChild: true },
                React.createElement(
                  Button,
                  {
                    variant: "ghost",
                    size: "sm",
                    className: "h-5 w-5 p-0",
                    onClick: (e: React.MouseEvent) => e.stopPropagation(),
                  },
                  React.createElement(ArrowUpDown, { className: "h-3 w-3" })
                )
              ),
              React.createElement(
                DropdownMenuContent,
                { key: "content", align: "end" },
                React.createElement(
                  DropdownMenuItem,
                  { onClick: () => handleSortChange(connection.id, "queues", "name") },
                  "Sort by Name"
                ),
                React.createElement(
                  DropdownMenuItem,
                  { onClick: () => handleSortChange(connection.id, "queues", "messageCount") },
                  "Sort by Message Count"
                ),
                React.createElement(
                  DropdownMenuItem,
                  { onClick: () => handleSortChange(connection.id, "queues", "deadLetterCount") },
                  "Sort by Dead Letter Count"
                )
              ),
            ],
          }
        )

        const queueRefreshAction = React.createElement(
          Button,
          {
            variant: "ghost",
            size: "sm",
            className: "h-5 w-5 p-0",
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation()
              handleRefreshQueues(connection.id)
            },
            disabled: loading[connection.id],
          },
          React.createElement(RefreshCw, { className: cn("h-3 w-3", loading[connection.id] && "animate-spin") })
        )

        const queueCreateAction = React.createElement(
          Button,
          {
            variant: "ghost",
            size: "sm",
            className: "h-5 w-5 p-0 opacity-0 group-hover:opacity-100",
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation()
              if (onCreateQueue) {
                onCreateQueue(connection.id)
              }
            },
          },
          React.createElement(Plus, { className: "h-3 w-3" })
        )
        
        children.push({
          id: `queues-${connection.id}`,
          label: "Queues",
          icon: React.createElement(MessageSquare, { className: "h-3 w-3" }),
          children: queueNodes,
          actions: React.createElement("div", { className: "flex items-center gap-1" }, queueSortAction, queueCreateAction),
          refreshAction: queueRefreshAction,
          data: { type: "queues-header", connection },
          isLoading: loading[connection.id],
        })
      }
      if (topicNodes.length > 0) {
        const topicSortAction = React.createElement(
          DropdownMenu,
          {
            key: `topic-sort-${connection.id}`,
            children: [
              React.createElement(
                DropdownMenuTrigger,
                { key: "trigger", asChild: true },
                React.createElement(
                  Button,
                  {
                    variant: "ghost",
                    size: "sm",
                    className: "h-5 w-5 p-0",
                    onClick: (e: React.MouseEvent) => e.stopPropagation(),
                  },
                  React.createElement(ArrowUpDown, { className: "h-3 w-3" })
                )
              ),
              React.createElement(
                DropdownMenuContent,
                { key: "content", align: "end" },
                React.createElement(
                  DropdownMenuItem,
                  { onClick: () => handleSortChange(connection.id, "topics", "name") },
                  "Sort by Name"
                ),
                React.createElement(
                  DropdownMenuItem,
                  { onClick: () => handleSortChange(connection.id, "topics", "subscriptionCount") },
                  "Sort by Subscription Count"
                ),
              ),
            ],
          }
        )

        const topicRefreshAction = React.createElement(
          Button,
          {
            variant: "ghost",
            size: "sm",
            className: "h-5 w-5 p-0",
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation()
              handleRefreshTopics(connection.id)
            },
            disabled: loading[connection.id],
          },
          React.createElement(RefreshCw, { className: cn("h-3 w-3", loading[connection.id] && "animate-spin") })
        )

        const topicCreateAction = React.createElement(
          Button,
          {
            variant: "ghost",
            size: "sm",
            className: "h-5 w-5 p-0 opacity-0 group-hover:opacity-100",
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation()
              if (onCreateTopic) {
                onCreateTopic(connection.id)
              }
            },
          },
          React.createElement(Plus, { className: "h-3 w-3" })
        )
        
        children.push({
          id: `topics-${connection.id}`,
          label: "Topics",
          icon: React.createElement(FolderTree, { className: "h-3 w-3" }),
          children: topicNodes,
          actions: React.createElement("div", { className: "flex items-center gap-1" }, topicSortAction, topicCreateAction),
          refreshAction: topicRefreshAction,
          data: { type: "topics-header", connection },
          isLoading: loading[connection.id],
        })
      }

      const handleDeleteConnection = (connectionId: string, connectionName: string) => {
        if (onDeleteRequest) {
          onDeleteRequest(connectionId, connectionName)
        } else {
          removeConnection(connectionId)
          onConnectionRemoved?.(connectionId)
        }
      }

      const connectionDeleteAction = React.createElement(
        Button,
        {
          key: `delete-${connection.id}`,
          variant: "ghost",
          size: "icon",
          className: "h-6 w-6",
          type: "button",
          onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
            e.preventDefault()
            e.stopPropagation()
            handleDeleteConnection(connection.id, connection.name)
          },
        },
        React.createElement(Trash2, { className: "h-3 w-3" })
      )

      const connectionRefreshAction = React.createElement(
        Button,
        {
          variant: "ghost",
          size: "icon",
          className: "h-6 w-6",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation()
            refreshConnection(connection.id)
          },
          disabled: loading[connection.id],
        },
        React.createElement(RefreshCw, { className: cn("h-3 w-3", loading[connection.id] && "animate-spin") })
      )

      const hasError = connectionErrors[connection.id]
      const connectionIcon = hasError 
        ? React.createElement(AlertCircle, { className: "h-3 w-3 text-destructive" })
        : React.createElement(Database, { className: "h-3 w-3" })

      return {
        id: `connection-${connection.id}`,
        label: connection.name,
        icon: connectionIcon,
        children: children.length > 0 ? children : undefined,
        data: { type: "connection", connection },
        actions: connectionDeleteAction,
        refreshAction: connectionRefreshAction,
        isLoading: loading[connection.id],
        hasError,
      }
    })
  }, [connections, connections.length, connectionsVersion, connectionData, sortPreferences, loading, connectionErrors, handleRefreshQueues, handleRefreshTopics, handleSortChange, removeConnection, refreshConnection, onConnectionRemoved, onDeleteRequest, onCreateQueue, onCreateTopic, onCreateSubscription])

  return {
    treeNodes,
    loading,
    refreshConnection,
  }
}

