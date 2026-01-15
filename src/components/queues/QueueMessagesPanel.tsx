"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, Trash2, Send, X, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InlineMessageViewer } from "./InlineMessageViewer"
import { MessageEditor } from "@/components/messages/MessageEditor"
import { QueueSettingsForm } from "./QueueSettingsForm"
import { useMessages } from "@/hooks/useMessages"
import { useQueues } from "@/hooks/useQueues"
import type { ServiceBusMessage, ServiceBusConnection, QueueProperties } from "@/types/azure"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

interface QueueMessagesPanelProps {
  queueName: string
  connection: ServiceBusConnection
  initialShowDeadLetter?: boolean
  initialQueueProperties?: QueueProperties
  onClose?: () => void
  onQueueDeleted?: () => void
  onQueueUpdated?: () => void
}

export function QueueMessagesPanel({ queueName, connection, initialShowDeadLetter = false, initialQueueProperties, onClose, onQueueDeleted, onQueueUpdated }: QueueMessagesPanelProps) {
  const { peekMessages, peekDeadLetterMessages, loading, error } = useMessages(connection)
  const { purgeQueue, refreshQueue, getQueue } = useQueues(connection)
  const [messages, setMessages] = useState<ServiceBusMessage[]>([])
  const [maxCount, setMaxCount] = useState(100)
  const [activeTab, setActiveTab] = useState<"active" | "deadletter">(initialShowDeadLetter ? "deadletter" : "active")
  // Initialize with provided queue properties, or null if not provided
  const [queueProperties, setQueueProperties] = useState<QueueProperties | null>(initialQueueProperties || null)
  const [purging, setPurging] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)

  // Update activeTab when initialShowDeadLetter prop changes
  useEffect(() => {
    setActiveTab(initialShowDeadLetter ? "deadletter" : "active")
  }, [initialShowDeadLetter])

  const loadMessages = useCallback(async () => {
    // Don't load if connection is not ready
    if (!connection || !queueName) {
      return
    }
    
    setMessages([])
    try {
      if (activeTab === "deadletter") {
        const msgs = await peekDeadLetterMessages(queueName, undefined, maxCount)
        setMessages(msgs)
      } else {
        // Active messages - peek regular messages
        const msgs = await peekMessages(queueName, maxCount)
        setMessages(msgs)
      }
      // Don't refresh queue properties here - only update when messages are actually changed (send/receive/purge)
    } catch (err) {
      console.error("Failed to load messages:", err)
    }
  }, [queueName, activeTab, maxCount, connection, peekMessages, peekDeadLetterMessages])

  // Update queue properties when initialQueueProperties prop changes or queueName changes
  useEffect(() => {
    console.log("QueueMessagesPanel useEffect:", {
      queueName,
      hasInitialQueueProperties: !!initialQueueProperties,
      initialQueuePropertiesName: initialQueueProperties?.name,
      initialActiveCount: initialQueueProperties?.activeMessageCount,
      initialDeadLetterCount: initialQueueProperties?.deadLetterMessageCount
    })
    
    // Always prefer initialQueueProperties if it exists and has the counts, regardless of name match
    // This ensures we use the counts from the queue list
    if (initialQueueProperties) {
      // Use provided properties from the queue list
      console.log("Setting queue properties from initialQueueProperties:", {
        name: initialQueueProperties.name,
        activeMessageCount: initialQueueProperties.activeMessageCount,
        deadLetterMessageCount: initialQueueProperties.deadLetterMessageCount
      })
      setQueueProperties(initialQueueProperties)
    } else {
      // Fallback: load properties if not provided
      const loadQueueProperties = async () => {
        if (!queueName) return
        try {
          const queue = await getQueue(queueName)
          if (queue) {
            console.log("Setting queue properties from getQueue:", {
              name: queue.name,
              activeMessageCount: queue.activeMessageCount,
              deadLetterMessageCount: queue.deadLetterMessageCount
            })
            setQueueProperties(queue)
          }
        } catch (err) {
          console.error("Failed to load queue properties:", err)
        }
      }
      loadQueueProperties()
    }
  }, [queueName, getQueue, initialQueueProperties])

  // Load messages when queueName, activeTab, maxCount, or connection changes
  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  const handleResend = async (message: ServiceBusMessage) => {
    // TODO: Implement resend functionality
    console.log("Resend message:", message)
  }

  const handlePurge = async () => {
    const confirmMessage = activeTab === "deadletter"
      ? `Are you sure you want to purge all dead letter messages from "${queueName}"? This action cannot be undone.`
      : `Are you sure you want to purge all messages from "${queueName}"? This action cannot be undone.`
    
    if (!confirm(confirmMessage)) {
      return
    }

    setPurging(true)
    try {
      const purgedCount = await purgeQueue(queueName, activeTab === "deadletter")
      alert(`Successfully purged ${purgedCount} message${purgedCount !== 1 ? "s" : ""} from ${queueName}`)
      // Reload messages after purge
      await loadMessages()
      // Refresh queue counts - this will update the queues list
      await refreshQueue(queueName)
      // Reload queue properties to update badges with fresh counts
      const queue = await getQueue(queueName)
      if (queue) {
        setQueueProperties(queue)
      }
      // Notify parent to refresh the queue list
      if (onQueueUpdated) {
        onQueueUpdated()
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      alert(`Failed to purge queue: ${errorMessage}`)
    } finally {
      setPurging(false)
    }
  }

  const handleSendSuccess = async () => {
    // Reload messages after sending
    await loadMessages()
    // Refresh queue counts - this will update the queues list
    await refreshQueue(queueName)
    // Reload queue properties to update badges with fresh counts
    const queue = await getQueue(queueName)
    if (queue) {
      setQueueProperties(queue)
    }
    // Notify parent to refresh the queue list
    if (onQueueUpdated) {
      onQueueUpdated()
    }
  }

  const handleEditSuccess = async () => {
    // Reload queue properties after editing
    const queue = await getQueue(queueName)
    if (queue) {
      setQueueProperties(queue)
    }
    setShowEditDialog(false)
    // Refresh tree view
    if (onQueueUpdated) {
      onQueueUpdated()
    }
  }

  const handleQueueDeleted = () => {
    // Close the panel when queue is deleted
    if (onClose) {
      onClose()
    }
    // Refresh tree view
    if (onQueueDeleted) {
      onQueueDeleted()
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">{queueName}</h3>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={(v) => {
            if (v === "active" || v === "deadletter") {
              setActiveTab(v)
            }
          }}>
            <TabsList>
              <TabsTrigger value="active" className="flex items-center gap-1.5">
                Active
                {(() => {
                  const count = queueProperties?.activeMessageCount
                  console.log("Rendering Active tab badge:", { count, queueProperties: queueProperties ? { name: queueProperties.name, activeMessageCount: queueProperties.activeMessageCount } : null })
                  return count !== undefined && count > 0 ? (
                    <Badge variant="secondary" className="h-4 px-1.5 text-xs min-w-[1.5rem] flex items-center justify-center">
                      {count}
                    </Badge>
                  ) : null
                })()}
              </TabsTrigger>
              <TabsTrigger value="deadletter" className="flex items-center gap-1.5">
                Dead Letter
                {(() => {
                  const count = queueProperties?.deadLetterMessageCount
                  console.log("Rendering Dead Letter tab badge:", { count, queueProperties: queueProperties ? { name: queueProperties.name, deadLetterMessageCount: queueProperties.deadLetterMessageCount } : null })
                  return count !== undefined && count > 0 ? (
                    <Badge variant="destructive" className="h-4 px-1.5 text-xs min-w-[1.5rem] flex items-center justify-center">
                      {count}
                    </Badge>
                  ) : null
                })()}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
              disabled={!queueProperties}
            >
              <Settings className="h-4 w-4 mr-2" />
              Edit Queue
            </Button>
            {activeTab === "active" && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowSendDialog(true)}
                disabled={loading}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handlePurge}
              disabled={purging || loading}
            >
              <Trash2 className={`h-4 w-4 mr-2 ${purging ? "animate-spin" : ""}`} />
              Purge {activeTab === "deadletter" ? "Dead Letter" : "Queue"}
            </Button>
            <Label htmlFor="maxCount" className="text-xs text-muted-foreground">
              Max:
            </Label>
            <Input
              id="maxCount"
              type="number"
              value={maxCount}
              onChange={(e) => setMaxCount(parseInt(e.target.value) || 100)}
              className="w-20 h-8 text-xs"
              min={1}
              max={1000}
            />
            <Button variant="outline" size="sm" onClick={loadMessages} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="px-4 pt-2">
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No messages found.</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <InlineMessageViewer
              key={message.messageId || `msg-${index}`}
              message={message}
              onResend={() => handleResend(message)}
            />
          ))
        )}
      </div>

      {/* Send Message Dialog */}
      <MessageEditor
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        queueName={queueName}
        connection={connection}
        onSuccess={handleSendSuccess}
      />

      {/* Edit Queue Dialog */}
      {queueProperties && (
        <QueueSettingsForm
          queue={queueProperties}
          connection={connection}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSuccess={handleEditSuccess}
          onDelete={handleQueueDeleted}
        />
      )}
    </div>
  )
}

