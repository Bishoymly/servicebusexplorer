"use client"

import { useState, useEffect } from "react"
import { RefreshCw, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { InlineMessageViewer } from "./InlineMessageViewer"
import { useMessages } from "@/hooks/useMessages"
import { useConnections } from "@/hooks/useConnections"
import type { ServiceBusMessage } from "@/types/azure"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface QueueMessagesPanelProps {
  queueName: string
  onClose?: () => void
}

export function QueueMessagesPanel({ queueName, onClose }: QueueMessagesPanelProps) {
  const { peekMessages, peekDeadLetterMessages, receiveMessages, loading, error } = useMessages()
  const [messages, setMessages] = useState<ServiceBusMessage[]>([])
  const [mode, setMode] = useState<"peek" | "receive">("peek")
  const [maxCount, setMaxCount] = useState(100)
  const [showDeadLetter, setShowDeadLetter] = useState(false)

  const loadMessages = async () => {
    setMessages([])
    try {
      if (showDeadLetter) {
        const msgs = await peekDeadLetterMessages(queueName, maxCount)
        setMessages(msgs)
      } else if (mode === "peek") {
        const msgs = await peekMessages(queueName, maxCount)
        setMessages(msgs)
      } else {
        const msgs = await receiveMessages(queueName, maxCount)
        setMessages(msgs)
      }
    } catch (err) {
      console.error("Failed to load messages:", err)
    }
  }

  const { currentConnection, currentConnectionId } = useConnections()

  useEffect(() => {
    if (queueName) {
      loadMessages()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueName, mode, showDeadLetter])

  // Reload messages when connection changes
  useEffect(() => {
    if (queueName && currentConnection) {
      loadMessages()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConnectionId])

  const handleResend = async (message: ServiceBusMessage) => {
    // TODO: Implement resend functionality
    console.log("Resend message:", message)
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
          <Tabs value={showDeadLetter ? "deadletter" : mode} onValueChange={(v) => {
            if (v === "deadletter") {
              setShowDeadLetter(true)
              setMode("peek")
            } else {
              setShowDeadLetter(false)
              setMode(v as "peek" | "receive")
            }
          }}>
            <TabsList>
              <TabsTrigger value="peek">Peek</TabsTrigger>
              <TabsTrigger value="receive">Receive</TabsTrigger>
              <TabsTrigger value="deadletter">Dead Letter</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 ml-auto">
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
    </div>
  )
}

