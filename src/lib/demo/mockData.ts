import type {
  ServiceBusConnection,
  QueueProperties,
  TopicProperties,
  SubscriptionProperties,
  ServiceBusMessage,
} from "@/types/azure"

// Mock connection data
export const MOCK_CONNECTION: ServiceBusConnection = {
  id: "demo-connection",
  name: "Demo Service Bus",
  connectionString: "Endpoint=sb://demo.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=demo",
  createdAt: Date.now() - 86400000, // 1 day ago
  updatedAt: Date.now(),
}

// Mock queues
export const MOCK_QUEUES: QueueProperties[] = [
  {
    name: "orders-queue",
    maxSizeInMegabytes: 1024,
    lockDurationInSeconds: 30,
    maxDeliveryCount: 10,
    defaultMessageTimeToLiveInSeconds: 604800,
    deadLetteringOnMessageExpiration: true,
    enableBatchedOperations: true,
    enablePartitioning: false,
    requiresSession: false,
    requiresDuplicateDetection: false,
    activeMessageCount: 42,
    deadLetterMessageCount: 3,
    messageCount: 45,
    sizeInBytes: 125000,
  },
  {
    name: "notifications-queue",
    maxSizeInMegabytes: 512,
    lockDurationInSeconds: 60,
    maxDeliveryCount: 5,
    defaultMessageTimeToLiveInSeconds: 86400,
    deadLetteringOnMessageExpiration: false,
    enableBatchedOperations: true,
    enablePartitioning: false,
    requiresSession: false,
    requiresDuplicateDetection: true,
    duplicateDetectionHistoryTimeWindowInSeconds: 600,
    activeMessageCount: 128,
    deadLetterMessageCount: 0,
    messageCount: 128,
    sizeInBytes: 89000,
  },
  {
    name: "processing-queue",
    maxSizeInMegabytes: 2048,
    lockDurationInSeconds: 45,
    maxDeliveryCount: 3,
    defaultMessageTimeToLiveInSeconds: 3600,
    deadLetteringOnMessageExpiration: true,
    enableBatchedOperations: false,
    enablePartitioning: true,
    requiresSession: true,
    requiresDuplicateDetection: false,
    activeMessageCount: 0,
    deadLetterMessageCount: 7,
    messageCount: 7,
    sizeInBytes: 15000,
  },
  {
    name: "payment-queue",
    maxSizeInMegabytes: 1024,
    lockDurationInSeconds: 30,
    maxDeliveryCount: 5,
    defaultMessageTimeToLiveInSeconds: 3600,
    deadLetteringOnMessageExpiration: true,
    enableBatchedOperations: true,
    enablePartitioning: false,
    requiresSession: false,
    requiresDuplicateDetection: true,
    duplicateDetectionHistoryTimeWindowInSeconds: 300,
    activeMessageCount: 89,
    deadLetterMessageCount: 2,
    messageCount: 91,
    sizeInBytes: 156000,
  },
  {
    name: "inventory-queue",
    maxSizeInMegabytes: 2048,
    lockDurationInSeconds: 60,
    maxDeliveryCount: 10,
    defaultMessageTimeToLiveInSeconds: 86400,
    deadLetteringOnMessageExpiration: false,
    enableBatchedOperations: true,
    enablePartitioning: false,
    requiresSession: false,
    requiresDuplicateDetection: false,
    activeMessageCount: 234,
    deadLetterMessageCount: 0,
    messageCount: 234,
    sizeInBytes: 345000,
  },
  {
    name: "shipping-queue",
    maxSizeInMegabytes: 512,
    lockDurationInSeconds: 45,
    maxDeliveryCount: 3,
    defaultMessageTimeToLiveInSeconds: 604800,
    deadLetteringOnMessageExpiration: true,
    enableBatchedOperations: false,
    enablePartitioning: false,
    requiresSession: false,
    requiresDuplicateDetection: false,
    activeMessageCount: 156,
    deadLetterMessageCount: 5,
    messageCount: 161,
    sizeInBytes: 198000,
  },
  {
    name: "analytics-queue",
    maxSizeInMegabytes: 4096,
    lockDurationInSeconds: 30,
    maxDeliveryCount: 1,
    defaultMessageTimeToLiveInSeconds: 2592000,
    deadLetteringOnMessageExpiration: false,
    enableBatchedOperations: true,
    enablePartitioning: true,
    requiresSession: false,
    requiresDuplicateDetection: false,
    activeMessageCount: 567,
    deadLetterMessageCount: 0,
    messageCount: 567,
    sizeInBytes: 892000,
  },
  {
    name: "audit-queue",
    maxSizeInMegabytes: 1024,
    lockDurationInSeconds: 120,
    maxDeliveryCount: 1,
    defaultMessageTimeToLiveInSeconds: 31536000,
    deadLetteringOnMessageExpiration: false,
    enableBatchedOperations: false,
    enablePartitioning: false,
    requiresSession: false,
    requiresDuplicateDetection: false,
    activeMessageCount: 1234,
    deadLetterMessageCount: 0,
    messageCount: 1234,
    sizeInBytes: 567000,
  },
]

