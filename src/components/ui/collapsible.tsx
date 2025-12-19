"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface CollapsibleProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
}

interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

const CollapsibleContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
}>({
  open: false,
  setOpen: () => {},
})

export function Collapsible({ open: controlledOpen, defaultOpen = false, onOpenChange, children, className }: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (controlledOpen === undefined) {
        setInternalOpen(newOpen)
      }
      onOpenChange?.(newOpen)
    },
    [controlledOpen, onOpenChange]
  )

  return (
    <CollapsibleContext.Provider value={{ open, setOpen }}>
      <div className={className}>{children}</div>
    </CollapsibleContext.Provider>
  )
}

export function CollapsibleTrigger({ children, className, ...props }: CollapsibleTriggerProps) {
  const { open, setOpen } = React.useContext(CollapsibleContext)
  return (
    <button
      type="button"
      className={cn("flex items-center justify-between w-full", className)}
      onClick={() => setOpen(!open)}
      {...props}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
    </button>
  )
}

export function CollapsibleContent({ children, className, ...props }: CollapsibleContentProps) {
  const { open } = React.useContext(CollapsibleContext)
  return (
    <div
      className={cn(
        "overflow-hidden transition-all",
        open ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0",
        className
      )}
      {...props}
    >
      {open && <div className="pt-2">{children}</div>}
    </div>
  )
}

