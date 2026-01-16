"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Send, Eye } from "lucide-react"
import type { ServiceBusMessage } from "@/types/azure"
import { cn, formatDateSafe } from "@/lib/utils"

interface MessageCardProps {
  message: ServiceBusMessage
  onClick?: () => void
  onResend?: () => void
}

export function MessageCard({ message, onClick, onResend }: MessageCardProps) {
  const bodyPreview =
    typeof message.body === "string"
      ? message.body.substring(0, 100)
      : JSON.stringify(message.body).substring(0, 100)

  return (
    <Card className="cursor-pointer transition-all hover:shadow-md" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">ID: {message.messageId || "N/A"}</span>
              {message.correlationId && (
                <span className="text-xs text-muted-foreground">
                  Correlation: {message.correlationId}
                </span>
              )}
            </div>
            {message.subject && (
              <p className="text-sm font-semibold">{message.subject}</p>
            )}
            <p className="text-sm text-muted-foreground line-clamp-2">{bodyPreview}...</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {message.enqueuedTimeUtc && (
                <span>Enqueued: {formatDateSafe(message.enqueuedTimeUtc) || "N/A"}</span>
              )}
              {message.deliveryCount !== undefined && (
                <span>Delivery Count: {message.deliveryCount}</span>
              )}
              {message.deadLetterReason && (
                <span className="text-destructive">Dead Letter: {message.deadLetterReason}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" onClick={onClick}>
              <Eye className="h-4 w-4" />
            </Button>
            {onResend && (
              <Button variant="outline" size="sm" onClick={onResend}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

