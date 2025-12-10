"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Eye, Send } from "lucide-react"
import type { ServiceBusMessage } from "@/types/azure"

interface MessageTableProps {
  messages: ServiceBusMessage[]
  onMessageClick: (message: ServiceBusMessage) => void
  onResend?: (message: ServiceBusMessage) => void
}

export function MessageTable({ messages, onMessageClick, onResend }: MessageTableProps) {
  const formatBody = (body: any): string => {
    if (typeof body === "string") {
      return body.length > 100 ? body.substring(0, 100) + "..." : body
    }
    const str = JSON.stringify(body)
    return str.length > 100 ? str.substring(0, 100) + "..." : str
  }

  const formatDate = (date: Date | undefined): string => {
    if (!date) return "-"
    return new Date(date).toLocaleString()
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">Message ID</TableHead>
            <TableHead className="w-[120px]">Correlation ID</TableHead>
            <TableHead className="w-[100px]">Subject</TableHead>
            <TableHead>Body Preview</TableHead>
            <TableHead className="w-[80px] text-right">Delivery</TableHead>
            <TableHead className="w-[150px]">Enqueued</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messages.map((message, index) => (
            <TableRow
              key={message.messageId || index}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onMessageClick(message)}
            >
              <TableCell className="font-mono text-xs">
                {message.messageId || "-"}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {message.correlationId || "-"}
              </TableCell>
              <TableCell className="text-sm">{message.subject || "-"}</TableCell>
              <TableCell className="text-xs font-mono max-w-md truncate">
                {formatBody(message.body)}
              </TableCell>
              <TableCell className="text-right text-sm">
                {message.deliveryCount || 0}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDate(message.enqueuedTimeUtc)}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}


