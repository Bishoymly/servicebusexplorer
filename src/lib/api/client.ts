import type {
  ServiceBusConnection,
  QueueProperties,
  TopicProperties,
  SubscriptionProperties,
  ServiceBusMessage,
} from "@/types/azure"

class ApiClient {
  private getConnectionHeader(connection: ServiceBusConnection | null): HeadersInit {
    if (!connection) {
      throw new Error("No connection available")
    }
    return {
      "Content-Type": "application/json",
      "x-connection": JSON.stringify(connection),
    }
  }

  async listQueues(connection: ServiceBusConnection | null): Promise<QueueProperties[]> {
    const response = await fetch("/api/queues", {
      headers: this.getConnectionHeader(connection),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch queues")
    }
    const data = await response.json()
    return data.queues
  }

  async getQueue(connection: ServiceBusConnection | null, queueName: string): Promise<QueueProperties> {
    const response = await fetch(`/api/queues/${encodeURIComponent(queueName)}`, {
      headers: this.getConnectionHeader(connection),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch queue")
    }
    const data = await response.json()
    return data.queue
  }

  async createQueue(
    connection: ServiceBusConnection | null,
    queueName: string,
    properties?: Partial<QueueProperties>
  ): Promise<void> {
    const response = await fetch("/api/queues/create", {
      method: "POST",
      headers: this.getConnectionHeader(connection),
      body: JSON.stringify({ queueName, properties }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to create queue")
    }
  }

  async updateQueue(
    connection: ServiceBusConnection | null,
    queueName: string,
    properties: Partial<QueueProperties>
  ): Promise<void> {
    const response = await fetch(`/api/queues/${encodeURIComponent(queueName)}`, {
      method: "PUT",
      headers: this.getConnectionHeader(connection),
      body: JSON.stringify({ properties }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to update queue")
    }
  }

  async deleteQueue(connection: ServiceBusConnection | null, queueName: string): Promise<void> {
    const response = await fetch(`/api/queues/${encodeURIComponent(queueName)}`, {
      method: "DELETE",
      headers: this.getConnectionHeader(connection),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to delete queue")
    }
  }

  async listTopics(connection: ServiceBusConnection | null): Promise<TopicProperties[]> {
    const response = await fetch("/api/topics", {
      headers: this.getConnectionHeader(connection),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch topics")
    }
    const data = await response.json()
    return data.topics
  }

  async getTopic(connection: ServiceBusConnection | null, topicName: string): Promise<TopicProperties> {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicName)}`, {
      headers: this.getConnectionHeader(connection),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch topic")
    }
    const data = await response.json()
    return data.topic
  }

  async createTopic(
    connection: ServiceBusConnection | null,
    topicName: string,
    properties?: Partial<TopicProperties>
  ): Promise<void> {
    const response = await fetch("/api/topics/create", {
      method: "POST",
      headers: this.getConnectionHeader(connection),
      body: JSON.stringify({ topicName, properties }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to create topic")
    }
  }

  async updateTopic(
    connection: ServiceBusConnection | null,
    topicName: string,
    properties: Partial<TopicProperties>
  ): Promise<void> {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicName)}`, {
      method: "PUT",
      headers: this.getConnectionHeader(connection),
      body: JSON.stringify({ properties }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to update topic")
    }
  }

  async deleteTopic(connection: ServiceBusConnection | null, topicName: string): Promise<void> {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicName)}`, {
      method: "DELETE",
      headers: this.getConnectionHeader(connection),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to delete topic")
    }
  }

  async listSubscriptions(
    connection: ServiceBusConnection | null,
    topicName: string
  ): Promise<SubscriptionProperties[]> {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicName)}/subscriptions`, {
      headers: this.getConnectionHeader(connection),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch subscriptions")
    }
    const data = await response.json()
    return data.subscriptions
  }

  async createSubscription(
    connection: ServiceBusConnection | null,
    topicName: string,
    subscriptionName: string,
    properties?: Partial<SubscriptionProperties>
  ): Promise<void> {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicName)}/subscriptions/create`, {
      method: "POST",
      headers: this.getConnectionHeader(connection),
      body: JSON.stringify({ subscriptionName, properties }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to create subscription")
    }
  }

  async peekMessages(
    connection: ServiceBusConnection | null,
    queueName?: string,
    topicName?: string,
    subscriptionName?: string,
    maxCount: number = 10
  ): Promise<ServiceBusMessage[]> {
    const response = await fetch("/api/messages/peek", {
      method: "POST",
      headers: this.getConnectionHeader(connection),
      body: JSON.stringify({ queueName, topicName, subscriptionName, maxCount }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to peek messages")
    }
    const data = await response.json()
    return data.messages
  }

  async peekDeadLetterMessages(
    connection: ServiceBusConnection | null,
    queueName?: string,
    topicName?: string,
    subscriptionName?: string,
    maxCount: number = 10
  ): Promise<ServiceBusMessage[]> {
    const response = await fetch("/api/messages/deadletter", {
      method: "POST",
      headers: this.getConnectionHeader(connection),
      body: JSON.stringify({ queueName, topicName, subscriptionName, maxCount }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to peek dead letter messages")
    }
    const data = await response.json()
    return data.messages
  }

  async sendMessage(
    connection: ServiceBusConnection | null,
    queueName: string,
    message: ServiceBusMessage
  ): Promise<void> {
    const response = await fetch("/api/messages/send", {
      method: "POST",
      headers: this.getConnectionHeader(connection),
      body: JSON.stringify({ queueName, message }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to send message")
    }
  }

  async sendMessageToTopic(
    connection: ServiceBusConnection | null,
    topicName: string,
    message: ServiceBusMessage
  ): Promise<void> {
    const response = await fetch("/api/messages/send", {
      method: "POST",
      headers: this.getConnectionHeader(connection),
      body: JSON.stringify({ topicName, message }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to send message")
    }
  }

  async purgeQueue(
    connection: ServiceBusConnection | null,
    queueName: string,
    purgeDeadLetter: boolean = false
  ): Promise<number> {
    const response = await fetch("/api/messages/purge", {
      method: "POST",
      headers: this.getConnectionHeader(connection),
      body: JSON.stringify({ queueName, purgeDeadLetter }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to purge queue")
    }
    const data = await response.json()
    return data.purgedCount
  }
}

export const apiClient = new ApiClient()

