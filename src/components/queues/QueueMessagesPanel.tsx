"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, Trash2, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InlineMessageViewer } from "./InlineMessageViewer"
import { MessageEditor } from "@/components/messages/MessageEditor"
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
  onClose?: () => void
}

export function QueueMessagesPanel({ queueName, connection, initialShowDeadLetter = false, onClose }: QueueMessagesPanelProps) {
  const { peekMessages, peekDeadLetterMessages, loading, error } = useMessages(connection)
  const { purgeQueue, refreshQueue, getQueue } = useQueues(connection)
  const [messages, setMessages] = useState<ServiceBusMessage[]>([])
  const [maxCount, setMaxCount] = useState(100)
  const [activeTab, setActiveTab] = useState<"active" | "deadletter">(initialShowDeadLetter ? "deadletter" : "active")
  const [purging, setPurging] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [queueProperties, setQueueProperties] = useState<QueueProperties | null>(null)

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
        const msgs = await peekDeadLetterMessages(queueName, maxCount)
        setMessages(msgs)
      } else {
        // Active messages - peek regular messages
        const msgs = await peekMessages(queueName, maxCount)
        setMessages(msgs)
      }
    } catch (err) {
      console.error("Failed to load messages:", err)
    }
  }, [queueName, activeTab, maxCount, connection, peekMessages, peekDeadLetterMessages])

  // Load queue properties
  useEffect(() => {
    const loadQueueProperties = async () => {
      if (!queueName) return
      try {
        const queue = await getQueue(queueName)
        if (queue) {
          setQueueProperties(queue)
        }
      } catch (err) {
        console.error("Failed to load queue properties:", err)
      }
    }
    loadQueueProperties()
  }, [queueName, getQueue])

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
      // Refresh queue counts
      await refreshQueue(queueName)
      // Reload queue properties to update badges
      const queue = await getQueue(queueName)
      if (queue) {
        setQueueProperties(queue)
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
    // Refresh queue counts
    await refreshQueue(queueName)
    // Reload queue properties to update badges
    const queue = await getQueue(queueName)
    if (queue) {
      setQueueProperties(queue)
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
                {queueProperties?.activeMessageCount !== undefined && queueProperties.activeMessageCount > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-xs">
                    {queueProperties.activeMessageCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="deadletter" className="flex items-center gap-1.5">
                Dead Letter
                {queueProperties?.deadLetterMessageCount !== undefined && queueProperties.deadLetterMessageCount > 0 && (
                  <Badge variant="destructive" className="h-4 px-1 text-xs">
                    {queueProperties.deadLetterMessageCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 ml-auto">
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
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
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
    </div>
  )
}

