import { NextRequest, NextResponse } from "next/server"
import { ServiceBusExplorerClient } from "@/lib/azure/serviceBusClient"
import type { ServiceBusConnection, ServiceBusMessage } from "@/types/azure"

export async function POST(request: NextRequest) {
  try {
    const connectionStr = request.headers.get("x-connection")
    if (!connectionStr) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    const body = await request.json()
    const { queueName, topicName, message }: { queueName?: string; topicName?: string; message: ServiceBusMessage } = body

    if (!queueName && !topicName) {
      return NextResponse.json({ error: "Either queueName or topicName is required" }, { status: 400 })
    }

    const connection: ServiceBusConnection = JSON.parse(connectionStr)
    const client = await ServiceBusExplorerClient.create(connection)

    if (queueName) {
      await client.sendMessage(queueName, message)
    } else {
      await client.sendMessageToTopic(topicName!, message)
    }

    await client.close()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error sending message:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send message" },
      { status: 500 }
    )
  }
}


