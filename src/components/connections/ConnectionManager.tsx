"use client"

import { useState } from "react"
import { Plus, Trash2, Edit, CheckCircle2, XCircle, MessageSquare, FolderTree } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

  const handleSubmit = (data: Omit<ServiceBusConnection, "id" | "createdAt" | "updatedAt">) => {
    if (editingConnection) {
      updateConnection(editingConnection.id, data)
    } else {
      const newConnection: ServiceBusConnection = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      addConnection(newConnection)
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
                <div className="flex-1">
                  <CardTitle className="text-lg">{connection.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {connection.useAzureAD
                      ? `Namespace: ${connection.namespace}`
                      : "Connection String"}
                  </CardDescription>
                </div>
                {connectionStatus[connection.id] !== undefined && (
                  <div className="ml-2">
                    {connectionStatus[connection.id] ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNavigateToQueues(connection)
                    }}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Queues
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
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
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEdit(connection)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm("Are you sure you want to delete this connection?")) {
                        removeConnection(connection.id)
                      }
                    }}
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

