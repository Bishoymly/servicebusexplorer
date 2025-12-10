"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FolderTree, Users } from "lucide-react"
import type { TopicProperties } from "@/types/azure"
import { cn } from "@/lib/utils"

interface TopicCardProps {
  topic: TopicProperties
  onClick?: () => void
}

export function TopicCard({ topic, onClick }: TopicCardProps) {
  return (
    <Card
      className={cn("cursor-pointer transition-all hover:shadow-md", onClick && "hover:border-primary")}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-medium">{topic.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Subscriptions:</span>
            <span className="font-medium">{topic.subscriptionCount || 0}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {topic.enablePartitioning && (
            <Badge variant="outline" className="text-xs">
              Partitioned
            </Badge>
          )}
          {topic.requiresDuplicateDetection && (
            <Badge variant="outline" className="text-xs">
              Duplicate Detection
            </Badge>
          )}
        </div>
        {topic.sizeInBytes !== undefined && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FolderTree className="h-3 w-3" />
            <span>Size: {(topic.sizeInBytes / 1024).toFixed(2)} KB</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

