import { NextRequest, NextResponse } from "next/server"
import { ServiceBusExplorerClient } from "@/lib/azure/serviceBusClient"
import type { ServiceBusConnection } from "@/types/azure"

export async function GET(request: NextRequest) {
  try {
    const connectionStr = request.headers.get("x-connection")
    if (!connectionStr) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    const connection: ServiceBusConnection = JSON.parse(connectionStr)
    const client = await ServiceBusExplorerClient.create(connection)
    
    // Stream queues as they're loaded for better performance
    const queues = await client.listQueues()
    await client.close()

    // Return all queues at once (client-side handles progressive rendering)
    return NextResponse.json({ queues })
  } catch (error: any) {
    console.error("Error listing queues:", error)
    return NextResponse.json(
      { error: error.message || "Failed to list queues" },
      { status: 500 }
    )
  }
}

