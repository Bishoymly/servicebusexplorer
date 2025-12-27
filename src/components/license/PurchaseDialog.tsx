"use client"

import { useLicense } from "@/hooks/useLicense"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Sparkles } from "lucide-react"

interface PurchaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PurchaseDialog({ open, onOpenChange }: PurchaseDialogProps) {
  const { licenseStatus, initiatePurchase } = useLicense()

  const handlePurchase = async () => {
    await initiatePurchase()
    // Don't close dialog immediately - let user complete purchase
  }

  const handleOpenAppStore = () => {
    window.open(
      "https://apps.apple.com/app/azure-service-bus-explorer/id6756694985",
      "_blank"
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle>Upgrade to Full Version</DialogTitle>
              <DialogDescription>Unlock all features with a one-time purchase</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {licenseStatus.isExpired ? (
            <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              Your trial has expired. Purchase now to continue using Azure Service Bus Explorer.
            </div>
          ) : licenseStatus.daysRemaining > 0 ? (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 text-sm">
              <strong>{licenseStatus.daysRemaining} day{licenseStatus.daysRemaining !== 1 ? "s" : ""}</strong> remaining in your trial
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Full Feature Access</div>
                <div className="text-sm text-muted-foreground">
                  Manage queues, topics, subscriptions, and messages without limitations
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">One-Time Purchase</div>
                <div className="text-sm text-muted-foreground">
                  Pay once, use forever. No subscriptions or recurring fees
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Lifetime Updates</div>
                <div className="text-sm text-muted-foreground">
                  Receive all future updates and improvements at no additional cost
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">$19.99</span>
              <span className="text-sm text-muted-foreground">one-time</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleOpenAppStore} className="w-full sm:w-auto">
            Open App Store
          </Button>
          <Button onClick={handlePurchase} className="w-full sm:w-auto">
            Purchase Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

