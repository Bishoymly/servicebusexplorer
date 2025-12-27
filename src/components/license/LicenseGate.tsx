"use client"

import { ReactNode } from "react"
import { useLicense } from "@/hooks/useLicense"
import { PurchaseDialog } from "./PurchaseDialog"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, Lock } from "lucide-react"

interface LicenseGateProps {
  children: ReactNode
}

export function LicenseGate({ children }: LicenseGateProps) {
  const { licenseStatus } = useLicense()
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false)

  // Web version: allow access unless we have trial data (for testing)
  const isTauri = typeof window !== "undefined" && "__TAURI__" in window
  const hasTrialData = typeof window !== "undefined" && 
    (localStorage.getItem("servicebusexplorer_trial_start") !== null || 
     localStorage.getItem("servicebusexplorer_purchase_status") !== null)
  
  if (!isTauri && !hasTrialData) {
    return <>{children}</>
  }

  // Loading state: show children (will be checked soon)
  if (licenseStatus.isLoading) {
    return <>{children}</>
  }

  // Purchased: allow full access
  if (licenseStatus.isPurchased) {
    return <>{children}</>
  }

  // Trial active or in grace period: allow access
  if (licenseStatus.isTrial || licenseStatus.daysRemaining === 0) {
    return <>{children}</>
  }

  // Trial expired (after grace period): block access
  if (licenseStatus.isExpired) {
    return (
      <>
        <div className="flex h-screen items-center justify-center bg-background p-8">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <Lock className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle>Trial Expired</CardTitle>
              <CardDescription>
                Your 3-day trial has ended. Purchase the full version to continue using Azure Service Bus Explorer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <div className="text-3xl font-bold">$19.99</div>
                <div className="text-sm text-muted-foreground">One-time purchase</div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Full feature access</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Lifetime updates</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>No subscriptions</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <Button onClick={() => setPurchaseDialogOpen(true)} className="w-full">
                Purchase Now
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  window.open(
                    "https://apps.apple.com/app/azure-service-bus-explorer/id6756694985",
                    "_blank"
                  )
                }}
                className="w-full"
              >
                Open App Store
              </Button>
            </CardFooter>
          </Card>
        </div>
        <PurchaseDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen} />
      </>
    )
  }

  // Default: allow access (shouldn't reach here)
  return <>{children}</>
}

