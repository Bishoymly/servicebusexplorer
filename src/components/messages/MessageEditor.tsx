"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useMessages } from "@/hooks/useMessages"
import type { ServiceBusMessage } from "@/types/azure"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface MessageEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMessage?: ServiceBusMessage
  queueName?: string
  topicName?: string
  onSuccess: () => void
}

export function MessageEditor({
  open,
  onOpenChange,
  initialMessage,
  queueName,
  topicName,
  onSuccess,
}: MessageEditorProps) {
  const { sendMessage, sendMessageToTopic, loading } = useMessages()
  const [body, setBody] = useState("")
  const [bodyFormat, setBodyFormat] = useState<"text" | "json">("text")
  const [messageId, setMessageId] = useState("")
  const [contentType, setContentType] = useState("application/json")
  const [correlationId, setCorrelationId] = useState("")
  const [sessionId, setSessionId] = useState("")
  const [subject, setSubject] = useState("")
  const [customProperties, setCustomProperties] = useState<Record<string, string>>({})
  const [newPropertyKey, setNewPropertyKey] = useState("")
  const [newPropertyValue, setNewPropertyValue] = useState("")

  useEffect(() => {
    if (initialMessage) {
      setBody(
        typeof initialMessage.body === "string"
          ? initialMessage.body
          : JSON.stringify(initialMessage.body, null, 2)
      )
      setBodyFormat(typeof initialMessage.body === "string" ? "text" : "json")
      setMessageId(initialMessage.messageId || "")
      setContentType(initialMessage.contentType || "application/json")
      setCorrelationId(initialMessage.correlationId || "")
      setSessionId(initialMessage.sessionId || "")
      setSubject(initialMessage.subject || "")
      setCustomProperties(initialMessage.applicationProperties || {})
    } else {
      setBody("")
      setBodyFormat("json")
      setMessageId("")
      setContentType("application/json")
      setCorrelationId("")
      setSessionId("")
      setSubject("")
      setCustomProperties({})
    }
  }, [initialMessage, open])

  const handleAddProperty = () => {
    if (newPropertyKey && newPropertyValue) {
      setCustomProperties((prev) => ({ ...prev, [newPropertyKey]: newPropertyValue }))
      setNewPropertyKey("")
      setNewPropertyValue("")
    }
  }

  const handleRemoveProperty = (key: string) => {
    setCustomProperties((prev) => {
      const updated = { ...prev }
      delete updated[key]
      return updated
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let parsedBody: any = body
    if (bodyFormat === "json") {
      try {
        parsedBody = JSON.parse(body)
      } catch (error) {
        alert("Invalid JSON in body")
        return
      }
    }

    const message: ServiceBusMessage = {
      body: parsedBody,
      messageId: messageId || undefined,
      contentType: contentType || undefined,
      correlationId: correlationId || undefined,
      sessionId: sessionId || undefined,
      subject: subject || undefined,
      applicationProperties: Object.keys(customProperties).length > 0 ? customProperties : undefined,
    }

    try {
      if (queueName) {
        await sendMessage(queueName, message)
      } else if (topicName) {
        await sendMessageToTopic(topicName, message)
      } else {
        alert("Please select a queue or topic")
        return
      }
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to send message:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialMessage ? "Resend Message" : "Send Message"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="messageId">Message ID (optional)</Label>
                <Input
                  id="messageId"
                  value={messageId}
                  onChange={(e) => setMessageId(e.target.value)}
                  placeholder="Auto-generated if empty"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contentType">Content Type</Label>
                <Input
                  id="contentType"
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  placeholder="application/json"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="correlationId">Correlation ID (optional)</Label>
                <Input
                  id="correlationId"
                  value={correlationId}
                  onChange={(e) => setCorrelationId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sessionId">Session ID (optional)</Label>
                <Input
                  id="sessionId"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="subject">Subject (optional)</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Message Body</Label>
                <Tabs value={bodyFormat} onValueChange={(v) => setBodyFormat(v as "text" | "json")}>
                  <TabsList>
                    <TabsTrigger value="text">Text</TabsTrigger>
                    <TabsTrigger value="json">JSON</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                placeholder={bodyFormat === "json" ? '{"key": "value"}' : "Enter message body"}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Custom Properties</Label>
              <div className="space-y-2">
                {Object.entries(customProperties).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Input value={key} disabled className="flex-1" />
                    <Input value={value} disabled className="flex-1" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveProperty(key)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Property key"
                    value={newPropertyKey}
                    onChange={(e) => setNewPropertyKey(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Property value"
                    value={newPropertyValue}
                    onChange={(e) => setNewPropertyValue(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleAddProperty}>
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || (!queueName && !topicName)}>
              {loading ? "Sending..." : initialMessage ? "Resend" : "Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

