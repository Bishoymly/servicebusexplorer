export interface ServiceBusConnection {
  id: string
  name: string
  connectionString?: string
  namespace?: string
  useAzureAD?: boolean
  tenantId?: string
  clientId?: string
  createdAt: number
  updatedAt: number
}

export interface QueueProperties {
  name: string
  maxSizeInMegabytes?: number
  lockDurationInSeconds?: number
  maxDeliveryCount?: number
  defaultMessageTimeToLiveInSeconds?: number
  deadLetteringOnMessageExpiration?: boolean
  duplicateDetectionHistoryTimeWindowInSeconds?: number
  enableBatchedOperations?: boolean
  enablePartitioning?: boolean
  requiresSession?: boolean
  requiresDuplicateDetection?: boolean
  messageCount?: number
  activeMessageCount?: number
  deadLetterMessageCount?: number
  scheduledMessageCount?: number
  transferMessageCount?: number
  transferDeadLetterMessageCount?: number
  sizeInBytes?: number
}

export interface TopicProperties {
  name: string
  maxSizeInMegabytes?: number
  defaultMessageTimeToLiveInSeconds?: number
  duplicateDetectionHistoryTimeWindowInSeconds?: number
  enableBatchedOperations?: boolean
  enablePartitioning?: boolean
  requiresDuplicateDetection?: boolean
  sizeInBytes?: number
  subscriptionCount?: number
}

export interface SubscriptionProperties {
  topicName: string
  subscriptionName: string
  maxDeliveryCount?: number
  lockDurationInSeconds?: number
  defaultMessageTimeToLiveInSeconds?: number
  deadLetteringOnMessageExpiration?: boolean
  enableBatchedOperations?: boolean
  requiresSession?: boolean
  messageCount?: number
  activeMessageCount?: number
  deadLetterMessageCount?: number
  transferMessageCount?: number
  transferDeadLetterMessageCount?: number
}

export interface ServiceBusMessage {
  body: any
  messageId?: string
  contentType?: string
  correlationId?: string
  sessionId?: string
  replyTo?: string
  replyToSessionId?: string
  subject?: string
  timeToLive?: number
  to?: string
  applicationProperties?: Record<string, any>
  deliveryCount?: number
  enqueuedTimeUtc?: Date
  lockedUntilUtc?: Date
  sequenceNumber?: number
  deadLetterReason?: string
  deadLetterErrorDescription?: string
}

export type QueueSortOption = "name" | "messageCount" | "deadLetterCount"

