import { ServiceBusClient, ServiceBusAdministrationClient } from "@azure/service-bus"
import { DefaultAzureCredential } from "@azure/identity"
import type {
  QueueProperties,
  TopicProperties,
  SubscriptionProperties,
  ServiceBusMessage,
} from "@/types/azure"
import type { ServiceBusConnection } from "@/types/azure"

export class ServiceBusExplorerClient {
  private sbClient: ServiceBusClient
  private adminClient: ServiceBusAdministrationClient

  constructor(client: ServiceBusClient, adminClient: ServiceBusAdministrationClient) {
    this.sbClient = client
    this.adminClient = adminClient
  }

  static async create(connection: ServiceBusConnection): Promise<ServiceBusExplorerClient> {
    let sbClient: ServiceBusClient
    let adminClient: ServiceBusAdministrationClient

    if (connection.useAzureAD && connection.namespace) {
      const credential = new DefaultAzureCredential()
      const fullyQualifiedNamespace = `${connection.namespace}.servicebus.windows.net`
      sbClient = new ServiceBusClient(fullyQualifiedNamespace, credential)
      adminClient = new ServiceBusAdministrationClient(fullyQualifiedNamespace, credential)
    } else if (connection.connectionString) {
      sbClient = new ServiceBusClient(connection.connectionString)
      adminClient = new ServiceBusAdministrationClient(connection.connectionString)
    } else {
      throw new Error("Either connection string or namespace with Azure AD must be provided")
    }

    return new ServiceBusExplorerClient(sbClient, adminClient)
  }

