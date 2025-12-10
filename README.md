# Azure Service Bus Explorer

A cross-platform Azure Service Bus Explorer built with Next.js, Tailwind CSS, and Tauri. This application allows developers to browse and manage Azure Service Bus queues, topics, subscriptions, and messages with a clean, Apple-like interface.

## Features

- **Connection Management**: Save multiple connection strings or use Azure AD authentication
- **Queue Management**: Browse queues, view properties, edit settings, and sort by name, message count, or dead letter count
- **Topic Management**: Manage topics and their subscriptions
- **Message Operations**: Peek, receive, send, and resend messages. Access dead letter queues
- **Cross-Platform**: Runs as a web app or desktop app (Windows, macOS, Linux) via Tauri

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Desktop**: Tauri (Rust-based wrapper)
- **Azure SDK**: @azure/service-bus
- **State Management**: React Context + Zustand
- **TypeScript**: Full type safety

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Rust (for Tauri desktop builds)
- Azure Service Bus connection string or Azure AD credentials

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Bishoymly/servicebusexplorer
cd servicebusexplorer
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Desktop App

#### Prerequisites for Desktop Builds

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`
- Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

**Windows:**
- Microsoft C++ Build Tools: https://visualstudio.microsoft.com/visual-cpp-build-tools/
- Rust: `rustup-init.exe` from https://rustup.rs/

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

#### Development

To run as a desktop app in development mode:

```bash
npm run tauri:dev
```

#### Production Builds

**Build for current platform:**
```bash
npm run tauri:build
```

**Build for specific platforms:**

Windows (64-bit):
```bash
npm run tauri:build -- --target x86_64-pc-windows-msvc
```

macOS (Intel):
```bash
npm run tauri:build -- --target x86_64-apple-darwin
```

macOS (Apple Silicon):
```bash
npm run tauri:build -- --target aarch64-apple-darwin
```

Linux (64-bit):
```bash
npm run tauri:build -- --target x86_64-unknown-linux-gnu
```

**Output locations:**
- Windows: `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi`
- macOS: `src-tauri/target/[arch]/release/bundle/dmg/*.dmg`
- Linux: `src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/*.deb`

#### Automated Builds with GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/build-desktop.yml`) that automatically builds the desktop app for all platforms when you:

1. **Push a version tag:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Manually trigger the workflow:**
   - Go to Actions → Build Desktop App → Run workflow
   - Select platforms to build

The workflow will:
- Build for Windows (x64), macOS (Intel & Apple Silicon), and Linux (x64)
- Create a GitHub Release with all platform installers
- Upload artifacts for download

**Note:** For macOS builds, you need to configure code signing:
1. Add your Apple Developer certificate to GitHub Secrets
2. Update the workflow to include signing configuration

## Usage

1. **Add a Connection**: Go to Connections and add your Azure Service Bus connection string or configure Azure AD authentication
2. **Browse Queues**: Navigate to Queues to see all queues, sort them, and manage their properties
3. **Manage Topics**: Go to Topics to view topics and their subscriptions
4. **Work with Messages**: Use the Messages page to peek, receive, send, and resend messages

## Project Structure

```
servicebusexplorer/
├── src/
│   ├── app/                    # Next.js app router pages
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn components
│   │   ├── connections/        # Connection management
│   │   ├── queues/             # Queue management
│   │   ├── topics/             # Topic management
│   │   └── messages/           # Message operations
│   ├── lib/                    # Utilities and Azure client
│   ├── hooks/                  # Custom React hooks
│   └── types/                  # TypeScript definitions
└── src-tauri/                  # Tauri configuration
```

## License

MIT
