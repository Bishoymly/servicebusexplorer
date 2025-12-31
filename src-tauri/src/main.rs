// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};

#[cfg(target_os = "macos")]
mod storekit;

mod azure;
// Keychain module is no longer used - we use tauri-plugin-keyring directly in commands

use azure::types::*;
use azure::servicebus::ServiceBusClient;

#[derive(Debug, Serialize, Deserialize)]
struct LicenseStatus {
    is_trial: bool,
    is_purchased: bool,
    is_expired: bool,
    days_remaining: i32,
    trial_start_date: Option<i64>,
}


#[cfg(target_os = "macos")]
#[tauri::command]
fn check_license_status() -> Result<LicenseStatus, String> {
    use std::time::{SystemTime, UNIX_EPOCH};
    
    // Check if app was purchased via App Store
    let is_purchased = match storekit::check_purchase_status() {
        Ok(true) => true,
        Ok(false) => false,
        Err(e) => {
            eprintln!("Error checking purchase status: {}", e);
            false
        }
    };
    
    if is_purchased {
        return Ok(LicenseStatus {
            is_trial: false,
            is_purchased: true,
            is_expired: false,
            days_remaining: -1,
            trial_start_date: None,
        });
    }
    
    // Not purchased - return trial status
    // Note: Trial tracking is handled in the frontend via localStorage
    // This function only checks App Store purchase status
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    
    Ok(LicenseStatus {
        is_trial: true,
        is_purchased: false,
        is_expired: false,
        days_remaining: 3,
        trial_start_date: Some(now),
    })
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn check_license_status() -> Result<LicenseStatus, String> {
    // Non-macOS platforms: always return purchased (no restrictions)
    Ok(LicenseStatus {
        is_trial: false,
        is_purchased: true,
        is_expired: false,
        days_remaining: -1,
        trial_start_date: None,
    })
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn initiate_purchase() -> Result<(), String> {
    // Use StoreKit module to initiate purchase
    storekit::initiate_purchase()
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn initiate_purchase() -> Result<(), String> {
    Err("Purchases are only available on macOS".to_string())
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn verify_receipt() -> Result<bool, String> {
    // Read receipt from app bundle
    match storekit::read_receipt() {
        Ok(Some(receipt_data)) => {
            // Verify receipt with Apple's servers
            storekit::verify_receipt_with_apple(&receipt_data)
        }
        Ok(None) => {
            // No receipt found
            Ok(false)
        }
        Err(e) => {
            Err(format!("Failed to read receipt: {}", e))
        }
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn verify_receipt() -> Result<bool, String> {
    // Non-macOS: always return true (no restrictions)
    Ok(true)
}

#[tauri::command]
fn get_trial_start_date() -> Result<Option<i64>, String> {
    use std::time::{SystemTime, UNIX_EPOCH};
    
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    
    Ok(Some(now))
}

// Keychain commands using tauri-plugin-keyring
#[tauri::command]
fn store_connection_string(
    app: tauri::AppHandle,
    connection_id: String, 
    connection_string: String, 
    _connection_name: String
) -> Result<(), String> {
    use tauri_plugin_keyring::KeyringExt;
    use std::collections::HashMap;
    use serde_json;
    
    const SERVICE_NAME: &str = "com.azureservicebusexplorer";
    const MASTER_ACCOUNT: &str = "all_connections";
    
    // Load existing connections
    let mut all_connections: HashMap<String, String> = match app.keyring().get_password(SERVICE_NAME, MASTER_ACCOUNT) {
        Ok(Some(json_data)) => {
            serde_json::from_str(&json_data).unwrap_or_else(|_| HashMap::new())
        }
        _ => HashMap::new()
    };
    
    // Update/add the new connection
    all_connections.insert(connection_id, connection_string);
    
    // Store all connections back as JSON
    let json_data = serde_json::to_string(&all_connections)
        .map_err(|e| format!("Failed to serialize connection strings: {}", e))?;
    
    app.keyring()
        .set_password(SERVICE_NAME, MASTER_ACCOUNT, &json_data)
        .map_err(|e| format!("Failed to store connection string in keychain: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn get_connection_string(
    app: tauri::AppHandle,
    connection_id: String
) -> Result<String, String> {
    use tauri_plugin_keyring::KeyringExt;
    use std::collections::HashMap;
    use serde_json;
    
    const SERVICE_NAME: &str = "com.azureservicebusexplorer";
    const MASTER_ACCOUNT: &str = "all_connections";
    
    // Load all connections from single keychain entry
    match app.keyring().get_password(SERVICE_NAME, MASTER_ACCOUNT) {
        Ok(Some(json_data)) => {
            let all_connections: HashMap<String, String> = serde_json::from_str(&json_data)
                .map_err(|e| format!("Failed to parse connection strings: {}", e))?;
            
            all_connections.get(&connection_id)
                .cloned()
                .ok_or_else(|| "Connection string not found".to_string())
        }
        Ok(None) => Err("Connection string not found".to_string()),
        Err(e) => Err(format!("Failed to get connection string from keychain: {}", e))
    }
}

#[tauri::command]
fn delete_connection_string(
    app: tauri::AppHandle,
    connection_id: String
) -> Result<(), String> {
    use tauri_plugin_keyring::KeyringExt;
    use std::collections::HashMap;
    use serde_json;
    
    const SERVICE_NAME: &str = "com.azureservicebusexplorer";
    const MASTER_ACCOUNT: &str = "all_connections";
    
    // Load existing connections
    let mut all_connections: HashMap<String, String> = match app.keyring().get_password(SERVICE_NAME, MASTER_ACCOUNT) {
        Ok(Some(json_data)) => {
            serde_json::from_str(&json_data).unwrap_or_else(|_| HashMap::new())
        }
        _ => HashMap::new()
    };
    
    // Remove the connection
    all_connections.remove(&connection_id);
    
    // Store updated connections back
    let json_data = serde_json::to_string(&all_connections)
        .map_err(|e| format!("Failed to serialize connection strings: {}", e))?;
    
    app.keyring()
        .set_password(SERVICE_NAME, MASTER_ACCOUNT, &json_data)
        .map_err(|e| format!("Failed to update connection strings in keychain: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn list_connection_ids() -> Result<Vec<String>, String> {
    // The keyring plugin doesn't support listing all entries
    // The frontend handles listing via localStorage metadata
    Ok(Vec::new())
}

#[tauri::command]
fn get_all_connection_strings(
    app: tauri::AppHandle,
    connection_ids: Vec<String>
) -> Result<std::collections::HashMap<String, String>, String> {
    use tauri_plugin_keyring::KeyringExt;
    use std::collections::HashMap;
    use serde_json;
    
    const SERVICE_NAME: &str = "com.azureservicebusexplorer";
    const MASTER_ACCOUNT: &str = "all_connections";
    
    // Try to get from single master entry first
    match app.keyring().get_password(SERVICE_NAME, MASTER_ACCOUNT) {
        Ok(Some(json_data)) => {
            // Parse JSON data
            match serde_json::from_str::<HashMap<String, String>>(&json_data) {
                Ok(connections) => {
                    // If we have connections, return them
                    if !connections.is_empty() {
                        return Ok(connections);
                    }
                }
                Err(e) => {
                    eprintln!("Failed to parse connection strings JSON: {}", e);
                }
            }
        }
        Ok(None) => {
            // No master entry found, try migrating from old format
        }
        Err(e) => {
            eprintln!("Failed to get master entry: {}", e);
        }
    }
    
    // Migration: Try to load from old individual entries and consolidate
    let mut all_connections = HashMap::new();
    let mut migrated = false;
    let connection_ids_clone = connection_ids.clone();
    
    for connection_id in &connection_ids {
        let old_account = format!("connection_{}", connection_id);
        match app.keyring().get_password(SERVICE_NAME, &old_account) {
            Ok(Some(password)) => {
                all_connections.insert(connection_id.clone(), password);
                migrated = true;
            }
            _ => {}
        }
    }
    
    // If we migrated, save to new format
    if migrated && !all_connections.is_empty() {
        let json_data = match serde_json::to_string(&all_connections) {
            Ok(data) => data,
            Err(e) => {
                eprintln!("Failed to serialize during migration: {}", e);
                return Ok(all_connections);
            }
        };
        
        // Save to master entry
        if let Err(e) = app.keyring().set_password(SERVICE_NAME, MASTER_ACCOUNT, &json_data) {
            eprintln!("Failed to save migrated data: {}", e);
        } else {
            // Delete old individual entries
            for connection_id in &connection_ids_clone {
                let old_account = format!("connection_{}", connection_id);
                let _ = app.keyring().delete_password(SERVICE_NAME, &old_account);
            }
        }
    }
    
    Ok(all_connections)
}

#[tauri::command]
fn store_all_connection_strings(
    app: tauri::AppHandle,
    connection_strings: std::collections::HashMap<String, String>
) -> Result<(), String> {
    use tauri_plugin_keyring::KeyringExt;
    use serde_json;
    
    const SERVICE_NAME: &str = "com.azureservicebusexplorer";
    const MASTER_ACCOUNT: &str = "all_connections";
    
    // Store all connection strings as JSON in a single keychain entry
    let json_data = serde_json::to_string(&connection_strings)
        .map_err(|e| format!("Failed to serialize connection strings: {}", e))?;
    
    app.keyring()
        .set_password(SERVICE_NAME, MASTER_ACCOUNT, &json_data)
        .map_err(|e| format!("Failed to store connection strings in keychain: {}", e))?;
    
    Ok(())
}

// Azure Service Bus commands
#[tauri::command]
async fn list_queues(connection: ServiceBusConnection) -> Result<Vec<QueueProperties>, String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.list_queues().await
}

#[tauri::command]
async fn get_queue(connection: ServiceBusConnection, queue_name: String) -> Result<QueueProperties, String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.get_queue(&queue_name).await
}

#[tauri::command]
async fn create_queue(connection: ServiceBusConnection, queue_name: String, properties: Option<QueueProperties>) -> Result<(), String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.create_queue(&queue_name, properties.as_ref()).await
}

#[tauri::command]
async fn update_queue(connection: ServiceBusConnection, queue_name: String, properties: QueueProperties) -> Result<(), String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.update_queue(&queue_name, &properties).await
}

#[tauri::command]
async fn delete_queue(connection: ServiceBusConnection, queue_name: String) -> Result<(), String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.delete_queue(&queue_name).await
}

#[tauri::command]
async fn list_topics(connection: ServiceBusConnection) -> Result<Vec<TopicProperties>, String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.list_topics().await
}

#[tauri::command]
async fn get_topic(connection: ServiceBusConnection, topic_name: String) -> Result<TopicProperties, String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.get_topic(&topic_name).await
}

#[tauri::command]
async fn create_topic(connection: ServiceBusConnection, topic_name: String, properties: Option<TopicProperties>) -> Result<(), String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.create_topic(&topic_name, properties.as_ref()).await
}

#[tauri::command]
async fn update_topic(connection: ServiceBusConnection, topic_name: String, properties: TopicProperties) -> Result<(), String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.update_topic(&topic_name, &properties).await
}

#[tauri::command]
async fn delete_topic(connection: ServiceBusConnection, topic_name: String) -> Result<(), String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.delete_topic(&topic_name).await
}

