use crate::azure::types::ServiceBusConnection;
use azure_identity::DefaultAzureCredential;
use url::Url;

#[derive(Debug, Clone)]
pub struct ParsedConnectionString {
    pub endpoint: String,
    pub shared_access_key_name: String,
    pub shared_access_key: String,
    #[allow(dead_code)]
    pub entity_path: Option<String>,
}

pub fn parse_connection_string(connection_string: &str) -> Result<ParsedConnectionString, String> {
    // Validate input
    let connection_string = connection_string.trim();
    if connection_string.is_empty() {
        return Err("Connection string cannot be empty".to_string());
    }

    let mut endpoint = None;
    let mut shared_access_key_name = None;
    let mut shared_access_key = None;
    let mut entity_path = None;

    for part in connection_string.split(';') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }

        if let Some((key, value)) = part.split_once('=') {
            match key.trim().to_lowercase().as_str() {
                "endpoint" => endpoint = Some(value.trim().to_string()),
                "sharedaccesskeyname" => shared_access_key_name = Some(value.trim().to_string()),
                "sharedaccesskey" => shared_access_key = Some(value.trim().to_string()),
                "entitypath" => entity_path = Some(value.trim().to_string()),
                _ => {} // Ignore unknown keys
            }
        }
    }

    Ok(ParsedConnectionString {
        endpoint: endpoint.ok_or("Missing Endpoint in connection string. Expected format: Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...")?,
        shared_access_key_name: shared_access_key_name
            .ok_or("Missing SharedAccessKeyName in connection string")?,
        shared_access_key: shared_access_key
            .ok_or("Missing SharedAccessKey in connection string")?,
        entity_path,
    })
}

pub fn generate_sas_token(
    resource_uri: &str,
    key_name: &str,
    key: &str,
    expiry_seconds: u64,
) -> Result<String, String> {
    use chrono::{Duration, Utc};
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    let expiry = (Utc::now() + Duration::seconds(expiry_seconds as i64))
        .timestamp()
        .to_string();

    let string_to_sign = format!("{}\n{}", urlencoding::encode(resource_uri), expiry);

    let mut mac = Hmac::<Sha256>::new_from_slice(key.as_bytes())
        .map_err(|e| format!("Failed to create HMAC: {}", e))?;
    mac.update(string_to_sign.as_bytes());
    use base64::Engine;
    let signature = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());

    let token = format!(
        "SharedAccessSignature sr={}&sig={}&se={}&skn={}",
        urlencoding::encode(resource_uri),
        urlencoding::encode(&signature),
        expiry,
        urlencoding::encode(key_name)
    );

    Ok(token)
}

pub fn get_namespace_from_endpoint(endpoint: &str) -> Result<String, String> {
    // Normalize endpoint: handle sb:// scheme, strip trailing slashes, ensure https:// scheme
    let endpoint_normalized = endpoint.trim();
    let endpoint_with_scheme = if endpoint_normalized.starts_with("sb://") {
        // Convert sb:// to https://
        format!("https://{}", &endpoint_normalized[5..].trim_end_matches('/'))
    } else if endpoint_normalized.starts_with("http://") || endpoint_normalized.starts_with("https://") {
        endpoint_normalized.trim_end_matches('/').to_string()
    } else {
        // No scheme, add https://
        format!("https://{}", endpoint_normalized.trim_end_matches('/'))
    };
    
    let url = Url::parse(&endpoint_with_scheme).map_err(|e| format!("Invalid endpoint URL: {}", e))?;
    let host = url
        .host_str()
        .ok_or("Invalid endpoint: missing host")?;
    
    // Extract namespace from hostname, supporting multiple Service Bus endpoint formats:
    // - .servicebus.windows.net (Public cloud)
    // - .servicebus.usgovcloudapi.net (US Government cloud)
    // - .servicebus.chinacloudapi.cn (China cloud)
    // - .servicebus.cloudapi.de (Germany cloud)
    let namespace = if let Some(ns) = host.strip_suffix(".servicebus.windows.net") {
        Ok(ns.to_string())
    } else if let Some(ns) = host.strip_suffix(".servicebus.usgovcloudapi.net") {
        Ok(ns.to_string())
    } else if let Some(ns) = host.strip_suffix(".servicebus.chinacloudapi.cn") {
        Ok(ns.to_string())
    } else if let Some(ns) = host.strip_suffix(".servicebus.cloudapi.de") {
        Ok(ns.to_string())
    } else {
        Err(format!("Invalid Service Bus endpoint: {}. Supported formats: *.servicebus.windows.net, *.servicebus.usgovcloudapi.net, *.servicebus.chinacloudapi.cn, *.servicebus.cloudapi.de", host))
    };
    
    namespace
}

