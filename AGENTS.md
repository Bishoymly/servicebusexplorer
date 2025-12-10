# Agent Best Practices - Azure Service Bus Explorer

This document provides best practices and guidelines for AI agents and developers working on this repository.

## Project Overview

Azure Service Bus Explorer is a cross-platform application built with Next.js, TypeScript, Tailwind CSS, and Tauri. It allows developers to manage Azure Service Bus queues, topics, subscriptions, and messages through a clean, Apple-like interface.

## Technology Stack

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v3 with shadcn/ui components
- **Desktop**: Tauri (Rust-based wrapper)
- **Azure SDK**: @azure/service-bus v7.9+
- **State Management**: React Context + Zustand
- **Storage**: localStorage for connection strings

## Project Structure

```
servicebusexplorer/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout with sidebar/header
│   │   ├── page.tsx            # Dashboard home
│   │   ├── connections/        # Connections page
│   │   ├── queues/             # Queues page
│   │   ├── topics/             # Topics page
│   │   └── messages/           # Messages page
│   ├── components/
│   │   ├── ui/                 # shadcn/ui base components
│   │   ├── connections/        # Connection management components
│   │   ├── queues/             # Queue management components
│   │   ├── topics/             # Topic management components
│   │   ├── messages/           # Message operation components
│   │   └── layout/             # Layout components (Sidebar, Header)
│   ├── lib/
│   │   ├── azure/              # Azure Service Bus client wrappers
│   │   │   ├── serviceBusClient.ts    # Main client wrapper
│   │   │   └── connectionManager.ts   # Connection management
│   │   ├── storage/            # localStorage utilities
│   │   └── utils.ts            # General utilities (cn helper)
│   ├── hooks/                  # Custom React hooks
│   │   ├── useConnections.ts   # Connection state management
│   │   ├── useQueues.ts         # Queue operations
│   │   ├── useTopics.ts         # Topic operations
│   │   └── useMessages.ts       # Message operations
│   └── types/                   # TypeScript definitions
│       └── azure.ts             # Azure Service Bus types
└── src-tauri/                  # Tauri desktop configuration
```

## Development Workflow

### Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```
   Opens at http://localhost:3000

3. **Run desktop app** (requires Rust):
   ```bash
   npm run tauri:dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

### Code Style Guidelines

1. **TypeScript**: Always use strict typing. Avoid `any` unless absolutely necessary.
2. **Components**: Use "use client" directive for client components. Server components by default.
3. **Naming**: 
   - Components: PascalCase (e.g., `QueueCard.tsx`)
   - Hooks: camelCase starting with "use" (e.g., `useQueues.ts`)
   - Utilities: camelCase (e.g., `utils.ts`)
   - Types: PascalCase (e.g., `QueueProperties`)

4. **File Organization**: 
   - One component per file
   - Co-locate related components in the same directory
   - Keep hooks separate from components

## Key Patterns and Conventions

### 1. Azure Service Bus Client Usage

**CRITICAL**: The Azure Service Bus SDK is a Node.js SDK and **cannot run in the browser**. All Azure operations must go through Next.js API routes.

**✅ Correct - Use API Client in Components:**
```typescript
import { apiClient } from "@/lib/api/client"
const queues = await apiClient.listQueues(currentConnection)
```

**✅ Correct - Azure SDK only in API Routes:**
```typescript
// In src/app/api/queues/route.ts
import { ServiceBusExplorerClient } from "@/lib/azure/serviceBusClient"
const client = await ServiceBusExplorerClient.create(connection)
const queues = await client.listQueues()
```

**❌ Incorrect - Never use Azure SDK in client components:**
```typescript
// This will fail with "Failed to fetch" error
import { ServiceBusExplorerClient } from "@/lib/azure/serviceBusClient"
const client = await ServiceBusExplorerClient.create(connection) // ❌ Won't work in browser
```

**Important**: 
- All Azure SDK calls must be in API routes (`src/app/api/`)
- Client components use `apiClient` from `@/lib/api/client`
- The API routes handle Duration conversions (ISO 8601 ↔ seconds) automatically

### 2. Connection Management

- **Always check for current connection** before making Azure calls:
  ```typescript
  const { currentConnection } = useConnections()
  if (!currentConnection) {
    // Handle no connection state
    return
  }
  ```

- **Connection strings are stored in localStorage** via `src/lib/storage/connections.ts`
- **Never log or expose connection strings** in error messages or console

### 3. Component Structure

**Follow this pattern for feature components**:

```typescript
"use client"

import { useState } from "react"
import { useQueues } from "@/hooks/useQueues"
import { Button } from "@/components/ui/button"