// Mock topics
export const MOCK_TOPICS: TopicProperties[] = [
  {
    name: "events-topic",
    maxSizeInMegabytes: 2048,
    defaultMessageTimeToLiveInSeconds: 604800,
    enableBatchedOperations: true,
    enablePartitioning: false,
    requiresDuplicateDetection: true,
    duplicateDetectionHistoryTimeWindowInSeconds: 300,
    sizeInBytes: 250000,
    subscriptionCount: 3,
  },
  {
    name: "alerts-topic",
    maxSizeInMegabytes: 1024,
    defaultMessageTimeToLiveInSeconds: 86400,
    enableBatchedOperations: true,
    enablePartitioning: false,
    requiresDuplicateDetection: false,
    sizeInBytes: 45000,
    subscriptionCount: 2,
  },
]

// Mock subscriptions
export const MOCK_SUBSCRIPTIONS: Record<string, SubscriptionProperties[]> = {
  "events-topic": [
    {
      topicName: "events-topic",
      subscriptionName: "web-subscription",
      maxDeliveryCount: 10,
      lockDurationInSeconds: 30,
      defaultMessageTimeToLiveInSeconds: 604800,
      deadLetteringOnMessageExpiration: true,
      enableBatchedOperations: true,
      requiresSession: false,
      activeMessageCount: 25,
      deadLetterMessageCount: 1,
      transferMessageCount: 0,
      messageCount: 26,
    },
    {
      topicName: "events-topic",
      subscriptionName: "mobile-subscription",
      maxDeliveryCount: 5,
      lockDurationInSeconds: 60,
      defaultMessageTimeToLiveInSeconds: 604800,
      deadLetteringOnMessageExpiration: false,
      enableBatchedOperations: true,
      requiresSession: false,
      activeMessageCount: 18,
      deadLetterMessageCount: 0,
      transferMessageCount: 0,
      messageCount: 18,
    },
    {
      topicName: "events-topic",
      subscriptionName: "analytics-subscription",
      maxDeliveryCount: 3,
      lockDurationInSeconds: 30,
      defaultMessageTimeToLiveInSeconds: 604800,
      deadLetteringOnMessageExpiration: true,
      enableBatchedOperations: false,
      requiresSession: false,
      activeMessageCount: 0,
      deadLetterMessageCount: 2,
      transferMessageCount: 0,
      messageCount: 2,
    },
  ],
  "alerts-topic": [
    {
      topicName: "alerts-topic",
      subscriptionName: "email-subscription",
      maxDeliveryCount: 5,
      lockDurationInSeconds: 30,
      defaultMessageTimeToLiveInSeconds: 86400,
      deadLetteringOnMessageExpiration: false,
      enableBatchedOperations: true,
      requiresSession: false,
      activeMessageCount: 8,
      deadLetterMessageCount: 0,
      transferMessageCount: 0,
      messageCount: 8,
    },
    {
      topicName: "alerts-topic",
      subscriptionName: "sms-subscription",
      maxDeliveryCount: 3,
      lockDurationInSeconds: 30,
      defaultMessageTimeToLiveInSeconds: 86400,
      deadLetteringOnMessageExpiration: false,
      enableBatchedOperations: true,
      requiresSession: false,
      activeMessageCount: 12,
      deadLetterMessageCount: 0,
      transferMessageCount: 0,
      messageCount: 12,
    },
  ],
}

