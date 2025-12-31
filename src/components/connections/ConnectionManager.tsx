"use client"

import { useState } from "react"
import { Plus, Trash2, Edit, CheckCircle2, XCircle, MessageSquare, FolderTree, Clock, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ConnectionForm } from "./ConnectionForm"
import { useConnections } from "@/hooks/useConnections"
import type { ServiceBusConnection } from "@/types/azure"
import Link from "next/link"
import { useRouter } from "next/navigation"

export function ConnectionManager() {
  const {
    connections,
    currentConnectionId,
    setCurrentConnectionId,
    addConnection,
    updateConnection,
    removeConnection,
  } = useConnections()
  const router = useRouter()
  const [formOpen, setFormOpen] = useState(false)
  const [editingConnection, setEditingConnection] = useState<ServiceBusConnection | undefined>()
  const [testingConnection, setTestingConnection] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<Record<string, boolean>>({})

  const handleNavigateToQueues = (connection: ServiceBusConnection) => {
    const encodedName = encodeURIComponent(connection.name)
    router.push(`/${encodedName}/queues`)
  }

  const handleNavigateToTopics = (connection: ServiceBusConnection) => {
    const encodedName = encodeURIComponent(connection.name)
    router.push(`/${encodedName}/topics`)
  }

  const handleAdd = () => {
    setEditingConnection(undefined)
    setFormOpen(true)
  }

  const handleEdit = (connection: ServiceBusConnection) => {
    setEditingConnection(connection)
    setFormOpen(true)
  }

  const handleSubmit = async (data: Omit<ServiceBusConnection, "id" | "createdAt" | "updatedAt">) => {
    if (editingConnection) {
      await updateConnection(editingConnection.id, data)
    } else {
      const newConnection: ServiceBusConnection = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await addConnection(newConnection)
    }
    setFormOpen(false)
    setEditingConnection(undefined)
  }

  const handleTest = async (connection: ServiceBusConnection) => {
    setTestingConnection(connection.id)
    try {
      const response = await fetch("/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection }),
      })
      const data = await response.json()
      setConnectionStatus((prev) => ({ ...prev, [connection.id]: data.valid }))
    } catch (error) {
      setConnectionStatus((prev) => ({ ...prev, [connection.id]: false }))
    } finally {
      setTestingConnection(null)
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Connections</h2>
            <p className="text-sm text-muted-foreground">Manage your Azure Service Bus connections</p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Connection
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {connections.map((connection) => (
          <Card
            key={connection.id}
            className={`cursor-pointer transition-colors ${
              currentConnectionId === connection.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setCurrentConnectionId(connection.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-lg truncate">{connection.name}</CardTitle>
                    {currentConnectionId === connection.id && (
                      <Badge variant="default" className="text-xs">Active</Badge>
                    )}
                    {connection.useAzureAD && (
                      <Badge variant="outline" className="text-xs">Azure AD</Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1 flex items-center gap-1.5">
                    <Database className="h-3 w-3" />
                    <span className="truncate">
                      {connection.useAzureAD
                        ? connection.namespace || "Azure AD"
                        : "Connection String"}
                    </span>
                  </CardDescription>
                  {connection.createdAt && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Created {new Date(connection.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
                <div className="ml-2 flex-shrink-0">
                  {connectionStatus[connection.id] !== undefined ? (
                    connectionStatus[connection.id] ? (
                      <div title="Connection tested successfully">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      </div>
                    ) : (
                      <div title="Connection test failed">
                        <XCircle className="h-5 w-5 text-red-500" />
                      </div>
                    )
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" title="Not tested" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-white hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNavigateToQueues(connection)
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Queues
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-white hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNavigateToTopics(connection)
                    }}
                  >
                    <FolderTree className="h-4 w-4 mr-2" />
                    Topics
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleTest(connection)
                    }}
                    disabled={testingConnection === connection.id}
                  >
                    {testingConnection === connection.id ? "Testing..." : "Test"}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEdit(connection)
                    }}
                    title="Edit connection"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm("Are you sure you want to delete this connection?")) {
                        removeConnection(connection.id)
                      }
                    }}
                    title="Delete connection"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        </div>

        {connections.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No connections yet</p>
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Connection
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <ConnectionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        initialData={editingConnection}
      />
    </div>
  )
}

