// Declare modules with path attributes to point to the actual module files
#[path = "../azure/mod.rs"]
mod azure;

// Test script to verify queue update works correctly
// This script helps verify that we can update queues with properties via the REST API
//
// Usage:
//   cargo run --bin test-update-queue -- <connection_string> <queue_name>
//
// Example:
//   cargo run --bin test-update-queue -- 'Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...' test-queue

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
        eprintln!("  {} 'Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...' test-queue", args[0]);
        std::process::exit(1);
    }
    
    let connection_string = &args[1];
    let queue_name = &args[2];
    
    println!("==========================================");
    println!("Azure Service Bus Queue Update Test");
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
    
    // Get existing queue first
    println!("[5/6] Getting existing queue properties...");
    let existing_queue = match client.get_queue(queue_name).await {
        Ok(queue) => {
            println!("✓ Queue found");
            println!("  Current Max Size (MB): {:?}", queue.max_size_in_megabytes);
            println!("  Current Lock Duration (seconds): {:?}", queue.lock_duration_in_seconds);
            println!("  Current Max Delivery Count: {:?}", queue.max_delivery_count);
            println!("  Current Enable Partitioning: {:?}", queue.enable_partitioning);
            println!("  Current Requires Session: {:?}", queue.requires_session);
            println!("  Current Requires Duplicate Detection: {:?}", queue.requires_duplicate_detection);
            queue
        }
        Err(e) => {
            eprintln!("\n❌ FAILED: Queue not found or cannot be retrieved:");
            eprintln!("   {}", e);
            eprintln!("\n   Please ensure the queue '{}' exists.", queue_name);
            std::process::exit(1);
        }
    };
    println!();
    
    // Test updating queue with new properties
    println!("[6/6] Updating queue properties...");
    let update_properties = QueueProperties {
        name: queue_name.to_string(),
        max_size_in_megabytes: Some(2048), // Change max size
        lock_duration_in_seconds: Some(60), // Change lock duration
        max_delivery_count: Some(15), // Change max delivery count
        default_message_time_to_live_in_seconds: Some(604800),
        dead_lettering_on_message_expiration: Some(true),
        duplicate_detection_history_time_window_in_seconds: Some(600),
        enable_batched_operations: Some(true),
        // Use existing values for immutable properties
        enable_partitioning: existing_queue.enable_partitioning,
        requires_session: existing_queue.requires_session,
        requires_duplicate_detection: existing_queue.requires_duplicate_detection,
        message_count: existing_queue.message_count,
        active_message_count: existing_queue.active_message_count,
        dead_letter_message_count: existing_queue.dead_letter_message_count,
        scheduled_message_count: existing_queue.scheduled_message_count,
        transfer_message_count: existing_queue.transfer_message_count,
        transfer_dead_letter_message_count: existing_queue.transfer_dead_letter_message_count,
        size_in_bytes: existing_queue.size_in_bytes,
    };
    
    match client.update_queue(queue_name, &update_properties).await {
        Ok(()) => {
            println!("✓ Queue update request sent successfully");
        }
        Err(e) => {
            eprintln!("\n❌ FAILED: Queue update failed with error:");
            eprintln!("   {}", e);
            std::process::exit(1);
        }
    }
    
    // Verify queue was updated by getting it again
    println!("\n[7/7] Verifying queue was updated...");
    match client.get_queue(queue_name).await {
        Ok(updated_queue) => {
            println!("✓ Queue verified successfully!");
            println!("\nUpdated Queue Properties:");
            println!("  Name: {}", updated_queue.name);
            if let Some(max_size) = updated_queue.max_size_in_megabytes {
                println!("  Max Size (MB): {} (was: {:?})", max_size, existing_queue.max_size_in_megabytes);
            }
            if let Some(lock_duration) = updated_queue.lock_duration_in_seconds {
                println!("  Lock Duration (seconds): {} (was: {:?})", lock_duration, existing_queue.lock_duration_in_seconds);
            }
            if let Some(max_delivery) = updated_queue.max_delivery_count {
                println!("  Max Delivery Count: {} (was: {:?})", max_delivery, existing_queue.max_delivery_count);
            }
        }
        Err(e) => {
            eprintln!("\n❌ FAILED: Queue was not updated or cannot be retrieved:");
            eprintln!("   {}", e);
            std::process::exit(1);
        }
    }
    
    println!("\n==========================================");
    println!("Test completed successfully!");
    println!("==========================================");
    
    Ok(())
}
