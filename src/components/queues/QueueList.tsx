"use client"

import { useState, useMemo } from "react"
import { Plus, RefreshCw, ArrowUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  const [showDeadLetterForQueue, setShowDeadLetterForQueue] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [refreshingQueues, setRefreshingQueues] = useState<Set<string>>(new Set())
  const [purgingQueues, setPurgingQueues] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")

  // Filter queues by search query
  const filteredQueues = useMemo(() => {
    if (!searchQuery.trim()) {
      return queues
    }
    const query = searchQuery.toLowerCase().trim()
    return queues.filter((queue) => 
      queue.name.toLowerCase().includes(query)
    )
  }, [queues, searchQuery])

  // Clear selected queue when connection changes
  useEffect(() => {
    setSelectedQueue(null)
    setSelectedQueueForMessages(null)
    setShowDeadLetterForQueue(null)
    setShowDetails(false)
    setShowSettings(false)
  }, [currentConnectionId])

  const handleQueueClick = (queue: QueueProperties) => {
    setSelectedQueue(queue)
    setSelectedQueueForMessages(queue.name)
    setShowDeadLetterForQueue(null) // Clear dead letter flag for regular click
    // Don't show details dialog in split view - messages panel replaces it
    // setShowDetails(true)
  }

  const handleQueueClickDeadLetter = (queue: QueueProperties) => {
    setSelectedQueue(queue)
    setSelectedQueueForMessages(queue.name)
    setShowDeadLetterForQueue(queue.name) // Set flag to show dead letter
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
                {filteredQueues.length > 0 && (
                  <>
                    {filteredQueues.length} of {queues.length} queue{queues.length !== 1 ? "s" : ""}
                    {searchQuery && ` matching "${searchQuery}"`}
                  </>
                )}
                {filteredQueues.length === 0 && queues.length > 0 && searchQuery && (
                  <>No queues found matching "{searchQuery}"</>
                )}
                {queues.length === 0 && !loading && "No queues found"}
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

          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search queues by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="h-9"
              >
                Clear
              </Button>
            )}
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
          ) : filteredQueues.length === 0 && !loading ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? (
                <p>No queues found matching "{searchQuery}". Try a different search term.</p>
              ) : (
                <p>No queues found. Create your first queue to get started.</p>
              )}
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
                queues={filteredQueues}
                onQueueClick={handleQueueClick}
                onQueueClickDeadLetter={handleQueueClickDeadLetter}
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
            initialShowDeadLetter={showDeadLetterForQueue === selectedQueueForMessages}
            onClose={() => {
              setSelectedQueueForMessages(null)
              setShowDeadLetterForQueue(null)
            }}
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

