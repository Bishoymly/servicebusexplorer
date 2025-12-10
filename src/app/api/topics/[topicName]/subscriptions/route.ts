import { NextRequest, NextResponse } from "next/server"
import { ServiceBusExplorerClient } from "@/lib/azure/serviceBusClient"
import type { ServiceBusConnection } from "@/types/azure"

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
    const subscriptions = await client.listSubscriptions(topicName)
    await client.close()

    return NextResponse.json({ subscriptions })
  } catch (error: any) {
    console.error("Error listing subscriptions:", error)
    return NextResponse.json(
      { error: error.message || "Failed to list subscriptions" },
      { status: 500 }
    )
  }
}

