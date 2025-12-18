// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::Duration;
use tauri::Manager;

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
            .setup(move |app| {
                // Wait for server to start, then navigate to the correct URL
                let port = port_for_setup;
                thread::spawn(move || {
                    thread::sleep(Duration::from_secs(2));
                    
                    if let Some(window) = app.get_webview_window("main") {
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
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
}

