import { NextRequest, NextResponse } from "next/server"
import { ServiceBusExplorerClient } from "@/lib/azure/serviceBusClient"
import type { ServiceBusConnection, TopicProperties } from "@/types/azure"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ topicName: string }> }
) {
  try {
    const { topicName } = await params
    const connectionStr = request.headers.get("x-connection")
    if (!connectionStr) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    const connection: ServiceBusConnection = JSON.parse(connectionStr)
    const client = await ServiceBusExplorerClient.create(connection)
    const topic = await client.getTopicProperties(topicName)
    await client.close()

    return NextResponse.json({ topic })
  } catch (error: any) {
    console.error("Error getting topic:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get topic" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ topicName: string }> }
) {
  try {
    const { topicName } = await params
    const connectionStr = request.headers.get("x-connection")
    if (!connectionStr) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    const body = await request.json()
    const properties: Partial<TopicProperties> = body.properties

    const connection: ServiceBusConnection = JSON.parse(connectionStr)
    const client = await ServiceBusExplorerClient.create(connection)
    await client.updateTopic(topicName, properties)
    await client.close()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error updating topic:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update topic" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ topicName: string }> }
) {
  try {
    const { topicName } = await params
    const connectionStr = request.headers.get("x-connection")
    if (!connectionStr) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    const connection: ServiceBusConnection = JSON.parse(connectionStr)
    const client = await ServiceBusExplorerClient.create(connection)
    await client.deleteTopic(topicName)
    await client.close()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting topic:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete topic" },
      { status: 500 }
    )
  }
}

