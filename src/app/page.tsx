import { ConnectionManager } from "@/components/connections/ConnectionManager"

export default function Home() {
  return (
    <div className="h-full">
      <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        <div className="p-4 border-b">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome to Azure Service Bus Explorer. Manage your queues, topics, and messages.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <ConnectionManager />
        </div>
      </div>
    </div>
  );
}