export function QueueList() {
  const { queues, loading, error, refresh } = useQueues()
  // Component logic
}
```

### 4. Error Handling

- **Always handle errors gracefully**:
  ```typescript
  try {
    await client.listQueues()
  } catch (err: any) {
    setError(err.message || "Failed to load queues")
    // Show user-friendly error message
  }
  ```

- **Use Alert components** for error display:
  ```typescript
  import { Alert, AlertDescription } from "@/components/ui/alert"
  {error && (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )}
  ```

### 5. Loading States

- **Always show loading indicators**:
  ```typescript
  {loading && queues.length === 0 ? (
    <div className="flex items-center justify-center py-12">
      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ) : (
    // Content
  )}
  ```

### 6. Form Handling

- **Use controlled components** with useState:
  ```typescript
  const [name, setName] = useState("")
  <Input value={name} onChange={(e) => setName(e.target.value)} />
  ```

- **Validate before submission**:
  ```typescript
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return // Validation
    // Submit logic
  }
  ```

## Azure Service Bus Specific Considerations

### Duration Handling

The Azure SDK uses ISO 8601 duration strings (e.g., "PT30S" for 30 seconds), but our UI works with seconds. The `ServiceBusExplorerClient` handles conversion automatically:

- **Reading**: `parseDurationToSeconds()` converts "PT30S" → 30
- **Writing**: `secondsToDuration()` converts 30 → "PT30S"

**Don't manually convert durations** - use the client methods.

### Message Properties

Azure SDK message properties can be `string | number | Buffer`. Always convert to strings:

```typescript
messageId: msg.messageId ? String(msg.messageId) : undefined
correlationId: msg.correlationId ? String(msg.correlationId) : undefined
sequenceNumber: msg.sequenceNumber ? Number(msg.sequenceNumber) : undefined
```

### Queue/Topic Operations

- **List operations** return runtime properties (message counts, sizes)
- **Get operations** return both properties and runtime properties
- **Update operations** require getting existing properties first, then updating
- **Create operations** can set initial properties

### Dead Letter Queues

Access dead letter messages using:
```typescript
const receiver = client.createReceiver(queueName, { 
  subQueueType: "deadLetter", 
  receiveMode: "peekLock" 
})
```

## UI/UX Guidelines

### Design System

- **Use shadcn/ui components** from `src/components/ui/`
- **Follow Apple-like design**: Clean, minimal, information-dense
- **Condensed layouts**: Maximize information per screen
- **Consistent spacing**: Use Tailwind spacing scale

### Component Patterns

1. **Cards for lists**: Use `Card` component for queue/topic cards
2. **Dialogs for details**: Use `Dialog` for viewing/editing details
3. **Forms**: Use `Dialog` with form elements for create/edit
4. **Sorting**: Use `Select` component for sort options

### Color Scheme

- Uses CSS variables defined in `globals.css`
- Supports light/dark mode via `prefers-color-scheme`
- Colors: `background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`

## Testing Considerations

### Manual Testing Checklist

When adding features, test:

1. **Connection Management**:
   - [ ] Add connection (connection string)
   - [ ] Add connection (Azure AD)
   - [ ] Edit connection
   - [ ] Delete connection
   - [ ] Switch between connections
   - [ ] Test connection

2. **Queue Operations**:
   - [ ] List queues
   - [ ] Sort queues (name, message count, dead letter count)
   - [ ] View queue details
   - [ ] Edit queue properties
   - [ ] Create queue
   - [ ] Delete queue

3. **Topic Operations**:
   - [ ] List topics
   - [ ] View topic details
   - [ ] View subscriptions
   - [ ] Edit topic properties
   - [ ] Create topic
   - [ ] Delete topic

4. **Message Operations**:
   - [ ] Peek messages
   - [ ] Receive messages
   - [ ] View message details
   - [ ] Send message
   - [ ] Resend message
   - [ ] Access dead letter queue

## Common Pitfalls to Avoid

1. **❌ Don't use Azure SDK directly in client components**
   - Azure SDK only works in Node.js (API routes)
   - Always use `apiClient` from `@/lib/api/client` in components
   - All Azure operations must go through `/api/*` routes

2. **❌ Don't forget to handle loading/error states**
   - Always show loading indicators and error messages

3. **❌ Don't expose connection strings**
   - Never log or display connection strings in UI

4. **❌ Don't forget to close Azure clients**
   - The wrapper handles this, but be aware of resource cleanup

5. **❌ Don't use `any` types**
   - Use proper TypeScript types from `src/types/azure.ts`

6. **❌ Don't mix server and client components incorrectly**
   - Use "use client" for interactive components

7. **❌ Don't forget to handle null/undefined**
   - Always check for currentConnection before Azure operations

## Build and Deployment

### Web Build

```bash
npm run build
npm run start
```

### Desktop Build

**Local builds:**
```bash
# Current platform
npm run tauri:build

# Specific platform
npm run tauri:build -- --target x86_64-pc-windows-msvc
npm run tauri:build -- --target x86_64-apple-darwin
npm run tauri:build -- --target aarch64-apple-darwin
npm run tauri:build -- --target x86_64-unknown-linux-gnu
```

**CI/CD with GitHub Actions:**

Two workflows are available:

1. **`.github/workflows/build-desktop.yml`** - Full workflow with automatic releases
   - Triggers on version tags (v*)
   - Creates GitHub Releases with installers
   - Requires proper configuration for code signing (macOS)

2. **`.github/workflows/build-desktop-simple.yml`** - Simple build workflow
   - Builds artifacts without creating releases
   - Useful for testing or manual release creation
   - Triggers on push to main/develop or manual dispatch

**To trigger a build:**
```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0

# Or manually trigger via GitHub Actions UI
```

**Build outputs:**
- Windows: `.msi` installer in `bundle/msi/`
- macOS: `.dmg` disk image in `bundle/dmg/`
- Linux: `.deb` package in `bundle/`

### Environment Variables

Currently none required. Connection strings are stored in localStorage.

### Code Signing (macOS)

For production macOS builds, configure code signing:

1. Export your Apple Developer certificate
2. Add to GitHub Secrets:
   - `APPLE_CERTIFICATE` - Base64 encoded .p12 certificate
   - `APPLE_CERTIFICATE_PASSWORD` - Certificate password
   - `APPLE_SIGNING_IDENTITY` - Signing identity (e.g., "Developer ID Application: Your Name")
   - `APPLE_TEAM_ID` - Your Apple Team ID

3. Update the workflow to use these secrets for signing

## Troubleshooting

### Build Errors

1. **Tailwind CSS errors**: Ensure using Tailwind v3 (not v4)
2. **TypeScript errors**: Check Azure SDK types match our interfaces
3. **Import errors**: Verify path aliases (`@/`) are correct

### Runtime Errors

1. **"Failed to create client"**: Check connection string format
2. **"Failed to load queues"**: Verify Azure permissions
3. **CORS errors**: Only occurs in web version, not desktop

### Common Fixes

- **Clear Next.js cache**: `rm -rf .next`
- **Reinstall dependencies**: `rm -rf node_modules && npm install`
- **Check TypeScript**: `npm run lint`

## File Modification Guidelines

### When Adding Features

1. **New page**: Add to `src/app/[feature]/page.tsx`
2. **New component**: Add to appropriate `src/components/[feature]/`
3. **New hook**: Add to `src/hooks/use[Feature].ts`
4. **New type**: Add to `src/types/azure.ts` or create new file
5. **New utility**: Add to `src/lib/[category]/`

### When Modifying Azure Client

- **Azure SDK code only in API routes** (`src/app/api/*`)
- **Client components use `apiClient`** (`src/lib/api/client.ts`)
- **Always update both API route and client wrapper** when adding features
- **Handle Duration conversions properly** (done in ServiceBusExplorerClient)
- **Update TypeScript types if needed**
- **Test with real Azure Service Bus instance**

### API Route Structure

All Azure operations are proxied through Next.js API routes:
- `/api/queues` - List queues
- `/api/queues/[queueName]` - Get/Update/Delete queue
- `/api/queues/create` - Create queue
- `/api/topics` - List topics
- `/api/topics/[topicName]` - Get/Update/Delete topic
- `/api/topics/[topicName]/subscriptions` - List subscriptions
- `/api/topics/create` - Create topic
- `/api/messages/peek` - Peek messages
- `/api/messages/receive` - Receive messages
- `/api/messages/send` - Send message
- `/api/messages/deadletter` - Peek dead letter messages
- `/api/connections/test` - Test connection

Connection data is passed via `x-connection` header (JSON stringified).

## Code Review Checklist

Before submitting changes:

- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] No console errors in browser
- [ ] Loading states implemented
- [ ] Error handling implemented
- [ ] Connection check before Azure operations
- [ ] Proper use of ServiceBusExplorerClient wrapper
- [ ] UI follows design system (shadcn/ui components)
- [ ] No connection strings exposed in logs/UI
- [ ] Components are properly typed
- [ ] Hooks follow naming convention (use*)

## Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **shadcn/ui**: https://ui.shadcn.com
- **Azure Service Bus SDK**: https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/servicebus
- **Tauri**: https://tauri.app

## Questions?

When in doubt:
1. Check existing similar code patterns
2. Review the Azure SDK documentation
3. Test with a real Azure Service Bus instance
4. Follow the established patterns in the codebase

