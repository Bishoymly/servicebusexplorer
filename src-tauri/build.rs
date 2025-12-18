fn main() {
    // Copy Next.js standalone output to a location Tauri can bundle
    #[cfg(not(debug_assertions))]
    {
        use std::fs;
        use std::path::Path;
        
        let standalone_dir = Path::new("../.next/standalone");
        let target_resources = Path::new("target/resources/standalone");
        
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
                }
            }
        } else {
            eprintln!("Warning: Next.js standalone output not found at {:?}", standalone_dir);
            eprintln!("Make sure 'npm run build' completed successfully before building Tauri app.");
        }
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
        
        if path.is_dir() {
            copy_dir_all(&path, &dst_path)?;
        } else {
            fs::copy(&path, &dst_path)?;
        }
    }
    Ok(())
}