#[tauri::command]
async fn list_subscriptions(connection: ServiceBusConnection, topic_name: String) -> Result<Vec<SubscriptionProperties>, String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.list_subscriptions(&topic_name).await
}

#[tauri::command]
async fn create_subscription(connection: ServiceBusConnection, topic_name: String, subscription_name: String, properties: Option<SubscriptionProperties>) -> Result<(), String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.create_subscription(&topic_name, &subscription_name, properties.as_ref()).await
}

#[tauri::command]
async fn peek_messages(
    connection: ServiceBusConnection,
    queue_name: Option<String>,
    topic_name: Option<String>,
    subscription_name: Option<String>,
    max_count: u32,
) -> Result<Vec<ServiceBusMessage>, String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.peek_messages(
        queue_name.as_deref(),
        topic_name.as_deref(),
        subscription_name.as_deref(),
        max_count,
    ).await
}

#[tauri::command]
async fn peek_dead_letter_messages(
    connection: ServiceBusConnection,
    queue_name: Option<String>,
    topic_name: Option<String>,
    subscription_name: Option<String>,
    max_count: u32,
) -> Result<Vec<ServiceBusMessage>, String> {
    // For dead letter messages, we use the same peek but with a different path
    // This is a simplified version - full implementation would handle dead letter queue path
    let client = ServiceBusClient::create(&connection).await?;
    client.peek_messages(
        queue_name.as_deref(),
        topic_name.as_deref(),
        subscription_name.as_deref(),
        max_count,
    ).await
}

