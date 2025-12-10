"use client"

import { LayoutDashboard, MessageSquare, FolderTree } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useConnections } from "@/hooks/useConnections"

export function Sidebar() {
  const pathname = usePathname()
  const { currentConnection } = useConnections()

  const getQueuesHref = () => {
    if (currentConnection) {
      return `/${encodeURIComponent(currentConnection.name)}/queues`
    }
    return "/queues"
  }

  const getTopicsHref = () => {
    if (currentConnection) {
      return `/${encodeURIComponent(currentConnection.name)}/topics`
    }
    return "/topics"
  }

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Queues", href: getQueuesHref(), icon: MessageSquare },
    { name: "Topics", href: getTopicsHref(), icon: FolderTree },
  ]

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-lg font-semibold">Service Bus Explorer</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          let isActive = false
          if (item.href === "/") {
            isActive = pathname === "/"
          } else if (item.name === "Queues") {
            isActive = pathname === "/queues" || (pathname?.includes("/queues") && pathname !== "/")
          } else if (item.name === "Topics") {
            isActive = pathname === "/topics" || (pathname?.includes("/topics") && pathname !== "/")
          } else {
            isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
          }
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

