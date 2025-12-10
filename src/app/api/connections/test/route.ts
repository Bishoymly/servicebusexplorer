import { NextRequest, NextResponse } from "next/server"
import { connectionManager } from "@/lib/azure/connectionManager"
import type { ServiceBusConnection } from "@/types/azure"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const connection: ServiceBusConnection = body.connection

    if (!connection) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    const isValid = await connectionManager.testConnection(connection)
    return NextResponse.json({ valid: isValid })
  } catch (error: any) {
    console.error("Error testing connection:", error)
    return NextResponse.json(
      { error: error.message || "Failed to test connection", valid: false },
      { status: 500 }
    )
  }
}

