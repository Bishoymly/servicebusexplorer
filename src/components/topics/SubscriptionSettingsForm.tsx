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
import { apiClient } from "@/lib/api/client"
import { useConnections } from "@/hooks/useConnections"
import type { SubscriptionProperties, ServiceBusConnection } from "@/types/azure"

interface SubscriptionSettingsFormProps {
  topicName: string
  subscription?: SubscriptionProperties
  connection: ServiceBusConnection
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function SubscriptionSettingsForm({
  topicName,
  subscription,
  connection,
  open,
  onOpenChange,
  onSuccess,
}: SubscriptionSettingsFormProps) {
  const [name, setName] = useState("")
  const [maxDeliveryCount, setMaxDeliveryCount] = useState<number | undefined>()
  const [lockDurationInSeconds, setLockDurationInSeconds] = useState<number | undefined>()
  const [defaultMessageTimeToLiveInSeconds, setDefaultMessageTimeToLiveInSeconds] = useState<number | undefined>()
  const [deadLetteringOnMessageExpiration, setDeadLetteringOnMessageExpiration] = useState(false)
  const [enableBatchedOperations, setEnableBatchedOperations] = useState(true)
  const [requiresSession, setRequiresSession] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (subscription) {
      setName(subscription.subscriptionName)
      setMaxDeliveryCount(subscription.maxDeliveryCount)
      setLockDurationInSeconds(subscription.lockDurationInSeconds)
      setDefaultMessageTimeToLiveInSeconds(subscription.defaultMessageTimeToLiveInSeconds)
      setDeadLetteringOnMessageExpiration(subscription.deadLetteringOnMessageExpiration || false)
      setEnableBatchedOperations(subscription.enableBatchedOperations ?? true)
      setRequiresSession(subscription.requiresSession || false)
    } else {
      setName("")
      setMaxDeliveryCount(undefined)
      setLockDurationInSeconds(undefined)
      setDefaultMessageTimeToLiveInSeconds(undefined)
      setDeadLetteringOnMessageExpiration(false)
      setEnableBatchedOperations(true)
      setRequiresSession(false)
    }
  }, [subscription, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      const properties: Partial<SubscriptionProperties> = {
        maxDeliveryCount,
        lockDurationInSeconds,
        defaultMessageTimeToLiveInSeconds,
        deadLetteringOnMessageExpiration,
        enableBatchedOperations,
        requiresSession,
      }

      if (subscription) {
        // Update subscription (if update API exists)
        // For now, subscriptions can only be created, not updated
        throw new Error("Subscription updates are not yet supported")
      } else {
        await apiClient.createSubscription(connection, topicName, name, properties)
      }
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Failed to save subscription:", error)
      alert(error.message || "Failed to create subscription")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{subscription ? "Edit Subscription" : "Create Subscription"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="topicName">Topic Name</Label>
              <Input
                id="topicName"
                value={topicName}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Subscription Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-subscription"
                required
                disabled={!!subscription}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxDeliveryCount">Max Delivery Count</Label>
                <Input
                  id="maxDeliveryCount"
                  type="number"
                  min="1"
                  value={maxDeliveryCount || ""}
                  onChange={(e) => setMaxDeliveryCount(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lockDuration">Lock Duration (seconds)</Label>
                <Input
                  id="lockDuration"
                  type="number"
                  min="1"
                  value={lockDurationInSeconds || ""}
                  onChange={(e) => setLockDurationInSeconds(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ttl">Default TTL (seconds)</Label>
                <Input
                  id="ttl"
                  type="number"
                  min="1"
                  value={defaultMessageTimeToLiveInSeconds || ""}
                  onChange={(e) => setDefaultMessageTimeToLiveInSeconds(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="604800"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="deadLettering"
                  checked={deadLetteringOnMessageExpiration}
                  onChange={(e) => setDeadLetteringOnMessageExpiration(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="deadLettering" className="cursor-pointer">
                  Dead Lettering on Message Expiration
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="enableBatchedOperations"
                  checked={enableBatchedOperations}
                  onChange={(e) => setEnableBatchedOperations(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="enableBatchedOperations" className="cursor-pointer">
                  Enable Batched Operations
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="requiresSession"
                  checked={requiresSession}
                  onChange={(e) => setRequiresSession(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="requiresSession" className="cursor-pointer">
                  Requires Session
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Saving..." : subscription ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

