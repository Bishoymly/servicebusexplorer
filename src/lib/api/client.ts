import { invoke } from "@tauri-apps/api/core"
import type {
  ServiceBusConnection,
  QueueProperties,
  TopicProperties,
  SubscriptionProperties,
  ServiceBusMessage,
} from "@/types/azure"
import {
  MOCK_CONNECTION,
  MOCK_QUEUES,
  MOCK_TOPICS,
  MOCK_SUBSCRIPTIONS,
  generateMockMessages,
} from "@/lib/demo/mockData"

class ApiClient {
  private isDemoMode(): boolean {
    if (typeof window === "undefined") return false
    return localStorage.getItem("demoMode") === "true"
  }
  
  // No longer needed - Rust struct now accepts camelCase directly via serde rename_all
  // Keeping for backwards compatibility but it just returns the connection as-is
  private transformConnectionForTauri(connection: ServiceBusConnection): ServiceBusConnection {
    return connection
  }

  private async getConnectionWithString(connection: ServiceBusConnection | null): Promise<ServiceBusConnection | null> {
    if (!connection) return null
    
    // If connection string is missing, try to load it from Keychain
    if (!connection.connectionString && connection.id) {
      try {
        const connStr = await invoke<string>("get_connection_string", { connectionId: connection.id })
        if (connStr) {
          return { ...connection, connectionString: connStr }
        }
      } catch (error) {
        console.warn("Failed to load connection string from Keychain:", error)
      }
    }
    
    return connection
  }