  // Queue operations
  async listQueues(): Promise<QueueProperties[]> {
    const queues: QueueProperties[] = []
    
    // First pass: collect all queue names and basic properties quickly
    const queueNames: string[] = []
    const queuePropsMap = new Map<string, any>()
    
    for await (const queueProperties of this.adminClient.listQueues()) {
      queueNames.push(queueProperties.name)
      queuePropsMap.set(queueProperties.name, {
        name: queueProperties.name,
        maxSizeInMegabytes: queueProperties.maxSizeInMegabytes,
        lockDurationInSeconds: queueProperties.lockDuration ? this.parseDurationToSeconds(queueProperties.lockDuration) : undefined,
        maxDeliveryCount: queueProperties.maxDeliveryCount,
        defaultMessageTimeToLiveInSeconds: queueProperties.defaultMessageTimeToLive ? this.parseDurationToSeconds(queueProperties.defaultMessageTimeToLive) : undefined,
        deadLetteringOnMessageExpiration: queueProperties.deadLetteringOnMessageExpiration,
        duplicateDetectionHistoryTimeWindowInSeconds: queueProperties.duplicateDetectionHistoryTimeWindow ? this.parseDurationToSeconds(queueProperties.duplicateDetectionHistoryTimeWindow) : undefined,
        enableBatchedOperations: queueProperties.enableBatchedOperations,
        enablePartitioning: queueProperties.enablePartitioning,
        requiresSession: queueProperties.requiresSession,
        requiresDuplicateDetection: queueProperties.requiresDuplicateDetection,
        // Initialize runtime properties to 0 - will be updated
        messageCount: 0,
        activeMessageCount: 0,
        deadLetterMessageCount: 0,
        scheduledMessageCount: 0,
        transferMessageCount: 0,
        transferDeadLetterMessageCount: 0,
        sizeInBytes: 0,
      })
    }
    
    // Second pass: load runtime properties in parallel batches for better performance
    const batchSize = 10 // Process 10 queues at a time
    for (let i = 0; i < queueNames.length; i += batchSize) {
      const batch = queueNames.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async (queueName) => {
          try {
            const runtimeProperties = await this.adminClient.getQueueRuntimeProperties(queueName)
            const props = queuePropsMap.get(queueName)!
            props.messageCount = runtimeProperties.activeMessageCount + runtimeProperties.deadLetterMessageCount + runtimeProperties.scheduledMessageCount
            props.activeMessageCount = runtimeProperties.activeMessageCount
            props.deadLetterMessageCount = runtimeProperties.deadLetterMessageCount
            props.scheduledMessageCount = runtimeProperties.scheduledMessageCount
            props.transferMessageCount = runtimeProperties.transferMessageCount
            props.transferDeadLetterMessageCount = runtimeProperties.transferDeadLetterMessageCount
            props.sizeInBytes = runtimeProperties.sizeInBytes
          } catch (error) {
            // If runtime properties fail, keep the queue with 0 counts
            console.warn(`Failed to load runtime properties for queue ${queueName}:`, error)
          }
        })
      )
    }
    
    // Convert map to array
    for (const queueName of queueNames) {
      queues.push(queuePropsMap.get(queueName)!)
    }
    
    return queues
  }

  async getQueueProperties(queueName: string): Promise<QueueProperties> {
    const queueProperties = await this.adminClient.getQueue(queueName)
    const runtimeProperties = await this.adminClient.getQueueRuntimeProperties(queueName)
    return {
      name: queueProperties.name,
      maxSizeInMegabytes: queueProperties.maxSizeInMegabytes,
      lockDurationInSeconds: queueProperties.lockDuration ? this.parseDurationToSeconds(queueProperties.lockDuration) : undefined,
      maxDeliveryCount: queueProperties.maxDeliveryCount,
      defaultMessageTimeToLiveInSeconds: queueProperties.defaultMessageTimeToLive ? this.parseDurationToSeconds(queueProperties.defaultMessageTimeToLive) : undefined,
      deadLetteringOnMessageExpiration: queueProperties.deadLetteringOnMessageExpiration,
      duplicateDetectionHistoryTimeWindowInSeconds: queueProperties.duplicateDetectionHistoryTimeWindow ? this.parseDurationToSeconds(queueProperties.duplicateDetectionHistoryTimeWindow) : undefined,
      enableBatchedOperations: queueProperties.enableBatchedOperations,
      enablePartitioning: queueProperties.enablePartitioning,
      requiresSession: queueProperties.requiresSession,
      requiresDuplicateDetection: queueProperties.requiresDuplicateDetection,
      messageCount: runtimeProperties.activeMessageCount + runtimeProperties.deadLetterMessageCount + runtimeProperties.scheduledMessageCount,
      activeMessageCount: runtimeProperties.activeMessageCount,
      deadLetterMessageCount: runtimeProperties.deadLetterMessageCount,
      scheduledMessageCount: runtimeProperties.scheduledMessageCount,
      transferMessageCount: runtimeProperties.transferMessageCount,
      transferDeadLetterMessageCount: runtimeProperties.transferDeadLetterMessageCount,
      sizeInBytes: runtimeProperties.sizeInBytes,
    }
  }

  async updateQueue(queueName: string, properties: Partial<QueueProperties>): Promise<void> {
    const existing = await this.adminClient.getQueue(queueName)
    await this.adminClient.updateQueue({
      ...existing,
      maxSizeInMegabytes: properties.maxSizeInMegabytes ?? existing.maxSizeInMegabytes,
      lockDuration: properties.lockDurationInSeconds ? this.secondsToDuration(properties.lockDurationInSeconds) : existing.lockDuration,
      maxDeliveryCount: properties.maxDeliveryCount ?? existing.maxDeliveryCount,
      defaultMessageTimeToLive: properties.defaultMessageTimeToLiveInSeconds ? this.secondsToDuration(properties.defaultMessageTimeToLiveInSeconds) : existing.defaultMessageTimeToLive,
      deadLetteringOnMessageExpiration: properties.deadLetteringOnMessageExpiration ?? existing.deadLetteringOnMessageExpiration,
      duplicateDetectionHistoryTimeWindow: properties.duplicateDetectionHistoryTimeWindowInSeconds ? this.secondsToDuration(properties.duplicateDetectionHistoryTimeWindowInSeconds) : existing.duplicateDetectionHistoryTimeWindow,
      enableBatchedOperations: properties.enableBatchedOperations ?? existing.enableBatchedOperations,
      requiresSession: properties.requiresSession ?? existing.requiresSession,
      requiresDuplicateDetection: properties.requiresDuplicateDetection ?? existing.requiresDuplicateDetection,
    })
  }

  async createQueue(queueName: string, properties?: Partial<QueueProperties>): Promise<void> {
    await this.adminClient.createQueue(queueName, {
      maxSizeInMegabytes: properties?.maxSizeInMegabytes,
      lockDuration: properties?.lockDurationInSeconds ? this.secondsToDuration(properties.lockDurationInSeconds) : undefined,
      maxDeliveryCount: properties?.maxDeliveryCount,
      defaultMessageTimeToLive: properties?.defaultMessageTimeToLiveInSeconds ? this.secondsToDuration(properties.defaultMessageTimeToLiveInSeconds) : undefined,
      deadLetteringOnMessageExpiration: properties?.deadLetteringOnMessageExpiration,
      duplicateDetectionHistoryTimeWindow: properties?.duplicateDetectionHistoryTimeWindowInSeconds ? this.secondsToDuration(properties.duplicateDetectionHistoryTimeWindowInSeconds) : undefined,
      enableBatchedOperations: properties?.enableBatchedOperations,
      enablePartitioning: properties?.enablePartitioning,
      requiresSession: properties?.requiresSession,
      requiresDuplicateDetection: properties?.requiresDuplicateDetection,
    })
  }

  async deleteQueue(queueName: string): Promise<void> {
    await this.adminClient.deleteQueue(queueName)
  }

  // Topic operations
  async listTopics(): Promise<TopicProperties[]> {
    const topics: TopicProperties[] = []
    
    // First pass: collect all topic names and basic properties quickly
    const topicNames: string[] = []
    const topicPropsMap = new Map<string, any>()
    
    for await (const topicProperties of this.adminClient.listTopics()) {
      topicNames.push(topicProperties.name)
      topicPropsMap.set(topicProperties.name, {
        name: topicProperties.name,
        maxSizeInMegabytes: topicProperties.maxSizeInMegabytes,
        defaultMessageTimeToLiveInSeconds: topicProperties.defaultMessageTimeToLive ? this.parseDurationToSeconds(topicProperties.defaultMessageTimeToLive) : undefined,
        duplicateDetectionHistoryTimeWindowInSeconds: topicProperties.duplicateDetectionHistoryTimeWindow ? this.parseDurationToSeconds(topicProperties.duplicateDetectionHistoryTimeWindow) : undefined,
        enableBatchedOperations: topicProperties.enableBatchedOperations,
        enablePartitioning: topicProperties.enablePartitioning,
        requiresDuplicateDetection: topicProperties.requiresDuplicateDetection,
        // Initialize runtime properties to 0 - will be updated
        subscriptionCount: 0,
        sizeInBytes: 0,
      })
    }
    
    // Second pass: load runtime properties and subscription counts in parallel batches
    const batchSize = 10
    for (let i = 0; i < topicNames.length; i += batchSize) {
      const batch = topicNames.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async (topicName) => {
          try {
            const [runtimeProperties, subscriptions] = await Promise.all([
              this.adminClient.getTopicRuntimeProperties(topicName),
              this.listSubscriptions(topicName),
            ])
            const props = topicPropsMap.get(topicName)!
            props.subscriptionCount = subscriptions.length
            props.sizeInBytes = runtimeProperties.sizeInBytes
          } catch (error) {
            console.warn(`Failed to load runtime properties for topic ${topicName}:`, error)
          }
        })
      )
    }
    
    // Convert map to array
    for (const topicName of topicNames) {
      topics.push(topicPropsMap.get(topicName)!)
    }
    
    return topics
  }

  async getTopicProperties(topicName: string): Promise<TopicProperties> {
    const topicProperties = await this.adminClient.getTopic(topicName)
    const runtimeProperties = await this.adminClient.getTopicRuntimeProperties(topicName)
    const subscriptions = await this.listSubscriptions(topicName)
    return {
      name: topicProperties.name,
      maxSizeInMegabytes: topicProperties.maxSizeInMegabytes,
      defaultMessageTimeToLiveInSeconds: topicProperties.defaultMessageTimeToLive ? this.parseDurationToSeconds(topicProperties.defaultMessageTimeToLive) : undefined,
      duplicateDetectionHistoryTimeWindowInSeconds: topicProperties.duplicateDetectionHistoryTimeWindow ? this.parseDurationToSeconds(topicProperties.duplicateDetectionHistoryTimeWindow) : undefined,
      enableBatchedOperations: topicProperties.enableBatchedOperations,
      enablePartitioning: topicProperties.enablePartitioning,
      requiresDuplicateDetection: topicProperties.requiresDuplicateDetection,
      sizeInBytes: runtimeProperties.sizeInBytes,
      subscriptionCount: subscriptions.length,
    }
  }

  async updateTopic(topicName: string, properties: Partial<TopicProperties>): Promise<void> {
    const existing = await this.adminClient.getTopic(topicName)
    await this.adminClient.updateTopic({
      ...existing,
      maxSizeInMegabytes: properties.maxSizeInMegabytes ?? existing.maxSizeInMegabytes,
      defaultMessageTimeToLive: properties.defaultMessageTimeToLiveInSeconds ? this.secondsToDuration(properties.defaultMessageTimeToLiveInSeconds) : existing.defaultMessageTimeToLive,
      duplicateDetectionHistoryTimeWindow: properties.duplicateDetectionHistoryTimeWindowInSeconds ? this.secondsToDuration(properties.duplicateDetectionHistoryTimeWindowInSeconds) : existing.duplicateDetectionHistoryTimeWindow,
      enableBatchedOperations: properties.enableBatchedOperations ?? existing.enableBatchedOperations,
      requiresDuplicateDetection: properties.requiresDuplicateDetection ?? existing.requiresDuplicateDetection,
    })
  }

  async createTopic(topicName: string, properties?: Partial<TopicProperties>): Promise<void> {
    await this.adminClient.createTopic(topicName, {
      maxSizeInMegabytes: properties?.maxSizeInMegabytes,
      defaultMessageTimeToLive: properties?.defaultMessageTimeToLiveInSeconds ? this.secondsToDuration(properties.defaultMessageTimeToLiveInSeconds) : undefined,
      duplicateDetectionHistoryTimeWindow: properties?.duplicateDetectionHistoryTimeWindowInSeconds ? this.secondsToDuration(properties.duplicateDetectionHistoryTimeWindowInSeconds) : undefined,
      enableBatchedOperations: properties?.enableBatchedOperations,
      enablePartitioning: properties?.enablePartitioning,
      requiresDuplicateDetection: properties?.requiresDuplicateDetection,
    })
  }

  async deleteTopic(topicName: string): Promise<void> {
    await this.adminClient.deleteTopic(topicName)
  }

  // Subscription operations
  async listSubscriptions(topicName: string): Promise<SubscriptionProperties[]> {
    const subscriptions: SubscriptionProperties[] = []
    for await (const subProperties of this.adminClient.listSubscriptions(topicName)) {
      const runtimeProperties = await this.adminClient.getSubscriptionRuntimeProperties(topicName, subProperties.subscriptionName)
      subscriptions.push({
        topicName: subProperties.topicName,
        subscriptionName: subProperties.subscriptionName,
        maxDeliveryCount: subProperties.maxDeliveryCount,
        lockDurationInSeconds: subProperties.lockDuration ? this.parseDurationToSeconds(subProperties.lockDuration) : undefined,
        defaultMessageTimeToLiveInSeconds: subProperties.defaultMessageTimeToLive ? this.parseDurationToSeconds(subProperties.defaultMessageTimeToLive) : undefined,
        deadLetteringOnMessageExpiration: subProperties.deadLetteringOnMessageExpiration,
        enableBatchedOperations: subProperties.enableBatchedOperations,
        requiresSession: subProperties.requiresSession,
        messageCount: runtimeProperties.activeMessageCount + runtimeProperties.deadLetterMessageCount + runtimeProperties.transferMessageCount,
        activeMessageCount: runtimeProperties.activeMessageCount,
        deadLetterMessageCount: runtimeProperties.deadLetterMessageCount,
        transferMessageCount: runtimeProperties.transferMessageCount,
        transferDeadLetterMessageCount: runtimeProperties.transferDeadLetterMessageCount,
      })
    }
    return subscriptions
  }

  async getSubscriptionProperties(topicName: string, subscriptionName: string): Promise<SubscriptionProperties> {
    const subProperties = await this.adminClient.getSubscription(topicName, subscriptionName)
    const runtimeProperties = await this.adminClient.getSubscriptionRuntimeProperties(topicName, subscriptionName)
    return {
      topicName: subProperties.topicName,
      subscriptionName: subProperties.subscriptionName,
      maxDeliveryCount: subProperties.maxDeliveryCount,
      lockDurationInSeconds: subProperties.lockDuration ? this.parseDurationToSeconds(subProperties.lockDuration) : undefined,
      defaultMessageTimeToLiveInSeconds: subProperties.defaultMessageTimeToLive ? this.parseDurationToSeconds(subProperties.defaultMessageTimeToLive) : undefined,
      deadLetteringOnMessageExpiration: subProperties.deadLetteringOnMessageExpiration,
      enableBatchedOperations: subProperties.enableBatchedOperations,
      requiresSession: subProperties.requiresSession,
      messageCount: runtimeProperties.activeMessageCount + runtimeProperties.deadLetterMessageCount + runtimeProperties.transferMessageCount,
      activeMessageCount: runtimeProperties.activeMessageCount,
      deadLetterMessageCount: runtimeProperties.deadLetterMessageCount,
      transferMessageCount: runtimeProperties.transferMessageCount,
      transferDeadLetterMessageCount: runtimeProperties.transferDeadLetterMessageCount,
    }
  }

  // Message operations
  async peekMessages(queueName: string, maxCount: number = 10): Promise<ServiceBusMessage[]> {
    const receiver = this.sbClient.createReceiver(queueName, { receiveMode: "peekLock" })
    try {
      const messages = await receiver.peekMessages(maxCount)
      return messages.map((msg) => ({
        body: msg.body,
        messageId: msg.messageId ? String(msg.messageId) : undefined,
        contentType: msg.contentType,
        correlationId: msg.correlationId ? String(msg.correlationId) : undefined,
        sessionId: msg.sessionId,
        replyTo: msg.replyTo,
        replyToSessionId: msg.replyToSessionId,
        subject: msg.subject,
        timeToLive: msg.timeToLive,
        to: msg.to,
        applicationProperties: msg.applicationProperties,
        deliveryCount: msg.deliveryCount,
        enqueuedTimeUtc: msg.enqueuedTimeUtc,
        lockedUntilUtc: msg.lockedUntilUtc,
        sequenceNumber: msg.sequenceNumber ? Number(msg.sequenceNumber) : undefined,
      }))
    } finally {
      await receiver.close()
    }
  }

  async peekMessagesFromSubscription(
    topicName: string,
    subscriptionName: string,
    maxCount: number = 10
  ): Promise<ServiceBusMessage[]> {
    const receiver = this.sbClient.createReceiver(topicName, subscriptionName, { receiveMode: "peekLock" })
    try {
      const messages = await receiver.peekMessages(maxCount)
      return messages.map((msg) => ({
        body: msg.body,
        messageId: msg.messageId ? String(msg.messageId) : undefined,
        contentType: msg.contentType,
        correlationId: msg.correlationId ? String(msg.correlationId) : undefined,
        sessionId: msg.sessionId,
        replyTo: msg.replyTo,
        replyToSessionId: msg.replyToSessionId,
        subject: msg.subject,
        timeToLive: msg.timeToLive,
        to: msg.to,
        applicationProperties: msg.applicationProperties,
        deliveryCount: msg.deliveryCount,
        enqueuedTimeUtc: msg.enqueuedTimeUtc,
        lockedUntilUtc: msg.lockedUntilUtc,
        sequenceNumber: msg.sequenceNumber ? Number(msg.sequenceNumber) : undefined,
      }))
    } finally {
      await receiver.close()
    }
  }

  async peekDeadLetterMessages(queueName: string, maxCount: number = 10): Promise<ServiceBusMessage[]> {
    const receiver = this.sbClient.createReceiver(queueName, { subQueueType: "deadLetter", receiveMode: "peekLock" })
    try {
      const messages = await receiver.peekMessages(maxCount)
      return messages.map((msg) => ({
        body: msg.body,
        messageId: msg.messageId ? String(msg.messageId) : undefined,
        contentType: msg.contentType,
        correlationId: msg.correlationId ? String(msg.correlationId) : undefined,
        sessionId: msg.sessionId,
        replyTo: msg.replyTo,
        replyToSessionId: msg.replyToSessionId,
        subject: msg.subject,
        timeToLive: msg.timeToLive,
        to: msg.to,
        applicationProperties: msg.applicationProperties,
        deliveryCount: msg.deliveryCount,
        enqueuedTimeUtc: msg.enqueuedTimeUtc,
        lockedUntilUtc: msg.lockedUntilUtc,
        sequenceNumber: msg.sequenceNumber ? Number(msg.sequenceNumber) : undefined,
        deadLetterReason: (msg.applicationProperties?.["DeadLetterReason"] as string) || undefined,
        deadLetterErrorDescription: (msg.applicationProperties?.["DeadLetterErrorDescription"] as string) || undefined,
      }))
    } finally {
      await receiver.close()
    }
  }

  async receiveMessages(queueName: string, maxCount: number = 10): Promise<ServiceBusMessage[]> {
    const receiver = this.sbClient.createReceiver(queueName, { receiveMode: "peekLock" })
    try {
      const messages = await receiver.receiveMessages(maxCount, { maxWaitTimeInMs: 5000 })
      const result = messages.map((msg) => ({
        body: msg.body,
        messageId: msg.messageId ? String(msg.messageId) : undefined,
        contentType: msg.contentType,
        correlationId: msg.correlationId ? String(msg.correlationId) : undefined,
        sessionId: msg.sessionId,
        replyTo: msg.replyTo,
        replyToSessionId: msg.replyToSessionId,
        subject: msg.subject,
        timeToLive: msg.timeToLive,
        to: msg.to,
        applicationProperties: msg.applicationProperties,
        deliveryCount: msg.deliveryCount,
        enqueuedTimeUtc: msg.enqueuedTimeUtc,
        lockedUntilUtc: msg.lockedUntilUtc,
        sequenceNumber: msg.sequenceNumber ? Number(msg.sequenceNumber) : undefined,
      }))
      // Complete the messages to remove them from the queue
      for (const msg of messages) {
        await receiver.completeMessage(msg)
      }
      return result
    } finally {
      await receiver.close()
    }
  }

  async sendMessage(queueName: string, message: ServiceBusMessage): Promise<void> {
    const sender = this.sbClient.createSender(queueName)
    try {
      await sender.sendMessages({
        body: message.body,
        messageId: message.messageId,
        contentType: message.contentType,
        correlationId: message.correlationId,
        sessionId: message.sessionId,
        replyTo: message.replyTo,
        replyToSessionId: message.replyToSessionId,
        subject: message.subject,
        timeToLive: message.timeToLive,
        to: message.to,
        applicationProperties: message.applicationProperties,
      })
    } finally {
      await sender.close()
    }
  }

  async sendMessageToTopic(topicName: string, message: ServiceBusMessage): Promise<void> {
    const sender = this.sbClient.createSender(topicName)
    try {
      await sender.sendMessages({
        body: message.body,
        messageId: message.messageId,
        contentType: message.contentType,
        correlationId: message.correlationId,
        sessionId: message.sessionId,
        replyTo: message.replyTo,
        replyToSessionId: message.replyToSessionId,
        subject: message.subject,
        timeToLive: message.timeToLive,
        to: message.to,
        applicationProperties: message.applicationProperties,
      })
    } finally {
      await sender.close()
    }
  }

  async close(): Promise<void> {
    await this.sbClient.close()
  }

  private parseDurationToSeconds(duration: string | { seconds: number }): number | undefined {
    if (typeof duration === "string") {
      // Parse ISO 8601 duration (e.g., "PT30S" = 30 seconds, "PT1H" = 3600 seconds)
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
      if (match) {
        const hours = parseInt(match[1] || "0", 10)
        const minutes = parseInt(match[2] || "0", 10)
        const seconds = parseInt(match[3] || "0", 10)
        return hours * 3600 + minutes * 60 + seconds
      }
      return undefined
    }
    return duration.seconds
  }

  private secondsToDuration(seconds: number): string {
    // Convert seconds to ISO 8601 duration format
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    let duration = "PT"
    if (hours > 0) duration += `${hours}H`
    if (minutes > 0) duration += `${minutes}M`
    if (secs > 0 || duration === "PT") duration += `${secs}S`
    return duration
  }
}

