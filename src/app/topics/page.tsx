"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useConnections } from "@/hooks/useConnections"

export default function TopicsPage() {
  const router = useRouter()
  const { currentConnection, loading } = useConnections()

  useEffect(() => {
    if (loading) return
    
    if (currentConnection) {
      const encodedName = encodeURIComponent(currentConnection.name)
      router.replace(`/${encodedName}/topics`)
    }
  }, [currentConnection, loading, router])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-muted-foreground">No connection selected</p>
    </div>
  )
}

