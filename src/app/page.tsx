"use client"

import { QueueMessagesPanel } from "@/components/queues/QueueMessagesPanel"
import { useSelectedResource } from "@/contexts/SelectedResourceContext"
import { useConnections } from "@/hooks/useConnections"

export default function Home() {
  const { selectedResource, setSelectedResource } = useSelectedResource()
  const { connections } = useConnections()
  
  // Check if the selected resource's connection is still valid
  const isValidResource = selectedResource && connections.some(c => c.id === selectedResource.connectionId)

  const handleCloseQueue = () => {
    setSelectedResource(null)
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
          onClose={handleCloseQueue} 
        />
      </div>
    )
  }

  return (
    <div className="h-full bg-background" />
  );
}
