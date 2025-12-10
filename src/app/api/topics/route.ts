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
    const topics = await client.listTopics()
    await client.close()

    return NextResponse.json({ topics })
  } catch (error: any) {
    console.error("Error listing topics:", error)
    return NextResponse.json(
      { error: error.message || "Failed to list topics" },
      { status: 500 }
    )
  }
}


