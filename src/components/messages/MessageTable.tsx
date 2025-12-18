"use client"

import { Button } from "@/components/ui/button"
import { Eye, Send } from "lucide-react"
import type { ServiceBusMessage } from "@/types/azure"
import { cn } from "@/lib/utils"

interface MessageTableProps {
  messages: ServiceBusMessage[]
  onMessageClick: (message: ServiceBusMessage) => void
  onResend?: (message: ServiceBusMessage) => void
}

export function MessageTable({ messages, onMessageClick, onResend }: MessageTableProps) {
  const formatBody = (body: any): string => {
    if (typeof body === "string") {
      return body
    }
    return JSON.stringify(body)
  }

  const formatDate = (date: Date | undefined): string => {
    if (!date) return "-"
    const d = new Date(date)
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getBodyPreview = (body: any, maxLines: number = 4): string => {
    const bodyStr = formatBody(body)
    const lines = bodyStr.split("\n")
    if (lines.length <= maxLines) {
      return bodyStr
    }
    return lines.slice(0, maxLines).join("\n") + "\n..."
  }

  return (
    <div className="space-y-1">
      {messages.map((message, index) => {
        const bodyPreview = getBodyPreview(message.body, 4)
        const hasAttributes = message.messageId || message.correlationId || message.subject || message.deliveryCount !== undefined || message.enqueuedTimeUtc
        
        return (
          <div
            key={message.messageId || index}
            className={cn(
              "group flex items-start gap-3 p-2 rounded-md border cursor-pointer",
              "hover:bg-muted/50 transition-colors"
            )}
            onClick={() => onMessageClick(message)}
          >
            {/* Main Content - Body Preview */}
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-mono text-foreground whitespace-pre-wrap break-words leading-relaxed">
                {bodyPreview}
              </div>
            </div>

            {/* Side Attributes */}
            {hasAttributes && (
              <div 
                className="flex-shrink-0 w-64 flex flex-col gap-1 text-[10px] text-muted-foreground"
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
            )}

            {/* Actions */}
            <div 
              className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onMessageClick(message)}
              >
                <Eye className="h-3 w-3" />
              </Button>
              {onResend && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onResend(message)}
                >
                  <Send className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}


