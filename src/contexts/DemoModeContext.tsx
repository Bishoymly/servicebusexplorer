"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface DemoModeContextType {
  isDemoMode: boolean
  toggleDemoMode: () => void
  enableDemoMode: () => void
  disableDemoMode: () => void
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined)

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false)

  // Load demo mode state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("demoMode")
    if (saved === "true") {
      setIsDemoMode(true)
    }
  }, [])

  // Save demo mode state to localStorage and dispatch event
  useEffect(() => {
    localStorage.setItem("demoMode", isDemoMode.toString())
    // Dispatch custom event so same-window listeners can react
    window.dispatchEvent(new Event("demoModeChanged"))
  }, [isDemoMode])

  const toggleDemoMode = () => {
    setIsDemoMode(prev => !prev)
  }

  const enableDemoMode = () => {
    setIsDemoMode(true)
  }

  const disableDemoMode = () => {
    setIsDemoMode(false)
  }

  return (
    <DemoModeContext.Provider value={{ isDemoMode, toggleDemoMode, enableDemoMode, disableDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  )
}

export function useDemoMode() {
  const context = useContext(DemoModeContext)
  if (!context) {
    throw new Error("useDemoMode must be used within DemoModeProvider")
  }
  return context
}

