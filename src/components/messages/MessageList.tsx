"use client"

import { useState, useEffect } from "react"
import { RefreshCw, Send, Eye, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MessageTable } from "./MessageTable"
import { MessageViewer } from "./MessageViewer"
import { MessageEditor } from "./MessageEditor"
import { useMessages } from "@/hooks/useMessages"
import { useQueues } from "@/hooks/useQueues"
import { useTopics } from "@/hooks/useTopics"
import type { ServiceBusMessage } from "@/types/azure"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface MessageListProps {
  queueName?: string
  topicName?: string
  subscriptionName?: string
}

export function MessageList({ queueName, topicName, subscriptionName }: MessageListProps) {
  const { peekMessages, peekMessagesFromSubscription, peekDeadLetterMessages, loading, error } = useMessages()
  const { queues } = useQueues()
  const { topics, listSubscriptions } = useTopics()
  const [messages, setMessages] = useState<ServiceBusMessage[]>([])
  const [selectedMessage, setSelectedMessage] = useState<ServiceBusMessage | null>(null)
  const [showViewer, setShowViewer] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [maxCount, setMaxCount] = useState(100)
  const [selectedQueue, setSelectedQueue] = useState(queueName || "")
  const [selectedTopic, setSelectedTopic] = useState(topicName || "")
  const [selectedSubscription, setSelectedSubscription] = useState(subscriptionName || "")
  const [topicSubscriptions, setTopicSubscriptions] = useState<string[]>([])

  useEffect(() => {
    if (selectedTopic) {
      listSubscriptions(selectedTopic)
        .then((subs) => {
          setTopicSubscriptions(subs.map((s) => s.subscriptionName))
        })
        .catch(() => {
          setTopicSubscriptions([])
        })
    } else {
      setTopicSubscriptions([])
    }
  }, [selectedTopic, listSubscriptions])

  const loadMessages = async () => {
    setMessages([]) // Clear for progressive loading
    if (selectedQueue) {
      const msgs = await peekMessages(selectedQueue, maxCount)
      // Progressive rendering for large message lists
      const batchSize = 50
      const seen = new Set<string>()
      
      for (let i = 0; i < msgs.length; i += batchSize) {
        const batch = msgs.slice(i, i + batchSize)
        // Filter duplicates by messageId or sequenceNumber
        const uniqueBatch = batch.filter((msg) => {
          const key = msg.messageId || `seq-${msg.sequenceNumber}` || `idx-${i}`
          if (seen.has(key)) {
            return false
          }
          seen.add(key)
          return true
        })
        
        if (uniqueBatch.length > 0) {
          setMessages((prev) => {
            const existingKeys = new Set(
              prev.map((m) => m.messageId || `seq-${m.sequenceNumber}` || `idx-${prev.indexOf(m)}`)
            )
            const newMessages = uniqueBatch.filter(
              (m) => !existingKeys.has(m.messageId || `seq-${m.sequenceNumber}` || "")
            )
            return [...prev, ...newMessages]
          })
        }
        
        if (i + batchSize < msgs.length) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      }
    } else if (selectedTopic && selectedSubscription) {
      const msgs = await peekMessagesFromSubscription(selectedTopic, selectedSubscription, maxCount)
      // Progressive rendering
      const batchSize = 50
      const seen = new Set<string>()
      
      for (let i = 0; i < msgs.length; i += batchSize) {
        const batch = msgs.slice(i, i + batchSize)
        // Filter duplicates
        const uniqueBatch = batch.filter((msg) => {
          const key = msg.messageId || `seq-${msg.sequenceNumber}` || `idx-${i}`
          if (seen.has(key)) {
            return false
          }
          seen.add(key)
          return true
        })
        
        if (uniqueBatch.length > 0) {
          setMessages((prev) => {
            const existingKeys = new Set(
              prev.map((m) => m.messageId || `seq-${m.sequenceNumber}` || `idx-${prev.indexOf(m)}`)
            )
            const newMessages = uniqueBatch.filter(
              (m) => !existingKeys.has(m.messageId || `seq-${m.sequenceNumber}` || "")
            )
            return [...prev, ...newMessages]
          })
        }
        
        if (i + batchSize < msgs.length) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      }
    }
  }

  const loadDeadLetterMessages = async () => {
    setMessages([]) // Clear for progressive loading
    if (selectedQueue) {
      const msgs = await peekDeadLetterMessages(selectedQueue, maxCount)
      // Progressive rendering
      const batchSize = 50
      const seen = new Set<string>()
      
      for (let i = 0; i < msgs.length; i += batchSize) {
        const batch = msgs.slice(i, i + batchSize)
        // Filter duplicates
        const uniqueBatch = batch.filter((msg) => {
          const key = msg.messageId || `seq-${msg.sequenceNumber}` || `idx-${i}`
          if (seen.has(key)) {
            return false
          }
          seen.add(key)
          return true
        })
        
        if (uniqueBatch.length > 0) {
          setMessages((prev) => {
            const existingKeys = new Set(
              prev.map((m) => m.messageId || `seq-${m.sequenceNumber}` || `idx-${prev.indexOf(m)}`)
            )
            const newMessages = uniqueBatch.filter(
              (m) => !existingKeys.has(m.messageId || `seq-${m.sequenceNumber}` || "")
            )
            return [...prev, ...newMessages]
          })
        }
        
        if (i + batchSize < msgs.length) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      }
    }
  }

  const handleMessageClick = (message: ServiceBusMessage) => {
    setSelectedMessage(message)
    setShowViewer(true)
  }

  const handleResend = (message: ServiceBusMessage) => {
    setSelectedMessage(message)
    setShowEditor(true)
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Messages</h2>
            <p className="text-sm text-muted-foreground">Browse and manage Service Bus messages</p>
          </div>
          <Button onClick={() => setShowEditor(true)}>
            <Send className="h-4 w-4 mr-2" />
            Send Message
          </Button>
        </div>

        <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Queue</Label>
            <Select value={selectedQueue} onValueChange={(value) => {
              setSelectedQueue(value)
              setSelectedTopic("")
              setSelectedSubscription("")
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a queue" />
              </SelectTrigger>
              <SelectContent>
                {queues.map((q) => (
                  <SelectItem key={q.name} value={q.name}>
                    {q.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Topic</Label>
            <Select value={selectedTopic} onValueChange={(value) => {
              setSelectedTopic(value)
              setSelectedQueue("")
              setSelectedSubscription("")
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a topic" />
              </SelectTrigger>
              <SelectContent>
                {topics.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedTopic && (
          <div className="space-y-2">
            <Label>Subscription</Label>
            <Select value={selectedSubscription} onValueChange={setSelectedSubscription}>
              <SelectTrigger>
                <SelectValue placeholder="Select a subscription" />
              </SelectTrigger>
              <SelectContent>
                {topicSubscriptions.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    {sub}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedQueue && (
          <>
            <div className="flex items-center gap-4">
              <div className="space-y-2 flex-1">
                <Label>Max Count</Label>
                <Input
                  type="number"
                  value={maxCount}
                  onChange={(e) => setMaxCount(parseInt(e.target.value) || 100)}
                  min={1}
                  max={1000}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={loadMessages} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Load Messages
              </Button>
              <Button variant="outline" onClick={loadDeadLetterMessages} disabled={loading}>
                <Eye className="h-4 w-4 mr-2" />
                Load Dead Letters
              </Button>
            </div>
          </>
        )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Messages Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && !loading ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No messages found. Load messages to get started.</p>
          </div>
        ) : messages.length > 0 ? (
          <>
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
              <span>{messages.length} message{messages.length !== 1 ? "s" : ""} loaded</span>
              {loading && (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading more...</span>
                </div>
              )}
            </div>
            <MessageTable
              messages={messages}
              onMessageClick={handleMessageClick}
              onResend={handleResend}
            />
          </>
        ) : null}
      </div>

      {selectedMessage && (
        <>
          <MessageViewer
            message={selectedMessage}
            open={showViewer}
            onOpenChange={setShowViewer}
            onResend={() => {
              setShowViewer(false)
              handleResend(selectedMessage)
            }}
          />
          <MessageEditor
            open={showEditor}
            onOpenChange={setShowEditor}
            initialMessage={selectedMessage}
            queueName={selectedQueue}
            topicName={selectedTopic}
            onSuccess={() => {
              setShowEditor(false)
              loadMessages()
            }}
          />
        </>
      )}

      {showEditor && !selectedMessage && (
        <MessageEditor
          open={showEditor}
          onOpenChange={setShowEditor}
          queueName={selectedQueue}
          topicName={selectedTopic}
          onSuccess={() => {
            setShowEditor(false)
            loadMessages()
          }}
        />
      )}
    </div>
  )
}

