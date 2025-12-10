"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { QueueList } from "@/components/queues/QueueList"
import { useConnections } from "@/hooks/useConnections"

export default function ConnectionQueuesPage() {
  const params = useParams()
  const router = useRouter()
  const { connections, setCurrentConnectionId, loading } = useConnections()
  const connectionName = params?.connectionName as string

  useEffect(() => {
    if (loading) return
    
    if (connectionName && connections.length > 0) {
      // Decode the connection name from URL
      const decodedName = decodeURIComponent(connectionName)
      // Find connection by name
      const connection = connections.find((c) => c.name === decodedName)
      
      if (connection) {
        setCurrentConnectionId(connection.id)
      } else {
        // Connection not found, redirect to dashboard
        router.push("/")
      }
    }
  }, [connectionName, connections, loading, setCurrentConnectionId, router])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="h-full">
      <QueueList />
    </div>
  )
}

