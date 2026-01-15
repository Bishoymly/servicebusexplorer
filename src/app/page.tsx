"use client"

import { useMemo } from "react"
import { QueueMessagesPanel } from "@/components/queues/QueueMessagesPanel"
import { SubscriptionMessagesPanel } from "@/components/topics/SubscriptionMessagesPanel"
import { useSelectedResource } from "@/contexts/SelectedResourceContext"
import { useTreeRefresh } from "@/contexts/TreeRefreshContext"
import { useConnections } from "@/hooks/useConnections"
import { useQueues } from "@/hooks/useQueues"

export default function Home() {
  const { selectedResource, setSelectedResource } = useSelectedResource()
  const { connections } = useConnections()
  const { refreshConnection } = useTreeRefresh()
  
  // Check if the selected resource's connection is still valid
  const isValidResource = selectedResource && connections.some(c => c.id === selectedResource.connectionId)

  // Get the connection for the selected resource
  const selectedConnection = useMemo(() => {
    if (!selectedResource) return null
    return connections.find(c => c.id === selectedResource.connectionId) || null
  }, [selectedResource, connections])

  // Get queues for the selected connection to find queue properties with message counts
  const { queues } = useQueues(selectedConnection)
  
  // Find the queue properties from the queues list
  const queueProperties = useMemo(() => {
    if (selectedResource?.type === "queue" && selectedResource.name) {
      return queues.find(q => q.name === selectedResource.name) || null
    }
    return null
  }, [selectedResource, queues])

  const handleClose = () => {
    setSelectedResource(null)
  }

  const handleQueueDeleted = () => {
    if (selectedResource?.connectionId) {
      refreshConnection(selectedResource.connectionId)
    }
    handleClose()
  }

  const handleQueueUpdated = () => {
    if (selectedResource?.connectionId) {
      refreshConnection(selectedResource.connectionId)
    }
  }

  if (selectedResource?.type === "queue" && isValidResource && selectedConnection) {
    return (
      <div className="h-full">
        <QueueMessagesPanel 
          queueName={selectedResource.name}
          connection={selectedConnection}
          initialShowDeadLetter={selectedResource.showDeadLetter || false}
          initialQueueProperties={queueProperties || undefined}
          onClose={handleClose}
          onQueueDeleted={handleQueueDeleted}
          onQueueUpdated={handleQueueUpdated}
        />
      </div>
    )
  }

  if (selectedResource?.type === "subscription" && isValidResource && selectedResource.topicName && selectedResource.subscriptionName) {
    const connection = connections.find(c => c.id === selectedResource.connectionId)
    if (!connection) {
      return <div className="h-full bg-background" />
    }
    
    return (
      <div className="h-full">
        <SubscriptionMessagesPanel 
          topicName={selectedResource.topicName}
          subscriptionName={selectedResource.subscriptionName}
          connection={connection}
          initialShowDeadLetter={selectedResource.showDeadLetter || false}
          onClose={handleClose} 
        />
      </div>
    )
  }

  return (
    <div className="h-full bg-background" />
  );
}
