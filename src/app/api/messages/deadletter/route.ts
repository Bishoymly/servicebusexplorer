import { NextRequest, NextResponse } from "next/server"
import { ServiceBusExplorerClient } from "@/lib/azure/serviceBusClient"
import type { ServiceBusConnection } from "@/types/azure"

export async function POST(request: NextRequest) {
  try {
    const connectionStr = request.headers.get("x-connection")
    if (!connectionStr) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    const body = await request.json()
    const { queueName, topicName, subscriptionName, maxCount = 10 } = body

    if (!queueName && (!topicName || !subscriptionName)) {
      return NextResponse.json({ error: "Either queueName or (topicName and subscriptionName) is required" }, { status: 400 })
    }

    const connection: ServiceBusConnection = JSON.parse(connectionStr)
    const client = await ServiceBusExplorerClient.create(connection)
    
    // Limit maxCount to prevent memory issues
    const safeMaxCount = Math.min(maxCount || 100, 1000)
    const messages = await client.peekDeadLetterMessages(queueName, topicName, subscriptionName, safeMaxCount)
    
    await client.close()
    return NextResponse.json({ messages })
  } catch (error: any) {
    console.error("Error peeking dead letter messages:", error)
    return NextResponse.json(
      { error: error.message || "Failed to peek dead letter messages" },
      { status: 500 }
    )
  }
}

