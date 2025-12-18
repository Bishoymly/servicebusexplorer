"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Send, ChevronDown, ChevronUp } from "lucide-react"
import type { ServiceBusMessage } from "@/types/azure"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism"
import prism from "react-syntax-highlighter/dist/cjs/styles/prism/prism"

interface InlineMessageViewerProps {
  message: ServiceBusMessage
  onResend?: () => void
}

export function InlineMessageViewer({ message, onResend }: InlineMessageViewerProps) {
  const [expanded, setExpanded] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  
  // Detect theme preference
  useEffect(() => {
    const checkTheme = () => {
      if (typeof window !== "undefined") {
        // Check for dark mode class or media query
        const isDark = 
          document.documentElement.classList.contains("dark") ||
          window.matchMedia("(prefers-color-scheme: dark)").matches
        setIsDarkMode(isDark)
      }
    }
    
    checkTheme()
    
    // Listen for theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => checkTheme()
    mediaQuery.addEventListener("change", handleChange)
    
    // Also listen for class changes (if theme switcher is added later)
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
  
  const bodyString =
    typeof message.body === "string" ? message.body : JSON.stringify(message.body, null, 2)
  
  // Detect if body is JSON
  const isJSON = (() => {
    if (typeof message.body === "string") {
      try {
        JSON.parse(message.body)
        return true
      } catch {
        return false
      }
    }
    return typeof message.body === "object"
  })()
  
  // Get first 6 lines for preview (increased from 2)
  const getPreview = (text: string, maxLines: number = 6): string => {
    const lines = text.split("\n")
    if (lines.length <= maxLines) {
      return text
    }
    return lines.slice(0, maxLines).join("\n") + "\n..."
  }
  
  const preview = getPreview(bodyString, 6)
  const language = isJSON ? "json" : message.contentType?.includes("json") ? "json" : "text"
  const syntaxTheme = isDarkMode ? vscDarkPlus : prism

  const formatDate = (date: Date | undefined): string => {
    if (!date) return "-"
    const d = new Date(date)
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Preview Header */}
      <div
        className="group px-3 py-2 bg-muted/50 hover:bg-muted/70 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          {/* Main Content - Body Preview */}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-mono text-foreground whitespace-pre-wrap break-words leading-relaxed">
              {preview}
            </div>
          </div>

          {/* Side Attributes */}
          <div 
            className="flex-shrink-0 w-56 flex flex-col gap-1 text-[10px] text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {message.messageId && (
              <div className="flex items-start gap-1">
                <span className="font-medium text-[9px] uppercase tracking-wide">ID:</span>
                <span className="font-mono break-all">{message.messageId}</span>
              </div>
            )}
            {message.correlationId && (
              <div className="flex items-start gap-1">
                <span className="font-medium text-[9px] uppercase tracking-wide">Corr:</span>
                <span className="font-mono break-all">{message.correlationId}</span>
              </div>
            )}
            {message.subject && (
              <div className="flex items-start gap-1">
                <span className="font-medium text-[9px] uppercase tracking-wide">Subj:</span>
                <span className="break-all">{message.subject}</span>
              </div>
            )}
            {message.sequenceNumber !== undefined && (
              <div className="flex items-start gap-1">
                <span className="font-medium text-[9px] uppercase tracking-wide">Seq:</span>
                <span className="font-mono">{message.sequenceNumber}</span>
              </div>
            )}
            <div className="flex items-center gap-3 mt-1 pt-1 border-t border-border/50">
              {message.deliveryCount !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="font-medium text-[9px] uppercase">Del:</span>
                  <span>{message.deliveryCount}</span>
                </div>
              )}
              {message.enqueuedTimeUtc && (
                <div className="flex items-center gap-1">
                  <span className="font-medium text-[9px] uppercase">Time:</span>
                  <span className="font-mono">{formatDate(message.enqueuedTimeUtc)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Expand/Collapse Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t">
          <div className="px-4 pt-4 pb-4 space-y-6">
            {/* Message Body */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Message Body</h4>
              <div className={`rounded-md border overflow-hidden ${isDarkMode ? "bg-muted/30" : "bg-background"}`}>
                <SyntaxHighlighter
                  language={language}
                  style={syntaxTheme}
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                    background: "transparent",
                    fontSize: "0.875rem",
                    color: isDarkMode ? undefined : "hsl(var(--foreground))",
                  }}
                  wrapLines
                  codeTagProps={{
                    style: {
                      color: isDarkMode ? undefined : "hsl(var(--foreground))",
                    },
                  }}
                >
                  {bodyString}
                </SyntaxHighlighter>
              </div>
            </div>

            {/* All Properties */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Properties</h4>
              
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Property</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* System Properties */}
                    <TableRow>
                      <TableCell className="text-muted-foreground text-xs">Message ID</TableCell>
                      <TableCell className="font-mono text-xs">{message.messageId || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground text-xs">Content Type</TableCell>
                      <TableCell className="text-xs">{message.contentType || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground text-xs">Correlation ID</TableCell>
                      <TableCell className="font-mono text-xs">{message.correlationId || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground text-xs">Session ID</TableCell>
                      <TableCell className="text-xs">{message.sessionId || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground text-xs">Reply To</TableCell>
                      <TableCell className="text-xs">{message.replyTo || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground text-xs">Reply To Session ID</TableCell>
                      <TableCell className="text-xs">{message.replyToSessionId || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground text-xs">Subject</TableCell>
                      <TableCell className="text-xs">{message.subject || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground text-xs">To</TableCell>
                      <TableCell className="text-xs">{message.to || "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground text-xs">Delivery Count</TableCell>
                      <TableCell className="text-xs">{message.deliveryCount ?? "N/A"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground text-xs">Sequence Number</TableCell>
                      <TableCell className="font-mono text-xs">{message.sequenceNumber ?? "N/A"}</TableCell>
                    </TableRow>
                    {message.enqueuedTimeUtc && (
                      <TableRow>
                        <TableCell className="text-muted-foreground text-xs">Enqueued Time</TableCell>
                        <TableCell className="text-xs">{new Date(message.enqueuedTimeUtc).toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {message.lockedUntilUtc && (
                      <TableRow>
                        <TableCell className="text-muted-foreground text-xs">Locked Until</TableCell>
                        <TableCell className="text-xs">{new Date(message.lockedUntilUtc).toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                    {message.timeToLive !== undefined && (
                      <TableRow>
                        <TableCell className="text-muted-foreground text-xs">Time To Live</TableCell>
                        <TableCell className="text-xs">{message.timeToLive} ms</TableCell>
                      </TableRow>
                    )}
                    {message.deadLetterReason && (
                      <TableRow>
                        <TableCell className="text-muted-foreground text-xs">Dead Letter Reason</TableCell>
                        <TableCell className="text-destructive text-xs">{message.deadLetterReason}</TableCell>
                      </TableRow>
                    )}
                    {message.deadLetterErrorDescription && (
                      <TableRow>
                        <TableCell className="text-muted-foreground text-xs">Dead Letter Error</TableCell>
                        <TableCell className="text-destructive text-xs">{message.deadLetterErrorDescription}</TableCell>
                      </TableRow>
                    )}
                    
                    {/* Application Properties */}
                    {message.applicationProperties && Object.keys(message.applicationProperties).length > 0 && (
                      <>
                        {Object.entries(message.applicationProperties).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell className="text-muted-foreground text-xs">{key}</TableCell>
                            <TableCell className="text-xs break-all">
                              {typeof value === "string" ? value : JSON.stringify(value)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {onResend && (
            <div className="flex items-center justify-end gap-2 px-4 pb-4 border-t pt-4">
              <Button variant="outline" size="sm" onClick={onResend}>
                <Send className="h-4 w-4 mr-2" />
                Resend
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

