"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { apiClient } from "@/lib/api/client"
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
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      setName(initialData?.name || "")
      setUseAzureAD(initialData?.useAzureAD || false)
      setConnectionString(initialData?.connectionString || "")
      setNamespace(initialData?.namespace || "")
      setTenantId(initialData?.tenantId || "")
      setClientId(initialData?.clientId || "")
      setTestResult(null)
    }
  }, [open, initialData])

  const handleTest = async () => {
    // Validate required fields
    if (!name.trim()) {
      setTestResult({ success: false, message: "Please enter a connection name" })
      return
    }

    if (useAzureAD && !namespace.trim()) {
      setTestResult({ success: false, message: "Please enter a namespace" })
      return
    }

    if (!useAzureAD && !connectionString.trim()) {
      setTestResult({ success: false, message: "Please enter a connection string" })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const testConnection: Omit<ServiceBusConnection, "id" | "createdAt" | "updatedAt"> = {
        name,
        connectionString: useAzureAD ? undefined : connectionString,
        namespace: useAzureAD ? namespace : undefined,
        useAzureAD,
        tenantId: useAzureAD ? tenantId : undefined,
        clientId: useAzureAD ? clientId : undefined,
      }

      const success = await apiClient.testConnection(testConnection)
      if (success) {
        setTestResult({ success: true, message: "Connection test successful!" })
      } else {
        setTestResult({ success: false, message: "Connection test failed. Please check your credentials." })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      setTestResult({ success: false, message: `Connection test failed: ${errorMessage}` })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!name.trim()) {
      setTestResult({ success: false, message: "Please enter a connection name" })
      return
    }

    if (useAzureAD && !namespace.trim()) {
      setTestResult({ success: false, message: "Please enter a namespace" })
      return
    }

    if (!useAzureAD && !connectionString.trim()) {
      setTestResult({ success: false, message: "Please enter a connection string" })
      return
    }

    // Validate connection string before testing
    if (!useAzureAD) {
      const trimmed = connectionString.trim()
      if (!trimmed) {
        setTestResult({ 
          success: false, 
          message: "Connection string is required" 
        })
        setTesting(false)
        return
      }
      // Basic validation: connection string should contain Endpoint=
      if (!trimmed.includes("Endpoint=")) {
        setTestResult({ 
          success: false, 
          message: "Invalid connection string format. It must include 'Endpoint='." 
        })
        setTesting(false)
        return
      }
    } else {
      // Validate Azure AD fields
      if (!namespace?.trim()) {
        setTestResult({ 
          success: false, 
          message: "Namespace is required for Azure AD authentication" 
        })
        setTesting(false)
        return
      }
    }

    // Automatically test connection before adding/updating
    setTesting(true)
    setTestResult(null)

    try {
      const testConnection: Omit<ServiceBusConnection, "id" | "createdAt" | "updatedAt"> = {
        name,
        connectionString: useAzureAD ? undefined : connectionString.trim(),
        namespace: useAzureAD ? namespace?.trim() : undefined,
        useAzureAD,
        tenantId: useAzureAD ? tenantId : undefined,
        clientId: useAzureAD ? clientId : undefined,
      }

      let success: boolean
      try {
        success = await apiClient.testConnection(testConnection)
      } catch (error) {
        // If testConnection throws an error, it means the test failed
        const errorMessage = error instanceof Error ? error.message : String(error)
        setTestResult({ 
          success: false, 
          message: errorMessage
        })
        setTesting(false)
        return
      }
      
      if (!success) {
        setTestResult({ 
          success: false, 
          message: "Connection test failed. Please check your credentials and try again." 
        })
        setTesting(false)
        return
      }

      // Test passed - proceed with adding/updating
      setTestResult({ success: true, message: "Connection test successful! Saving..." })
      
      onSubmit({
        name,
        connectionString: useAzureAD ? undefined : connectionString,
        namespace: useAzureAD ? namespace : undefined,
        useAzureAD,
        tenantId: useAzureAD ? tenantId : undefined,
        clientId: useAzureAD ? clientId : undefined,
      })
      
      // Close dialog and reset form
      onOpenChange(false)
      setName("")
      setUseAzureAD(false)
      setConnectionString("")
      setNamespace("")
      setTenantId("")
      setClientId("")
      setTestResult(null)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      setTestResult({ 
        success: false, 
        message: `Connection test failed: ${errorMessage}. Please check your credentials and try again.` 
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Connection" : "Add Connection"}</DialogTitle>
          <DialogDescription>
            {initialData ? "Update your connection settings" : "Enter your Azure Service Bus connection details"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {testResult && !testing && testResult.success && (
              <Alert variant="default">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription>{testResult.message}</AlertDescription>
                </div>
              </Alert>
            )}
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
                  {testing && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Testing connection...</span>
                    </div>
                  )}
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
                  onChange={(e) => {
                    setConnectionString(e.target.value)
                    // Clear error when user starts typing
                    if (testResult && !testResult.success) {
                      setTestResult(null)
                    }
                  }}
                  placeholder="Endpoint=sb://..."
                  required
                  className={testResult && !testResult.success ? "border-destructive" : ""}
                />
                {testing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Testing connection...</span>
                  </div>
                )}
                {testResult && !testResult.success && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    {testResult.message}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={testing}
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                initialData ? "Update" : "Add"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

