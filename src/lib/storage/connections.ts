import { invoke } from "@tauri-apps/api/core"
import type { ServiceBusConnection } from "@/types/azure"

// All connection data is now stored in Keychain via Tauri commands
// No localStorage usage for connection data

export async function loadConnections(): Promise<ServiceBusConnection[]> {
  if (typeof window === "undefined") return []
  try {
    const connections = await invoke<ServiceBusConnection[]>("get_all_connections")
    return connections || []
  } catch (error) {
    console.error("Failed to load connections from Keychain:", error)
    return []
  }
}

export async function addConnection(connection: ServiceBusConnection): Promise<void> {
  try {
    await invoke("store_connection", { connection })
  } catch (error) {
    console.error("Failed to store connection in Keychain:", error)
    throw error
  }
}

export async function updateConnection(connectionId: string, updates: Partial<ServiceBusConnection>): Promise<void> {
  const connections = await loadConnections()
  const connection = connections.find((c) => c.id === connectionId)
  if (!connection) {
    throw new Error(`Connection ${connectionId} not found`)
  }
  
  const updated: ServiceBusConnection = {
    ...connection,
    ...updates,
    updatedAt: Date.now(),
  }
  
  try {
    await invoke("store_connection", { connection: updated })
  } catch (error) {
    console.error("Failed to update connection in Keychain:", error)
    throw error
  }
}

export async function deleteConnection(connectionId: string): Promise<void> {
  try {
    await invoke("delete_connection", { connectionId })
  } catch (error) {
    console.error("Failed to delete connection from Keychain:", error)
    throw error
  }
}

export async function getConnection(connectionId: string): Promise<ServiceBusConnection | undefined> {
  const connections = await loadConnections()
  return connections.find((c) => c.id === connectionId)
}

// Migration function to move connections from localStorage to Keychain
export async function migrateConnectionsToKeychain(): Promise<void> {
  if (typeof window === "undefined") return
  
  const STORAGE_KEY = "servicebusexplorer_connections"
  const MIGRATION_FLAG = "servicebusexplorer_keychain_migrated"
  
  // Check if already migrated
  if (localStorage.getItem(MIGRATION_FLAG) === "true") {
    return
  }
  
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) {
      localStorage.setItem(MIGRATION_FLAG, "true")
      return
    }
    
    const connections = JSON.parse(data) as ServiceBusConnection[]
    let migrated = 0
    
    for (const conn of connections) {
      try {
        await invoke("store_connection", { connection: conn })
        migrated++
      } catch (error) {
        console.error(`Failed to migrate connection ${conn.id}:`, error)
        // Continue with other connections
      }
    }
    
    // Mark as migrated
    localStorage.setItem(MIGRATION_FLAG, "true")
    
    // Optionally clear localStorage after successful migration
    // localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error("Failed to migrate connections to Keychain:", error)
    // Don't mark as migrated if there was an error
  }
}

const STORAGE_KEY_CURRENT_CONNECTION = "servicebusexplorer_current_connection_id"

export function saveCurrentConnectionId(connectionId: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (connectionId) {
      localStorage.setItem(STORAGE_KEY_CURRENT_CONNECTION, connectionId)
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_CONNECTION)
    }
  } catch (error) {
    console.error("Failed to save current connection ID:", error)
  }
}

export async function loadCurrentConnectionId(): Promise<string | null> {
  if (typeof window === "undefined") return null
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CURRENT_CONNECTION)
    if (saved) {
      // Verify the connection still exists
      const connections = await loadConnections()
      if (connections.some((c) => c.id === saved)) {
        return saved
      }
      // If saved connection doesn't exist, remove it
      localStorage.removeItem(STORAGE_KEY_CURRENT_CONNECTION)
    }
    return null
  } catch (error) {
    console.error("Failed to load current connection ID:", error)
    return null
  }
}
