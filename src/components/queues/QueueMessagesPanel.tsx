"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { RefreshCw, Trash2, Send, X, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InlineMessageViewer } from "./InlineMessageViewer"
import { MessageEditor } from "@/components/messages/MessageEditor"
import { QueueSettingsForm } from "./QueueSettingsForm"
import { useMessages } from "@/hooks/useMessages"
import { useQueues } from "@/hooks/useQueues"
import { useTreeRefresh } from "@/contexts/TreeRefreshContext"
import type { ServiceBusMessage, ServiceBusConnection, QueueProperties } from "@/types/azure"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"

interface QueueMessagesPanelProps {
  queueName: string
  connection: ServiceBusConnection
  initialShowDeadLetter?: boolean
  initialQueueProperties?: QueueProperties
  onClose?: () => void
  onQueueDeleted?: () => void
  onQueueUpdated?: () => void
}

export function QueueMessagesPanel({ queueName, connection, initialShowDeadLetter = false, initialQueueProperties, onClose, onQueueDeleted, onQueueUpdated }: QueueMessagesPanelProps) {
  const { peekMessages, peekDeadLetterMessages, loading, error } = useMessages(connection)
  const { purgeQueue, refreshQueue, getQueue } = useQueues(connection)
  const { updateQueueInTree } = useTreeRefresh()
  const [messages, setMessages] = useState<ServiceBusMessage[]>([])
  const [maxCount, setMaxCount] = useState(100)
  const [activeTab, setActiveTab] = useState<"active" | "deadletter">(initialShowDeadLetter ? "deadletter" : "active")
  // Initialize with provided queue properties, or null if not provided
  const [queueProperties, setQueueProperties] = useState<QueueProperties | null>(initialQueueProperties || null)
  const [purging, setPurging] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showPurgeConfirmDialog, setShowPurgeConfirmDialog] = useState(false)
  const manuallyRefreshedRef = useRef(false)
  const lastSyncedCountsRef = useRef<{ active: number; deadLetter: number } | null>(null)
  const onQueueUpdatedRef = useRef(onQueueUpdated)
  
  // Keep ref updated
  useEffect(() => {
    onQueueUpdatedRef.current = onQueueUpdated
  }, [onQueueUpdated])

  // Update activeTab when initialShowDeadLetter prop changes
  useEffect(() => {
    setActiveTab(initialShowDeadLetter ? "deadletter" : "active")
  }, [initialShowDeadLetter])

  // Reset purging state when queueName changes (user switches queues) or component unmounts
  useEffect(() => {
    setPurging(false)
    setShowPurgeConfirmDialog(false)
    manuallyRefreshedRef.current = false // Reset manual refresh flag when queue changes
    
    // Cleanup function to reset state on unmount
    return () => {
      setPurging(false)
      setShowPurgeConfirmDialog(false)
    }
  }, [queueName])

  const loadMessages = useCallback(async (refreshProperties: boolean = false) => {
    // Don't load if connection is not ready
    if (!connection || !queueName) {
      return
    }
    
    setMessages([])
    try {
      let msgs: ServiceBusMessage[] = []
      if (activeTab === "deadletter") {
        msgs = await peekDeadLetterMessages(queueName, undefined, maxCount)
        setMessages(msgs)
      } else {
        // Active messages - peek regular messages
        msgs = await peekMessages(queueName, maxCount)
        setMessages(msgs)
      }
      
      // Refresh queue properties if requested (e.g., when user clicks refresh button)
      if (refreshProperties) {
        // Check if we got maxCount messages - if so, don't update counts (might be hitting limit)
        const messageCount = msgs.length
        const hitMaxCount = messageCount >= maxCount
        
        if (hitMaxCount) {
          console.log("[loadMessages] Got maxCount messages, skipping queue property update (count might be inaccurate)")
          return
        }
        
        // Get updated queue properties
        const queue = await getQueue(queueName)
        if (queue) {
          // Only update if counts are different from what we currently have
          // Use functional update to read current state without including it in dependencies
          let shouldUpdate = false
          setQueueProperties(current => {
            const currentActiveCount = current?.activeMessageCount ?? 0
            const currentDeadLetterCount = current?.deadLetterMessageCount ?? 0
            const newActiveCount = queue.activeMessageCount ?? 0
            const newDeadLetterCount = queue.deadLetterMessageCount ?? 0
            
            const countsChanged = 
              currentActiveCount !== newActiveCount ||
              currentDeadLetterCount !== newDeadLetterCount
            
            if (!countsChanged) {
              console.log("[loadMessages] Queue counts unchanged, skipping update:", {
                activeMessageCount: newActiveCount,
                deadLetterMessageCount: newDeadLetterCount
              })
              return current // No change, return current state
            }
            
            console.log("[loadMessages] Refreshing queue properties (counts changed):", {
              name: queue.name,
              oldActiveCount: currentActiveCount,
              newActiveCount: newActiveCount,
              oldDeadLetterCount: currentDeadLetterCount,
              newDeadLetterCount: newDeadLetterCount
            })
            shouldUpdate = true
            manuallyRefreshedRef.current = true // Mark as manually refreshed
            return queue
          })
          
          // Only do the expensive operations if we actually updated
          if (shouldUpdate) {
            // Update in useQueues hook
            await refreshQueue(queueName)
            
            // Update tree (this will also call getQueue, but that's okay for consistency)
            if (updateQueueInTree && connection?.id) {
              try {
                await updateQueueInTree(connection.id, queueName)
              } catch (err) {
                console.warn("Could not update queue in tree:", err)
              }
            }
            
          // Notify parent to refresh (this will update the parent's queueProperties prop)
          // Use ref to avoid including onQueueUpdated in dependencies
          if (onQueueUpdatedRef.current) {
            onQueueUpdatedRef.current()
          }
          }
        }
      }
    } catch (err) {
      console.error("Failed to load messages:", err)
    }
  }, [queueName, activeTab, maxCount, connection, peekMessages, peekDeadLetterMessages, refreshQueue, getQueue, updateQueueInTree])

  // Update queue properties when queueName changes (not when initialQueueProperties changes)
  // This prevents overriding manual refreshes
  useEffect(() => {
    // Skip if we don't have a queueName yet
    if (!queueName) return
    
    // Reset manual refresh flag and last synced counts when queue changes
    manuallyRefreshedRef.current = false
    lastSyncedCountsRef.current = null
    
    // Use initialQueueProperties if available, otherwise load
    if (initialQueueProperties) {
      console.log("Setting queue properties from initialQueueProperties (queueName changed):", {
        name: initialQueueProperties.name,
        activeMessageCount: initialQueueProperties.activeMessageCount,
        deadLetterMessageCount: initialQueueProperties.deadLetterMessageCount
      })
      setQueueProperties(initialQueueProperties)
    } else {
      // Fallback: load properties if not provided
      const loadQueueProperties = async () => {
        try {
          const queue = await getQueue(queueName)
          if (queue) {
            console.log("Setting queue properties from getQueue (queueName changed):", {
              name: queue.name,
              activeMessageCount: queue.activeMessageCount,
              deadLetterMessageCount: queue.deadLetterMessageCount
            })
            setQueueProperties(queue)
          }
        } catch (err) {
          console.error("Failed to load queue properties:", err)
        }
      }
      loadQueueProperties()
    }
  }, [queueName, getQueue]) // Only depend on queueName, not initialQueueProperties
  
  // Sync with initialQueueProperties when it changes (but only if we haven't manually refreshed)
  // Use a ref to track the last synced counts to avoid infinite loops
  useEffect(() => {
    if (!queueName || !initialQueueProperties) return
    
    const newActiveCount = initialQueueProperties.activeMessageCount || 0
    const newDeadLetterCount = initialQueueProperties.deadLetterMessageCount || 0
    
    // Check if this is the same as what we last synced
    if (lastSyncedCountsRef.current &&
        lastSyncedCountsRef.current.active === newActiveCount &&
        lastSyncedCountsRef.current.deadLetter === newDeadLetterCount) {
      // Already synced with these counts, skip
      return
    }
    
    // Only sync if we haven't manually refreshed
    if (!manuallyRefreshedRef.current) {
      console.log("Syncing queue properties from initialQueueProperties:", {
        name: initialQueueProperties.name,
        activeMessageCount: newActiveCount,
        deadLetterMessageCount: newDeadLetterCount
      })
      setQueueProperties(initialQueueProperties)
      lastSyncedCountsRef.current = {
        active: newActiveCount,
        deadLetter: newDeadLetterCount
      }
    } else {
      // We manually refreshed, but check if counts are significantly different
      // (meaning the parent was updated from elsewhere)
      // Use functional update to read current state without including it in dependencies
      setQueueProperties(current => {
        const currentActiveCount = current?.activeMessageCount ?? 0
        const currentDeadLetterCount = current?.deadLetterMessageCount ?? 0
        
        const countsDifferent = 
          currentActiveCount !== newActiveCount ||
          currentDeadLetterCount !== newDeadLetterCount
        
        if (countsDifferent) {
          console.log("Syncing queue properties from initialQueueProperties (counts changed after manual refresh):", {
            name: initialQueueProperties.name,
            oldActiveCount: currentActiveCount,
            newActiveCount: newActiveCount,
            oldDeadLetterCount: currentDeadLetterCount,
            newDeadLetterCount: newDeadLetterCount
          })
          lastSyncedCountsRef.current = {
            active: newActiveCount,
            deadLetter: newDeadLetterCount
          }
          manuallyRefreshedRef.current = false // Reset after syncing
          return initialQueueProperties
        }
        return current // No change, return current state
      })
    }
  }, [initialQueueProperties, queueName]) // Removed queueProperties from dependencies to prevent infinite loop

  // Load messages when queueName, activeTab, maxCount, or connection changes
  // Don't depend on loadMessages itself to avoid infinite loops - use direct dependencies
  useEffect(() => {
    if (!connection || !queueName) return
    
    const load = async () => {
      setMessages([])
      try {
        let msgs: ServiceBusMessage[] = []
        if (activeTab === "deadletter") {
          msgs = await peekDeadLetterMessages(queueName, undefined, maxCount)
          setMessages(msgs)
        } else {
          msgs = await peekMessages(queueName, maxCount)
          setMessages(msgs)
        }
      } catch (err) {
        console.error("Failed to load messages:", err)
      }
    }
    
    load()
  }, [queueName, activeTab, maxCount, connection, peekMessages, peekDeadLetterMessages])

  const handleResend = async (message: ServiceBusMessage) => {
    // TODO: Implement resend functionality
    console.log("Resend message:", message)
  }

  const handlePurgeClick = () => {
    console.log("[handlePurgeClick] Button clicked, activeTab:", activeTab)
    setShowPurgeConfirmDialog(true)
  }

  const handlePurgeConfirm = async () => {
    console.log("[handlePurgeConfirm] Confirming purge, activeTab:", activeTab, "queueName:", queueName)
    setShowPurgeConfirmDialog(false)
    setPurging(true)
    
    const isDeadLetter = activeTab === "deadletter"
    let purgedCount = 0
    let purgeError: Error | null = null
    
    try {
      console.log("[handlePurgeConfirm] Calling purgeQueue with:", { queueName, isDeadLetter })
      purgedCount = await purgeQueue(queueName, isDeadLetter)
      console.log("[handlePurgeConfirm] Purged count:", purgedCount)
    } catch (err: unknown) {
      console.error("[handlePurgeConfirm] Purge error:", err)
      purgeError = err instanceof Error ? err : new Error(String(err))
    }
    
    if (purgeError) {
      // Reset purging state on error
      setPurging(false)
      const errorMessage = purgeError.message || "Unknown error"
      setTimeout(() => {
        alert(`Failed to purge queue: ${errorMessage}`)
      }, 100)
      return
    }
    
    // Show success message (non-blocking)
    const successMessage = `Successfully purged ${purgedCount} message${purgedCount !== 1 ? "s" : ""} from ${queueName}`
    setTimeout(() => {
      alert(successMessage)
    }, 100)
    
    try {
      // Reload messages immediately after purge (don't refresh properties here to avoid redundant calls)
      await loadMessages(false)
      
      // Wait a moment for Azure to update counts (reduced from 500ms)
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Get updated queue once - this will be used for all updates
      // Note: refreshQueue and updateQueueInTree will also call getQueue, but that's acceptable
      // to ensure consistency. The main optimization is avoiding full list refreshes.
      const queue = await getQueue(queueName)
      if (queue) {
        setQueueProperties(queue)
        
        // Update in useQueues hook (calls getQueue again, but that's okay for consistency)
        await refreshQueue(queueName)
        
        // Update tree (calls getQueue again, but that's okay for consistency)
        if (updateQueueInTree && connection?.id) {
          console.log("[handlePurgeConfirm] Updating queue in tree:", { connectionId: connection.id, queueName })
          try {
            await updateQueueInTree(connection.id, queueName)
          } catch (err) {
            console.warn("[handlePurgeConfirm] Could not update queue in tree:", err)
          }
        }
        
        // Notify parent to refresh (this will update the parent's queueProperties prop)
        // Do this last to avoid triggering multiple refreshes
        // IMPORTANT: This should NOT trigger refreshConnection or loadConnectionData
        if (onQueueUpdatedRef.current) {
          console.log("[handlePurgeConfirm] Calling onQueueUpdated")
          onQueueUpdatedRef.current()
        }
      }
    } catch (err: unknown) {
      console.error("[handlePurgeConfirm] Error refreshing after purge:", err)
      // Don't show another alert, just log the error
    } finally {
      // Always reset purging state after all operations complete
      setPurging(false)
    }
  }

  const handleSendSuccess = async () => {
    // Reload messages after sending
    await loadMessages()
    // Refresh queue counts - this will update the queues list
    await refreshQueue(queueName)
    // Reload queue properties to update badges with fresh counts
    const queue = await getQueue(queueName)
    if (queue) {
      setQueueProperties(queue)
    }
    // Notify parent to refresh the queue list
    if (onQueueUpdated) {
      onQueueUpdated()
    }
  }

  const handleEditSuccess = async () => {
    // Reload queue properties after editing
    const queue = await getQueue(queueName)
    if (queue) {
      setQueueProperties(queue)
    }
    setShowEditDialog(false)
    // Refresh tree view
    if (onQueueUpdated) {
      onQueueUpdated()
    }
  }

  const handleQueueDeleted = () => {
    // Close the panel when queue is deleted
    if (onClose) {
      onClose()
    }
    // Refresh tree view
    if (onQueueDeleted) {
      onQueueDeleted()
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">{queueName}</h3>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={(v) => {
            if (v === "active" || v === "deadletter") {
              setActiveTab(v)
            }
          }}>
            <TabsList>
              <TabsTrigger value="active" className="flex items-center gap-1.5">
                Active
                {(() => {
                  const count = queueProperties?.activeMessageCount
                  console.log("Rendering Active tab badge:", { count, queueProperties: queueProperties ? { name: queueProperties.name, activeMessageCount: queueProperties.activeMessageCount } : null })
                  return count !== undefined && count > 0 ? (
                    <Badge variant="secondary" className="h-4 px-1.5 text-xs min-w-[1.5rem] flex items-center justify-center">
                      {count}
                    </Badge>
                  ) : null
                })()}
              </TabsTrigger>
              <TabsTrigger value="deadletter" className="flex items-center gap-1.5">
                Dead Letter
                {(() => {
                  const count = queueProperties?.deadLetterMessageCount
                  console.log("Rendering Dead Letter tab badge:", { count, queueProperties: queueProperties ? { name: queueProperties.name, deadLetterMessageCount: queueProperties.deadLetterMessageCount } : null })
                  return count !== undefined && count > 0 ? (
                    <Badge variant="destructive" className="h-4 px-1.5 text-xs min-w-[1.5rem] flex items-center justify-center">
                      {count}
                    </Badge>
                  ) : null
                })()}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
              disabled={!queueProperties}
            >
              <Settings className="h-4 w-4 mr-2" />
              Edit Queue
            </Button>
            {activeTab === "active" && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowSendDialog(true)}
                disabled={loading}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handlePurgeClick}
              disabled={purging || loading}
            >
              <Trash2 className={`h-4 w-4 mr-2 ${purging ? "animate-spin" : ""}`} />
              Purge {activeTab === "deadletter" ? "Dead Letter" : "Queue"}
            </Button>
            <Label htmlFor="maxCount" className="text-xs text-muted-foreground">
              Max:
            </Label>
            <Input
              id="maxCount"
              type="number"
              value={maxCount}
              onChange={(e) => setMaxCount(parseInt(e.target.value) || 100)}
              className="w-20 h-8 text-xs"
              min={1}
              max={1000}
            />
            <Button variant="outline" size="sm" onClick={() => loadMessages(true)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="px-4 pt-2">
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No messages found.</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <InlineMessageViewer
              key={message.messageId || `msg-${index}`}
              message={message}
              onResend={() => handleResend(message)}
            />
          ))
        )}
      </div>

      {/* Send Message Dialog */}
      <MessageEditor
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        queueName={queueName}
        connection={connection}
        onSuccess={handleSendSuccess}
      />

      {/* Edit Queue Dialog */}
      {queueProperties && (
        <QueueSettingsForm
          queue={queueProperties}
          connection={connection}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSuccess={handleEditSuccess}
          onDelete={handleQueueDeleted}
        />
      )}

      {/* Purge Confirmation Dialog */}
      <Dialog open={showPurgeConfirmDialog} onOpenChange={setShowPurgeConfirmDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Purge {activeTab === "deadletter" ? "Dead Letter Messages" : "Queue Messages"}
            </DialogTitle>
            <DialogDescription>
              {activeTab === "deadletter"
                ? `Are you sure you want to purge all dead letter messages from "${queueName}"? This action cannot be undone.`
                : `Are you sure you want to purge all messages from "${queueName}"? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPurgeConfirmDialog(false)}
              disabled={purging}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handlePurgeConfirm}
              disabled={purging}
            >
              {purging ? "Purging..." : "Purge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

