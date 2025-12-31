fn main() {
    // Copy Next.js standalone output to a location Tauri can bundle
    // Only do this in release builds when the standalone directory exists
    #[cfg(not(debug_assertions))]
    {
        use std::fs;
        use std::path::Path;
        
        let standalone_dir = Path::new("../.next/standalone");
        let target_resources = Path::new("target/resources/standalone");
        
        println!("Checking for standalone directory at: {:?}", standalone_dir);
        println!("Standalone exists: {}", standalone_dir.exists());
        
        // Also check if .next exists
        let next_dir = Path::new("../.next");
        println!("Checking for .next directory at: {:?}", next_dir);
        println!(".next exists: {}", next_dir.exists());
        if next_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(next_dir) {
                println!("Contents of .next:");
                for entry in entries.flatten() {
                    println!("  - {:?}", entry.path());
                }
            }
        }
        
        if standalone_dir.exists() {
            // Create target directory
            if let Err(e) = fs::create_dir_all(&target_resources.parent().unwrap()) {
                eprintln!("Warning: Failed to create resources directory: {}", e);
            } else {
                // Copy standalone directory
                if target_resources.exists() {
                    let _ = fs::remove_dir_all(&target_resources);
                }
                if let Err(e) = copy_dir_all(standalone_dir, &target_resources) {
                    eprintln!("Warning: Failed to copy standalone directory: {}", e);
                } else {
                    println!("Successfully copied standalone directory to resources");
                    
                    // Next.js standalone needs .next/static and .next/server directories
                    // According to Next.js docs, standalone doesn't copy .next/static automatically
                    // These need to be copied into standalone/.next/ so server.js can find them
                    let next_static = Path::new("../.next/static");
                    let next_server = Path::new("../.next/server");
                    let standalone_next = target_resources.join(".next");
                    
                    // Ensure .next directory exists in standalone (it should from the copy)
                    if let Err(e) = fs::create_dir_all(&standalone_next) {
                        eprintln!("Warning: Failed to create .next directory: {}", e);
                    }
                    
                    // Copy static directory (CRITICAL - Next.js doesn't copy this automatically)
                    if next_static.exists() {
                        let standalone_static = standalone_next.join("static");
                        // Remove existing static if it exists (might be a symlink or empty)
                        if standalone_static.exists() {
                            let _ = fs::remove_dir_all(&standalone_static);
                        }
                        if let Err(e) = copy_dir_all(next_static, &standalone_static) {
                            eprintln!("Warning: Failed to copy static directory: {}", e);
                        } else {
                            println!("Successfully copied static files to standalone/.next/static");
                        }
                    } else {
                        eprintln!("Warning: .next/static directory not found at {:?}", next_static);
                    }
                    
                    // Copy server directory (needed for SSR) - check if it already exists
                    if next_server.exists() {
                        let standalone_server = standalone_next.join("server");
                        // Only copy if it doesn't exist or is different
                        if !standalone_server.exists() {
                            if let Err(e) = copy_dir_all(next_server, &standalone_server) {
                                eprintln!("Warning: Failed to copy server directory: {}", e);
                            } else {
                                println!("Successfully copied server files to standalone/.next/server");
                            }
                        } else {
                            println!("Server directory already exists in standalone, skipping copy");
                        }
                    } else {
                        eprintln!("Warning: .next/server directory not found at {:?}", next_server);
                    }
                    
                    // Also copy public folder if it exists (for static assets)
                    let public_dir = Path::new("../public");
                    if public_dir.exists() {
                        let standalone_public = target_resources.join("public");
                        if let Err(e) = copy_dir_all(public_dir, &standalone_public) {
                            eprintln!("Warning: Failed to copy public directory: {}", e);
                        } else {
                            println!("Successfully copied public files to standalone/public");
                        }
                    }
                    
                    // Copy bundled Node.js binary to standalone directory
                    let nodejs_dir = Path::new("target/resources/nodejs");
                    let node_binary = nodejs_dir.join("node");
                    if node_binary.exists() {
                        let standalone_node = target_resources.join("node");
                        match fs::copy(&node_binary, &standalone_node) {
                            Ok(_) => {
                                // Make it executable on Unix systems
                                #[cfg(unix)]
                                {
                                    if let Ok(mut perms) = fs::metadata(&standalone_node).map(|m| m.permissions()) {
                                        use std::os::unix::fs::PermissionsExt;
                                        perms.set_mode(0o755);
                                        let _ = fs::set_permissions(&standalone_node, perms);
                                    }
                                }
                                println!("✅ Successfully copied Node.js binary to standalone/node");
                            }
                            Err(e) => {
                                eprintln!("⚠️  Warning: Failed to copy Node.js binary: {}", e);
                            }
                        }
                    } else {
                        eprintln!("⚠️  Warning: Node.js binary not found at {:?}", node_binary);
                        eprintln!("   This is required for TestFlight builds.");
                        eprintln!("   Run: npm run bundle:nodejs to bundle Node.js");
                        eprintln!("   The app may not work in TestFlight without bundled Node.js.");
                    }
                }
            }
        }
        // Don't error if standalone doesn't exist - it's expected in dev builds
    }
    
    tauri_build::build()
}

#[cfg(not(debug_assertions))]
fn copy_dir_all(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    use std::fs;
    
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        // Check if it's a symlink - if so, follow it and copy the actual directory/file
        let metadata = fs::metadata(&path)?;
        if metadata.file_type().is_symlink() {
            // For symlinks, read the link and copy the target
            if let Ok(target) = fs::read_link(&path) {
                let resolved_path = if target.is_absolute() {
                    target
                } else {
                    path.parent().unwrap().join(target)
                };
                if resolved_path.exists() {
                    if resolved_path.is_dir() {
                        copy_dir_all(&resolved_path, &dst_path)?;
                    } else {
                        fs::copy(&resolved_path, &dst_path)?;
                    }
                }
            }
        } else if path.is_dir() {
            copy_dir_all(&path, &dst_path)?;
        } else {
            fs::copy(&path, &dst_path)?;
        }
    }
    Ok(())
}