// Generate mock messages
function generateMockMessage(queueName?: string, topicName?: string, subscriptionName?: string, isDeadLetter = false): ServiceBusMessage {
  const messageId = `msg-${Math.random().toString(36).substr(2, 9)}`
  const now = new Date()
  const enqueuedTime = new Date(now.getTime() - Math.random() * 86400000) // Random time in last 24 hours
  
  const sampleBodies = [
    {
      orderId: "ORD-12345",
      customerId: "CUST-789",
      customerName: "John Doe",
      customerEmail: "john.doe@example.com",
      amount: 129.99,
      currency: "USD",
      status: "pending",
      items: [
        { productId: "PROD-001", name: "Product A", quantity: 2, price: 49.99 },
        { productId: "PROD-002", name: "Product B", quantity: 1, price: 30.01 }
      ],
      shippingAddress: {
        street: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        country: "USA"
      },
      paymentMethod: "credit_card",
      createdAt: enqueuedTime.toISOString(),
      metadata: {
        source: "web",
        userAgent: "Mozilla/5.0",
        ipAddress: "192.168.1.1"
      }
    },
    {
      userId: "user-456",
      userName: "Jane Smith",
      action: "login",
      timestamp: enqueuedTime.toISOString(),
      sessionId: `session-${Math.random().toString(36).substr(2, 16)}`,
      ipAddress: "10.0.0.1",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      deviceType: "desktop",
      location: { country: "US", region: "CA", city: "San Francisco" },
      authenticationMethod: "oauth2",
      success: true
    },
    {
      eventType: "payment.processed",
      transactionId: "TXN-98765",
      orderId: "ORD-67890",
      amount: 49.99,
      currency: "USD",
      paymentMethod: "credit_card",
      cardLast4: "4242",
      cardBrand: "visa",
      customerId: "CUST-123",
      timestamp: enqueuedTime.toISOString(),
      status: "completed",
      fees: { processing: 1.50, platform: 0.25 },
      metadata: {
        processor: "stripe",
        chargeId: `ch_${Math.random().toString(36).substr(2, 24)}`,
        refundable: true
      }
    },
    {
      notificationType: "email",
      recipient: "user@example.com",
      recipientName: "User Name",
      subject: "Welcome to Our Service!",
      templateId: "welcome-email-v2",
      content: {
        html: "<html><body><h1>Welcome!</h1><p>Thank you for joining us. We're excited to have you on board.</p><p>Get started by exploring our features and don't hesitate to reach out if you need help.</p></body></html>",
        text: "Welcome! Thank you for joining us. We're excited to have you on board. Get started by exploring our features."
      },
      priority: "normal",
      scheduledFor: enqueuedTime.toISOString(),
      metadata: {
        campaignId: "campaign-001",
        userId: "user-789"
      }
    },
    JSON.stringify({
      data: "This is a comprehensive sample message with detailed information",
      metadata: {
        source: "demo",
        version: "1.0.0",
        environment: "production",
        timestamp: enqueuedTime.toISOString(),
        correlationId: `corr-${Math.random().toString(36).substr(2, 16)}`,
        additionalInfo: {
          service: "order-processing",
          region: "us-east-1",
          instance: "instance-123",
          traceId: `trace-${Math.random().toString(36).substr(2, 32)}`
        }
      },
      payload: {
        type: "event",
        category: "business",
        severity: "info",
        description: "A detailed event description that provides context about what happened in the system",
        details: {
          step: "processing",
          stage: "validation",
          result: "success",
          duration: 125,
          resources: ["database", "cache", "api"]
        }
      }
    }, null, 2),
  ]

  const body = sampleBodies[Math.floor(Math.random() * sampleBodies.length)]

  return {
    body,
    messageId,
    contentType: typeof body === "string" ? "text/plain" : "application/json",
    correlationId: `corr-${Math.random().toString(36).substr(2, 9)}`,
    subject: queueName || topicName || "demo-message",
    enqueuedTimeUtc: enqueuedTime,
    sequenceNumber: Math.floor(Math.random() * 1000000),
    deliveryCount: isDeadLetter ? Math.floor(Math.random() * 5) + 1 : 1,
    applicationProperties: {
      source: "demo",
      version: "1.0",
      environment: "demo",
    },
    ...(isDeadLetter && {
      deadLetterReason: "MaxDeliveryCountExceeded",
      deadLetterErrorDescription: "Message exceeded maximum delivery count",
    }),
  }
}

export function generateMockMessages(
  queueName?: string,
  topicName?: string,
  subscriptionName?: string,
  isDeadLetter = false,
  count = 10
): ServiceBusMessage[] {
  return Array.from({ length: count }, () =>
    generateMockMessage(queueName, topicName, subscriptionName, isDeadLetter)
  )
}

