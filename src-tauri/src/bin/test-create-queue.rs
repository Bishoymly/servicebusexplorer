// Declare modules with path attributes to point to the actual module files
#[path = "../azure/mod.rs"]
mod azure;

// Test script to verify queue creation works correctly
// This script helps verify that we can create queues with properties via the REST API
//
// Usage:
//   cargo run --bin test-create-queue -- <connection_string> <queue_name>
//
// Example:
//   cargo run --bin test-create-queue -- 'Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...' test-queue-123

use azure::auth::{get_endpoint_domain, get_namespace_from_endpoint, parse_connection_string};
use azure::types::{QueueProperties, ServiceBusConnection};
use azure::servicebus::ServiceBusClient;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parse command line arguments
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 3 {
        eprintln!("Usage: {} <connection_string> <queue_name>", args[0]);
        eprintln!("\nExample:");
        eprintln!("  {} 'Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...' test-queue-123", args[0]);
        std::process::exit(1);
    }
    
    let connection_string = &args[1];
    let queue_name = &args[2];
    
    println!("==========================================");
    println!("Azure Service Bus Queue Creation Test");
    println!("==========================================");
    println!("Queue Name: {}", queue_name);
    println!("==========================================\n");
    
    // Parse connection string
    println!("[1/6] Parsing connection string...");
    let parsed = parse_connection_string(connection_string)?;
    println!("✓ Connection string parsed successfully");
    println!("  Endpoint: {}", parsed.endpoint);
    println!("  Key Name: {}", parsed.shared_access_key_name);
    println!();
    
    // Extract namespace and domain
    println!("[2/6] Extracting namespace and domain...");
    let namespace = get_namespace_from_endpoint(&parsed.endpoint)?;
    let domain = get_endpoint_domain(&parsed.endpoint)?;
    println!("✓ Namespace: {}", namespace);
    println!("✓ Domain: {}", domain);
    println!();
    
    // Create ServiceBusConnection
    println!("[3/6] Creating ServiceBusConnection...");
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
    println!("[4/6] Creating ServiceBusClient...");
    let client = ServiceBusClient::create(&connection).await?;
    println!("✓ Client created");
    println!();
    
    // Test creating queue with properties
    println!("[5/6] Creating queue with properties...");
    let properties = QueueProperties {
        name: queue_name.to_string(),
        max_size_in_megabytes: Some(1024),
        lock_duration_in_seconds: Some(30),
        max_delivery_count: Some(10),
        default_message_time_to_live_in_seconds: Some(604800),
        dead_lettering_on_message_expiration: Some(true),
        duplicate_detection_history_time_window_in_seconds: Some(600),
        enable_batched_operations: Some(true),
        enable_partitioning: Some(false),
        requires_session: Some(false),
        requires_duplicate_detection: Some(false),
        message_count: None,
        active_message_count: None,
        dead_letter_message_count: None,
        scheduled_message_count: None,
        transfer_message_count: None,
        transfer_dead_letter_message_count: None,
        size_in_bytes: None,
    };
    
    match client.create_queue(queue_name, Some(&properties)).await {
        Ok(()) => {
            println!("✓ Queue creation request sent successfully");
        }
        Err(e) => {
            eprintln!("\n❌ FAILED: Queue creation failed with error:");
            eprintln!("   {}", e);
            std::process::exit(1);
        }
    }
    println!();
    
    // Verify queue was created by getting it
    println!("[6/6] Verifying queue was created...");
    match client.get_queue(queue_name).await {
        Ok(queue) => {
            println!("✓ Queue verified successfully!");
            println!("\nQueue Properties:");
            println!("  Name: {}", queue.name);
            if let Some(max_size) = queue.max_size_in_megabytes {
                println!("  Max Size (MB): {}", max_size);
            }
            if let Some(lock_duration) = queue.lock_duration_in_seconds {
                println!("  Lock Duration (seconds): {}", lock_duration);
            }
            if let Some(max_delivery) = queue.max_delivery_count {
                println!("  Max Delivery Count: {}", max_delivery);
            }
            if let Some(ttl) = queue.default_message_time_to_live_in_seconds {
                println!("  Default TTL (seconds): {}", ttl);
            }
        }
        Err(e) => {
            eprintln!("\n❌ FAILED: Queue was not created or cannot be retrieved:");
            eprintln!("   {}", e);
            eprintln!("\n   This suggests the create_queue call may have succeeded");
            eprintln!("   but the queue was not actually created, or there's an issue");
            eprintln!("   with the XML format sent to Azure.");
            std::process::exit(1);
        }
    }
    
    println!("\n==========================================");
    println!("Test completed successfully!");
    println!("==========================================");
    println!("\nNote: The queue '{}' has been created.", queue_name);
    println!("You may want to delete it manually if it was created for testing.");
    
    Ok(())
}
