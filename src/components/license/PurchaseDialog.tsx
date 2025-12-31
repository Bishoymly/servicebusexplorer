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

const APP_TITLE = "Azure Service Bus Explorer"

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

  const isExpired = licenseStatus.isExpired
  const daysRemaining = licenseStatus.daysRemaining

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">{APP_TITLE}</DialogTitle>
              <DialogDescription>
                {isExpired 
                  ? "Your trial has expired. Purchase now to continue using all features."
                  : daysRemaining > 0
                  ? `Upgrade to unlock all features (${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining)`
                  : "Upgrade to unlock all features with a one-time purchase"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isExpired && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
              <div className="text-sm font-medium text-destructive mb-1">Trial Expired</div>
              <div className="text-sm text-destructive/80">
                Your 3-day trial has ended. Purchase the full version to continue using {APP_TITLE}.
              </div>
            </div>
          )}

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

        <DialogFooter>
          <Button onClick={handlePurchase} className="w-full">
            Purchase Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

