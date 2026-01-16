"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Send, ChevronDown, ChevronUp, Copy, Check } from "lucide-react"
import type { ServiceBusMessage } from "@/types/azure"
import { formatDateSafe } from "@/lib/utils"
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
import coy from "react-syntax-highlighter/dist/cjs/styles/prism/coy"

interface InlineMessageViewerProps {
  message: ServiceBusMessage
  onResend?: () => void
}

export function InlineMessageViewer({ message, onResend }: InlineMessageViewerProps) {
  const [expanded, setExpanded] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [copied, setCopied] = useState(false)
  
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
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bodyString)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }
  
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
  
  const language = isJSON ? "json" : message.contentType?.includes("json") ? "json" : "text"
  const syntaxTheme = isDarkMode ? vscDarkPlus : coy

  const formatDate = (date: string | Date | undefined): string => {
    if (!date) return "-"
    // Try to parse and format
    const d = date instanceof Date ? date : new Date(date)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    // If parsing fails, try formatDateSafe which returns the original string
    const safe = formatDateSafe(date)
    return safe || "-"
  }

  // Important properties to show in collapsed view (prioritized)
  const importantProperties = [
    { label: "Message ID", value: message.messageId, isMono: true },
    { label: "Correlation ID", value: message.correlationId, isMono: true },
    { label: "Subject", value: message.subject, isMono: false },
    { label: "Delivery Count", value: message.deliveryCount, isMono: false },
    { label: "Sequence Number", value: message.sequenceNumber, isMono: true },
    { label: "Enqueued Time", value: message.enqueuedTimeUtc ? formatDateSafe(message.enqueuedTimeUtc) || undefined : undefined, isMono: false },
  ].filter(prop => prop.value !== undefined && prop.value !== null && prop.value !== "")

  return (
    <div className="overflow-hidden">
      {/* Collapsed/Expanded View */}
      <div
        className="group transition-colors relative"
      >
        <div className={expanded ? "flex gap-0 p-0" : "flex gap-0 p-0"}>
          {/* Combined Container with Border */}
          <div 
            className={`flex-1 flex rounded-md border border-foreground/30 overflow-hidden shadow-md ${isDarkMode ? "bg-muted/30" : "bg-background"} ${!expanded ? "max-h-[9em]" : ""} cursor-pointer relative`}
            onClick={(e) => {
              // Expand when clicking anywhere in the panel (but don't collapse)
              if (!expanded) {
                setExpanded(true)
              }
            }}
          >
            {/* Message Body - Left Side */}
            <div className={`flex-1 min-w-0 relative ${!expanded ? "flex items-stretch" : ""}`}>
              <div className={`overflow-hidden ${expanded ? "h-full" : ""} ${isDarkMode ? "bg-muted/30" : "bg-background"} relative`}>
                {/* Expand/Collapse Button - Top Right of message content */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
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
                
                {/* Copy and Resend Buttons - Top Right (left of expand/collapse) */}
                {expanded && (
                  <div className="absolute top-2 right-10 flex gap-2 z-20">
                    <Button variant="outline" size="sm" onClick={(e) => {
                      e.stopPropagation()
                      handleCopy()
                    }}>
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                    {onResend && (
                      <Button variant="outline" size="sm" onClick={(e) => {
                        e.stopPropagation()
                        onResend()
                      }}>
                        <Send className="h-4 w-4 mr-2" />
                        Resend
                      </Button>
                    )}
                  </div>
                )}
                
                <div 
                  className={`${expanded ? "h-full overflow-auto" : "overflow-hidden relative"} w-full`}
                  onMouseDown={(e) => {
                    // Auto-expand when user starts selecting text (but don't collapse)
                    if (!expanded) {
                      // Expand immediately when user clicks on content area
                      setExpanded(true)
                    }
                  }}
                  onSelect={(e) => {
                    // Also expand if user successfully selects text
                    const selection = window.getSelection()?.toString()
                    if (!expanded && selection && selection.length > 0) {
                      setExpanded(true)
                    }
                  }}
                  onClick={(e) => {
                    // Prevent expand/collapse when clicking on content (allow text selection)
                    e.stopPropagation()
                  }}
                >
                  <SyntaxHighlighter
                    language={language}
                    style={syntaxTheme}
                  customStyle={{
                    margin: 0,
                    padding: "0.5rem",
                    background: "transparent",
                    fontSize: "0.875rem",
                    color: isDarkMode ? undefined : "hsl(var(--foreground))",
                    width: "100%",
                    display: "block",
                  }}
                    wrapLines
                    codeTagProps={{
                      style: {
                        color: isDarkMode ? undefined : "hsl(var(--foreground))",
                        width: "100%",
                        display: "block",
                      },
                    }}
                  >
                    {bodyString}
                  </SyntaxHighlighter>
                </div>
                
                {/* Bottom gradient overlay for collapsed view - positioned on parent container */}
                {!expanded && (
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                    style={{
                      zIndex: 30,
                      background: isDarkMode 
                        ? "linear-gradient(to bottom, rgba(0,0,0,0), hsl(var(--muted) / 0.95))"
                        : "linear-gradient(to bottom, rgba(255,255,255,0), hsl(var(--background) / 0.95))"
                    }}
                  />
                )}
              </div>
            </div>

            {/* Middle Separator */}
            <div className="w-px bg-border flex-shrink-0"></div>

            {/* Properties - Right Side */}
            <div className="w-1/3 flex-shrink-0">
              <div className="h-full overflow-auto">
                <Table>
                  <TableBody>
                  {/* Important Properties (shown in both collapsed and expanded) */}
                  {importantProperties.map((prop) => (
                    <TableRow key={prop.label}>
                      <TableCell className="text-muted-foreground text-xs">{prop.label}</TableCell>
                      <TableCell className={prop.isMono ? "font-mono text-xs" : "text-xs"}>
                        {prop.value}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Additional Properties (only shown when expanded) */}
                  {expanded && (
                    <>
                      {message.contentType && (
                        <TableRow>
                          <TableCell className="text-muted-foreground text-xs">Content Type</TableCell>
                          <TableCell className="text-xs">{message.contentType}</TableCell>
                        </TableRow>
                      )}
                      {message.sessionId && (
                        <TableRow>
                          <TableCell className="text-muted-foreground text-xs">Session ID</TableCell>
                          <TableCell className="text-xs">{message.sessionId}</TableCell>
                        </TableRow>
                      )}
                      {message.replyTo && (
                        <TableRow>
                          <TableCell className="text-muted-foreground text-xs">Reply To</TableCell>
                          <TableCell className="text-xs">{message.replyTo}</TableCell>
                        </TableRow>
                      )}
                      {message.replyToSessionId && (
                        <TableRow>
                          <TableCell className="text-muted-foreground text-xs">Reply To Session ID</TableCell>
                          <TableCell className="text-xs">{message.replyToSessionId}</TableCell>
                        </TableRow>
                      )}
                      {message.to && (
                        <TableRow>
                          <TableCell className="text-muted-foreground text-xs">To</TableCell>
                          <TableCell className="text-xs">{message.to}</TableCell>
                        </TableRow>
                      )}
                      {message.lockedUntilUtc && (
                        <TableRow>
                          <TableCell className="text-muted-foreground text-xs">Locked Until</TableCell>
                          <TableCell className="text-xs">{formatDateSafe(message.lockedUntilUtc) || "N/A"}</TableCell>
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
                          {Object.entries(message.applicationProperties).map(([key, value]) => {
                            // Only show if value is not null/undefined/empty
                            if (value === null || value === undefined || value === "") {
                              return null
                            }
                            return (
                              <TableRow key={key}>
                                <TableCell className="text-muted-foreground text-xs">{key}</TableCell>
                                <TableCell className="text-xs break-all">
                                  {typeof value === "string" ? value : JSON.stringify(value)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

