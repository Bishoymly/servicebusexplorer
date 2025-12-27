// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpListener;
use std::path::PathBuf;
use std::process::Command;
use std::thread;
use std::time::Duration;
use tauri::Manager;
use serde::{Deserialize, Serialize};

#[cfg(target_os = "macos")]
mod storekit;

#[derive(Debug, Serialize, Deserialize)]
struct LicenseStatus {
    is_trial: bool,
    is_purchased: bool,
    is_expired: bool,
    days_remaining: i32,
    trial_start_date: Option<i64>,
}

const PRODUCT_ID: &str = "com.bishoylabib.servicebusexplorer.full";

// Find an available port starting from the preferred port
fn find_available_port(start_port: u16) -> u16 {
    for port in start_port..=start_port + 100 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return port;
        }
    }
    // Fallback: let the OS assign a port
    let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind to any port");
    listener.local_addr().unwrap().port()
}

#[cfg(not(debug_assertions))]
fn start_nextjs_server(port: u16) -> Option<std::process::Child> {
    // Get the app's resource directory
    // On macOS: Contents/Resources inside .app bundle
    // On Windows/Linux: resources directory next to executable
    let exe = std::env::current_exe().expect("Failed to get executable path");
    let mut app_dir: PathBuf = exe.parent().expect("Failed to get app directory").to_path_buf();
    
    // On macOS, we might be in Contents/MacOS, so go up to Contents
    #[cfg(target_os = "macos")]
    {
        if app_dir.ends_with("MacOS") {
            app_dir = app_dir.parent().unwrap().to_path_buf();
        }
        // Then to Contents/Resources
        if app_dir.ends_with("Contents") {
            app_dir = app_dir.join("Resources");
        }
    }
    
    let resource_dir = app_dir.join("resources");
    
    // Try to find the standalone server in various locations
    let server_paths = vec![
        resource_dir.join("standalone").join("server.js"),
        app_dir.join("standalone").join("server.js"),
        app_dir.join("resources").join("standalone").join("server.js"),
        PathBuf::from("standalone").join("server.js"),
    ];
    
    for server_path in &server_paths {
        if server_path.exists() {
            let server_dir = server_path.parent().unwrap();
            println!("Starting Next.js server from: {:?} on port {}", server_dir, port);
            if let Ok(child) = Command::new("node")
                .arg(server_path.to_str().unwrap())
                .env("PORT", port.to_string())
                .env("HOSTNAME", "127.0.0.1")
                .current_dir(server_dir)
                .spawn()
            {
                return Some(child);
            }
        }
    }
    
    eprintln!("Warning: Could not find standalone server. Tried paths:");
    for path in &server_paths {
        eprintln!("  {:?} (exists: {})", path, path.exists());
    }
    None
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

fn main() {
    #[cfg(not(debug_assertions))]
    {
        // Find an available port (starting from 1420 - Tauri's default, less common than 3000)
        let port = find_available_port(1420);
        println!("Using port: {}", port);
        
        // Start the server in a separate thread
        let port_clone = port;
        thread::spawn(move || {
            // Wait a bit for Tauri to initialize
            thread::sleep(Duration::from_secs(1));
            
            if let Some(mut child) = start_nextjs_server(port_clone) {
                let _ = child.wait();
            }
        });
        
        // Store port in environment variable so we can access it in Tauri commands if needed
        std::env::set_var("TAURI_PORT", port.to_string());
        
        // Build Tauri app - the window will load from devUrl initially
        // We'll navigate to the correct port after the server starts
        let port_for_setup = port;
        let app = tauri::Builder::default()
            .plugin(tauri_plugin_shell::init())
            .invoke_handler(tauri::generate_handler![
                check_license_status,
                initiate_purchase,
                verify_receipt,
                get_trial_start_date
            ])
            .setup(move |app| {
                // Get a handle that can be used across threads
                let app_handle = app.handle().clone();
                let port = port_for_setup;
                
                // Spawn thread to navigate after server starts
                thread::spawn(move || {
                    thread::sleep(Duration::from_secs(2));
                    
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let url = format!("http://127.0.0.1:{}", port);
                        println!("Navigating to: {}", url);
                        // Use eval to navigate to the new URL
                        if let Err(e) = window.eval(&format!("window.location.href = '{}';", url)) {
                            eprintln!("Failed to navigate to {}: {:?}", url, e);
                        }
                    }
                });
                Ok(())
            });
        
        app.run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
    
    #[cfg(debug_assertions)]
    {
        tauri::Builder::default()
            .plugin(tauri_plugin_shell::init())
            .invoke_handler(tauri::generate_handler![
                check_license_status,
                initiate_purchase,
                verify_receipt,
                get_trial_start_date
            ])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
}

