"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useConnections } from "@/hooks/useConnections"
import { CheckCircle2, XCircle } from "lucide-react"

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { connections, currentConnectionId, setCurrentConnectionId, currentConnection } = useConnections()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleConnectionChange = (newConnectionId: string) => {
    setCurrentConnectionId(newConnectionId)
    
    // If we're on a queues or topics page, redirect to the new connection's page
    const newConnection = connections.find((c) => c.id === newConnectionId)
    if (newConnection && pathname) {
      const encodedName = encodeURIComponent(newConnection.name)
      
      // Check if we're on a queues or topics page (including connection-specific routes)
      if (pathname.includes("/queues")) {
        router.push(`/${encodedName}/queues`)
      } else if (pathname.includes("/topics")) {
        router.push(`/${encodedName}/topics`)
      }
    }
  }

  return (
    <header className="flex h-16 items-center border-b bg-background px-6">
      <div className="flex items-center gap-4 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Connection:</span>
          {mounted ? (
            <Select value={currentConnectionId || undefined} onValueChange={handleConnectionChange}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a connection" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((connection) => (
                  <SelectItem key={connection.id} value={connection.id}>
                    <div className="flex items-center gap-2">
                      {connection.name}
                      {connection.useAzureAD && (
                        <span className="text-xs text-muted-foreground">({connection.namespace})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select disabled>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a connection" />
              </SelectTrigger>
            </Select>
          )}
        </div>
        {currentConnection && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Connected</span>
          </div>
        )}
        {!currentConnection && connections.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <XCircle className="h-4 w-4 text-gray-400" />
            <span>No connection selected</span>
          </div>
        )}
      </div>
    </header>
  )
}

