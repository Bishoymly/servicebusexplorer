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
    // Tauri bundles target/resources/standalone/**/* to Resources/target/resources/standalone/
    let server_paths = vec![
        app_dir.join("target").join("resources").join("standalone").join("server.js"), // Tauri bundle path
        resource_dir.join("standalone").join("server.js"), // Alternative path
        app_dir.join("standalone").join("server.js"),
        PathBuf::from("standalone").join("server.js"),
    ];
    
    for server_path in &server_paths {
        if server_path.exists() {
            let server_dir = server_path.parent().unwrap();
            println!("Found server at: {:?}", server_path);
            
            // Try to find node executable - bundled Node.js takes priority
            // Check MacOS/ first (where Xcode signs it with provisioning profile)
            let node_paths = vec![
                app_dir.join("MacOS").join("node"), // Xcode-signed version (has provisioning profile)
                server_dir.join("node"), // Bundled Node.js (in standalone directory)
                app_dir.join("node"), // Alternative location
                app_dir.join("Resources").join("node"), // In Resources directory
                PathBuf::from("/usr/bin/node"), // System node (may not work in sandbox)
                PathBuf::from("node"), // Try PATH (last resort)
            ];
            
            let mut node_cmd = None;
            for node_path in &node_paths {
                if node_path.exists() {
                    node_cmd = Some(node_path.clone());
                    println!("✅ Found Node.js at: {:?}", node_path);
                    break;
                }
            }
            
            // If no node found, try system node (will likely fail in sandbox)
            let node_exec = node_cmd.unwrap_or_else(|| {
                eprintln!("⚠️  Warning: No bundled Node.js found, trying system node (may fail in TestFlight)");
                PathBuf::from("node")
            });
            
            println!("Starting Next.js server from: {:?} on port {}", server_dir, port);
            match Command::new(&node_exec)
                .arg(server_path.to_str().unwrap())
                .env("PORT", port.to_string())
                .env("HOSTNAME", "127.0.0.1")
                .current_dir(server_dir)
                .spawn()
            {
                Ok(child) => {
                    println!("Server process started successfully (PID: {})", child.id());
                    return Some(child);
                }
                Err(e) => {
                    eprintln!("Failed to start server with {:?}: {:?}", node_exec, e);
                    // Continue to next path
                }
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
        
        // Start the server first and wait for it to be ready
        let port_clone = port;
        let _server_handle = thread::spawn(move || {
            // Wait a bit for Tauri to initialize
            thread::sleep(Duration::from_secs(1));
            
            if let Some(mut child) = start_nextjs_server(port_clone) {
                println!("Server process started (PID: {})", child.id());
                // Wait a bit for server to start
                thread::sleep(Duration::from_secs(2)); // Increased wait time for TestFlight
                
                // Check if server process is still running
                if let Ok(Some(status)) = child.try_wait() {
                    eprintln!("Server process exited early with status: {:?}", status);
                    return;
                }
                
                // Check if server is ready by trying to connect
                let mut ready = false;
                for attempt in 0..30 { // Increased attempts for TestFlight
                    // Check if process is still alive
                    if let Ok(Some(status)) = child.try_wait() {
                        eprintln!("Server process died during startup (attempt {}): {:?}", attempt, status);
                        break;
                    }
                    
                    if let Ok(stream) = std::net::TcpStream::connect(format!("127.0.0.1:{}", port_clone)) {
                        ready = true;
                        let _ = stream.shutdown(std::net::Shutdown::Both);
                        println!("Server is ready on port {} after {} attempts", port_clone, attempt + 1);
                        break;
                    }
                    thread::sleep(Duration::from_millis(500)); // Increased interval
                }
                
                if !ready {
                    eprintln!("Server never became ready on port {}", port_clone);
                    // Check final process status
                    if let Ok(Some(status)) = child.try_wait() {
                        eprintln!("Server process final status: {:?}", status);
                    } else {
                        eprintln!("Server process is still running but not responding");
                    }
                }
                
                // Keep process alive - don't wait() here as it blocks
                // The process will be cleaned up when the app exits
            } else {
                eprintln!("Failed to start Next.js server - check logs above for details");
            }
        });
        
        // Store port in environment variable so we can access it in Tauri commands if needed
        std::env::set_var("TAURI_PORT", port.to_string());
        
        // Build Tauri app with a loading screen initially
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
                
                // Show loading screen immediately using eval to inject HTML
                if let Some(window) = app_handle.get_webview_window("main") {
                    // Inject loading screen HTML directly
                    let script = r#"
                        document.open();
                        document.write(`
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="utf-8">
                                <title>Azure Service Bus Explorer</title>
                                <style>
                                    body {
                                        margin: 0;
                                        padding: 0;
                                        display: flex;
                                        justify-content: center;
                                        align-items: center;
                                        height: 100vh;
                                        background: linear-gradient(135deg, #ffffff 0%, #f8f8f8 100%);
                                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                    }
                                    .loader {
                                        text-align: center;
                                        color: #1a1a1a;
                                    }
                                    .spinner {
                                        border: 3px solid rgba(102, 126, 234, 0.2);
                                        border-top: 3px solid #667eea;
                                        border-radius: 50%;
                                        width: 40px;
                                        height: 40px;
                                        animation: spin 1s linear infinite;
                                        margin: 24px auto 0;
                                    }
                                    @keyframes spin {
                                        0% { transform: rotate(0deg); }
                                        100% { transform: rotate(360deg); }
                                    }
                                    h1 {
                                        margin: 0;
                                        font-size: 28px;
                                        font-weight: 600;
                                        color: #1a1a1a;
                                    }
                                    p {
                                        margin: 8px 0 0 0;
                                        opacity: 0.6;
                                        font-size: 15px;
                                        color: #666;
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="loader">
                                    <h1>Azure Service Bus Explorer</h1>
                                    <p>Starting application...</p>
                                    <div class="spinner"></div>
                                </div>
                            </body>
                            </html>
                        `);
                        document.close();
                    "#;
                    if let Err(e) = window.eval(script) {
                        eprintln!("Failed to load loading screen: {:?}", e);
                    }
                }
                
                // Spawn thread to wait for server and navigate
                thread::spawn(move || {
                    // Wait longer for server to be ready (TestFlight may be slower)
                    let mut server_ready = false;
                    let max_attempts = 60; // 12 seconds total (60 * 200ms)
                    
                    for attempt in 0..max_attempts {
                        if let Ok(stream) = std::net::TcpStream::connect(format!("127.0.0.1:{}", port)) {
                            server_ready = true;
                            let _ = stream.shutdown(std::net::Shutdown::Both);
                            println!("Server ready after {} attempts", attempt + 1);
                            break;
                        }
                        thread::sleep(Duration::from_millis(200));
                    }
                    
                    if server_ready {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let url = format!("http://127.0.0.1:{}", port);
                            println!("Server ready, navigating to: {}", url);
                            // Use eval to navigate to the new URL
                            if let Err(e) = window.eval(&format!("window.location.href = '{}';", url)) {
                                eprintln!("Failed to navigate to {}: {:?}", url, e);
                                // Show error message if navigation fails
                                let error_script = r#"
                                    document.body.innerHTML = `
                                        <div style="text-align: center; padding: 40px; color: #d32f2f;">
                                            <h1>Navigation Error</h1>
                                            <p>Failed to navigate to application.</p>
                                            <p style="font-size: 12px; opacity: 0.7;">Please restart the application.</p>
                                        </div>
                                    `;
                                "#;
                                let _ = window.eval(error_script);
                            }
                        }
                    } else {
                        eprintln!("Error: Server did not become ready after {} attempts", max_attempts);
                        // Show error message on loading screen
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let error_script = r#"
                                document.body.innerHTML = `
                                    <div style="text-align: center; padding: 40px; color: #d32f2f;">
                                        <h1>Failed to Start Server</h1>
                                        <p>The application server could not be started.</p>
                                        <p style="font-size: 12px; opacity: 0.7;">Please restart the application or contact support.</p>
                                    </div>
                                `;
                            "#;
                            if let Err(e) = window.eval(error_script) {
                                eprintln!("Failed to show error message: {:?}", e);
                            }
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

