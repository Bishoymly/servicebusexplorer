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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMessages } from "@/hooks/useMessages"
import type { ServiceBusMessage, ServiceBusConnection } from "@/types/azure"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism"
import coy from "react-syntax-highlighter/dist/cjs/styles/prism/coy"
import { Send } from "lucide-react"

interface MessageEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMessage?: ServiceBusMessage
  queueName?: string
  topicName?: string
  connection?: ServiceBusConnection | null
  onSuccess: () => void
}

export function MessageEditor({
  open,
  onOpenChange,
  initialMessage,
  queueName,
  topicName,
  connection,
  onSuccess,
}: MessageEditorProps) {
  const { sendMessage, sendMessageToTopic, loading } = useMessages(connection)
  const [body, setBody] = useState("")
  const [bodyFormat, setBodyFormat] = useState<"text" | "json">("json")
  const [messageId, setMessageId] = useState("")
  const [contentType, setContentType] = useState("application/json")
  const [correlationId, setCorrelationId] = useState("")
  const [sessionId, setSessionId] = useState("")
  const [subject, setSubject] = useState("")
  const [customProperties, setCustomProperties] = useState<Record<string, string>>({})
  const [newPropertyKey, setNewPropertyKey] = useState("")
  const [newPropertyValue, setNewPropertyValue] = useState("")
  const [isDarkMode, setIsDarkMode] = useState(false)

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

  useEffect(() => {
    const checkTheme = () => {
      if (typeof window !== "undefined") {
        const isDark =
          document.documentElement.classList.contains("dark") ||
          window.matchMedia("(prefers-color-scheme: dark)").matches
        setIsDarkMode(isDark)
      }
    }
    checkTheme()
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => checkTheme()
    mediaQuery.addEventListener("change", handleChange)
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
      observer.disconnect()
    }
  }, [])

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
      // Try to parse JSON, but if it fails, send as string
      try {
        parsedBody = body.trim() === "" ? "" : JSON.parse(body)
      } catch (error) {
        // If JSON parsing fails, send the body as a string
        parsedBody = body
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
      alert(`Failed to send message: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => {
          // Prevent clicks inside dialog from closing it
          e.stopPropagation()
        }}
      >
        <DialogHeader>
          <DialogTitle>{initialMessage ? "Resend Message" : "Send Message"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Message Body - Main Content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Message Body</Label>
                <div className="flex items-center gap-2">
                  <Tabs value={bodyFormat} onValueChange={(v) => setBodyFormat(v as "text" | "json")}>
                    <TabsList>
                      <TabsTrigger value="text">Text</TabsTrigger>
                      <TabsTrigger value="json">JSON</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
              <textarea
                id="body"
                name="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full min-h-[300px] resize-none border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={bodyFormat === "json" ? '{\n  "key": "value"\n}' : "Enter message body"}
                spellCheck={false}
              />
            </div>

            {/* Optional Fields - Collapsed */}
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Optional Fields
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="messageId">Message ID</Label>
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
                      <Label htmlFor="correlationId">Correlation ID</Label>
                      <Input
                        id="correlationId"
                        value={correlationId}
                        onChange={(e) => setCorrelationId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sessionId">Session ID</Label>
                      <Input
                        id="sessionId"
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>
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
              </CollapsibleContent>
            </Collapsible>

          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || (!queueName && !topicName)}
            >
              {loading ? "Sending..." : initialMessage ? "Resend" : "Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

