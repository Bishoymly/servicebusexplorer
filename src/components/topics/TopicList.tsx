"use client"

import { useState } from "react"
import { Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TopicTable } from "./TopicTable"
import { TopicDetails } from "./TopicDetails"
import { TopicSettingsForm } from "./TopicSettingsForm"
import { SubscriptionList } from "./SubscriptionList"
import { useTopics } from "@/hooks/useTopics"
import type { TopicProperties } from "@/types/azure"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function TopicList() {
  const { topics, loading, error, refresh, deleteTopic } = useTopics()
  const [selectedTopic, setSelectedTopic] = useState<TopicProperties | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showSubscriptions, setShowSubscriptions] = useState(false)

  const handleTopicClick = (topic: TopicProperties) => {
    setSelectedTopic(topic)
    setShowDetails(true)
  }

  const handleDelete = async (topicName: string) => {
    if (confirm(`Are you sure you want to delete topic "${topicName}"?`)) {
      await deleteTopic(topicName)
      if (selectedTopic?.name === topicName) {
        setSelectedTopic(null)
        setShowDetails(false)
      }
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Left Panel - Topic List */}
      <div className="flex-1 flex flex-col border-r overflow-hidden">
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Topics</h2>
              <p className="text-sm text-muted-foreground">
                {topics.length > 0 && `${topics.length} topic${topics.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={refresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Topic
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
          {loading && topics.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading topics...</span>
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No topics found. Create your first topic to get started.</p>
            </div>
          ) : (
            <>
              {loading && topics.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading more topics...</span>
                </div>
              )}
              <TopicTable
                topics={topics}
                onTopicClick={handleTopicClick}
                onEdit={(topic) => {
                  setSelectedTopic(topic)
                  setShowDetails(false)
                  setShowSettings(true)
                }}
                onDelete={handleDelete}
                onViewSubscriptions={(topic) => {
                  setSelectedTopic(topic)
                  setShowDetails(false)
                  setShowSubscriptions(true)
                }}
              />
            </>
          )}
        </div>
      </div>

      {selectedTopic && (
        <>
          <TopicDetails
            topic={selectedTopic}
            open={showDetails}
            onOpenChange={setShowDetails}
            onEdit={() => {
              setShowDetails(false)
              setShowSettings(true)
            }}
            onDelete={() => handleDelete(selectedTopic.name)}
            onViewSubscriptions={() => {
              setShowDetails(false)
              setShowSubscriptions(true)
            }}
            onRefresh={refresh}
          />
          <TopicSettingsForm
            topic={selectedTopic}
            open={showSettings}
            onOpenChange={setShowSettings}
            onSuccess={refresh}
          />
          <SubscriptionList
            topicName={selectedTopic.name}
            open={showSubscriptions}
            onOpenChange={setShowSubscriptions}
          />
        </>
      )}

      {showCreateForm && (
        <TopicSettingsForm
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

