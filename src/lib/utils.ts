import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely formats a date that may be a string or Date object.
 * Returns the original string if parsing fails, or an empty string if the value is invalid.
 */
export function formatDateSafe(date: string | Date | undefined | null): string {
  if (!date) return ""
  
  // If it's already a Date object, format it
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return ""
    return date.toLocaleString()
  }
  
  // If it's a string, try to parse it
  if (typeof date === "string") {
    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) {
      // If parsing fails, return the original string
      return date
    }
    return parsed.toLocaleString()
  }
  
  return ""
}

