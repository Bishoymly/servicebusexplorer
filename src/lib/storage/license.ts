const STORAGE_KEY_TRIAL_START = "servicebusexplorer_trial_start"
const STORAGE_KEY_PURCHASE_STATUS = "servicebusexplorer_purchase_status"
const TRIAL_DURATION_DAYS = 3
const GRACE_PERIOD_DAYS = 1

export interface PurchaseStatus {
  purchased: boolean
  purchaseDate?: number
  receiptData?: string
  productId?: string
}

export function saveTrialStartDate(timestamp: number): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY_TRIAL_START, timestamp.toString())
  } catch (error) {
    console.error("Failed to save trial start date:", error)
  }
}

export function loadTrialStartDate(): number | null {
  if (typeof window === "undefined") return null
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TRIAL_START)
    if (saved) {
      return parseInt(saved, 10)
    }
  } catch (error) {
    console.error("Failed to load trial start date:", error)
  }
  return null
}

export function savePurchaseStatus(status: PurchaseStatus): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY_PURCHASE_STATUS, JSON.stringify(status))
  } catch (error) {
    console.error("Failed to save purchase status:", error)
  }
}

export function loadPurchaseStatus(): PurchaseStatus | null {
  if (typeof window === "undefined") return null
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PURCHASE_STATUS)
    if (saved) {
      return JSON.parse(saved) as PurchaseStatus
    }
  } catch (error) {
    console.error("Failed to load purchase status:", error)
  }
  return null
}

export function isTrialExpired(trialStartDate: number | null): boolean {
  if (!trialStartDate) return false
  
  const now = Date.now()
  const trialEndTime = trialStartDate + (TRIAL_DURATION_DAYS + GRACE_PERIOD_DAYS) * 24 * 60 * 60 * 1000
  
  return now > trialEndTime
}

export function getTrialDaysRemaining(trialStartDate: number | null): number {
  if (!trialStartDate) return TRIAL_DURATION_DAYS
  
  const now = Date.now()
  const trialEndTime = trialStartDate + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000
  const remainingMs = trialEndTime - now
  
  if (remainingMs <= 0) {
    // Check if we're in grace period
    const graceEndTime = trialStartDate + (TRIAL_DURATION_DAYS + GRACE_PERIOD_DAYS) * 24 * 60 * 60 * 1000
    const graceRemainingMs = graceEndTime - now
    if (graceRemainingMs > 0) {
      return 0 // Trial expired but in grace period
    }
    return -1 // Fully expired
  }
  
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
}

export function isInGracePeriod(trialStartDate: number | null): boolean {
  if (!trialStartDate) return false
  
  const now = Date.now()
  const trialEndTime = trialStartDate + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000
  const graceEndTime = trialStartDate + (TRIAL_DURATION_DAYS + GRACE_PERIOD_DAYS) * 24 * 60 * 60 * 1000
  
  return now > trialEndTime && now <= graceEndTime
}

