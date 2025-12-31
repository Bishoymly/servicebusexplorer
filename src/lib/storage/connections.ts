import { invoke } from "@tauri-apps/api/core"
import type { ServiceBusConnection } from "@/types/azure"

const STORAGE_KEY = "servicebusexplorer_connections"
const MIGRATION_FLAG = "servicebusexplorer_keychain_migrated"

// Store connection metadata (non-sensitive) in localStorage
// Store connection strings (sensitive) in Keychain via Tauri commands
export function saveConnections(connections: ServiceBusConnection[]): void {
  if (typeof window === "undefined") return
  try {
    // Store metadata without connection strings
    const metadata = connections.map((conn) => {
      const { connectionString, ...rest } = conn
      return rest
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata))
  } catch (error) {
    console.error("Failed to save connections:", error)
  }
}

export async function loadConnections(): Promise<ServiceBusConnection[]> {
  if (typeof window === "undefined") return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    const metadata = JSON.parse(data) as Omit<ServiceBusConnection, "connectionString">[]
    
    if (metadata.length === 0) return []
    
    // Load all connection strings from Keychain in one batch operation
    // This reduces keychain prompts from N prompts to 1 prompt
    const connectionIds = metadata.map(meta => meta.id)
    let connectionStrings: Record<string, string> = {}
    
    try {
      connectionStrings = await invoke<Record<string, string>>("get_all_connection_strings", {
        connectionIds
      })
    } catch (error) {
      console.warn("Failed to batch load connection strings, falling back to individual loads:", error)
      // Fallback to individual loads if batch fails
      for (const meta of metadata) {
        try {
          const connectionString = await getConnectionString(meta.id)
          if (connectionString) {
            connectionStrings[meta.id] = connectionString
          }
        } catch (err) {
          console.warn(`Failed to load connection string for ${meta.id}:`, err)
        }
      }
    }
    
    // Build connections array with loaded connection strings
    const connections: ServiceBusConnection[] = metadata.map(meta => ({
      ...meta,
      connectionString: connectionStrings[meta.id] || undefined,
    }))
    
    return connections
  } catch (error) {
    console.error("Failed to load connections:", error)
    return []
  }
}

export async function addConnection(connection: ServiceBusConnection): Promise<void> {
  // Store connection string in Keychain if present
  if (connection.connectionString) {
    try {
      await invoke("store_connection_string", {
        connectionId: connection.id,
        connectionString: connection.connectionString,
        connectionName: connection.name,
      })
    } catch (error) {
      console.error("Failed to store connection string in Keychain:", error)
      throw error
    }
  }
  
  // Store metadata in localStorage
  const connections = await loadConnections()
  // Remove connection string before storing metadata
  const { connectionString, ...metadata } = connection
  connections.push(metadata as ServiceBusConnection)
  saveConnections(connections)
}

export async function updateConnection(connectionId: string, updates: Partial<ServiceBusConnection>): Promise<void> {
  const connections = await loadConnections()
  const index = connections.findIndex((c) => c.id === connectionId)
  if (index !== -1) {
    const updated = { ...connections[index], ...updates, updatedAt: Date.now() }
    
    // Update connection string in Keychain if changed
    if (updates.connectionString !== undefined) {
      try {
        if (updates.connectionString) {
          await invoke("store_connection_string", {
            connectionId,
            connectionString: updates.connectionString,
            connectionName: updated.name,
          })
        } else {
          // If connection string is set to null/empty, delete from Keychain
          await invoke("delete_connection_string", { connectionId })
        }
      } catch (error) {
        console.error("Failed to update connection string in Keychain:", error)
        throw error
      }
    }
    
    // Update metadata in localStorage (without connection string)
    const { connectionString, ...metadata } = updated
    connections[index] = metadata as ServiceBusConnection
    saveConnections(connections)
  }
}

export async function deleteConnection(connectionId: string): Promise<void> {
  // Delete connection string from Keychain
  try {
    await invoke("delete_connection_string", { connectionId })
  } catch (error) {
    console.warn("Failed to delete connection string from Keychain:", error)
    // Continue with metadata deletion even if Keychain deletion fails
  }
  
  // Delete metadata from localStorage
  const connections = await loadConnections()
  const filtered = connections.filter((c) => c.id !== connectionId)
  saveConnections(filtered)
}

export async function getConnection(connectionId: string): Promise<ServiceBusConnection | undefined> {
  const connections = await loadConnections()
  return connections.find((c) => c.id === connectionId)
}

// Helper function to get connection string from Keychain
export async function getConnectionString(connectionId: string): Promise<string | null> {
  try {
    return await invoke<string>("get_connection_string", { connectionId })
  } catch (error) {
    // If not found or access denied, return null
    return null
  }
}

// Migration function to move connection strings from localStorage to Keychain
export async function migrateConnectionsToKeychain(): Promise<void> {
  if (typeof window === "undefined") return
  
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
      if (conn.connectionString) {
        try {
          await invoke("store_connection_string", {
            connectionId: conn.id,
            connectionString: conn.connectionString,
            connectionName: conn.name,
          })
          migrated++
        } catch (error) {
          console.error(`Failed to migrate connection ${conn.id}:`, error)
          // Continue with other connections
        }
      }
    }
    
    // Mark as migrated
    localStorage.setItem(MIGRATION_FLAG, "true")
    console.log(`Migrated ${migrated} connection strings to Keychain`)
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

