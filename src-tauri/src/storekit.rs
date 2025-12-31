// StoreKit integration for macOS App Store purchases
// Uses receipt validation and App Store APIs

#[cfg(target_os = "macos")]
mod macos {
    use std::path::PathBuf;

    const PRODUCT_ID: &str = "com.bishoylabib.servicebusexplorer.full";

    /// Read the App Store receipt from the app bundle
    pub fn read_receipt() -> Result<Option<Vec<u8>>, String> {
        let exe = std::env::current_exe()
            .map_err(|e| format!("Failed to get executable path: {}", e))?;
        
        let mut app_dir: PathBuf = exe.parent()
            .ok_or("Failed to get app directory")?
            .to_path_buf();
        
        // Navigate to app bundle root
        if app_dir.ends_with("MacOS") {
            app_dir = app_dir.parent().ok_or("Failed to get Contents directory")?.to_path_buf();
        }
        
        let receipt_path = app_dir.join("_MASReceipt").join("receipt");
        
        if receipt_path.exists() {
            std::fs::read(&receipt_path)
                .map_err(|e| format!("Failed to read receipt: {}", e))
                .map(Some)
        } else {
            Ok(None)
        }
    }

    /// Verify receipt with Apple's servers
    pub fn verify_receipt_with_apple(receipt_data: &[u8]) -> Result<bool, String> {
        use base64::Engine;
        use base64::engine::general_purpose;
        
        // Base64 encode the receipt data
        let receipt_base64 = general_purpose::STANDARD.encode(receipt_data);
        
        // Determine which endpoint to use
        // In development/debug builds, try sandbox first, then production
        // In release builds, try production first, then sandbox
        let endpoints = if cfg!(debug_assertions) {
            vec![
                "https://sandbox.itunes.apple.com/verifyReceipt",
                "https://buy.itunes.apple.com/verifyReceipt",
            ]
        } else {
            vec![
                "https://buy.itunes.apple.com/verifyReceipt",
                "https://sandbox.itunes.apple.com/verifyReceipt",
            ]
        };
        
        // Prepare request body
        let request_body = serde_json::json!({
            "receipt-data": receipt_base64,
            "password": "", // Shared secret (if configured in App Store Connect)
            "exclude-old-transactions": false
        });
        
        // Try each endpoint
        for endpoint in endpoints {
            match verify_with_endpoint(endpoint, &request_body) {
                Ok(true) => return Ok(true),
                Ok(false) => continue, // Try next endpoint
                Err(e) => {
                    eprintln!("Error verifying with {}: {}", endpoint, e);
                    continue;
                }
            }
        }
        
        Ok(false)
    }
    
    fn verify_with_endpoint(endpoint: &str, body: &serde_json::Value) -> Result<bool, String> {
        // Use tokio runtime for async reqwest calls
        let rt = tokio::runtime::Runtime::new().map_err(|e| format!("Failed to create runtime: {}", e))?;
        rt.block_on(async {
            let client = reqwest::Client::new();
            let response = client
                .post(endpoint)
                .json(body)
                .send()
                .await
                .map_err(|e| format!("Request failed: {}", e))?;
            
            let status: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;
        
            // Check response status
            let status_code = status["status"]
                .as_i64()
                .ok_or("Invalid status code in response")?;
            
            // Status codes:
            // 0 = valid
            // 21007 = receipt is from sandbox, should use sandbox endpoint
            // 21008 = receipt is from production, should use production endpoint
            // Other codes = invalid
            
            match status_code {
                0 => {
                    // Valid receipt - check for our product
                    if let Some(receipt) = status.get("receipt") {
                        if let Some(in_app) = receipt.get("in_app") {
                            if let Some(transactions) = in_app.as_array() {
                                for transaction in transactions {
                                    if let Some(product_id) = transaction.get("product_id") {
                                        if product_id.as_str() == Some(PRODUCT_ID) {
                                            return Ok(true);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    // Receipt valid but product not found
                    Ok(false)
                }
                21007 => {
                    // Receipt is from sandbox - caller should retry with sandbox endpoint
                    Ok(false)
                }
                21008 => {
                    // Receipt is from production - caller should retry with production endpoint
                    Ok(false)
                }
                _ => {
                    Err(format!("Receipt verification failed with status: {}", status_code))
                }
            }
        })
    }

    /// Check if the app was purchased via App Store
    pub fn check_purchase_status() -> Result<bool, String> {
        // Try to read receipt
        match read_receipt() {
            Ok(Some(receipt_data)) => {
                // Verify receipt (simplified - in production, verify with Apple's servers)
                verify_receipt_with_apple(&receipt_data)
            }
            Ok(None) => {
                // No receipt found - could be development build or not purchased
                Ok(false)
            }
            Err(e) => {
                eprintln!("Error reading receipt: {}", e);
                Ok(false)
            }
        }
    }

    /// Initiate in-app purchase using StoreKit
    pub fn initiate_purchase() -> Result<(), String> {
        // StoreKit 2 requires macOS 12.0+
        // For broader compatibility, we'll open the App Store page
        // Full StoreKit 2 implementation would require Swift/Objective-C bridge
        
        let app_store_url = format!("macappstore://apps.apple.com/app/id6756694985");
        
        use std::process::Command;
        Command::new("open")
            .arg(app_store_url)
            .output()
            .map_err(|e| format!("Failed to open App Store: {}", e))?;
        
        Ok(())
    }

    /// Check for valid purchase transaction using StoreKit 2
    /// This requires macOS 12.0+ and StoreKit 2
    /// 
    /// Note: This is a placeholder for future StoreKit 2 implementation.
    /// Currently falls back to receipt checking.
    /// See STOREKIT_IMPLEMENTATION.md for details.
    #[allow(dead_code)]
    pub fn check_storekit2_transaction() -> Result<bool, String> {
        // StoreKit 2 implementation would go here
        // This requires Swift/Objective-C interop or a native bridge
        // For now, fall back to receipt checking
        check_purchase_status()
    }
}

#[cfg(target_os = "macos")]
pub use macos::*;

#[cfg(not(target_os = "macos"))]
pub mod non_macos {
    pub fn check_purchase_status() -> Result<bool, String> {
        Ok(true) // Non-macOS: no restrictions
    }
    
    pub fn initiate_purchase() -> Result<(), String> {
        Err("Purchases are only available on macOS".to_string())
    }
    
    pub fn verify_receipt_with_apple(_receipt_data: &[u8]) -> Result<bool, String> {
        Ok(true)
    }
    
    pub fn read_receipt() -> Result<Option<Vec<u8>>, String> {
        Ok(None) // Non-macOS: no receipts
    }
}

#[cfg(not(target_os = "macos"))]
pub use non_macos::*;