pub fn get_endpoint_domain(endpoint: &str) -> Result<String, String> {
    // Normalize endpoint: handle sb:// scheme, strip trailing slashes, ensure https:// scheme
    let endpoint_normalized = endpoint.trim();
    let endpoint_with_scheme = if endpoint_normalized.starts_with("sb://") {
        // Convert sb:// to https://
        format!("https://{}", &endpoint_normalized[5..].trim_end_matches('/'))
    } else if endpoint_normalized.starts_with("http://") || endpoint_normalized.starts_with("https://") {
        endpoint_normalized.trim_end_matches('/').to_string()
    } else {
        // No scheme, add https://
        format!("https://{}", endpoint_normalized.trim_end_matches('/'))
    };
    
    let url = Url::parse(&endpoint_with_scheme).map_err(|e| format!("Invalid endpoint URL: {}", e))?;
    let host = url
        .host_str()
        .ok_or("Invalid endpoint: missing host")?;
    
    // Extract domain suffix from hostname
    if host.ends_with(".servicebus.windows.net") {
        Ok(".servicebus.windows.net".to_string())
    } else if host.ends_with(".servicebus.usgovcloudapi.net") {
        Ok(".servicebus.usgovcloudapi.net".to_string())
    } else if host.ends_with(".servicebus.chinacloudapi.cn") {
        Ok(".servicebus.chinacloudapi.cn".to_string())
    } else if host.ends_with(".servicebus.cloudapi.de") {
        Ok(".servicebus.cloudapi.de".to_string())
    } else {
        Err(format!("Invalid Service Bus endpoint: {}", host))
    }
}

#[allow(dead_code)]
pub async fn create_credential(
    connection: &ServiceBusConnection,
) -> Result<Box<dyn azure_core::auth::TokenCredential + Send + Sync>, String> {
    if connection.use_azure_ad.unwrap_or(false) {
        if let Some(_namespace) = &connection.namespace {
            if let (Some(_tenant_id), Some(_client_id)) = (&connection.tenant_id, &connection.client_id) {
                // Use client secret credential if tenant/client ID provided
                // Note: In production, you'd want to get client_secret from Keychain or environment
                // For now, we'll use DefaultAzureCredential which tries multiple auth methods
                Ok(Box::new(DefaultAzureCredential::default()))
            } else {
                // Use DefaultAzureCredential for managed identity, Azure CLI, etc.
                Ok(Box::new(DefaultAzureCredential::default()))
            }
        } else {
            Err("Namespace is required for Azure AD authentication".to_string())
        }
    } else {
        Err("Connection string authentication should use SAS tokens, not credentials".to_string())
    }
}

#[allow(dead_code)]
pub fn parse_duration_to_seconds(duration: &str) -> Option<u64> {
    // Parse ISO 8601 duration (e.g., "PT30S" = 30 seconds, "PT1H" = 3600 seconds)
    let re = regex::Regex::new(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?").ok()?;
    let caps = re.captures(duration)?;
    
    let hours: u64 = caps.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
    let minutes: u64 = caps.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
    let seconds: u64 = caps.get(3).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
    
    Some(hours * 3600 + minutes * 60 + seconds)
}

#[allow(dead_code)]
pub fn seconds_to_duration(seconds: u64) -> String {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;
    
    let mut duration = String::from("PT");
    if hours > 0 {
        duration.push_str(&format!("{}H", hours));
    }
    if minutes > 0 {
        duration.push_str(&format!("{}M", minutes));
    }
    if secs > 0 || duration == "PT" {
        duration.push_str(&format!("{}S", secs));
    }
    
    duration
}

