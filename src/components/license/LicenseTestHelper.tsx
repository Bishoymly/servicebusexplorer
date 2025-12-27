"use client"

import { useEffect } from "react"

/**
 * License Test Helper Component
 * 
 * Makes testLicense available globally in development mode
 * Only loads in development builds
 */
export function LicenseTestHelper() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      import("@/lib/storage/license-test-helper").then(() => {
        console.log(
          "🧪 License testing helper loaded! Use testLicense.status() to check state."
        )
      })
    }
  }, [])

  return null
}

