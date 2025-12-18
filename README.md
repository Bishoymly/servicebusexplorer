# Azure Service Bus Explorer

## The Professional Tool for Managing Azure Service Bus

**Azure Service Bus Explorer** is a powerful, intuitive desktop application that makes it easy to manage and monitor your Azure Service Bus infrastructure. Whether you're debugging message queues, managing topics and subscriptions, or testing your messaging workflows, this app provides everything you need in a beautiful, native interface.

---

## 🚀 Key Features

### 🔌 **Multi-Connection Management**
- Save and switch between multiple Azure Service Bus connections
- Support for connection strings and Azure AD authentication
- Quick connection testing to verify access
- Secure local storage of connection credentials

### 📬 **Queue Management**
- **Browse & Search**: View all queues with instant search and filtering
- **Real-time Metrics**: See message counts, dead letter counts, and queue sizes at a glance
- **Queue Operations**: Create, edit, and delete queues with ease
- **Smart Sorting**: Sort by name, message count, or dead letter count
- **Detailed Properties**: View and modify queue settings including TTL, lock duration, and more

### 📢 **Topic & Subscription Management**
- **Topic Overview**: Browse all topics and their properties
- **Subscription Details**: View and manage subscriptions for each topic
- **Full Control**: Create, edit, and delete topics and subscriptions
- **Property Management**: Configure topic settings and subscription filters

### 💬 **Message Operations**
- **Peek Messages**: View messages without removing them from the queue
- **Send Messages**: Create and send custom messages with properties and body
- **Message Viewer**: Inspect message content, properties, and metadata in detail
- **Dead Letter Queue Access**: Easily access and manage dead letter messages
- **Queue Purge**: Quickly clear queues or dead letter queues when needed
- **Resend Messages**: Copy and resend messages for testing and debugging

### 🎨 **Beautiful Interface**
- **Native Desktop Experience**: Fast, responsive native app built with modern technologies
- **Clean Design**: Apple-inspired interface that's intuitive and easy to use
- **Dark Mode Support**: Automatic dark mode that matches your system preferences
- **Cross-Platform**: Available for Windows, macOS, and Linux

### ⚡ **Performance & Reliability**
- **Lightweight**: Built with Tauri for minimal resource usage
- **Fast**: Instant loading and smooth navigation
- **Offline Capable**: Works with your Azure Service Bus without requiring cloud services
- **Secure**: All connection data stored locally on your machine

---

## 🎯 Perfect For

- **Developers** debugging and testing Azure Service Bus integrations
- **DevOps Engineers** monitoring and managing message queues
- **QA Teams** testing messaging workflows and scenarios
- **Architects** exploring and understanding Service Bus topology
- **Support Teams** troubleshooting message delivery issues

---

## 📋 Use Cases

- **Debugging**: Quickly peek at messages to understand what's being sent
- **Testing**: Send test messages to verify your applications are working correctly
- **Monitoring**: Keep an eye on queue depths and dead letter counts
- **Troubleshooting**: Access dead letter queues to diagnose delivery failures
- **Development**: Create and configure queues and topics during development
- **Documentation**: Explore your Service Bus namespace structure

---

## 🔒 Security & Privacy

- All connection strings and credentials are stored locally on your device
- No data is sent to third-party servers
- Direct connection to your Azure Service Bus namespace
- Supports Azure AD authentication for enhanced security

---

## 💻 System Requirements

- **macOS**: macOS 10.13 or later
- **Windows**: Windows 10 or later
- **Linux**: Ubuntu 18.04+ / Debian 10+ / Fedora 32+ / Arch Linux
- **Internet Connection**: Required to connect to Azure Service Bus

---

## 📥 Installation

### macOS App Store
Download from the Mac App Store (coming soon)

### Direct Download
Visit our [Releases](https://github.com/Bishoymly/servicebusexplorer/releases) page to download installers for Windows, macOS, and Linux.

### Development Build
For developers who want to build from source, see [BUILD.md](BUILD.md) for detailed instructions.

---

## 🛠️ Technical Details

**Built with:**
- **Framework**: Next.js 16+ (App Router)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Desktop**: Tauri (Rust-based wrapper)
- **Azure SDK**: @azure/service-bus v7.9+
- **State Management**: React Context + Zustand
- **TypeScript**: Full type safety throughout

---

## 🚀 Quick Start

1. **Launch the App**: Open Azure Service Bus Explorer
2. **Add Your Connection**: 
   - Click "Add Connection" on the dashboard
   - Enter your Azure Service Bus connection string or configure Azure AD
   - Test the connection to verify access
3. **Explore Your Namespace**: 
   - View queues and topics in the sidebar
   - Click any queue or topic to see details and messages
4. **Work with Messages**: 
   - Peek messages to inspect content
   - Send new messages for testing
   - Access dead letter queues when needed

## 📖 Usage Guide

### Managing Connections
- **Add Connection**: Click the "+" button and enter your connection details
- **Switch Connections**: Use the dropdown in the header to switch between saved connections
- **Test Connection**: Verify your connection works before saving
- **Edit/Delete**: Right-click connections to edit or remove them

### Working with Queues
- **View All Queues**: See all queues in your namespace with real-time message counts
- **Search Queues**: Use the search bar to quickly find specific queues
- **Queue Details**: Click a queue to view properties, messages, and operations
- **Sort & Filter**: Sort by name, message count, or dead letter count
- **Create Queue**: Add new queues directly from the app
- **Purge Queue**: Clear all messages from a queue or its dead letter queue

### Managing Topics
- **Browse Topics**: View all topics and their subscription counts
- **Topic Details**: Click a topic to see properties and subscriptions
- **Subscriptions**: View and manage subscriptions for each topic
- **Create Topics**: Add new topics with custom properties

### Message Operations
- **Peek Messages**: View messages without removing them (non-destructive)
- **Send Messages**: Create custom messages with JSON body and custom properties
- **Message Details**: Inspect message content, system properties, and custom properties
- **Dead Letter Access**: Easily navigate to dead letter queues
- **Resend**: Copy and resend messages for testing

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/) for native desktop performance
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Powered by [Azure Service Bus SDK](https://github.com/Azure/azure-sdk-for-js)

## 📞 Support

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/Bishoymly/servicebusexplorer/issues)
- **Documentation**: Check the [Wiki](https://github.com/Bishoymly/servicebusexplorer/wiki) for detailed guides

---

**Made with ❤️ for the Azure community**
