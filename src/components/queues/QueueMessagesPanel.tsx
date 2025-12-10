"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, Trash2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { InlineMessageViewer } from "./InlineMessageViewer"
import { MessageEditor } from "@/components/messages/MessageEditor"
import { useMessages } from "@/hooks/useMessages"
import { useConnections } from "@/hooks/useConnections"
import { useQueues } from "@/hooks/useQueues"
import type { ServiceBusMessage } from "@/types/azure"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface QueueMessagesPanelProps {
  queueName: string
  initialShowDeadLetter?: boolean
  onClose?: () => void
}

export function QueueMessagesPanel({ queueName, initialShowDeadLetter = false, onClose }: QueueMessagesPanelProps) {
  const { peekMessages, peekDeadLetterMessages, loading, error } = useMessages()
  const { currentConnection, currentConnectionId, loading: connectionsLoading } = useConnections()
  const { purgeQueue, refreshQueue } = useQueues()
  const [messages, setMessages] = useState<ServiceBusMessage[]>([])
  const [maxCount, setMaxCount] = useState(100)
  const [showDeadLetter, setShowDeadLetter] = useState(initialShowDeadLetter)
  const [purging, setPurging] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)

  // Update showDeadLetter when initialShowDeadLetter prop changes
  useEffect(() => {
    setShowDeadLetter(initialShowDeadLetter)
  }, [initialShowDeadLetter])

  const loadMessages = useCallback(async () => {
    // Don't load if connection is not ready
    if (!currentConnection || connectionsLoading || !queueName) {
      return
    }
    
    setMessages([])
    try {
      if (showDeadLetter) {
        const msgs = await peekDeadLetterMessages(queueName, maxCount)
        setMessages(msgs)
      } else {
        const msgs = await peekMessages(queueName, maxCount)
        setMessages(msgs)
      }
    } catch (err) {
      console.error("Failed to load messages:", err)
    }
  }, [queueName, showDeadLetter, maxCount, currentConnection, connectionsLoading, peekMessages, peekDeadLetterMessages])

  // Load messages when queueName, showDeadLetter, maxCount, or connection changes
  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  const handleResend = async (message: ServiceBusMessage) => {
    // TODO: Implement resend functionality
    console.log("Resend message:", message)
  }

  const handlePurge = async () => {
    const confirmMessage = showDeadLetter
      ? `Are you sure you want to purge all dead letter messages from "${queueName}"? This action cannot be undone.`
      : `Are you sure you want to purge all messages from "${queueName}"? This action cannot be undone.`
    
    if (!confirm(confirmMessage)) {
      return
    }

    setPurging(true)
    try {
      const purgedCount = await purgeQueue(queueName, showDeadLetter)
      alert(`Successfully purged ${purgedCount} message${purgedCount !== 1 ? "s" : ""} from ${queueName}`)
      // Reload messages after purge
      await loadMessages()
      // Refresh queue counts
      await refreshQueue(queueName)
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
  }

  return (
    <div className="h-full flex flex-col border-l bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg">{queueName}</h3>
            <p className="text-sm text-muted-foreground">
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              ×
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={showDeadLetter ? "deadletter" : "peek"} onValueChange={(v) => {
            if (v === "deadletter") {
              setShowDeadLetter(true)
            } else {
              setShowDeadLetter(false)
            }
          }}>
            <TabsList>
              <TabsTrigger value="peek">Peek</TabsTrigger>
              <TabsTrigger value="deadletter">Dead Letter</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 ml-auto">
            {!showDeadLetter && (
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
              Purge {showDeadLetter ? "Dead Letter" : "Queue"}
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
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
        onSuccess={handleSendSuccess}
      />
    </div>
  )
}

