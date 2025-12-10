// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use std::thread;
use std::time::Duration;

#[cfg(not(debug_assertions))]
fn start_nextjs_server() {
    thread::spawn(move || {
        // Wait a bit for Tauri to initialize
        thread::sleep(Duration::from_secs(1));
        
        // Try to start Next.js server
        // In production, the server should be bundled with the app
        if let Ok(mut child) = Command::new("node")
            .arg("node_modules/.bin/next")
            .arg("start")
            .env("PORT", "3000")
            .spawn()
        {
            let _ = child.wait();
        }
    });
}

fn main() {
    #[cfg(not(debug_assertions))]
    start_nextjs_server();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

