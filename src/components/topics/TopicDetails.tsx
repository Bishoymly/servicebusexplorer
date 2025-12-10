"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Edit, Trash2, RefreshCw, Users } from "lucide-react"
import type { TopicProperties } from "@/types/azure"

interface TopicDetailsProps {
  topic: TopicProperties
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onViewSubscriptions: () => void
  onRefresh: () => void
}

export function TopicDetails({
  topic,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onViewSubscriptions,
  onRefresh,
}: TopicDetailsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{topic.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Subscriptions</label>
              <p className="text-lg font-semibold">{topic.subscriptionCount || 0}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Size</label>
              <p className="text-lg font-semibold">
                {topic.sizeInBytes ? `${(topic.sizeInBytes / 1024).toFixed(2)} KB` : "N/A"}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-semibold">Properties</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-muted-foreground">Max Size (MB)</label>
                <p>{topic.maxSizeInMegabytes || "N/A"}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Default TTL (seconds)</label>
                <p>{topic.defaultMessageTimeToLiveInSeconds || "N/A"}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Duplicate Detection Window (seconds)</label>
                <p>{topic.duplicateDetectionHistoryTimeWindowInSeconds || "N/A"}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Batched Operations</label>
                <p>{topic.enableBatchedOperations ? "Yes" : "No"}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Partitioned</label>
                <p>{topic.enablePartitioning ? "Yes" : "No"}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Duplicate Detection</label>
                <p>{topic.requiresDuplicateDetection ? "Yes" : "No"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={onViewSubscriptions}>
            <Users className="h-4 w-4 mr-2" />
            View Subscriptions
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

