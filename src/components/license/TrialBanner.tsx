"use client"

import { useLicense } from "@/hooks/useLicense"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Clock, AlertCircle } from "lucide-react"

export function TrialBanner() {
  const { licenseStatus, initiatePurchase } = useLicense()

  // Don't show banner if purchased or if not in trial/expired state
  if (licenseStatus.isPurchased || licenseStatus.isLoading) {
    return null
  }

  // Show banner if we have trial data (for testing in web version)
  const isTauri = typeof window !== "undefined" && "__TAURI__" in window
  const hasTrialData = typeof window !== "undefined" && 
    (localStorage.getItem("servicebusexplorer_trial_start") !== null || 
     localStorage.getItem("servicebusexplorer_purchase_status") !== null)
  
  if (!isTauri && !hasTrialData) {
    return null
  }

  const handlePurchase = () => {
    initiatePurchase()
  }

  if (licenseStatus.isExpired) {
    return (
      <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <AlertDescription className="flex items-center justify-between flex-1">
            <span>Trial expired. Please purchase to continue using Azure Service Bus Explorer.</span>
            <Button onClick={handlePurchase} size="sm" className="ml-4 shrink-0">
              Purchase ($19.99)
            </Button>
          </AlertDescription>
        </div>
      </Alert>
    )
  }

  if (licenseStatus.daysRemaining === 0) {
    return (
      <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 shrink-0 mt-0.5" />
          <AlertDescription className="flex items-center justify-between flex-1">
            <span>Trial expired. You have 1 day grace period to purchase.</span>
            <Button onClick={handlePurchase} size="sm" className="ml-4 shrink-0">
              Purchase ($19.99)
            </Button>
          </AlertDescription>
        </div>
      </Alert>
    )
  }

  if (licenseStatus.daysRemaining > 0) {
    return (
      <Alert className="rounded-none border-x-0 border-t-0 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 shrink-0 mt-0.5" />
          <AlertDescription className="flex items-center justify-between flex-1">
            <span>
              {licenseStatus.daysRemaining === 1
                ? "1 day remaining in your trial"
                : `${licenseStatus.daysRemaining} days remaining in your trial`}
            </span>
            <Button onClick={handlePurchase} size="sm" variant="outline" className="ml-4 shrink-0">
              Purchase ($19.99)
            </Button>
          </AlertDescription>
        </div>
      </Alert>
    )
  }

  return null
}

