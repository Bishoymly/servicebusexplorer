"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InlineMessageViewer } from "@/components/queues/InlineMessageViewer"
import { MessageEditor } from "@/components/messages/MessageEditor"
import { useMessages } from "@/hooks/useMessages"
import type { ServiceBusMessage, ServiceBusConnection } from "@/types/azure"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface SubscriptionMessagesPanelProps {
  topicName: string
  subscriptionName: string
  connection: ServiceBusConnection
  initialShowDeadLetter?: boolean
  onClose?: () => void
}

export function SubscriptionMessagesPanel({ 
  topicName, 
  subscriptionName, 
  connection, 
  initialShowDeadLetter = false, 
  onClose 
}: SubscriptionMessagesPanelProps) {
  const { peekMessagesFromSubscription, peekDeadLetterMessages, loading, error } = useMessages(connection)
  const [messages, setMessages] = useState<ServiceBusMessage[]>([])
  const [maxCount, setMaxCount] = useState(100)
  const [activeTab, setActiveTab] = useState<"active" | "deadletter">(initialShowDeadLetter ? "deadletter" : "active")
  const [showSendDialog, setShowSendDialog] = useState(false)

  // Update activeTab when initialShowDeadLetter prop changes
  useEffect(() => {
    setActiveTab(initialShowDeadLetter ? "deadletter" : "active")
  }, [initialShowDeadLetter])

  const loadMessages = useCallback(async () => {
    if (!connection || !topicName || !subscriptionName) {
      return
    }
    
    setMessages([])
    try {
      if (activeTab === "deadletter") {
        const msgs = await peekDeadLetterMessages(topicName, subscriptionName, maxCount)
        setMessages(msgs)
      } else {
        const msgs = await peekMessagesFromSubscription(topicName, subscriptionName, maxCount)
        setMessages(msgs)
      }
    } catch (err) {
      console.error("Failed to load messages:", err)
    }
  }, [topicName, subscriptionName, activeTab, maxCount, connection, peekMessagesFromSubscription, peekDeadLetterMessages])

  // Load messages when topicName, subscriptionName, activeTab, maxCount, or connection changes
  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  const handleResend = (message: ServiceBusMessage) => {
    // Open message editor with the message data
    setShowSendDialog(true)
  }

  const handleSendSuccess = () => {
    loadMessages()
  }

  return (
    <div className="h-full flex flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{subscriptionName}</h2>
          <span className="text-sm text-muted-foreground">({topicName})</span>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="maxCount" className="text-sm">Max Messages</Label>
            <Input
              id="maxCount"
              type="number"
              min="1"
              max="1000"
              value={maxCount}
              onChange={(e) => setMaxCount(Math.max(1, parseInt(e.target.value) || 100))}
              className="w-24"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMessages}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowSendDialog(true)}
          >
            <Send className="h-4 w-4 mr-2" />
            Send Message
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "deadletter")}>
          <TabsList>
            <TabsTrigger value="active" className="flex items-center gap-1.5">
              Active
              {messages.length > 0 && activeTab === "active" && (
                <Badge variant="secondary" className="ml-1">
                  {messages.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="deadletter" className="flex items-center gap-1.5">
              Dead Letter
              {messages.length > 0 && activeTab === "deadletter" && (
                <Badge variant="destructive" className="ml-1">
                  {messages.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
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
        topicName={topicName}
        connection={connection}
        onSuccess={handleSendSuccess}
      />
    </div>
  )
}
