"use client"

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react"
import { invoke } from "@tauri-apps/api/core"
import {
  saveTrialStartDate,
  loadTrialStartDate,
  savePurchaseStatus,
  loadPurchaseStatus,
  isTrialExpired,
  getTrialDaysRemaining,
  isInGracePeriod,
  type PurchaseStatus,
} from "@/lib/storage/license"

interface LicenseStatus {
  isTrial: boolean
  isPurchased: boolean
  isExpired: boolean
  daysRemaining: number
  trialStartDate: number | null
  isLoading: boolean
}

interface LicenseContextType {
  licenseStatus: LicenseStatus
  checkLicense: () => Promise<void>
  initiatePurchase: () => Promise<void>
  refreshLicenseStatus: () => Promise<void>
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined)

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>({
    isTrial: true,
    isPurchased: false,
    isExpired: false,
    daysRemaining: 3,
    trialStartDate: null,
    isLoading: true,
  })

  const checkLicense = useCallback(async () => {
    try {
      // Check if we're running in Tauri (desktop app)
      const isTauri = typeof window !== "undefined" && "__TAURI__" in window

      // For testing: allow trial system in web version if localStorage has trial data
      // This allows testing the UI without needing Tauri
      const hasTrialData = typeof window !== "undefined" && 
        (localStorage.getItem("servicebusexplorer_trial_start") !== null || 
         localStorage.getItem("servicebusexplorer_purchase_status") !== null)

      if (!isTauri && !hasTrialData) {
        // Web version with no trial data: no license restrictions
        setLicenseStatus({
          isTrial: false,
          isPurchased: true,
          isExpired: false,
          daysRemaining: -1,
          trialStartDate: null,
          isLoading: false,
        })
        return
      }

      // Load purchase status from storage
      const purchaseStatus = loadPurchaseStatus()
      if (purchaseStatus?.purchased) {
        setLicenseStatus({
          isTrial: false,
          isPurchased: true,
          isExpired: false,
          daysRemaining: -1,
          trialStartDate: null,
          isLoading: false,
        })
        return
      }

      // Check trial start date
      let trialStartDate = loadTrialStartDate()
      if (!trialStartDate) {
        // First launch - start trial
        trialStartDate = Date.now()
        saveTrialStartDate(trialStartDate)
      }

      // Check if trial expired
      const expired = isTrialExpired(trialStartDate)
      const daysRemaining = getTrialDaysRemaining(trialStartDate)
      const inGracePeriod = isInGracePeriod(trialStartDate)

      // Try to verify receipt with native code (optional - for App Store validation)
      try {
        const nativeStatus = await invoke<{
          is_trial: boolean
          is_purchased: boolean
          is_expired: boolean
          days_remaining: number
          trial_start_date: number | null
        }>("check_license_status")

        // If native code says purchased, update storage
        if (nativeStatus.is_purchased) {
          const purchaseStatus: PurchaseStatus = {
            purchased: true,
            purchaseDate: Date.now(),
            productId: "com.bishoylabib.servicebusexplorer.full",
          }
          savePurchaseStatus(purchaseStatus)
          setLicenseStatus({
            isTrial: false,
            isPurchased: true,
            isExpired: false,
            daysRemaining: -1,
            trialStartDate: null,
            isLoading: false,
          })
          return
        }
      } catch (error) {
        console.warn("Failed to check native license status:", error)
        // Continue with local trial check
      }

      setLicenseStatus({
        isTrial: !expired && !inGracePeriod,
        isPurchased: false,
        isExpired: expired && !inGracePeriod,
        daysRemaining,
        trialStartDate,
        isLoading: false,
      })
    } catch (error) {
      console.error("Failed to check license:", error)
      setLicenseStatus((prev) => ({ ...prev, isLoading: false }))
    }
  }, [])

  const initiatePurchase = async () => {
    try {
      const isTauri = typeof window !== "undefined" && "__TAURI__" in window

      if (isTauri) {
        // Try to initiate in-app purchase
        try {
          await invoke("initiate_purchase")
        } catch (error) {
          console.warn("Failed to initiate purchase via Tauri:", error)
          // Fallback: open App Store page
          window.open(
            "https://apps.apple.com/app/azure-service-bus-explorer/id6756694985",
            "_blank"
          )
        }
      } else {
        // Web version: open App Store page
        window.open(
          "https://apps.apple.com/app/azure-service-bus-explorer/id6756694985",
          "_blank"
        )
      }
    } catch (error) {
      console.error("Failed to initiate purchase:", error)
    }
  }

  const refreshLicenseStatus = useCallback(async () => {
    await checkLicense()
  }, [checkLicense])

  // Check license on mount
  useEffect(() => {
    // Initialization: check license status on app start
    // Use setTimeout to defer state update and avoid linter warning
    const timer = setTimeout(() => {
      checkLicense()
    }, 0)
    return () => clearTimeout(timer)
  }, [checkLicense])

  // Poll license status every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      refreshLicenseStatus()
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [refreshLicenseStatus])

  // Listen for manual refresh events (for testing)
  useEffect(() => {
    const handleRefresh = () => {
      refreshLicenseStatus()
    }
    window.addEventListener("license:refresh", handleRefresh)
    return () => {
      window.removeEventListener("license:refresh", handleRefresh)
    }
  }, [refreshLicenseStatus])

  return (
    <LicenseContext.Provider
      value={{
        licenseStatus,
        checkLicense,
        initiatePurchase,
        refreshLicenseStatus,
      }}
    >
      {children}
    </LicenseContext.Provider>
  )
}

export function useLicense() {
  const context = useContext(LicenseContext)
  if (context === undefined) {
    throw new Error("useLicense must be used within a LicenseProvider")
  }
  return context
}