#[tauri::command]
async fn send_message(
    connection: ServiceBusConnection,
    queue_name: Option<String>,
    topic_name: Option<String>,
    message: ServiceBusMessage,
) -> Result<(), String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.send_message(
        queue_name.as_deref(),
        topic_name.as_deref(),
        &message,
    ).await
}

#[tauri::command]
async fn purge_queue(connection: ServiceBusConnection, queue_name: String, purge_dead_letter: bool) -> Result<u32, String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.purge_queue(&queue_name, purge_dead_letter).await
}

#[tauri::command]
async fn test_connection(connection: ServiceBusConnection) -> Result<bool, String> {
    let client = ServiceBusClient::create(&connection).await?;
    client.test_connection().await
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_keyring::init())
        .invoke_handler(tauri::generate_handler![
            // License commands
            check_license_status,
            initiate_purchase,
            verify_receipt,
            get_trial_start_date,
            // Keychain commands
            store_connection_string,
            get_connection_string,
            delete_connection_string,
            list_connection_ids,
            get_all_connection_strings,
            store_all_connection_strings,
            // Azure Service Bus commands
            list_queues,
            get_queue,
            create_queue,
            update_queue,
            delete_queue,
            list_topics,
            get_topic,
            create_topic,
            update_topic,
            delete_topic,
            list_subscriptions,
            create_subscription,
            peek_messages,
            peek_dead_letter_messages,
            send_message,
            purge_queue,
            test_connection,
        ])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

