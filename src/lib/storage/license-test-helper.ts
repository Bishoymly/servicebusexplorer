/**
 * License Testing Helper
 * 
 * This file provides utilities for testing the license system.
 * Import and use these functions in browser console or test files.
 * 
 * Usage in browser console:
 *   import { testLicense } from '@/lib/storage/license-test-helper'
 *   testLicense.reset()
 */

import {
  saveTrialStartDate,
  savePurchaseStatus,
  loadTrialStartDate,
  loadPurchaseStatus,
  getTrialDaysRemaining,
  isTrialExpired,
  isInGracePeriod,
} from "./license"

export const testLicense = {
  /**
   * Reset to fresh install state (no trial, no purchase)
   */
  reset: () => {
    if (typeof window === "undefined") {
      console.error("testLicense can only be used in browser")
      return
    }
    localStorage.removeItem("servicebusexplorer_trial_start")
    localStorage.removeItem("servicebusexplorer_purchase_status")
    console.log("✅ License reset - ready for fresh install")
    // Trigger refresh instead of reload for faster testing
    window.dispatchEvent(new CustomEvent("license:refresh"))
    setTimeout(() => window.location.reload(), 100)
  },

  /**
   * Set trial to specific number of days remaining
   * @param days - Number of days remaining (0-3)
   */
  setTrialDays: (days: number) => {
    if (typeof window === "undefined") {
      console.error("testLicense can only be used in browser")
      return
    }
    if (days < 0 || days > 3) {
      console.error("Days must be between 0 and 3")
      return
    }
    const startDate = Date.now() - (3 - days) * 24 * 60 * 60 * 1000
    saveTrialStartDate(startDate)
    localStorage.removeItem("servicebusexplorer_purchase_status")
    console.log(`✅ Trial set to ${days} day(s) remaining`)
    window.dispatchEvent(new CustomEvent("license:refresh"))
    setTimeout(() => window.location.reload(), 100)
  },

  /**
   * Set trial to expired state (after grace period)
   */
  expireTrial: () => {
    if (typeof window === "undefined") {
      console.error("testLicense can only be used in browser")
      return
    }
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000
    saveTrialStartDate(fiveDaysAgo)
    localStorage.removeItem("servicebusexplorer_purchase_status")
    console.log("✅ Trial expired (after grace period)")
    window.dispatchEvent(new CustomEvent("license:refresh"))
    setTimeout(() => window.location.reload(), 100)
  },

  /**
   * Set trial to grace period (expired but still accessible)
   */
  setGracePeriod: () => {
    if (typeof window === "undefined") {
      console.error("testLicense can only be used in browser")
      return
    }
    const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000
    saveTrialStartDate(fourDaysAgo)
    localStorage.removeItem("servicebusexplorer_purchase_status")
    console.log("✅ Trial in grace period")
    window.dispatchEvent(new CustomEvent("license:refresh"))
    setTimeout(() => window.location.reload(), 100)
  },

  /**
   * Set to purchased state
   */
  setPurchased: () => {
    if (typeof window === "undefined") {
      console.error("testLicense can only be used in browser")
      return
    }
    savePurchaseStatus({
      purchased: true,
      purchaseDate: Date.now(),
      productId: "com.bishoylabib.servicebusexplorer.full",
    })
    console.log("✅ License set to purchased")
    window.dispatchEvent(new CustomEvent("license:refresh"))
    setTimeout(() => window.location.reload(), 100)
  },

  /**
   * Manually refresh license status (without reload)
   */
  refresh: () => {
    if (typeof window === "undefined") {
      console.error("testLicense can only be used in browser")
      return
    }
    // Dispatch a custom event that LicenseContext can listen to
    window.dispatchEvent(new CustomEvent("license:refresh"))
    console.log("✅ License refresh triggered")
  },

  /**
   * Show current license status
   */
  status: () => {
    if (typeof window === "undefined") {
      console.error("testLicense can only be used in browser")
      return
    }
    const trialStart = loadTrialStartDate()
    const purchase = loadPurchaseStatus()
    const daysRemaining = getTrialDaysRemaining(trialStart)
    const expired = isTrialExpired(trialStart)
    const gracePeriod = isInGracePeriod(trialStart)

    const status = {
      "Trial Start": trialStart ? new Date(trialStart).toLocaleString() : "Not set",
      "Purchase Status": purchase?.purchased ? "Purchased" : "Not purchased",
      "Days Remaining": daysRemaining,
      "Is Expired": expired,
      "In Grace Period": gracePeriod,
      "Full Access": purchase?.purchased || (!expired && !gracePeriod),
    }

    console.table(status)
    return status
  },

  /**
   * Get raw localStorage values for debugging
   */
  debug: () => {
    if (typeof window === "undefined") {
      console.error("testLicense can only be used in browser")
      return
    }
    const trialStart = localStorage.getItem("servicebusexplorer_trial_start")
    const purchase = localStorage.getItem("servicebusexplorer_purchase_status")

    console.log("=== License Debug Info ===")
    console.log("Trial Start (raw):", trialStart)
    console.log("Purchase Status (raw):", purchase)
    if (trialStart) {
      const start = parseInt(trialStart, 10)
      const now = Date.now()
      const elapsed = now - start
      const daysElapsed = elapsed / (24 * 60 * 60 * 1000)
      console.log("Days Since Trial Start:", daysElapsed.toFixed(2))
    }
    if (purchase) {
      try {
        console.log("Purchase Status (parsed):", JSON.parse(purchase))
      } catch (e) {
        console.error("Failed to parse purchase status:", e)
      }
    }
  },
}

// Make available globally in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  ;(window as any).testLicense = testLicense
  console.log(
    "🧪 License testing helper available! Use testLicense.status() to check state, or testLicense.reset() to reset."
  )
}

