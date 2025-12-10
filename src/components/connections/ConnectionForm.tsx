"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import type { ServiceBusConnection } from "@/types/azure"

interface ConnectionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (connection: Omit<ServiceBusConnection, "id" | "createdAt" | "updatedAt">) => void
  initialData?: ServiceBusConnection
}

export function ConnectionForm({ open, onOpenChange, onSubmit, initialData }: ConnectionFormProps) {
  const [name, setName] = useState(initialData?.name || "")
  const [useAzureAD, setUseAzureAD] = useState(initialData?.useAzureAD || false)
  const [connectionString, setConnectionString] = useState(initialData?.connectionString || "")
  const [namespace, setNamespace] = useState(initialData?.namespace || "")
  const [tenantId, setTenantId] = useState(initialData?.tenantId || "")
  const [clientId, setClientId] = useState(initialData?.clientId || "")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name,
      connectionString: useAzureAD ? undefined : connectionString,
      namespace: useAzureAD ? namespace : undefined,
      useAzureAD,
      tenantId: useAzureAD ? tenantId : undefined,
      clientId: useAzureAD ? clientId : undefined,
    })
    onOpenChange(false)
    // Reset form
    setName("")
    setUseAzureAD(false)
    setConnectionString("")
    setNamespace("")
    setTenantId("")
    setClientId("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Connection" : "Add Connection"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Connection Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Service Bus"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useAzureAD"
                  checked={useAzureAD}
                  onChange={(e) => setUseAzureAD(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="useAzureAD">Use Azure AD Authentication</Label>
              </div>
            </div>

            {useAzureAD ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="namespace">Namespace</Label>
                  <Input
                    id="namespace"
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value)}
                    placeholder="my-namespace"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenantId">Tenant ID (Optional)</Label>
                  <Input
                    id="tenantId"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientId">Client ID (Optional)</Label>
                  <Input
                    id="clientId"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="connectionString">Connection String</Label>
                <Input
                  id="connectionString"
                  type="password"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="Endpoint=sb://..."
                  required
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{initialData ? "Update" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

