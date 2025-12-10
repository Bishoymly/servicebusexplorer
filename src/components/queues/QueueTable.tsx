"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreVertical, Eye, Edit, Trash2, RefreshCw, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { QueueProperties } from "@/types/azure"
import { cn } from "@/lib/utils"

interface QueueTableProps {
  queues: QueueProperties[]
  onQueueClick: (queue: QueueProperties) => void
  onQueueClickDeadLetter?: (queue: QueueProperties) => void
  onEdit: (queue: QueueProperties) => void
  onDelete: (queueName: string) => void
  onRefresh?: (queueName: string) => void
  onPurge?: (queueName: string, purgeDeadLetter?: boolean) => void
  refreshingQueues?: Set<string>
  purgingQueues?: Set<string>
}

export function QueueTable({ queues, onQueueClick, onQueueClickDeadLetter, onEdit, onDelete, onRefresh, onPurge, refreshingQueues, purgingQueues }: QueueTableProps) {
  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return "0"
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatSize = (bytes: number | undefined) => {
    if (!bytes) return "-"
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${bytes} B`
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Name</TableHead>
            <TableHead className="w-[100px] text-right">Active</TableHead>
            <TableHead className="w-[100px] text-right">Dead Letter</TableHead>
            <TableHead className="w-[100px] text-right">Scheduled</TableHead>
            <TableHead className="w-[100px] text-right">Total</TableHead>
            <TableHead className="w-[100px] text-right">Size</TableHead>
            <TableHead className="w-[150px]">Features</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {queues.map((queue, index) => (
            <TableRow
              key={`${queue.name}-${index}`}
              className="hover:bg-muted/50"
            >
              <TableCell 
                className="font-medium cursor-pointer"
                onClick={() => onQueueClick(queue)}
              >
                {queue.name}
              </TableCell>
              <TableCell className="text-right">
                {queue.activeMessageCount && queue.activeMessageCount > 0 ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onQueueClick(queue)
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    {formatNumber(queue.activeMessageCount)}
                  </button>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {queue.deadLetterMessageCount && queue.deadLetterMessageCount > 0 ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onQueueClickDeadLetter) {
                        onQueueClickDeadLetter(queue)
                      } else {
                        onQueueClick(queue)
                      }
                    }}
                    className="text-destructive hover:underline"
                  >
                    <Badge variant="destructive" className="text-xs cursor-pointer">
                      {formatNumber(queue.deadLetterMessageCount)}
                    </Badge>
                  </button>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatNumber(queue.scheduledMessageCount)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {queue.messageCount && queue.messageCount > 0 ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onQueueClick(queue)
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    {formatNumber(queue.messageCount)}
                  </button>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {formatSize(queue.sizeInBytes)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {queue.requiresSession && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      S
                    </Badge>
                  )}
                  {queue.enablePartitioning && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      P
                    </Badge>
                  )}
                  {queue.requiresDuplicateDetection && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      D
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  {onRefresh && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onRefresh(queue.name)}
                      disabled={refreshingQueues?.has(queue.name)}
                      title="Refresh queue"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${refreshingQueues?.has(queue.name) ? "animate-spin" : ""}`}
                      />
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onQueueClick(queue)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(queue)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {onPurge && (
                        <>
                          <DropdownMenuItem
                            onClick={() => onPurge(queue.name, false)}
                            disabled={purgingQueues?.has(queue.name)}
                            className="text-destructive"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Purge Queue
                          </DropdownMenuItem>
                          {queue.deadLetterMessageCount && queue.deadLetterMessageCount > 0 && (
                            <DropdownMenuItem
                              onClick={() => onPurge(queue.name, true)}
                              disabled={purgingQueues?.has(queue.name)}
                              className="text-destructive"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Purge Dead Letter
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={() => onDelete(queue.name)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

