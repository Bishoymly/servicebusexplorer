"use client"

import { useState } from "react"
import { Plus, RefreshCw, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QueueTable } from "./QueueTable"
import { QueueDetails } from "./QueueDetails"
import { QueueSettingsForm } from "./QueueSettingsForm"
import { QueueMessagesPanel } from "./QueueMessagesPanel"
import { useQueues } from "@/hooks/useQueues"
import { useConnections } from "@/hooks/useConnections"
import type { QueueProperties, QueueSortOption } from "@/types/azure"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useEffect } from "react"

export function QueueList() {
  const { queues, loading, error, sortBy, setSortBy, refresh, refreshQueue, deleteQueue, purgeQueue } = useQueues()
  const { currentConnectionId } = useConnections()
  const [selectedQueue, setSelectedQueue] = useState<QueueProperties | null>(null)
  const [selectedQueueForMessages, setSelectedQueueForMessages] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [refreshingQueues, setRefreshingQueues] = useState<Set<string>>(new Set())
  const [purgingQueues, setPurgingQueues] = useState<Set<string>>(new Set())

  // Clear selected queue when connection changes
  useEffect(() => {
    setSelectedQueue(null)
    setSelectedQueueForMessages(null)
    setShowDetails(false)
    setShowSettings(false)
  }, [currentConnectionId])

  const handleQueueClick = (queue: QueueProperties) => {
    setSelectedQueue(queue)
    setSelectedQueueForMessages(queue.name)
    // Don't show details dialog in split view - messages panel replaces it
    // setShowDetails(true)
  }

  const handleDelete = async (queueName: string) => {
    if (confirm(`Are you sure you want to delete queue "${queueName}"?`)) {
      await deleteQueue(queueName)
      if (selectedQueue?.name === queueName) {
        setSelectedQueue(null)
        setShowDetails(false)
      }
    }
  }

  const handleRefreshQueue = async (queueName: string) => {
    setRefreshingQueues((prev) => new Set(prev).add(queueName))
    try {
      await refreshQueue(queueName)
    } finally {
      setRefreshingQueues((prev) => {
        const next = new Set(prev)
        next.delete(queueName)
        return next
      })
    }
  }

  const handlePurgeQueue = async (queueName: string, purgeDeadLetter: boolean = false) => {
    const confirmMessage = purgeDeadLetter
      ? `Are you sure you want to purge all dead letter messages from "${queueName}"? This action cannot be undone.`
      : `Are you sure you want to purge all messages from "${queueName}"? This action cannot be undone.`
    
    if (!confirm(confirmMessage)) {
      return
    }

    setPurgingQueues((prev) => new Set(prev).add(queueName))
    try {
      const purgedCount = await purgeQueue(queueName, purgeDeadLetter)
      alert(`Successfully purged ${purgedCount} message${purgedCount !== 1 ? "s" : ""} from ${queueName}`)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      alert(`Failed to purge queue: ${errorMessage}`)
    } finally {
      setPurgingQueues((prev) => {
        const next = new Set(prev)
        next.delete(queueName)
        return next
      })
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Left Panel - Queue List */}
      <div className="flex-1 flex flex-col border-r overflow-hidden">
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Queues</h2>
              <p className="text-sm text-muted-foreground">
                {queues.length > 0 && `${queues.length} queue${queues.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as QueueSortOption)}>
                <SelectTrigger className="w-[200px]">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort by Name</SelectItem>
                  <SelectItem value="messageCount">Sort by Message Count</SelectItem>
                  <SelectItem value="deadLetterCount">Sort by Dead Letter Count</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={refresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Queue
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && queues.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading queues...</span>
            </div>
          ) : queues.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No queues found. Create your first queue to get started.</p>
            </div>
          ) : (
            <>
              {loading && queues.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading more queues...</span>
                </div>
              )}
              <QueueTable
                queues={queues}
                onQueueClick={handleQueueClick}
                onEdit={(queue) => {
                  setSelectedQueue(queue)
                  setShowDetails(false)
                  setShowSettings(true)
                }}
                onDelete={handleDelete}
                onRefresh={handleRefreshQueue}
                onPurge={handlePurgeQueue}
                refreshingQueues={refreshingQueues}
                purgingQueues={purgingQueues}
              />
            </>
          )}
        </div>
      </div>

      {/* Right Panel - Messages */}
      {selectedQueueForMessages && (
        <div className="w-1/2 min-w-[500px]">
          <QueueMessagesPanel
            queueName={selectedQueueForMessages}
            onClose={() => setSelectedQueueForMessages(null)}
          />
        </div>
      )}

      {selectedQueue && (
        <>
          <QueueDetails
            queue={selectedQueue}
            open={showDetails}
            onOpenChange={setShowDetails}
            onEdit={() => {
              setShowDetails(false)
              setShowSettings(true)
            }}
            onDelete={() => handleDelete(selectedQueue.name)}
            onRefresh={refresh}
          />
          <QueueSettingsForm
            queue={selectedQueue}
            open={showSettings}
            onOpenChange={setShowSettings}
            onSuccess={refresh}
          />
        </>
      )}

      {showCreateForm && (
        <QueueSettingsForm
          open={showCreateForm}
          onOpenChange={setShowCreateForm}
          onSuccess={() => {
            setShowCreateForm(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}

