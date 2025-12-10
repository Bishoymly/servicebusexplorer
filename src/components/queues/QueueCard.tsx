"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, AlertCircle, Clock } from "lucide-react"
import type { QueueProperties } from "@/types/azure"
import { cn } from "@/lib/utils"

interface QueueCardProps {
  queue: QueueProperties
  onClick?: () => void
}

export function QueueCard({ queue, onClick }: QueueCardProps) {
  return (
    <Card
      className={cn("cursor-pointer transition-all hover:shadow-md", onClick && "hover:border-primary")}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-medium">{queue.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Messages:</span>
            <span className="font-medium">{queue.activeMessageCount || 0}</span>
          </div>
          {queue.deadLetterMessageCount && queue.deadLetterMessageCount > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-muted-foreground">Dead Letters:</span>
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {queue.deadLetterMessageCount}
              </Badge>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {queue.requiresSession && (
            <Badge variant="outline" className="text-xs">
              Session
            </Badge>
          )}
          {queue.enablePartitioning && (
            <Badge variant="outline" className="text-xs">
              Partitioned
            </Badge>
          )}
          {queue.requiresDuplicateDetection && (
            <Badge variant="outline" className="text-xs">
              Duplicate Detection
            </Badge>
          )}
        </div>
        {queue.sizeInBytes !== undefined && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Size: {(queue.sizeInBytes / 1024).toFixed(2)} KB</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

