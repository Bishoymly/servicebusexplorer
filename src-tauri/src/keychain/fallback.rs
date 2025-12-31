// Fallback implementation for non-macOS platforms
// Note: This module is no longer used - we use tauri-plugin-keyring instead
// Keeping for reference but functions are now handled in main.rs via the plugin

const SERVICE_NAME: &str = "com.azureservicebusexplorer";
const ACCOUNT_PREFIX: &str = "connection_";

pub fn store_connection_string(connection_id: &str, connection_string: &str, _connection_name: &str) -> Result<(), String> {
    Err("This function should not be called directly. Use Tauri commands instead.".to_string())
}

pub fn get_connection_string(connection_id: &str) -> Result<String, String> {
    Err("This function should not be called directly. Use Tauri commands instead.".to_string())
}

pub fn delete_connection_string(connection_id: &str) -> Result<(), String> {
    Err("This function should not be called directly. Use Tauri commands instead.".to_string())
}

pub fn list_connection_ids() -> Result<Vec<String>, String> {
    // The keyring crate doesn't support listing all entries
    // We'll return an empty vector - the frontend will handle listing via localStorage metadata
    Ok(Vec::new())
}

