"use client"

import React, { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Plus, Search } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { useConnections } from "@/hooks/useConnections"
import { useTreeData } from "@/hooks/useTreeData"
import { Tree, type TreeNode } from "@/components/ui/tree"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConnectionForm } from "@/components/connections/ConnectionForm"
import { QueueSettingsForm } from "@/components/queues/QueueSettingsForm"
import { TopicSettingsForm } from "@/components/topics/TopicSettingsForm"
import { SubscriptionSettingsForm } from "@/components/topics/SubscriptionSettingsForm"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { useSelectedResource } from "@/contexts/SelectedResourceContext"
import { TreeRefreshProvider } from "@/contexts/TreeRefreshContext"
import { useDemoMode } from "@/contexts/DemoModeContext"
import type { ServiceBusConnection } from "@/types/azure"

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { connections, connectionsVersion, addConnection, removeConnection } = useConnections()
  const { selectedResource, setSelectedResource } = useSelectedResource()
  const { isDemoMode, toggleDemoMode } = useDemoMode()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [connectionToDelete, setConnectionToDelete] = useState<{ id: string; name: string } | null>(null)

  // Keyboard shortcut: Press D key 3 times quickly, or Ctrl/Cmd+D
  useEffect(() => {
    let keyPressCount = 0
    let keyPressTimer: NodeJS.Timeout | null = null

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+D or Cmd+D to toggle demo mode
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        toggleDemoMode()
        return
      }

      // Press D key 3 times quickly
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        keyPressCount++
        
        if (keyPressCount >= 3) {
          toggleDemoMode()
          keyPressCount = 0
          if (keyPressTimer) {
            clearTimeout(keyPressTimer)
            keyPressTimer = null
          }
        } else {
          // Reset counter after 1 second of inactivity
          if (keyPressTimer) {
            clearTimeout(keyPressTimer)
          }
          keyPressTimer = setTimeout(() => {
            keyPressCount = 0
          }, 1000)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (keyPressTimer) {
        clearTimeout(keyPressTimer)
      }
    }
  }, [toggleDemoMode])
  
  const handleDeleteRequest = (connectionId: string, connectionName: string) => {
    setConnectionToDelete({ id: connectionId, name: connectionName })
    setDeleteDialogOpen(true)
  }
  
  const handleConnectionRemoved = (connectionId: string) => {
    // Clear selected resource if it belongs to the deleted connection
    if (selectedResource?.connectionId === connectionId) {
      setSelectedResource(null)
    }
  }
  
  const handleConfirmDelete = async () => {
    if (connectionToDelete) {
      try {
        console.log("Deleting connection:", connectionToDelete.id)
        await removeConnection(connectionToDelete.id)
        handleConnectionRemoved(connectionToDelete.id)
        setDeleteDialogOpen(false)
        setConnectionToDelete(null)
      } catch (error) {
        console.error("Failed to delete connection:", error)
        alert(`Failed to delete connection: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  
  const [createQueueDialog, setCreateQueueDialog] = useState<{ connectionId: string } | null>(null)
  const [createTopicDialog, setCreateTopicDialog] = useState<{ connectionId: string } | null>(null)
  const [createSubscriptionDialog, setCreateSubscriptionDialog] = useState<{ connectionId: string; topicName: string } | null>(null)

  const handleCreateQueue = (connectionId: string) => {
    setCreateQueueDialog({ connectionId })
  }

  const handleCreateTopic = (connectionId: string) => {
    setCreateTopicDialog({ connectionId })
  }

  const handleCreateSubscription = (connectionId: string, topicName: string) => {
    setCreateSubscriptionDialog({ connectionId, topicName })
  }

  const { treeNodes, refreshConnection, updateQueueInTree } = useTreeData(
    handleConnectionRemoved,
    handleDeleteRequest,
    handleCreateQueue,
    handleCreateTopic,
    handleCreateSubscription
  )
  const [searchTerm, setSearchTerm] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)

  const handleNodeSelect = (node: TreeNode) => {
    const { type, connection, queue, topic, subscription } = node.data || {}
    
    if (type === "queue" && connection && queue) {
      // Set selected resource instead of navigating
      setSelectedResource({
        type: "queue",
        name: queue.name,
        connectionId: connection.id,
        connectionName: connection.name,
        showDeadLetter: false,
      })
      // Navigate to home page
      router.push("/")
    } else if (type === "subscription" && connection && topic && subscription) {
      // Set selected resource for subscription (similar to queue)
      setSelectedResource({
        type: "subscription",
        name: subscription.subscriptionName,
        connectionId: connection.id,
        connectionName: connection.name,
        topicName: topic.name,
        subscriptionName: subscription.subscriptionName,
        showDeadLetter: false,
      })
      // Navigate to home page
      router.push("/")
    } else if (type === "connection" && connection) {
      // Toggle expansion for connection
      setExpanded(prev => {
        const next = new Set(prev)
        if (next.has(node.id)) {
          next.delete(node.id)
        } else {
          next.add(node.id)
        }
        return next
      })
    } else if (type === "queues-header" || type === "topics-header") {
      // Toggle expansion for headers
      setExpanded(prev => {
        const next = new Set(prev)
        if (next.has(node.id)) {
          next.delete(node.id)
        } else {
          next.add(node.id)
        }
        return next
      })
    }
  }

  const handleBadgeClick = (node: TreeNode, badgeType: string) => {
    const { type, connection, queue, topic, subscription } = node.data || {}
    
    // Handle dead letter badge click
    if (badgeType === "deadletter" && type === "queue" && connection && queue) {
      setSelectedResource({
        type: "queue",
        name: queue.name,
        connectionId: connection.id,
        connectionName: connection.name,
        showDeadLetter: true,
      })
      router.push("/")
    } else if (badgeType === "deadletter" && type === "subscription" && connection && topic && subscription) {
      setSelectedResource({
        type: "subscription",
        name: subscription.subscriptionName,
        connectionId: connection.id,
        connectionName: connection.name,
        topicName: topic.name,
        subscriptionName: subscription.subscriptionName,
        showDeadLetter: true,
      })
      router.push("/")
    }
  }

  const handleAddConnection = async (data: Omit<ServiceBusConnection, "id" | "createdAt" | "updatedAt">) => {
    try {
      const newConnection: ServiceBusConnection = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      console.log("Adding connection:", { name: newConnection.name, id: newConnection.id })
      await addConnection(newConnection)
      console.log("Connection added successfully")
      setFormOpen(false)
    } catch (error) {
      console.error("Failed to add connection:", error)
      // Keep form open on error so user can retry
      const errorMessage = error instanceof Error ? error.message : String(error)
      alert(`Failed to add connection: ${errorMessage}`)
    }
  }

  // Auto-expand connections by default and when new connections are added
  const previousConnectionsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const currentConnectionIds = new Set(connections.map(c => c.id))
    
    // Clean up expanded state for removed connections
    const removedConnectionIds = Array.from(previousConnectionsRef.current).filter(
      id => !currentConnectionIds.has(id)
    )
    
    if (removedConnectionIds.length > 0) {
      setExpanded(prev => {
        const next = new Set(prev)
        // Remove all expanded nodes related to deleted connections
        removedConnectionIds.forEach(connectionId => {
          // Remove connection node
          next.delete(`connection-${connectionId}`)
          // Remove queues header
          next.delete(`queues-${connectionId}`)
          // Remove topics header
          next.delete(`topics-${connectionId}`)
          // Remove all queue nodes
          treeNodes.forEach(node => {
            if (node.data?.type === "queue" && node.data?.connection?.id === connectionId) {
              next.delete(node.id)
            }
            if (node.data?.type === "topic" && node.data?.connection?.id === connectionId) {
              next.delete(node.id)
            }
            if (node.data?.type === "subscription" && node.data?.connection?.id === connectionId) {
              next.delete(node.id)
            }
          })
        })
        return next
      })
    }
    
    // Check if there are new connections
    const hasNewConnections = Array.from(currentConnectionIds).some(id => !previousConnectionsRef.current.has(id))
    
    if (hasNewConnections || previousConnectionsRef.current.size === 0) {
      // Auto-expand all connection nodes
      const connectionNodeIds = treeNodes
        .filter(node => node.data?.type === "connection")
        .map(node => node.id)
      
      if (connectionNodeIds.length > 0) {
        // Use setTimeout to avoid synchronous setState in effect
        setTimeout(() => {
          setExpanded(prev => {
            const next = new Set(prev)
            connectionNodeIds.forEach(id => next.add(id))
            return next
          })
        }, 0)
      }
    }
    
    // Update the ref with current connection IDs
    previousConnectionsRef.current = currentConnectionIds
  }, [connections, treeNodes])

  // Get selected node ID from selected resource
  const getSelectedId = () => {
    if (selectedResource?.type === "queue") {
      return `queue-${selectedResource.connectionId}-${selectedResource.name}`
    }
    // For topics, still use pathname
    const match = pathname?.match(/\/([^/]+)\/(topics)/)
    if (!match) return undefined
    
    const connectionName = decodeURIComponent(match[1])
    const connection = connections.find(c => c.name === connectionName)
    if (!connection) return undefined

    if (match[2] === "topics") {
      return `topics-${connection.id}`
    }
    return undefined
  }

  return (
    <TreeRefreshProvider refreshConnection={refreshConnection} updateQueueInTree={updateQueueInTree}>
      <div className="flex h-full w-96 flex-col border-r bg-card">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 -m-2">
            <Image 
              src="/app-icon.png" 
              alt="Azure Service Bus Explorer" 
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          <h1 className="text-lg font-semibold">
            Azure Service Bus Explorer
          </h1>
        </div>
        {isDemoMode && (
          <div className="flex items-center gap-2 px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded text-xs text-yellow-600 dark:text-yellow-400 mt-2 ml-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
            DEMO MODE
          </div>
        )}
      </div>
      
      <div className="border-b p-2">
        <Button
          variant="default"
          size="sm"
          className="w-full"
          onClick={() => setFormOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Connection
        </Button>
      </div>

      <div className="border-b p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {treeNodes.length === 0 ? (
          <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
            No connections. Add one to get started.
          </div>
        ) : (
          <Tree
            key={`connections-${connectionsVersion}`}
            nodes={treeNodes}
            expanded={expanded}
            onToggle={(id) => {
              setExpanded(prev => {
                const next = new Set(prev)
                if (next.has(id)) {
                  next.delete(id)
                } else {
                  next.add(id)
                }
                return next
              })
            }}
            onSelect={handleNodeSelect}
            onBadgeClick={handleBadgeClick}
            selectedId={getSelectedId()}
            searchTerm={searchTerm}
            className="p-2"
          />
        )}
      </div>

      <ConnectionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleAddConnection}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Connection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the connection &quot;{connectionToDelete?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setConnectionToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Queue Dialog */}
      {createQueueDialog && (() => {
        const connection = connections.find(c => c.id === createQueueDialog.connectionId)
        if (!connection) return null
        return (
          <QueueSettingsForm
            connection={connection}
            open={!!createQueueDialog}
            onOpenChange={(open) => {
              if (!open) setCreateQueueDialog(null)
            }}
            onSuccess={async () => {
              setCreateQueueDialog(null)
              await refreshConnection(createQueueDialog.connectionId)
            }}
          />
        )
      })()}

      {/* Create Topic Dialog */}
      {createTopicDialog && (() => {
        const connection = connections.find(c => c.id === createTopicDialog.connectionId)
        if (!connection) return null
        return (
          <TopicSettingsForm
            connection={connection}
            open={!!createTopicDialog}
            onOpenChange={(open) => {
              if (!open) setCreateTopicDialog(null)
            }}
            onSuccess={async () => {
              setCreateTopicDialog(null)
              await refreshConnection(createTopicDialog.connectionId)
            }}
          />
        )
      })()}

      {/* Create Subscription Dialog */}
      {createSubscriptionDialog && (() => {
        const connection = connections.find(c => c.id === createSubscriptionDialog.connectionId)
        if (!connection) return null
        return (
          <SubscriptionSettingsForm
            topicName={createSubscriptionDialog.topicName}
            connection={connection}
            open={!!createSubscriptionDialog}
            onOpenChange={(open) => {
              if (!open) setCreateSubscriptionDialog(null)
            }}
            onSuccess={async () => {
              setCreateSubscriptionDialog(null)
              await refreshConnection(createSubscriptionDialog.connectionId)
            }}
          />
        )
      })()}
      </div>
    </TreeRefreshProvider>
  )
}

