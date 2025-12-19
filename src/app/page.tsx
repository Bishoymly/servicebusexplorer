"use client"

import { QueueMessagesPanel } from "@/components/queues/QueueMessagesPanel"
import { SubscriptionMessagesPanel } from "@/components/topics/SubscriptionMessagesPanel"
import { useSelectedResource } from "@/contexts/SelectedResourceContext"
import { useTreeRefresh } from "@/contexts/TreeRefreshContext"
import { useConnections } from "@/hooks/useConnections"

export default function Home() {
  const { selectedResource, setSelectedResource } = useSelectedResource()
  const { connections } = useConnections()
  const { refreshConnection } = useTreeRefresh()
  
  // Check if the selected resource's connection is still valid
  const isValidResource = selectedResource && connections.some(c => c.id === selectedResource.connectionId)

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

  if (selectedResource?.type === "queue" && isValidResource) {
    const connection = connections.find(c => c.id === selectedResource.connectionId)
    if (!connection) {
      return <div className="h-full bg-background" />
    }
    
    return (
      <div className="h-full">
        <QueueMessagesPanel 
          queueName={selectedResource.name}
          connection={connection}
          initialShowDeadLetter={selectedResource.showDeadLetter || false}
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
