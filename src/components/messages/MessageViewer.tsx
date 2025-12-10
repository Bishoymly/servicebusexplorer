"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Send } from "lucide-react"
import type { ServiceBusMessage } from "@/types/azure"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface MessageViewerProps {
  message: ServiceBusMessage
  open: boolean
  onOpenChange: (open: boolean) => void
  onResend: () => void
}

export function MessageViewer({ message, open, onOpenChange, onResend }: MessageViewerProps) {
  const bodyString =
    typeof message.body === "string" ? message.body : JSON.stringify(message.body, null, 2)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Message Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Tabs defaultValue="body" className="w-full">
            <TabsList>
              <TabsTrigger value="body">Body</TabsTrigger>
              <TabsTrigger value="properties">Properties</TabsTrigger>
              <TabsTrigger value="system">System Properties</TabsTrigger>
            </TabsList>
            <TabsContent value="body" className="space-y-2">
              <div className="rounded-md border bg-muted p-4">
                <pre className="text-sm overflow-x-auto whitespace-pre-wrap">{bodyString}</pre>
              </div>
            </TabsContent>
            <TabsContent value="properties" className="space-y-2">
              {message.applicationProperties && Object.keys(message.applicationProperties).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(message.applicationProperties).map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between border-b pb-2">
                      <span className="font-medium text-sm">{key}:</span>
                      <span className="text-sm text-muted-foreground ml-4">
                        {typeof value === "string" ? value : JSON.stringify(value)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No custom properties</p>
              )}
            </TabsContent>
            <TabsContent value="system" className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-muted-foreground">Message ID</label>
                  <p className="font-medium">{message.messageId || "N/A"}</p>
                </div>
                <div>
                  <label className="text-muted-foreground">Content Type</label>
                  <p className="font-medium">{message.contentType || "N/A"}</p>
                </div>
                <div>
                  <label className="text-muted-foreground">Correlation ID</label>
                  <p className="font-medium">{message.correlationId || "N/A"}</p>
                </div>
                <div>
                  <label className="text-muted-foreground">Session ID</label>
                  <p className="font-medium">{message.sessionId || "N/A"}</p>
                </div>
                <div>
                  <label className="text-muted-foreground">Reply To</label>
                  <p className="font-medium">{message.replyTo || "N/A"}</p>
                </div>
                <div>
                  <label className="text-muted-foreground">Subject</label>
                  <p className="font-medium">{message.subject || "N/A"}</p>
                </div>
                <div>
                  <label className="text-muted-foreground">Delivery Count</label>
                  <p className="font-medium">{message.deliveryCount || "N/A"}</p>
                </div>
                <div>
                  <label className="text-muted-foreground">Sequence Number</label>
                  <p className="font-medium">{message.sequenceNumber || "N/A"}</p>
                </div>
                {message.enqueuedTimeUtc && (
                  <div>
                    <label className="text-muted-foreground">Enqueued Time</label>
                    <p className="font-medium">{new Date(message.enqueuedTimeUtc).toLocaleString()}</p>
                  </div>
                )}
                {message.lockedUntilUtc && (
                  <div>
                    <label className="text-muted-foreground">Locked Until</label>
                    <p className="font-medium">{new Date(message.lockedUntilUtc).toLocaleString()}</p>
                  </div>
                )}
                {message.deadLetterReason && (
                  <div className="col-span-2">
                    <label className="text-muted-foreground">Dead Letter Reason</label>
                    <p className="font-medium text-destructive">{message.deadLetterReason}</p>
                  </div>
                )}
                {message.deadLetterErrorDescription && (
                  <div className="col-span-2">
                    <label className="text-muted-foreground">Dead Letter Error</label>
                    <p className="font-medium text-destructive">{message.deadLetterErrorDescription}</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onResend}>
            <Send className="h-4 w-4 mr-2" />
            Resend
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

