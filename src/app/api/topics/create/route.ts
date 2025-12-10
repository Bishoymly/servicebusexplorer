import { NextRequest, NextResponse } from "next/server"
import { ServiceBusExplorerClient } from "@/lib/azure/serviceBusClient"
import type { ServiceBusConnection, TopicProperties } from "@/types/azure"

export async function POST(request: NextRequest) {
  try {
    const connectionStr = request.headers.get("x-connection")
    if (!connectionStr) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    const body = await request.json()
    const { topicName, properties }: { topicName: string; properties?: Partial<TopicProperties> } = body

    if (!topicName) {
      return NextResponse.json({ error: "Topic name is required" }, { status: 400 })
    }

    const connection: ServiceBusConnection = JSON.parse(connectionStr)
    const client = await ServiceBusExplorerClient.create(connection)
    await client.createTopic(topicName, properties)
    await client.close()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error creating topic:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create topic" },
      { status: 500 }
    )
  }
}


