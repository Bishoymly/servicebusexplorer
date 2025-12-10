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
    const { queueName, purgeDeadLetter = false } = body

    if (!queueName) {
      return NextResponse.json({ error: "Queue name is required" }, { status: 400 })
    }

    const connection: ServiceBusConnection = JSON.parse(connectionStr)
    const client = await ServiceBusExplorerClient.create(connection)
    
    const purgedCount = await client.purgeQueue(queueName, purgeDeadLetter)
    
    await client.close()
    return NextResponse.json({ purgedCount })
  } catch (error: any) {
    console.error("Error purging queue:", error)
    return NextResponse.json(
      { error: error.message || "Failed to purge queue" },
      { status: 500 }
    )
  }
}

