import { NextRequest, NextResponse } from "next/server"
import { ServiceBusExplorerClient } from "@/lib/azure/serviceBusClient"
import type { ServiceBusConnection, QueueProperties } from "@/types/azure"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ queueName: string }> }
) {
  try {
    const { queueName } = await params
    const connectionStr = request.headers.get("x-connection")
    if (!connectionStr) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    const connection: ServiceBusConnection = JSON.parse(connectionStr)
    const client = await ServiceBusExplorerClient.create(connection)
    const queue = await client.getQueueProperties(queueName)
    await client.close()

    return NextResponse.json({ queue })
  } catch (error: any) {
    console.error("Error getting queue:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get queue" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ queueName: string }> }
) {
  try {
    const { queueName } = await params
    const connectionStr = request.headers.get("x-connection")
    if (!connectionStr) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    const body = await request.json()
    const properties: Partial<QueueProperties> = body.properties

    const connection: ServiceBusConnection = JSON.parse(connectionStr)
    const client = await ServiceBusExplorerClient.create(connection)
    await client.updateQueue(queueName, properties)
    await client.close()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error updating queue:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update queue" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ queueName: string }> }
) {
  try {
    const { queueName } = await params
    const connectionStr = request.headers.get("x-connection")
    if (!connectionStr) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    const connection: ServiceBusConnection = JSON.parse(connectionStr)
    const client = await ServiceBusExplorerClient.create(connection)
    await client.deleteQueue(queueName)
    await client.close()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting queue:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete queue" },
      { status: 500 }
    )
  }
}

