"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, MessageSquare, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTopics } from "@/hooks/useTopics"
import type { SubscriptionProperties } from "@/types/azure"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SubscriptionListProps {
  topicName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SubscriptionList({ topicName, open, onOpenChange }: SubscriptionListProps) {
  const { listSubscriptions } = useTopics()
  const [subscriptions, setSubscriptions] = useState<SubscriptionProperties[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSubscriptions = async () => {
    setLoading(true)
    setError(null)
    try {
      const subs = await listSubscriptions(topicName)
      setSubscriptions(subs)
    } catch (err: any) {
      setError(err.message || "Failed to load subscriptions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && topicName) {
      loadSubscriptions()
    }
  }, [open, topicName])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subscriptions for {topicName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {subscriptions.length} subscription{subscriptions.length !== 1 ? "s" : ""} found
            </p>
            <Button variant="outline" onClick={loadSubscriptions} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && subscriptions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No subscriptions found for this topic.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {subscriptions.map((sub) => (
                <Card key={sub.subscriptionName}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{sub.subscriptionName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Messages:</span>
                        <span className="font-medium">{sub.activeMessageCount || 0}</span>
                      </div>
                      {sub.deadLetterMessageCount && sub.deadLetterMessageCount > 0 && (
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          <span className="text-muted-foreground">Dead Letters:</span>
                          <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                            {sub.deadLetterMessageCount}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Max Delivery Count: {sub.maxDeliveryCount || "N/A"}</p>
                      <p>Lock Duration: {sub.lockDurationInSeconds || "N/A"}s</p>
                      {sub.requiresSession && (
                        <Badge variant="outline" className="text-xs mt-2">
                          Requires Session
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

