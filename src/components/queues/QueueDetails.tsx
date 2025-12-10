"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Edit, Trash2, RefreshCw } from "lucide-react"
import type { QueueProperties } from "@/types/azure"

interface QueueDetailsProps {
  queue: QueueProperties
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onRefresh: () => void
}

export function QueueDetails({
  queue,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onRefresh,
}: QueueDetailsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{queue.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Active Messages</label>
              <p className="text-lg font-semibold">{queue.activeMessageCount || 0}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Dead Letter Messages</label>
              <p className="text-lg font-semibold text-destructive">{queue.deadLetterMessageCount || 0}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Scheduled Messages</label>
              <p className="text-lg font-semibold">{queue.scheduledMessageCount || 0}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Total Messages</label>
              <p className="text-lg font-semibold">{queue.messageCount || 0}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-semibold">Properties</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-muted-foreground">Max Size (MB)</label>
                <p>{queue.maxSizeInMegabytes || "N/A"}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Lock Duration (seconds)</label>
                <p>{queue.lockDurationInSeconds || "N/A"}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Max Delivery Count</label>
                <p>{queue.maxDeliveryCount || "N/A"}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Default TTL (seconds)</label>
                <p>{queue.defaultMessageTimeToLiveInSeconds || "N/A"}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Dead Letter on Expiration</label>
                <p>{queue.deadLetteringOnMessageExpiration ? "Yes" : "No"}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Duplicate Detection Window (seconds)</label>
                <p>{queue.duplicateDetectionHistoryTimeWindowInSeconds || "N/A"}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Requires Session</label>
                <p>{queue.requiresSession ? "Yes" : "No"}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Partitioned</label>
                <p>{queue.enablePartitioning ? "Yes" : "No"}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Duplicate Detection</label>
                <p>{queue.requiresDuplicateDetection ? "Yes" : "No"}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Batched Operations</label>
                <p>{queue.enableBatchedOperations ? "Yes" : "No"}</p>
              </div>
            </div>
          </div>

          {queue.sizeInBytes !== undefined && (
            <>
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Size</label>
                <p>{(queue.sizeInBytes / 1024).toFixed(2)} KB</p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
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

