import { NextRequest, NextResponse } from "next/server"
import { ServiceBusExplorerClient } from "@/lib/azure/serviceBusClient"
import type { ServiceBusConnection, SubscriptionProperties } from "@/types/azure"

export async function POST(
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
    const { subscriptionName, properties }: { subscriptionName: string; properties?: Partial<SubscriptionProperties> } = body

    if (!subscriptionName) {
      return NextResponse.json({ error: "Subscription name is required" }, { status: 400 })
    }

    const connection: ServiceBusConnection = JSON.parse(connectionStr)
    const client = await ServiceBusExplorerClient.create(connection)
    await client.createSubscription(topicName, subscriptionName, properties)
    await client.close()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error creating subscription:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create subscription" },
      { status: 500 }
    )
  }
}

