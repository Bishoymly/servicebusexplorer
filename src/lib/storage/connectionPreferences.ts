import type { QueueSortOption, TopicSortOption, SubscriptionSortOption } from "@/types/azure"

const STORAGE_KEY_PREFIX = "servicebusexplorer_connection_prefs_"

interface ConnectionPreferences {
  queueSort?: QueueSortOption
  topicSort?: TopicSortOption
  subscriptionSort?: SubscriptionSortOption
}

function getStorageKey(connectionId: string): string {
  return `${STORAGE_KEY_PREFIX}${connectionId}`
}

export function saveConnectionPreferences(connectionId: string, prefs: ConnectionPreferences): void {
  if (typeof window === "undefined") return
  try {
    const key = getStorageKey(connectionId)
    localStorage.setItem(key, JSON.stringify(prefs))
  } catch (error) {
    console.error(`Failed to save preferences for connection ${connectionId}:`, error)
  }
}

export function loadConnectionPreferences(connectionId: string): ConnectionPreferences {
  if (typeof window === "undefined") return {}
  try {
    const key = getStorageKey(connectionId)
    const saved = localStorage.getItem(key)
    if (saved) {
      return JSON.parse(saved) as ConnectionPreferences
    }
  } catch (error) {
    console.error(`Failed to load preferences for connection ${connectionId}:`, error)
  }
  return {}
}

export function saveQueueSortPreference(connectionId: string, sortBy: QueueSortOption): void {
  const prefs = loadConnectionPreferences(connectionId)
  saveConnectionPreferences(connectionId, { ...prefs, queueSort: sortBy })
}

export function loadQueueSortPreference(connectionId: string): QueueSortOption {
  const prefs = loadConnectionPreferences(connectionId)
  return prefs.queueSort || "name"
}

export function saveTopicSortPreference(connectionId: string, sortBy: TopicSortOption): void {
  const prefs = loadConnectionPreferences(connectionId)
  saveConnectionPreferences(connectionId, { ...prefs, topicSort: sortBy })
}

export function loadTopicSortPreference(connectionId: string): TopicSortOption {
  const prefs = loadConnectionPreferences(connectionId)
  return prefs.topicSort || "name"
}

export function saveSubscriptionSortPreference(connectionId: string, sortBy: SubscriptionSortOption): void {
  const prefs = loadConnectionPreferences(connectionId)
  saveConnectionPreferences(connectionId, { ...prefs, subscriptionSort: sortBy })
}

export function loadSubscriptionSortPreference(connectionId: string): SubscriptionSortOption {
  const prefs = loadConnectionPreferences(connectionId)
  return prefs.subscriptionSort || "name"
}

