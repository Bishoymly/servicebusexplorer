import { ServiceBusClient } from "@azure/service-bus"
import { DefaultAzureCredential } from "@azure/identity"
import type { ServiceBusConnection } from "@/types/azure"

export class ConnectionManager {
  private clients: Map<string, ServiceBusClient> = new Map()

  async createClient(connection: ServiceBusConnection): Promise<ServiceBusClient> {
    const cacheKey = connection.id

    // Return cached client if exists
    if (this.clients.has(cacheKey)) {
      return this.clients.get(cacheKey)!
    }

    let client: ServiceBusClient

    if (connection.useAzureAD && connection.namespace) {
      // Use Azure AD authentication
      const credential = new DefaultAzureCredential()
      const fullyQualifiedNamespace = `${connection.namespace}.servicebus.windows.net`
      client = new ServiceBusClient(fullyQualifiedNamespace, credential)
    } else if (connection.connectionString) {
      // Use connection string
      client = new ServiceBusClient(connection.connectionString)
    } else {
      throw new Error("Either connection string or namespace with Azure AD must be provided")
    }

    // Cache the client
    this.clients.set(cacheKey, client)
    return client
  }

  async testConnection(connection: ServiceBusConnection): Promise<boolean> {
    try {
      const client = await this.createClient(connection)
      // Try to get namespace info by listing queues (limited to 1)
      const receiver = client.createReceiver("$management")
      await receiver.close()
      return true
    } catch (error) {
      console.error("Connection test failed:", error)
      return false
    }
  }

  closeClient(connectionId: string): void {
    const client = this.clients.get(connectionId)
    if (client) {
      client.close()
      this.clients.delete(connectionId)
    }
  }

  closeAll(): void {
    for (const [id, client] of this.clients) {
      client.close()
    }
    this.clients.clear()
  }
}

export const connectionManager = new ConnectionManager()

