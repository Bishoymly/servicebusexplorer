"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { useQueues } from "@/hooks/useQueues"
import type { QueueProperties, ServiceBusConnection } from "@/types/azure"
import { Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface QueueSettingsFormProps {
  queue?: QueueProperties
  connection?: ServiceBusConnection
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (queueName?: string) => void
  onDelete?: (queueName: string) => void
}

export function QueueSettingsForm({
  queue,
  connection,
  open,
  onOpenChange,
  onSuccess,
  onDelete,
}: QueueSettingsFormProps) {
  const { createQueue, updateQueue, deleteQueue, error: queueError, refresh } = useQueues(connection)
  const [name, setName] = useState("")
  const [maxSizeInMegabytes, setMaxSizeInMegabytes] = useState<number | undefined>()
  const [lockDurationInSeconds, setLockDurationInSeconds] = useState<number | undefined>()
  const [maxDeliveryCount, setMaxDeliveryCount] = useState<number | undefined>()
  const [defaultMessageTimeToLiveInSeconds, setDefaultMessageTimeToLiveInSeconds] = useState<
    number | undefined
  >()
  const [deadLetteringOnMessageExpiration, setDeadLetteringOnMessageExpiration] = useState(false)
  const [duplicateDetectionHistoryTimeWindowInSeconds, setDuplicateDetectionHistoryTimeWindowInSeconds] =
    useState<number | undefined>()
  const [enableBatchedOperations, setEnableBatchedOperations] = useState(true)
  const [enablePartitioning, setEnablePartitioning] = useState(false)
  const [requiresSession, setRequiresSession] = useState(false)
  const [requiresDuplicateDetection, setRequiresDuplicateDetection] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open) {
      // Clear any previous errors when dialog opens
      if (queueError) {
        // Error will be cleared by the hook when operations succeed
      }
      
      if (queue) {
        setName(queue.name)
        setMaxSizeInMegabytes(queue.maxSizeInMegabytes)
        setLockDurationInSeconds(queue.lockDurationInSeconds)
        setMaxDeliveryCount(queue.maxDeliveryCount)
        setDefaultMessageTimeToLiveInSeconds(queue.defaultMessageTimeToLiveInSeconds)
        setDeadLetteringOnMessageExpiration(queue.deadLetteringOnMessageExpiration || false)
        setDuplicateDetectionHistoryTimeWindowInSeconds(
          queue.duplicateDetectionHistoryTimeWindowInSeconds
        )
        setEnableBatchedOperations(queue.enableBatchedOperations ?? true)
        setEnablePartitioning(queue.enablePartitioning || false)
        setRequiresSession(queue.requiresSession || false)
        setRequiresDuplicateDetection(queue.requiresDuplicateDetection || false)
      } else {
        // Reset form for new queue
        setName("")
        setMaxSizeInMegabytes(undefined)
        setLockDurationInSeconds(undefined)
        setMaxDeliveryCount(undefined)
        setDefaultMessageTimeToLiveInSeconds(undefined)
        setDeadLetteringOnMessageExpiration(false)
        setDuplicateDetectionHistoryTimeWindowInSeconds(undefined)
        setEnableBatchedOperations(true)
        setEnablePartitioning(false)
        setRequiresSession(false)
        setRequiresDuplicateDetection(false)
      }
    }
  }, [queue, open, queueError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      const properties: Partial<QueueProperties> = {
        maxSizeInMegabytes,
        lockDurationInSeconds,
        maxDeliveryCount,
        defaultMessageTimeToLiveInSeconds,
        deadLetteringOnMessageExpiration,
        duplicateDetectionHistoryTimeWindowInSeconds,
        enableBatchedOperations,
        enablePartitioning,
        requiresSession,
        requiresDuplicateDetection,
      }

      let success = false
      try {
        if (queue) {
          success = await updateQueue(queue.name, properties)
        } else {
          success = await createQueue(name, properties)
        }
        
        if (!success) {
          // Error is already set in the hook via setError, it will be displayed in the form
          // Log the error for debugging
          console.error("Queue operation failed:", queueError || "Unknown error")
          return
        }
      } catch (err) {
        console.error("Queue operation exception:", err)
        return
      }
      
      // Pass queue name to onSuccess callback so parent can update tree efficiently
      onSuccess(queue ? queue.name : name)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save queue:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!queue) return

    setDeleting(true)
    try {
      const success = await deleteQueue(queue.name)
      if (success) {
        setDeleteDialogOpen(false)
        onOpenChange(false)
        // Call onDelete callback with queue name (to remove from tree) only if deletion was successful
        if (onDelete) {
          onDelete(queue.name)
        }
        // Then call onSuccess for any other cleanup
        onSuccess(queue.name)
      }
    } catch (error) {
      console.error("Failed to delete queue:", error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{queue ? "Edit Queue" : "Create Queue"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {queueError && (
              <Alert variant="destructive">
                <AlertDescription>{queueError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Queue Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-queue"
                required
                disabled={!!queue}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxSize">Max Size (MB)</Label>
                <Input
                  id="maxSize"
                  type="number"
                  value={maxSizeInMegabytes || ""}
                  onChange={(e) =>
                    setMaxSizeInMegabytes(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  placeholder="1024"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lockDuration">Lock Duration (seconds)</Label>
                <Input
                  id="lockDuration"
                  type="number"
                  value={lockDurationInSeconds || ""}
                  onChange={(e) =>
                    setLockDurationInSeconds(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  placeholder="30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxDeliveryCount">Max Delivery Count</Label>
                <Input
                  id="maxDeliveryCount"
                  type="number"
                  value={maxDeliveryCount || ""}
                  onChange={(e) =>
                    setMaxDeliveryCount(e.target.value ? parseInt(e.target.value) : undefined)
                  }
                  placeholder="10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ttl">Default TTL (seconds)</Label>
                <Input
                  id="ttl"
                  type="number"
                  value={defaultMessageTimeToLiveInSeconds || ""}
                  onChange={(e) =>
                    setDefaultMessageTimeToLiveInSeconds(
                      e.target.value ? parseInt(e.target.value) : undefined
                    )
                  }
                  placeholder="604800"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duplicateWindow">Duplicate Detection Window (seconds)</Label>
              <Input
                id="duplicateWindow"
                type="number"
                value={duplicateDetectionHistoryTimeWindowInSeconds || ""}
                onChange={(e) =>
                  setDuplicateDetectionHistoryTimeWindowInSeconds(
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                placeholder="600"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="deadLetter"
                  checked={deadLetteringOnMessageExpiration}
                  onChange={(e) => setDeadLetteringOnMessageExpiration(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="deadLetter">Dead Letter on Message Expiration</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="batched"
                  checked={enableBatchedOperations}
                  onChange={(e) => setEnableBatchedOperations(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="batched">Enable Batched Operations</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="partitioning"
                  checked={enablePartitioning}
                  onChange={(e) => setEnablePartitioning(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                  disabled={!!queue}
                />
                <Label htmlFor="partitioning">Enable Partitioning</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="session"
                  checked={requiresSession}
                  onChange={(e) => setRequiresSession(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                  disabled={!!queue}
                />
                <Label htmlFor="session">Requires Session</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="duplicateDetection"
                  checked={requiresDuplicateDetection}
                  onChange={(e) => setRequiresDuplicateDetection(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                  disabled={!!queue}
                />
                <Label htmlFor="duplicateDetection">Requires Duplicate Detection</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            {queue && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={loading || deleting}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Queue
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || deleting}>
              {loading ? "Saving..." : queue ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Queue</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the queue &quot;{queue?.name}&quot;? This action cannot be undone and all messages in the queue will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

