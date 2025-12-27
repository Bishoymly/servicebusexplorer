"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useConnections } from "@/hooks/useConnections"
import { CheckCircle2, XCircle, Plus, ShoppingCart } from "lucide-react"
import { useLicense } from "@/hooks/useLicense"
import { PurchaseDialog } from "@/components/license/PurchaseDialog"
import { useState } from "react"
import { ConnectionForm } from "@/components/connections/ConnectionForm"
import type { ServiceBusConnection } from "@/types/azure"

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { connections, currentConnectionId, setCurrentConnectionId, currentConnection, addConnection } = useConnections()
  const { licenseStatus } = useLicense()
  const [mounted, setMounted] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleConnectionChange = (newConnectionId: string) => {
    // Special value for "New Connection"
    if (newConnectionId === "__new__") {
      setFormOpen(true)
      // Reset select to current connection (this happens automatically via controlled value)
      return
    }
    
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

  const handleFormSubmit = (data: Omit<ServiceBusConnection, "id" | "createdAt" | "updatedAt">) => {
    const newConnection: ServiceBusConnection = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    addConnection(newConnection)
    setFormOpen(false)
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
                <SelectItem value="__new__" className="text-primary">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    New Connection
                  </div>
                </SelectItem>
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

      <div className="flex items-center gap-4">
        {licenseStatus.isTrial && !licenseStatus.isPurchased && (
          <button
            onClick={() => setPurchaseDialogOpen(true)}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-accent"
          >
            <ShoppingCart className="h-4 w-4" />
            Purchase
          </button>
        )}
      </div>

      <ConnectionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
      />
      <PurchaseDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen} />
    </header>
  )
}

