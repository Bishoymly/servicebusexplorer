"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Search } from "lucide-react"
import { useRouter, usePathname } from "next/navigation"
import { useConnections } from "@/hooks/useConnections"
import { useTreeData } from "@/hooks/useTreeData"
import { Tree, type TreeNode } from "@/components/ui/tree"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConnectionForm } from "@/components/connections/ConnectionForm"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { useSelectedResource } from "@/contexts/SelectedResourceContext"
import type { ServiceBusConnection } from "@/types/azure"

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { connections, addConnection, removeConnection } = useConnections()
  const { selectedResource, setSelectedResource } = useSelectedResource()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [connectionToDelete, setConnectionToDelete] = useState<{ id: string; name: string } | null>(null)
  
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
  
  const handleConfirmDelete = () => {
    if (connectionToDelete) {
      removeConnection(connectionToDelete.id)
      handleConnectionRemoved(connectionToDelete.id)
      setDeleteDialogOpen(false)
      setConnectionToDelete(null)
    }
  }
  
  const { treeNodes } = useTreeData(handleConnectionRemoved, handleDeleteRequest)
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
    } else if (type === "topic" && connection && topic) {
      const encodedName = encodeURIComponent(connection.name)
      router.push(`/${encodedName}/topics`)
    } else if (type === "subscription" && connection && topic && subscription) {
      const encodedName = encodeURIComponent(connection.name)
      router.push(`/${encodedName}/topics`)
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
    const { type, connection, queue, subscription } = node.data || {}
    
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
    } else if (badgeType === "deadletter" && type === "subscription" && connection && subscription) {
      // Handle subscription dead letter click if needed in the future
      // For now, subscriptions don't have a separate dead letter view
    }
  }

  const handleAddConnection = (data: Omit<ServiceBusConnection, "id" | "createdAt" | "updatedAt">) => {
    addConnection({
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    setFormOpen(false)
  }

  // Auto-expand connections by default and when new connections are added
  const previousConnectionsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const currentConnectionIds = new Set(connections.map(c => c.id))
    
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
    <div className="flex h-full w-96 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-4">
        <h1 className="text-lg font-semibold">Service Bus Explorer</h1>
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
    </div>
  )
}

