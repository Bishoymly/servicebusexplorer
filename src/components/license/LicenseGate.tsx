"use client"

import { ReactNode } from "react"
import Image from "next/image"
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

  // Trial expired (after grace period): show purchase dialog
  if (licenseStatus.isExpired) {
    return (
      <>
        <div className="flex h-screen flex-col bg-background">
          {/* Header with app icon and title */}
          <div className="flex items-center gap-3 p-6 border-b">
            <div className="relative h-8 w-8 shrink-0">
              <Image 
                src="/app-icon.png" 
                alt="Azure Service Bus Explorer" 
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <h1 className="text-xl font-semibold">Azure Service Bus Explorer</h1>
          </div>

          {/* Main content */}
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center w-full max-w-md">
              <div className="mb-6">
                <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Trial Expired</h2>
              <p className="text-muted-foreground mb-6">
                Please purchase the full version to continue using all features.
              </p>
              <Button onClick={() => setPurchaseDialogOpen(true)} size="lg">
                Purchase Now
              </Button>
            </div>
          </div>
        </div>
        <PurchaseDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen} />
      </>
    )
  }

  // Default: allow access (shouldn't reach here)
  return <>{children}</>
}

