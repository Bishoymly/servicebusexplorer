import { NextRequest, NextResponse } from "next/server"
import { ServiceBusExplorerClient } from "@/lib/azure/serviceBusClient"
import type { ServiceBusConnection, QueueProperties } from "@/types/azure"

export async function POST(request: NextRequest) {
  try {
    const connectionStr = request.headers.get("x-connection")
    if (!connectionStr) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    const body = await request.json()
    const { queueName, properties }: { queueName: string; properties?: Partial<QueueProperties> } = body

    if (!queueName) {
      return NextResponse.json({ error: "Queue name is required" }, { status: 400 })
    }

    const connection: ServiceBusConnection = JSON.parse(connectionStr)
    const client = await ServiceBusExplorerClient.create(connection)
    await client.createQueue(queueName, properties)
    await client.close()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error creating queue:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create queue" },
      { status: 500 }
    )
  }
}

