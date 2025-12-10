import type { ServiceBusConnection } from "@/types/azure"

const STORAGE_KEY = "servicebusexplorer_connections"

export function saveConnections(connections: ServiceBusConnection[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(connections))
  } catch (error) {
    console.error("Failed to save connections:", error)
  }
}

export function loadConnections(): ServiceBusConnection[] {
  if (typeof window === "undefined") return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    return JSON.parse(data) as ServiceBusConnection[]
  } catch (error) {
    console.error("Failed to load connections:", error)
    return []
  }
}

export function addConnection(connection: ServiceBusConnection): void {
  const connections = loadConnections()
  connections.push(connection)
  saveConnections(connections)
}

export function updateConnection(connectionId: string, updates: Partial<ServiceBusConnection>): void {
  const connections = loadConnections()
  const index = connections.findIndex((c) => c.id === connectionId)
  if (index !== -1) {
    connections[index] = { ...connections[index], ...updates, updatedAt: Date.now() }
    saveConnections(connections)
  }
}

export function deleteConnection(connectionId: string): void {
  const connections = loadConnections()
  const filtered = connections.filter((c) => c.id !== connectionId)
  saveConnections(filtered)
}

export function getConnection(connectionId: string): ServiceBusConnection | undefined {
  const connections = loadConnections()
  return connections.find((c) => c.id === connectionId)
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

export function loadCurrentConnectionId(): string | null {
  if (typeof window === "undefined") return null
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CURRENT_CONNECTION)
    if (saved) {
      // Verify the connection still exists
      const connections = loadConnections()
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

