// Declare modules with path attributes to point to the actual module files
#[path = "../azure/mod.rs"]
mod azure;

// Test script to debug Azure Service Bus message peeking
// This script helps verify that we can peek multiple messages from a queue
//
// Usage:
//   cargo run --bin test-peek -- <connection_string> <queue_name> [max_count]
//
// Example:
//   cargo run --bin test-peek -- 'Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...' myqueue 10

use azure::auth::{get_endpoint_domain, get_namespace_from_endpoint, parse_connection_string};
use azure::types::ServiceBusConnection;
use azure::servicebus::ServiceBusClient;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parse command line arguments
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 3 {
        eprintln!("Usage: {} <connection_string> <queue_name> [max_count]", args[0]);
        eprintln!("\nExample:");
        eprintln!("  {} 'Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...' myqueue 10", args[0]);
        std::process::exit(1);
    }
    
    let connection_string = &args[1];
    let queue_name = &args[2];
    let max_count: u32 = args.get(3)
        .and_then(|s| s.parse().ok())
        .unwrap_or(10);
    
    println!("==========================================");
    println!("Azure Service Bus Peek Test");
    println!("==========================================");
    println!("Queue: {}", queue_name);
    println!("Max count: {}", max_count);
    println!("==========================================\n");
    
    // Parse connection string
    println!("[1/5] Parsing connection string...");
    let parsed = parse_connection_string(connection_string)?;
    println!("✓ Connection string parsed successfully");
    println!("  Endpoint: {}", parsed.endpoint);
    println!("  Key Name: {}", parsed.shared_access_key_name);
    println!();
    
    // Extract namespace and domain
    println!("[2/5] Extracting namespace and domain...");
    let namespace = get_namespace_from_endpoint(&parsed.endpoint)?;
    let domain = get_endpoint_domain(&parsed.endpoint)?;
    println!("✓ Namespace: {}", namespace);
    println!("✓ Domain: {}", domain);
    println!();
    
    // Create ServiceBusConnection
    println!("[3/5] Creating ServiceBusConnection...");
    let connection = ServiceBusConnection {
        id: "test".to_string(),
        name: "Test Connection".to_string(),
        connection_string: Some(connection_string.to_string()),
        namespace: None,
        use_azure_ad: Some(false),
        tenant_id: None,
        client_id: None,
        created_at: chrono::Utc::now().timestamp(),
        updated_at: chrono::Utc::now().timestamp(),
    };
    println!("✓ Connection created");
    println!();
    
    // Create ServiceBusClient
    println!("[4/5] Creating ServiceBusClient...");
    let client = ServiceBusClient::create(&connection).await?;
    println!("✓ Client created");
    println!();
    
    // Test peeking messages using SDK
    println!("[5/5] Peeking messages using azservicebus SDK...");
    println!("----------------------------------------");
    let messages = client.peek_messages_sdk(Some(queue_name), None, None, max_count).await?;
    println!("----------------------------------------\n");
    
    // Display results
    println!("==========================================");
    println!("Results");
    println!("==========================================");
    println!("Total messages peeked: {}", messages.len());
    println!();
    
    // Assertion: Verify we peeked more than 1 message
    if messages.is_empty() {
        eprintln!("\n❌ ASSERTION FAILED: No messages found in queue '{}'", queue_name);
        eprintln!("   Cannot verify that peek returns multiple messages.");
        eprintln!("   Please ensure the queue has at least 2 messages for testing.");
        std::process::exit(1);
    } else if messages.len() == 1 {
        eprintln!("\n❌ ASSERTION FAILED: Expected more than 1 message, but got only 1");
        eprintln!("   This indicates the peek operation may only be returning a single message.");
        eprintln!("   Please check the peek_messages implementation.");
        eprintln!("\n   Message found:");
        if let Some(ref msg_id) = messages[0].message_id {
            eprintln!("     MessageId: {}", msg_id);
        }
        std::process::exit(1);
    }
    
    println!("✓ Assertion passed: Successfully peeked {} messages (expected > 1)", messages.len());
    println!();
    
    println!("Messages:");
    for (idx, msg) in messages.iter().enumerate() {
        println!("\n  Message #{}:", idx + 1);
        if let Some(ref msg_id) = msg.message_id {
            println!("    MessageId: {}", msg_id);
        }
        if let Some(ref seq) = msg.sequence_number {
            println!("    SequenceNumber: {}", seq);
        }
        if let Some(ref corr_id) = msg.correlation_id {
            println!("    CorrelationId: {}", corr_id);
        }
        if let Some(ref content_type) = msg.content_type {
            println!("    ContentType: {}", content_type);
        }
        if let Some(ref enqueued_time) = msg.enqueued_time_utc {
            println!("    EnqueuedTimeUtc: {}", enqueued_time);
        }
        println!("    Body: {}", serde_json::to_string_pretty(&msg.body)?);
    }
    
    println!("\n==========================================");
    println!("Test completed successfully!");
    println!("==========================================");
    
    Ok(())
}
