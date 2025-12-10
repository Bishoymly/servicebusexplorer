import type { QueueSortOption } from "@/types/azure"

const STORAGE_KEY_QUEUE_SORT = "servicebusexplorer_queue_sort"

export function saveQueueSortPreference(sortBy: QueueSortOption): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY_QUEUE_SORT, sortBy)
  } catch (error) {
    console.error("Failed to save queue sort preference:", error)
  }
}

export function loadQueueSortPreference(): QueueSortOption {
  if (typeof window === "undefined") return "name"
  try {
    const saved = localStorage.getItem(STORAGE_KEY_QUEUE_SORT)
    if (saved && (saved === "name" || saved === "messageCount" || saved === "deadLetterCount")) {
      return saved as QueueSortOption
    }
    return "name"
  } catch (error) {
    console.error("Failed to load queue sort preference:", error)
    return "name"
  }
}


