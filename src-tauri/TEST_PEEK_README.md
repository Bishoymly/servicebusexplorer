# Test Peek Script

This script helps debug and test peeking multiple messages from an Azure Service Bus queue.

## Usage

```bash
cd src-tauri
cargo run --bin test-peek -- <connection_string> <queue_name> [max_count]
```

## Examples

### Basic usage (peeks up to 10 messages by default):
```bash
cargo run --bin test-peek -- 'Endpoint=sb://sb-uat-ipts.servicebus.usgovcloudapi.net/;SharedAccessKeyName=SharedKey;SharedAccessKey=vbmYuCV3y5Yw+h8RM3aLGo2lVC5xWACL+KD6v5LbHEc=' missingappxtenderdocumentjob 100
```

### Peek up to 20 messages:
```bash
cargo run --bin test-peek -- 'Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...' myqueue 20
```

## What it does

1. Parses the connection string
2. Extracts namespace and domain
3. Creates a ServiceBusClient
4. Peeks messages from the specified queue
5. Displays all peeked messages with their properties

## Output

The script provides detailed output showing:
- Connection parsing status
- Namespace and domain extraction
- Each step of the peek operation
- All messages found with their properties (MessageId, SequenceNumber, Body, etc.)

## Debugging

The script uses the same `peek_messages` implementation as the main app, so any fixes you make here can be directly applied to the main codebase. The script includes detailed logging to help identify issues with:
- Authentication
- URL construction
- Response parsing (XML vs JSON)
- Message extraction
- Pagination
