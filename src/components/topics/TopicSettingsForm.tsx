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
} from "@/components/ui/dialog"
import { useTopics } from "@/hooks/useTopics"
import type { TopicProperties } from "@/types/azure"

interface TopicSettingsFormProps {
  topic?: TopicProperties
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function TopicSettingsForm({
  topic,
  open,
  onOpenChange,
  onSuccess,
}: TopicSettingsFormProps) {
  const { createTopic, updateTopic } = useTopics()
  const [name, setName] = useState("")
  const [maxSizeInMegabytes, setMaxSizeInMegabytes] = useState<number | undefined>()
  const [defaultMessageTimeToLiveInSeconds, setDefaultMessageTimeToLiveInSeconds] = useState<
    number | undefined
  >()
  const [duplicateDetectionHistoryTimeWindowInSeconds, setDuplicateDetectionHistoryTimeWindowInSeconds] =
    useState<number | undefined>()
  const [enableBatchedOperations, setEnableBatchedOperations] = useState(true)
  const [enablePartitioning, setEnablePartitioning] = useState(false)
  const [requiresDuplicateDetection, setRequiresDuplicateDetection] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (topic) {
      setName(topic.name)
      setMaxSizeInMegabytes(topic.maxSizeInMegabytes)
      setDefaultMessageTimeToLiveInSeconds(topic.defaultMessageTimeToLiveInSeconds)
      setDuplicateDetectionHistoryTimeWindowInSeconds(
        topic.duplicateDetectionHistoryTimeWindowInSeconds
      )
      setEnableBatchedOperations(topic.enableBatchedOperations ?? true)
      setEnablePartitioning(topic.enablePartitioning || false)
      setRequiresDuplicateDetection(topic.requiresDuplicateDetection || false)
    } else {
      setName("")
      setMaxSizeInMegabytes(undefined)
      setDefaultMessageTimeToLiveInSeconds(undefined)
      setDuplicateDetectionHistoryTimeWindowInSeconds(undefined)
      setEnableBatchedOperations(true)
      setEnablePartitioning(false)
      setRequiresDuplicateDetection(false)
    }
  }, [topic, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      const properties: Partial<TopicProperties> = {
        maxSizeInMegabytes,
        defaultMessageTimeToLiveInSeconds,
        duplicateDetectionHistoryTimeWindowInSeconds,
        enableBatchedOperations,
        enablePartitioning,
        requiresDuplicateDetection,
      }

      if (topic) {
        await updateTopic(topic.name, properties)
      } else {
        await createTopic(name, properties)
      }
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save topic:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{topic ? "Edit Topic" : "Create Topic"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Topic Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-topic"
                required
                disabled={!!topic}
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
                  disabled={!!topic}
                />
                <Label htmlFor="partitioning">Enable Partitioning</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="duplicateDetection"
                  checked={requiresDuplicateDetection}
                  onChange={(e) => setRequiresDuplicateDetection(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                  disabled={!!topic}
                />
                <Label htmlFor="duplicateDetection">Requires Duplicate Detection</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : topic ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