  async listQueues(connection: ServiceBusConnection | null): Promise<QueueProperties[]> {
    if (this.isDemoMode()) {
      // Simulate async delay
      await new Promise(resolve => setTimeout(resolve, 300))
      return [...MOCK_QUEUES]
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    return await invoke<QueueProperties[]>("list_queues", { connection: tauriConnection })
  }

  async listQueuesPage(
    connection: ServiceBusConnection | null,
    skip?: number,
    top?: number
  ): Promise<QueueProperties[]> {
    if (this.isDemoMode()) {
      // Simulate async delay
      await new Promise(resolve => setTimeout(resolve, 100))
      const start = skip || 0
      const end = top ? start + top : start + 100
      return [...MOCK_QUEUES].slice(start, end)
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    return await invoke<QueueProperties[]>("list_queues_page", {
      connection: tauriConnection,
      skip: skip ? skip : null,
      top: top ? top : null,
    })
  }

  async getQueue(connection: ServiceBusConnection | null, queueName: string): Promise<QueueProperties> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 200))
      const queue = MOCK_QUEUES.find(q => q.name === queueName)
      if (!queue) {
        throw new Error(`Queue "${queueName}" not found`)
      }
      return { ...queue }
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    return await invoke<QueueProperties>("get_queue", { connection: tauriConnection, queueName })
  }

  async createQueue(
    connection: ServiceBusConnection | null,
    queueName: string,
    properties?: Partial<QueueProperties>
  ): Promise<void> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 500))
      // In demo mode, just simulate success
      return
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    // Include name in properties object as Rust expects QueueProperties with name field
    const propertiesWithName = properties ? { ...properties, name: queueName } : { name: queueName }
    await invoke("create_queue", { connection: tauriConnection, queueName, properties: propertiesWithName })
  }

  async updateQueue(
    connection: ServiceBusConnection | null,
    queueName: string,
    properties: Partial<QueueProperties>
  ): Promise<void> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 400))
      return
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    // Include name in properties object as Rust expects QueueProperties with name field
    const propertiesWithName = { ...properties, name: queueName }
    await invoke("update_queue", { connection: tauriConnection, queueName, properties: propertiesWithName })
  }

  async deleteQueue(connection: ServiceBusConnection | null, queueName: string): Promise<void> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    await invoke("delete_queue", { connection: tauriConnection, queueName })
  }

  async listTopics(connection: ServiceBusConnection | null): Promise<TopicProperties[]> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return [...MOCK_TOPICS]
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    return await invoke<TopicProperties[]>("list_topics", { connection: tauriConnection })
  }

  async getTopic(connection: ServiceBusConnection | null, topicName: string): Promise<TopicProperties> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 200))
      const topic = MOCK_TOPICS.find(t => t.name === topicName)
      if (!topic) {
        throw new Error(`Topic "${topicName}" not found`)
      }
      return { ...topic }
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    return await invoke<TopicProperties>("get_topic", { connection: tauriConnection, topicName })
  }

  async createTopic(
    connection: ServiceBusConnection | null,
    topicName: string,
    properties?: Partial<TopicProperties>
  ): Promise<void> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    await invoke("create_topic", { connection: tauriConnection, topicName, properties })
  }

  async updateTopic(
    connection: ServiceBusConnection | null,
    topicName: string,
    properties: Partial<TopicProperties>
  ): Promise<void> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 400))
      return
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    await invoke("update_topic", { connection: tauriConnection, topicName, properties })
  }

  async deleteTopic(connection: ServiceBusConnection | null, topicName: string): Promise<void> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 300))
      return
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    await invoke("delete_topic", { connection: tauriConnection, topicName })
  }

  async listSubscriptions(
    connection: ServiceBusConnection | null,
    topicName: string
  ): Promise<SubscriptionProperties[]> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 200))
      return [...(MOCK_SUBSCRIPTIONS[topicName] || [])]
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    return await invoke<SubscriptionProperties[]>("list_subscriptions", { connection: tauriConnection, topicName })
  }

  async createSubscription(
    connection: ServiceBusConnection | null,
    topicName: string,
    subscriptionName: string,
    properties?: Partial<SubscriptionProperties>
  ): Promise<void> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    await invoke("create_subscription", { connection: tauriConnection, topicName, subscriptionName, properties })
  }

  async peekMessages(
    connection: ServiceBusConnection | null,
    queueName?: string,
    topicName?: string,
    subscriptionName?: string,
    maxCount: number = 10
  ): Promise<ServiceBusMessage[]> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 400))
      return generateMockMessages(queueName, topicName, subscriptionName, false, maxCount)
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    return await invoke<ServiceBusMessage[]>("peek_messages", {
      connection: tauriConnection,
      queueName,
      topicName,
      subscriptionName,
      maxCount,
    })
  }

  async peekDeadLetterMessages(
    connection: ServiceBusConnection | null,
    queueName?: string,
    topicName?: string,
    subscriptionName?: string,
    maxCount: number = 10
  ): Promise<ServiceBusMessage[]> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 400))
      return generateMockMessages(queueName, topicName, subscriptionName, true, maxCount)
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    return await invoke<ServiceBusMessage[]>("peek_dead_letter_messages", {
      connection: tauriConnection,
      queueName,
      topicName,
      subscriptionName,
      maxCount,
    })
  }

  async sendMessage(
    connection: ServiceBusConnection | null,
    queueName: string,
    message: ServiceBusMessage
  ): Promise<void> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 500))
      // In demo mode, just simulate success
      return
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    await invoke("send_message", { connection: tauriConnection, queueName, topicName: null, message })
  }

  async sendMessageToTopic(
    connection: ServiceBusConnection | null,
    topicName: string,
    message: ServiceBusMessage
  ): Promise<void> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    await invoke("send_message", { connection: tauriConnection, queueName: null, topicName, message })
  }

  async purgeQueue(
    connection: ServiceBusConnection | null,
    queueName: string,
    purgeDeadLetter: boolean = false
  ): Promise<number> {
    if (this.isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 600))
      // Return a mock purged count
      const queue = MOCK_QUEUES.find(q => q.name === queueName)
      if (queue) {
        return purgeDeadLetter ? (queue.deadLetterMessageCount || 0) : (queue.activeMessageCount || 0)
      }
      return 0
    }
    if (!connection) {
      throw new Error("No connection available")
    }
    const connWithString = await this.getConnectionWithString(connection)
    if (!connWithString) {
      throw new Error("No connection available")
    }
    const tauriConnection = this.transformConnectionForTauri(connWithString)
    return await invoke<number>("purge_queue", { connection: tauriConnection, queueName, purgeDeadLetter })
  }

  async testConnection(connection: Omit<ServiceBusConnection, "id" | "createdAt" | "updatedAt">): Promise<boolean> {
    if (this.isDemoMode()) {
      // In demo mode, simulate a successful test
      await new Promise(resolve => setTimeout(resolve, 500))
      return true
    }
    
    // For testing new connections, the connection string should already be in the connection object
    // We don't need to load it from Keychain since it hasn't been saved yet
    if (!connection.useAzureAD) {
      if (!connection.connectionString || !connection.connectionString.trim()) {
        throw new Error("Connection string is required")
      }
      // Basic validation: connection string should contain Endpoint=
      if (!connection.connectionString.includes("Endpoint=")) {
        throw new Error("Invalid connection string format. It must include 'Endpoint='.")
      }
    } else {
      if (!connection.namespace || !connection.namespace.trim()) {
        throw new Error("Namespace is required for Azure AD authentication")
      }
    }
    
    // Create a temporary connection object with required fields
    const tempConnection: ServiceBusConnection = {
      ...connection,
      id: "temp-test",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    
    try {
      const tauriConnection = this.transformConnectionForTauri(tempConnection)
      console.log("Testing connection:", { 
        name: tauriConnection.name, 
        hasConnectionString: !!tauriConnection.connectionString,
        hasNamespace: !!tauriConnection.namespace,
        useAzureAD: tauriConnection.useAzureAD 
      })
      const result = await invoke<boolean>("test_connection", { connection: tauriConnection })
      console.log("Test result:", result)
      return result
    } catch (error) {
      console.error("Test connection error:", error)
      // If invoke throws an error, it means the test failed
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Connection test failed: ${errorMessage}`)
    }
  }
}

export const apiClient = new ApiClient()

