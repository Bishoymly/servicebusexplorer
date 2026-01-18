use crate::azure::auth::{
    generate_sas_token, get_namespace_from_endpoint, get_endpoint_domain, parse_connection_string,
    ParsedConnectionString,
};
use crate::azure::types::*;
use reqwest::Client;
use serde::Deserialize;
use serde_xml_rs::from_str;
use std::time::Duration;

const API_VERSION: &str = "2021-05";

pub struct ServiceBusClient {
    client: Client,
    namespace: String,
    endpoint_domain: String,
    parsed_connection: Option<ParsedConnectionString>,
    use_azure_ad: bool,
}

#[allow(dead_code)] // Methods are used by main app, not all by test binary
impl ServiceBusClient {
    pub async fn create(connection: &ServiceBusConnection) -> Result<Self, String> {
        let client = Client::builder()
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let (namespace, endpoint_domain) = if connection.use_azure_ad.unwrap_or(false) {
            let ns = connection
                .namespace
                .as_ref()
                .ok_or("Namespace is required for Azure AD authentication")?
                .clone();
            // For Azure AD, default to public cloud domain
            // In production, you might want to allow specifying the cloud environment
            (ns, ".servicebus.windows.net".to_string())
        } else {
            let conn_str = connection
                .connection_string
                .as_ref()
                .ok_or("Connection string is required")?;
            let parsed = parse_connection_string(conn_str)?;
            let ns = get_namespace_from_endpoint(&parsed.endpoint)?;
            let domain = get_endpoint_domain(&parsed.endpoint)?;
            (ns, domain)
        };

        let parsed_connection = if connection.use_azure_ad.unwrap_or(false) {
            None
        } else {
            let conn_str = connection
                .connection_string
                .as_ref()
                .ok_or("Connection string is required")?;
            Some(parse_connection_string(conn_str)?)
        };

        Ok(ServiceBusClient {
            client,
            namespace,
            endpoint_domain,
            parsed_connection,
            use_azure_ad: connection.use_azure_ad.unwrap_or(false),
        })
    }

    async fn get_auth_header(&self, resource_uri: &str) -> Result<String, String> {
        if self.use_azure_ad {
            // For Azure AD, we'd use the credential to get a token
            // For now, we'll use SAS token approach which works for both
            // In production, you'd want to use the credential here
            Err("Azure AD authentication via REST API requires OAuth token - not yet implemented".to_string())
        } else {
            let parsed = self
                .parsed_connection
                .as_ref()
                .ok_or("Connection string not available")?;
            // Generate SAS token valid for 1 hour
            generate_sas_token(resource_uri, &parsed.shared_access_key_name, &parsed.shared_access_key, 3600)
        }
    }

    fn get_base_url(&self) -> String {
        format!("https://{}{}", self.namespace, self.endpoint_domain)
    }

    // ============================================================================
    // Management Operations (REST API)
    // ============================================================================
    // These operations use REST API because azservicebus SDK does not support
    // management operations (CRUD for queues, topics, subscriptions).
    // ============================================================================

    // Queue operations
    pub async fn list_queues(&self) -> Result<Vec<QueueProperties>, String> {
        let mut all_queues = Vec::new();
        let mut url = format!("{}/$Resources/Queues?api-version={}", self.get_base_url(), API_VERSION);
        let mut page_count = 0;
        
        loop {
            page_count += 1;
            eprintln!("[list_queues] Fetching page {} from: {}", page_count, url);
            
            let auth_header = self.get_auth_header(&url).await?;

            let response = self
                .client
                .get(&url)
                .header("Authorization", &auth_header)
                .send()
                .await
                .map_err(|e| format!("Failed to list queues: {}", e))?;

            let status = response.status();
            if !status.is_success() {
                let error_text = response.text().await.unwrap_or_default();
                return Err(format!("Failed to list queues: {} - {}", status, error_text));
            }

            let xml = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
            
            // Extract next link manually from XML since serde_xml_rs doesn't parse attributes correctly
            let next_link_href = if let Some(cap) = regex::Regex::new(r#"<link\s+rel="next"\s+href="([^"]+)""#)
                .ok()
                .and_then(|re| re.captures(&xml))
            {
                Some(cap[1].replace("&amp;", "&"))
            } else {
                None
            };
            
            if page_count == 1 {
                eprintln!("[list_queues] Extracted next link: {:?}", next_link_href);
            }
            
            let feed: QueueFeed = from_str(&xml).map_err(|e| format!("Failed to parse XML: {}", e))?;

            eprintln!("[list_queues] Page {}: Found {} entries", page_count, feed.entries.len());

            // If we got 0 entries, we're done
            if feed.entries.is_empty() {
                eprintln!("[list_queues] No entries returned, pagination complete");
                break;
            }

            // Extract content for each entry using regex (since serde_xml_rs can't handle nested XML in content)
            // Match each entry's content separately
            let content_regex = regex::Regex::new(r#"(?s)<entry[^>]*>.*?<title[^>]*>([^<]+)</title>.*?<content[^>]*type="application/xml"[^>]*>(.*?)</content>"#).ok();
            
            for entry in feed.entries {
                let mut entry_with_content = entry.clone();
                
                // Try to find content for this entry by matching title
                if let Some(ref re) = content_regex {
                    if let Some(cap) = re.captures_iter(&xml).find(|cap| {
                        cap.get(1).map(|m| m.as_str().trim()) == Some(entry.title.trim())
                    }) {
                        if let Some(content_match) = cap.get(2) {
                            entry_with_content.content = Some(content_match.as_str().to_string());
                        }
                    }
                }
                
                let props = self.queue_entry_to_properties(&entry_with_content)?;
                all_queues.push(props);
            }

            eprintln!("[list_queues] Total queues so far: {}", all_queues.len());

            // Use the manually extracted next link
            if let Some(href) = next_link_href {
                // Normalize the href URL
                let next_url = if let Some(href) = href.strip_prefix("http") {
                    format!("http{}", href)
                } else {
                    href.clone()
                };
                
                // Decode URLs for comparison (normalize %24 to $, etc.)
                let normalized_current = url.replace("%24", "$");
                let normalized_next = next_url.replace("%24", "$");
                
                // Check if the next URL is the same as current URL to prevent infinite loop
                if normalized_next == normalized_current {
                    eprintln!("[list_queues] Next link is same as current URL, pagination complete");
                    break;
                }
                
                eprintln!("[list_queues] Following next link: {}", next_url);
                url = next_url;
                continue;
            } else {
                eprintln!("[list_queues] No next link found, pagination complete");
            }
            
            // No more pages
            break;
        }

        eprintln!("[list_queues] Final total: {} queues", all_queues.len());
        Ok(all_queues)
    }

    pub async fn list_queues_page(&self, skip: Option<u32>, top: Option<u32>) -> Result<Vec<QueueProperties>, String> {
        // Build URL with pagination parameters
        let mut url = format!("{}/$Resources/Queues?api-version={}", self.get_base_url(), API_VERSION);
        if let Some(skip_val) = skip {
            url = format!("{}&$skip={}", url, skip_val);
        }
        if let Some(top_val) = top {
            url = format!("{}&$top={}", url, top_val);
        }
        
        eprintln!("[list_queues_page] Fetching page (skip={:?}, top={:?}) from: {}", skip, top, url);
        
        let auth_header = self.get_auth_header(&url).await?;

        let response = self
            .client
            .get(&url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .map_err(|e| format!("Failed to list queues: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to list queues: {} - {}", status, error_text));
        }

        let xml = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
        
        let feed: QueueFeed = from_str(&xml).map_err(|e| format!("Failed to parse XML: {}", e))?;

        eprintln!("[list_queues_page] Found {} entries", feed.entries.len());

        let mut queues = Vec::new();
        
        // Extract content for each entry using regex
        let content_regex = regex::Regex::new(r#"(?s)<entry[^>]*>.*?<title[^>]*>([^<]+)</title>.*?<content[^>]*type="application/xml"[^>]*>(.*?)</content>"#).ok();
        
        for entry in feed.entries {
            let mut entry_with_content = entry.clone();
            
            // Try to find content for this entry by matching title
            if let Some(ref re) = content_regex {
                if let Some(cap) = re.captures_iter(&xml).find(|cap| {
                    cap.get(1).map(|m| m.as_str().trim()) == Some(entry.title.trim())
                }) {
                    if let Some(content_match) = cap.get(2) {
                        entry_with_content.content = Some(content_match.as_str().to_string());
                    }
                }
            }
            
            let props = self.queue_entry_to_properties(&entry_with_content)?;
            queues.push(props);
        }

        eprintln!("[list_queues_page] Returning {} queues", queues.len());
        Ok(queues)
    }

    pub async fn get_queue(&self, queue_name: &str) -> Result<QueueProperties, String> {
        let url = format!("{}/{}?api-version={}", self.get_base_url(), queue_name, API_VERSION);
        let auth_header = self.get_auth_header(&url).await?;

        let response = self
            .client
            .get(&url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .map_err(|e| format!("Failed to get queue: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to get queue: {} - {}", status, error_text));
        }

        let xml = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
        let mut entry: QueueEntry = from_str(&xml).map_err(|e| format!("Failed to parse XML: {}", e))?;
        
        // Extract content XML using regex (same approach as list_queues)
        let content_regex = regex::Regex::new(r#"(?s)<entry[^>]*>.*?<title[^>]*>([^<]+)</title>.*?<content[^>]*type="application/xml"[^>]*>(.*?)</content>"#).ok();
        if let Some(ref re) = content_regex {
            if let Some(cap) = re.captures(&xml) {
                if let Some(content_match) = cap.get(2) {
                    entry.content = Some(content_match.as_str().to_string());
                }
            }
        }

        self.queue_entry_to_properties(&entry)
    }

    pub async fn create_queue(&self, queue_name: &str, properties: Option<&QueueProperties>) -> Result<(), String> {
        let url = format!("{}/{}?api-version={}", self.get_base_url(), queue_name, API_VERSION);
        let auth_header = self.get_auth_header(&url).await?;

        let xml = self.queue_properties_to_xml(queue_name, properties, false)?;

        let response = self
            .client
            .put(&url)
            .header("Authorization", &auth_header)
            .header("Content-Type", "application/atom+xml;type=entry;charset=utf-8")
            .body(xml)
            .send()
            .await
            .map_err(|e| format!("Failed to create queue: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to create queue: {} - {}", status, error_text));
        }

        Ok(())
    }

    pub async fn update_queue(&self, queue_name: &str, properties: &QueueProperties) -> Result<(), String> {
        // Get existing queue first
        let existing = self.get_queue(queue_name).await?;
        
        // Merge properties: use new value if provided, otherwise use existing value
        // For updates, we must include ALL updatable properties, using existing values for ones not being changed
        let merged = QueueProperties {
            name: properties.name.clone(),
            // Use new value if provided, otherwise keep existing value
            max_size_in_megabytes: properties.max_size_in_megabytes.or(existing.max_size_in_megabytes),
            lock_duration_in_seconds: properties.lock_duration_in_seconds.or(existing.lock_duration_in_seconds),
            max_delivery_count: properties.max_delivery_count.or(existing.max_delivery_count),
            default_message_time_to_live_in_seconds: properties.default_message_time_to_live_in_seconds.or(existing.default_message_time_to_live_in_seconds),
            dead_lettering_on_message_expiration: properties.dead_lettering_on_message_expiration.or(existing.dead_lettering_on_message_expiration),
            duplicate_detection_history_time_window_in_seconds: properties.duplicate_detection_history_time_window_in_seconds.or(existing.duplicate_detection_history_time_window_in_seconds),
            enable_batched_operations: properties.enable_batched_operations.or(existing.enable_batched_operations),
            // Immutable properties - always use existing values (cannot be changed)
            enable_partitioning: existing.enable_partitioning, // Always use existing - immutable
            requires_session: existing.requires_session, // Always use existing - immutable
            requires_duplicate_detection: existing.requires_duplicate_detection, // Always use existing - immutable
            message_count: existing.message_count,
            active_message_count: existing.active_message_count,
            dead_letter_message_count: existing.dead_letter_message_count,
            scheduled_message_count: existing.scheduled_message_count,
            transfer_message_count: existing.transfer_message_count,
            transfer_dead_letter_message_count: existing.transfer_dead_letter_message_count,
            size_in_bytes: existing.size_in_bytes,
        };

        // For updates, we need to use create_queue but mark it as an update to exclude immutable properties
        let url = format!("{}/{}?api-version={}", self.get_base_url(), queue_name, API_VERSION);
        let auth_header = self.get_auth_header(&url).await?;

        // Generate XML for update (excluding immutable properties)
        let xml = self.queue_properties_to_xml(queue_name, Some(&merged), true)?;
        
        // Log the XML for debugging (remove in production)
        eprintln!("[update_queue] XML being sent:\n{}", xml);
        eprintln!("[update_queue] Merged properties - max_size: {:?}, lock_duration: {:?}, max_delivery: {:?}, ttl: {:?}, dead_letter: {:?}, dup_window: {:?}, batched: {:?}", 
            merged.max_size_in_megabytes, merged.lock_duration_in_seconds, merged.max_delivery_count,
            merged.default_message_time_to_live_in_seconds, merged.dead_lettering_on_message_expiration,
            merged.duplicate_detection_history_time_window_in_seconds, merged.enable_batched_operations);

        let response = self
            .client
            .put(&url)
            .header("Authorization", &auth_header)
            .header("Content-Type", "application/atom+xml;type=entry;charset=utf-8")
            .body(xml)
            .send()
            .await
            .map_err(|e| format!("Failed to update queue: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to update queue: {} - {}", status, error_text));
        }

        Ok(())
    }

    pub async fn delete_queue(&self, queue_name: &str) -> Result<(), String> {
        let url = format!("{}/{}?api-version={}", self.get_base_url(), queue_name, API_VERSION);
        let auth_header = self.get_auth_header(&url).await?;

        let response = self
            .client
            .delete(&url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .map_err(|e| format!("Failed to delete queue: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to delete queue: {} - {}", status, error_text));
        }

        Ok(())
    }

    // Topic operations
    pub async fn list_topics(&self) -> Result<Vec<TopicProperties>, String> {
        let mut all_topics = Vec::new();
        let mut url = format!("{}/$Resources/Topics?api-version={}", self.get_base_url(), API_VERSION);
        
        loop {
            let auth_header = self.get_auth_header(&url).await?;

            let response = self
                .client
                .get(&url)
                .header("Authorization", &auth_header)
                .send()
                .await
                .map_err(|e| format!("Failed to list topics: {}", e))?;

            let status = response.status();
            if !status.is_success() {
                let error_text = response.text().await.unwrap_or_default();
                return Err(format!("Failed to list topics: {} - {}", status, error_text));
            }

            let xml = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
            let feed: TopicFeed = from_str(&xml).map_err(|e| format!("Failed to parse XML: {}", e))?;

            for entry in feed.entries {
                let props = self.topic_entry_to_properties(&entry)?;
                all_topics.push(props);
            }

            // Check for next page link
            let next_link = feed.links.iter().find(|link| {
                link.rel.as_ref().map(|r| r == "next").unwrap_or(false)
            });

            if let Some(link) = next_link {
                if let Some(href) = &link.href {
                    if href.starts_with("http") {
                        if let Ok(parsed_url) = url::Url::parse(href) {
                            url = format!("{}{}?{}", self.get_base_url(), parsed_url.path(), parsed_url.query().unwrap_or(""));
                        } else {
                            break;
                        }
                    } else {
                        url = format!("{}{}", self.get_base_url(), href);
                    }
                    continue;
                }
            }
            
            break;
        }

        Ok(all_topics)
    }

    pub async fn get_topic(&self, topic_name: &str) -> Result<TopicProperties, String> {
        let url = format!("{}/{}?api-version={}", self.get_base_url(), topic_name, API_VERSION);
        let auth_header = self.get_auth_header(&url).await?;

        let response = self
            .client
            .get(&url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .map_err(|e| format!("Failed to get topic: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to get topic: {} - {}", status, error_text));
        }

        let xml = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
        let entry: TopicEntry = from_str(&xml).map_err(|e| format!("Failed to parse XML: {}", e))?;

        self.topic_entry_to_properties(&entry)
    }

    pub async fn create_topic(&self, topic_name: &str, properties: Option<&TopicProperties>) -> Result<(), String> {
        let url = format!("{}/{}?api-version={}", self.get_base_url(), topic_name, API_VERSION);
        let auth_header = self.get_auth_header(&url).await?;

        let xml = self.topic_properties_to_xml(topic_name, properties)?;

        let response = self
            .client
            .put(&url)
            .header("Authorization", &auth_header)
            .header("Content-Type", "application/atom+xml;type=entry;charset=utf-8")
            .body(xml)
            .send()
            .await
            .map_err(|e| format!("Failed to create topic: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to create topic: {} - {}", status, error_text));
        }

        Ok(())
    }

    pub async fn update_topic(&self, topic_name: &str, properties: &TopicProperties) -> Result<(), String> {
        let existing = self.get_topic(topic_name).await?;
        
        let merged = TopicProperties {
            name: properties.name.clone(),
            max_size_in_megabytes: properties.max_size_in_megabytes.or(existing.max_size_in_megabytes),
            default_message_time_to_live_in_seconds: properties.default_message_time_to_live_in_seconds.or(existing.default_message_time_to_live_in_seconds),
            duplicate_detection_history_time_window_in_seconds: properties.duplicate_detection_history_time_window_in_seconds.or(existing.duplicate_detection_history_time_window_in_seconds),
            enable_batched_operations: properties.enable_batched_operations.or(existing.enable_batched_operations),
            enable_partitioning: properties.enable_partitioning.or(existing.enable_partitioning),
            requires_duplicate_detection: properties.requires_duplicate_detection.or(existing.requires_duplicate_detection),
            size_in_bytes: existing.size_in_bytes,
            subscription_count: existing.subscription_count,
        };

        self.create_topic(topic_name, Some(&merged)).await
    }

    pub async fn delete_topic(&self, topic_name: &str) -> Result<(), String> {
        let url = format!("{}/{}?api-version={}", self.get_base_url(), topic_name, API_VERSION);
        let auth_header = self.get_auth_header(&url).await?;

        let response = self
            .client
            .delete(&url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .map_err(|e| format!("Failed to delete topic: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to delete topic: {} - {}", status, error_text));
        }

        Ok(())
    }

    // Subscription operations
    pub async fn list_subscriptions(&self, topic_name: &str) -> Result<Vec<SubscriptionProperties>, String> {
        let mut all_subscriptions = Vec::new();
        let mut url = format!("{}/{}/Subscriptions?api-version={}", self.get_base_url(), topic_name, API_VERSION);
        
        loop {
            let auth_header = self.get_auth_header(&url).await?;

            let response = self
                .client
                .get(&url)
                .header("Authorization", &auth_header)
                .send()
                .await
                .map_err(|e| format!("Failed to list subscriptions: {}", e))?;

            let status = response.status();
            if !status.is_success() {
                let error_text = response.text().await.unwrap_or_default();
                return Err(format!("Failed to list subscriptions: {} - {}", status, error_text));
            }

            let xml = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
            let feed: SubscriptionFeed = from_str(&xml).map_err(|e| format!("Failed to parse XML: {}", e))?;

            // Extract content for each entry using regex (since serde_xml_rs can't handle nested XML in content)
            // Match each entry's content separately
            let content_regex = regex::Regex::new(r#"(?s)<entry[^>]*>.*?<title[^>]*>([^<]+)</title>.*?<content[^>]*type="application/xml"[^>]*>(.*?)</content>"#).ok();
            
            for entry in feed.entries {
                let mut entry_with_content = entry.clone();
                
                // Try to find content for this entry by matching title
                if let Some(ref re) = content_regex {
                    if let Some(cap) = re.captures_iter(&xml).find(|cap| {
                        cap.get(1).map(|m| m.as_str().trim()) == Some(entry.title.trim())
                    }) {
                        if let Some(content_match) = cap.get(2) {
                            entry_with_content.content = Some(content_match.as_str().to_string());
                        }
                    }
                }
                
                let props = self.subscription_entry_to_properties(topic_name, &entry_with_content)?;
                all_subscriptions.push(props);
            }

            // Check for next page link
            let next_link = feed.links.iter().find(|link| {
                link.rel.as_ref().map(|r| r == "next").unwrap_or(false)
            });

            if let Some(link) = next_link {
                if let Some(href) = &link.href {
                    if href.starts_with("http") {
                        if let Ok(parsed_url) = url::Url::parse(href) {
                            url = format!("{}{}?{}", self.get_base_url(), parsed_url.path(), parsed_url.query().unwrap_or(""));
                        } else {
                            break;
                        }
                    } else {
                        url = format!("{}{}", self.get_base_url(), href);
                    }
                    continue;
                }
            }
            
            break;
        }

        Ok(all_subscriptions)
    }

    pub async fn create_subscription(
        &self,
        topic_name: &str,
        subscription_name: &str,
        properties: Option<&SubscriptionProperties>,
    ) -> Result<(), String> {
        let url = format!("{}/{}/Subscriptions/{}?api-version={}", self.get_base_url(), topic_name, subscription_name, API_VERSION);
        let auth_header = self.get_auth_header(&url).await?;

        let xml = self.subscription_properties_to_xml(topic_name, subscription_name, properties)?;

        let response = self
            .client
            .put(&url)
            .header("Authorization", &auth_header)
            .header("Content-Type", "application/atom+xml;type=entry;charset=utf-8")
            .body(xml)
            .send()
            .await
            .map_err(|e| format!("Failed to create subscription: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to create subscription: {} - {}", status, error_text));
        }

        Ok(())
    }

    // ============================================================================
    // Message Operations (azservicebus SDK)
    // ============================================================================
    // These operations use the azservicebus SDK for better performance,
    // reliability, and proper AMQP-based message handling.
    // ============================================================================

    // Peek messages using azservicebus SDK
    pub async fn peek_messages_sdk(
        &self,
        queue_name: Option<&str>,
        topic_name: Option<&str>,
        subscription_name: Option<&str>,
        max_count: u32,
    ) -> Result<Vec<ServiceBusMessage>, String> {
        use azservicebus::prelude::*;
        
        let connection_string = if let Some(ref parsed) = self.parsed_connection {
            // Reconstruct connection string from parsed components
            format!(
                "Endpoint=sb://{}{}/;SharedAccessKeyName={};SharedAccessKey={}",
                self.namespace,
                self.endpoint_domain,
                parsed.shared_access_key_name,
                parsed.shared_access_key
            )
        } else {
            return Err("Connection string not available for SDK".to_string());
        };

        eprintln!("[peek_messages_sdk] Using azservicebus SDK to peek {} messages", max_count);

        // Create ServiceBus client
        let mut client = ServiceBusClient::new_from_connection_string(
            &connection_string,
            ServiceBusClientOptions::default(),
        )
        .await
        .map_err(|e| format!("Failed to create ServiceBus client: {}", e))?;

        // Create receiver based on entity type
        let mut receiver = if let Some(q) = queue_name {
            eprintln!("[peek_messages_sdk] Creating receiver for queue: {}", q);
            client
                .create_receiver_for_queue(q, ServiceBusReceiverOptions::default())
                .await
                .map_err(|e| format!("Failed to create queue receiver: {}", e))?
        } else if let (Some(t), Some(s)) = (topic_name, subscription_name) {
            eprintln!("[peek_messages_sdk] Creating receiver for topic/subscription: {}/{}", t, s);
            client
                .create_receiver_for_subscription(t, s, ServiceBusReceiverOptions::default())
                .await
                .map_err(|e| format!("Failed to create subscription receiver: {}", e))?
        } else {
            return Err("Either queue_name or (topic_name and subscription_name) must be provided".to_string());
        };

        // Peek messages using SDK
        // peek_messages takes (max_count: u32, from_sequence_number: Option<i64>)
        let sdk_messages = receiver
            .peek_messages(max_count, None)
            .await
            .map_err(|e| format!("Failed to peek messages: {}", e))?;

        eprintln!("[peek_messages_sdk] SDK returned {} messages", sdk_messages.len());

        // Convert SDK ReceivedMessage to our ServiceBusMessage format
        let mut messages = Vec::new();
        for (idx, sdk_msg) in sdk_messages.iter().enumerate() {
            eprintln!("[peek_messages_sdk] Processing message {}", idx + 1);
            
            // Get message body (returns Result)
            let body_bytes = sdk_msg.body().map_err(|e| format!("Failed to get message body: {}", e))?;
            
            // Try to parse as JSON, otherwise use as string
            let body = match serde_json::from_slice::<serde_json::Value>(body_bytes) {
                Ok(json) => json,
                Err(_) => {
                    // If not JSON, try as UTF-8 string
                    match std::str::from_utf8(body_bytes) {
                        Ok(s) => serde_json::Value::String(s.to_string()),
                        Err(_) => serde_json::Value::String(format!("<binary data: {} bytes>", body_bytes.len())),
                    }
                }
            };

            // Access properties from ReceivedMessage and create our ServiceBusMessage
            // Convert OffsetDateTime to string - use format! with Display trait
            let enqueued_time_str = format!("{}", sdk_msg.enqueued_time());
            
            // Extract application properties (user_properties) from the SDK message
            // Try to get user_properties - the exact API may vary, so we'll try a few approaches
            let application_properties = {
                // Try to access user_properties - this might be through a method or direct field
                // For now, we'll set to None and can enhance later if the SDK provides access
                // The SDK may expose this differently - checking what's available
                None
            };
            
            // Extract delivery_count - try to get it from the message
            // Peeked messages may not have delivery_count, but let's try
            let delivery_count = {
                // Try to access delivery_count if available
                // This might not be available on peeked messages, only on received/locked messages
                None
            };
            
            let message = crate::azure::types::ServiceBusMessage {
                body,
                message_id: sdk_msg.message_id().as_ref().map(|id| id.to_string()),
                correlation_id: sdk_msg.correlation_id().as_ref().map(|id| id.to_string()),
                content_type: sdk_msg.content_type().as_ref().map(|ct| ct.to_string()),
                sequence_number: Some(sdk_msg.sequence_number() as u64), // Convert i64 to u64
                subject: sdk_msg.subject().as_ref().map(|s| s.to_string()),
                reply_to: sdk_msg.reply_to().as_ref().map(|r| r.to_string()),
                reply_to_session_id: sdk_msg.reply_to_session_id().as_ref().map(|s| s.to_string()),
                session_id: sdk_msg.session_id().as_ref().map(|s| s.to_string()),
                time_to_live: sdk_msg.time_to_live().map(|ttl| ttl.as_secs()),
                to: sdk_msg.to().as_ref().map(|t| t.to_string()),
                application_properties,
                delivery_count,
                enqueued_time_utc: Some(enqueued_time_str),
                locked_until_utc: None, // Peek doesn't lock
                dead_letter_reason: None,
                dead_letter_error_description: None,
            };
            
            messages.push(message);
        }

        // Cleanup
        receiver.dispose().await.map_err(|e| format!("Failed to dispose receiver: {}", e))?;
        client.dispose().await.map_err(|e| format!("Failed to dispose client: {}", e))?;

        eprintln!("[peek_messages_sdk] Successfully converted {} messages", messages.len());
        Ok(messages)
    }

    // Main peek_messages method - delegates to SDK implementation
    pub async fn peek_messages(
        &self,
        queue_name: Option<&str>,
        topic_name: Option<&str>,
        subscription_name: Option<&str>,
        max_count: u32,
    ) -> Result<Vec<ServiceBusMessage>, String> {
        // Use SDK implementation for proper batch peeking
        self.peek_messages_sdk(queue_name, topic_name, subscription_name, max_count).await
    }

    // Peek messages from dead letter queue using azservicebus SDK
    pub async fn peek_dead_letter_messages_sdk(
        &self,
        queue_name: Option<&str>,
        topic_name: Option<&str>,
        subscription_name: Option<&str>,
        max_count: u32,
    ) -> Result<Vec<ServiceBusMessage>, String> {
        use azservicebus::prelude::*;
        
        let connection_string = if let Some(ref parsed) = self.parsed_connection {
            // Reconstruct connection string from parsed components
            format!(
                "Endpoint=sb://{}{}/;SharedAccessKeyName={};SharedAccessKey={}",
                self.namespace,
                self.endpoint_domain,
                parsed.shared_access_key_name,
                parsed.shared_access_key
            )
        } else {
            return Err("Connection string not available for SDK".to_string());
        };

        eprintln!("[peek_dead_letter_messages_sdk] Using azservicebus SDK to peek {} messages from dead letter queue", max_count);

        // Create ServiceBus client
        let mut client = ServiceBusClient::new_from_connection_string(
            &connection_string,
            ServiceBusClientOptions::default(),
        )
        .await
        .map_err(|e| format!("Failed to create ServiceBus client: {}", e))?;

        // Create receiver for dead letter queue using the $deadletterqueue path (lowercase)
        let mut receiver = if let Some(q) = queue_name {
            let dead_letter_path = format!("{}/$deadletterqueue", q);
            eprintln!("[peek_dead_letter_messages_sdk] Creating receiver for dead letter queue: {}", dead_letter_path);
            client
                .create_receiver_for_queue(&dead_letter_path, ServiceBusReceiverOptions::default())
                .await
                .map_err(|e| format!("Failed to create dead letter queue receiver: {}", e))?
        } else if let (Some(t), Some(s)) = (topic_name, subscription_name) {
            // For subscriptions, the path is: topic/Subscriptions/subscription/$deadletterqueue
            // We can use create_receiver_for_queue with the full path
            let dead_letter_path = format!("{}/Subscriptions/{}/$deadletterqueue", t, s);
            eprintln!("[peek_dead_letter_messages_sdk] Creating receiver for dead letter subscription: {}", dead_letter_path);
            client
                .create_receiver_for_queue(&dead_letter_path, ServiceBusReceiverOptions::default())
                .await
                .map_err(|e| format!("Failed to create dead letter subscription receiver: {}", e))?
        } else {
            return Err("Either queue_name or (topic_name and subscription_name) must be provided".to_string());
        };

        // Peek messages from dead letter queue
        let sdk_messages = receiver
            .peek_messages(max_count, None)
            .await
            .map_err(|e| format!("Failed to peek dead letter messages: {}", e))?;

        eprintln!("[peek_dead_letter_messages_sdk] SDK returned {} dead letter messages", sdk_messages.len());

        // Convert SDK ReceivedMessage to our ServiceBusMessage format
        let mut messages = Vec::new();
        for (idx, sdk_msg) in sdk_messages.iter().enumerate() {
            eprintln!("[peek_dead_letter_messages_sdk] Processing dead letter message {}", idx + 1);
            
            // Get message body (returns Result)
            let body_bytes = sdk_msg.body().map_err(|e| format!("Failed to get message body: {}", e))?;
            
            // Try to parse as JSON, otherwise use as string
            let body = match serde_json::from_slice::<serde_json::Value>(body_bytes) {
                Ok(json) => json,
                Err(_) => {
                    // If not JSON, try as UTF-8 string
                    match std::str::from_utf8(body_bytes) {
                        Ok(s) => serde_json::Value::String(s.to_string()),
                        Err(_) => serde_json::Value::String(format!("<binary data: {} bytes>", body_bytes.len())),
                    }
                }
            };

            // Access properties from ReceivedMessage and create our ServiceBusMessage
            let enqueued_time_str = format!("{}", sdk_msg.enqueued_time());
            
            // Extract application properties - dead letter messages may have DeadLetterReason and DeadLetterErrorDescription
            let application_properties = None; // TODO: Extract from user_properties if available
            
            // Try to extract dead letter reason and error description from application properties
            // These are typically stored in the message's application properties
            let (dead_letter_reason, dead_letter_error_description) = {
                // Try to get from user_properties if available
                // DeadLetterReason and DeadLetterErrorDescription are typically in application properties
                (None, None)
            };
            
            let delivery_count = None; // Not available on peeked messages
            
            let message = crate::azure::types::ServiceBusMessage {
                body,
                message_id: sdk_msg.message_id().as_ref().map(|id| id.to_string()),
                correlation_id: sdk_msg.correlation_id().as_ref().map(|id| id.to_string()),
                content_type: sdk_msg.content_type().as_ref().map(|ct| ct.to_string()),
                sequence_number: Some(sdk_msg.sequence_number() as u64),
                subject: sdk_msg.subject().as_ref().map(|s| s.to_string()),
                reply_to: sdk_msg.reply_to().as_ref().map(|r| r.to_string()),
                reply_to_session_id: sdk_msg.reply_to_session_id().as_ref().map(|s| s.to_string()),
                session_id: sdk_msg.session_id().as_ref().map(|s| s.to_string()),
                time_to_live: sdk_msg.time_to_live().map(|ttl| ttl.as_secs()),
                to: sdk_msg.to().as_ref().map(|t| t.to_string()),
                application_properties,
                delivery_count,
                enqueued_time_utc: Some(enqueued_time_str),
                locked_until_utc: None, // Peek doesn't lock
                dead_letter_reason,
                dead_letter_error_description,
            };
            
            messages.push(message);
        }

        // Cleanup
        receiver.dispose().await.map_err(|e| format!("Failed to dispose receiver: {}", e))?;
        client.dispose().await.map_err(|e| format!("Failed to dispose client: {}", e))?;

        eprintln!("[peek_dead_letter_messages_sdk] Successfully converted {} dead letter messages", messages.len());
        Ok(messages)
    }

    // Original REST API implementation (kept for backward compatibility if needed)
    #[allow(dead_code)]
    pub async fn peek_messages_rest(
        &self,
        queue_name: Option<&str>,
        topic_name: Option<&str>,
        subscription_name: Option<&str>,
        max_count: u32,
    ) -> Result<Vec<ServiceBusMessage>, String> {
        let entity_path = if let Some(q) = queue_name {
            eprintln!("[peek_messages] Peeking from queue: {}", q);
            q.to_string()
        } else if let (Some(t), Some(s)) = (topic_name, subscription_name) {
            eprintln!("[peek_messages] Peeking from topic/subscription: {}/{}", t, s);
            format!("{}/Subscriptions/{}", t, s)
        } else {
            return Err("Either queue_name or (topic_name and subscription_name) must be provided".to_string());
        };

        // Azure Service Bus peek uses GET request, not POST
        // Format: /{entity-path}/messages/head?timeout={seconds}&maxcount={count}&api-version={version}
        let base_url = format!("{}/{}/messages/head?timeout=60&api-version={}", self.get_base_url(), entity_path, API_VERSION);
        eprintln!("[peek_messages] Base URL: {}", base_url);

        let mut all_messages = Vec::new();
        let max_per_request = max_count.min(32); // Azure allows max 32 messages per peek
        let mut sequence_number: Option<i64> = None; // For pagination
        let mut seen_message_ids = std::collections::HashSet::new(); // Track seen messages to avoid duplicates

        loop {
            let remaining = max_count as usize - all_messages.len();
            if remaining == 0 {
                break;
            }
            
            let count = remaining.min(max_per_request as usize);
            
            // When we get JSON responses without sequence numbers, we can't paginate properly
            // Try different approaches: with maxcount, without maxcount, or with maxcount=1
            let mut peek_url = if all_messages.is_empty() {
                // First request: try with the requested maxcount
                format!("{}&maxcount={}", base_url, count)
            } else if sequence_number.is_none() && seen_message_ids.len() == all_messages.len() {
                // We got JSON without sequence numbers - try without maxcount to see if we get XML
                // Or try with maxcount=1 to get individual messages
                eprintln!("[peek_messages] Got JSON without sequence numbers, trying without maxcount to get XML Atom feed");
                base_url.clone() // No maxcount parameter
            } else {
                // Use the requested count
                format!("{}&maxcount={}", base_url, count.min(32))
            };
            
            // Add from parameter for pagination if we have a sequence number
            if let Some(seq) = sequence_number {
                peek_url = format!("{}&from={}", peek_url, seq);
            }
            
            eprintln!("[peek_messages] Fetching from URL: {}", peek_url);
            
            // Update auth header for the new URL
            let auth_header = self.get_auth_header(&peek_url).await?;
            
            let response = self
                .client
                .get(&peek_url)
                .header("Authorization", &auth_header)
                .header("Accept", "application/atom+xml")
                .header("Content-Type", "application/atom+xml")
                .send()
                .await
                .map_err(|e| {
                    eprintln!("[peek_messages] Request failed: {}", e);
                    format!("Failed to peek messages: {}", e)
                })?;

            let status = response.status();
            eprintln!("[peek_messages] Response status: {}", status);
            
            // Extract Content-Type header before consuming the response
            let content_type = response.headers()
                .get("content-type")
                .and_then(|h| h.to_str().ok())
                .map(|s| s.to_string())
                .unwrap_or_else(|| "unknown".to_string());
            eprintln!("[peek_messages] Content-Type: {}", content_type);
            
            // Check for 204 No Content (no messages) before checking success
            if status.as_u16() == 204 {
                eprintln!("[peek_messages] No messages (204 No Content)");
                break;
            }
            
            if !status.is_success() {
                let error_text = response.text().await.unwrap_or_default();
                eprintln!("[peek_messages] Error response: {}", error_text);
                return Err(format!("Failed to peek messages: {} - {}", status, error_text));
            }

            // Parse messages from response
            // Azure Service Bus returns messages in Atom feed format (XML)
            // However, sometimes Azure returns JSON instead, especially when maxcount is used
            let response_text = response.text().await.map_err(|e| {
                eprintln!("[peek_messages] Failed to read response text: {}", e);
                format!("Failed to read response: {}", e)
            })?;
            
            // Debug: Check if response might be XML-wrapped JSON by looking for XML tags
            // even if it starts with {
            if response_text.trim_start().starts_with('{') {
                // Check if there are any XML tags in the response (might be XML-wrapped)
                if response_text.contains('<') && (response_text.contains("feed") || response_text.contains("entry")) {
                    eprintln!("[peek_messages] Response starts with {{ but contains XML tags - might be XML-wrapped JSON");
                }
            }
            
            eprintln!("[peek_messages] Response length: {} chars", response_text.len());
            
            // Log full response if small, or preview if large
            if response_text.len() < 2000 {
                eprintln!("[peek_messages] Full response: {}", response_text);
            } else {
                eprintln!("[peek_messages] Response preview (first 1000 chars): {}", &response_text[..1000.min(response_text.len())]);
                eprintln!("[peek_messages] Response preview (last 500 chars): {}", &response_text[response_text.len().saturating_sub(500)..]);
            }
            
            // Check if response starts with XML declaration or feed tag
            let trimmed = response_text.trim_start();
            let is_xml_start = trimmed.starts_with("<?xml") || trimmed.starts_with("<feed") || trimmed.starts_with("<entry");
            let is_json_start = trimmed.starts_with('{') || trimmed.starts_with('[');
            
            eprintln!("[peek_messages] Response starts with XML: {}, JSON: {}", is_xml_start, is_json_start);
            
            // Check if response might be XML-wrapped JSON (look for common XML patterns even if it starts with {)
            let might_be_xml_wrapped = trimmed.contains("<feed") || trimmed.contains("<entry") || trimmed.contains("<?xml");
            if might_be_xml_wrapped && is_json_start {
                eprintln!("[peek_messages] Warning: Response starts with JSON but might contain XML elements - could be XML-wrapped JSON");
            }
            
            // Try to parse as XML Atom feed first (standard Azure Service Bus format)
            // Even if it starts with JSON, it might be XML-wrapped JSON content
            // However, if Content-Type says XML but body is JSON, Azure might be misconfigured
            // Try parsing as XML first
            let feed_result: Result<MessageFeed, _> = from_str(&response_text);
            
            // If XML parsing fails and Content-Type says XML but body is JSON,
            // this might indicate Azure is returning raw message body instead of Atom feed
            // This could happen if maxcount parameter causes issues or if Azure is misconfigured
            
            match feed_result {
                Ok(feed) => {
                    // Successfully parsed as XML Atom feed
                    let entry_count = feed.entries.len();
                    eprintln!("[peek_messages] Parsed {} entries from XML feed", entry_count);
                    
                    if entry_count == 0 {
                        // No more messages
                        break;
                    }
                    
                    for (idx, entry) in feed.entries.iter().enumerate() {
                        eprintln!("[peek_messages] Processing entry {}", idx);
                        let message = self.message_entry_to_message(entry).map_err(|e| {
                            eprintln!("[peek_messages] Failed to convert entry {} to message: {}", idx, e);
                            e
                        })?;
                        all_messages.push(message);
                    }
                    
                    eprintln!("[peek_messages] Successfully processed {} messages, total so far: {}", entry_count, all_messages.len());
                    
                    // Track sequence number for pagination (from last message)
                    if let Some(last_entry) = feed.entries.last() {
                        if let Some(seq) = last_entry.sequence_number {
                            sequence_number = Some(seq);
                        }
                    }
                    
                    // If we got fewer messages than requested, we're done
                    if entry_count < count {
                        break;
                    }
                    
                    // Continue to next iteration of loop for pagination
                    continue;
                }
                Err(xml_err) => {
                    // XML parsing failed - check if it's JSON
                    eprintln!("[peek_messages] XML parsing failed: {}", xml_err);
                    
                    if is_json_start && !is_xml_start {
                        eprintln!("[peek_messages] Detected JSON response (raw message body)");
                        // Azure is returning JSON instead of XML Atom feed - this is non-standard
                        // Try to parse as JSON - could be a single message object or an array
                        match serde_json::from_str::<serde_json::Value>(&response_text) {
                            Ok(json_value) => {
                                // Check if it's an array of messages
                                if let Some(array) = json_value.as_array() {
                                    eprintln!("[peek_messages] JSON is an array with {} messages", array.len());
                                    for (_idx, item) in array.iter().enumerate() {
                                        // Extract message properties from JSON object
                                        let message_id = item.get("MessageId").and_then(|v| v.as_str()).map(|s| s.to_string());
                                        let body = item.clone(); // Use the whole JSON object as body
                                        
                                        let message = ServiceBusMessage {
                                            body,
                                            message_id: message_id.clone(),
                                            correlation_id: item.get("CorrelationId").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                            content_type: Some("application/json".to_string()),
                                            sequence_number: item.get("SequenceNumber").and_then(|v| v.as_i64()).map(|s| s as u64),
                                            subject: item.get("Subject").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                            reply_to: item.get("ReplyTo").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                            reply_to_session_id: item.get("ReplyToSessionId").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                            session_id: item.get("SessionId").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                            time_to_live: None,
                                            to: item.get("To").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                            application_properties: None,
                                            delivery_count: item.get("DeliveryCount").and_then(|v| v.as_u64()).map(|s| s as u32),
                                            enqueued_time_utc: item.get("EnqueuedTimeUtc").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                            locked_until_utc: item.get("LockedUntilUtc").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                            dead_letter_reason: item.get("DeadLetterReason").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                            dead_letter_error_description: item.get("DeadLetterErrorDescription").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                        };
                                        all_messages.push(message);
                                    }
                                    eprintln!("[peek_messages] Created {} messages from JSON array", array.len());
                                } else {
                                    // Single message object
                                    eprintln!("[peek_messages] JSON is a single message object");
                                    // Extract message properties from JSON object
                                    let message_id = json_value.get("MessageId").and_then(|v| v.as_str()).map(|s| s.to_string());
                                    let body = json_value.clone(); // Use the whole JSON object as body
                                    
                                    // Try to extract sequence number for pagination
                                    let seq_num = json_value.get("SequenceNumber").and_then(|v| v.as_i64());
                                    
                                    let message = ServiceBusMessage {
                                        body,
                                        message_id: message_id.clone(),
                                        correlation_id: json_value.get("CorrelationId").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                        content_type: Some("application/json".to_string()),
                                        sequence_number: seq_num.map(|s| s as u64),
                                        subject: json_value.get("Subject").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                        reply_to: json_value.get("ReplyTo").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                        reply_to_session_id: json_value.get("ReplyToSessionId").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                        session_id: json_value.get("SessionId").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                        time_to_live: None,
                                        to: json_value.get("To").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                        application_properties: None,
                                        delivery_count: json_value.get("DeliveryCount").and_then(|v| v.as_u64()).map(|s| s as u32),
                                        enqueued_time_utc: json_value.get("EnqueuedTimeUtc").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                        locked_until_utc: json_value.get("LockedUntilUtc").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                        dead_letter_reason: json_value.get("DeadLetterReason").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                        dead_letter_error_description: json_value.get("DeadLetterErrorDescription").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                    };
                                    // Check if we've already seen this message
                                    if let Some(ref msg_id) = message_id {
                                        if seen_message_ids.contains(msg_id) {
                                            eprintln!("[peek_messages] Already seen message ID {}, stopping pagination", msg_id);
                                            break; // We're getting duplicates, stop
                                        }
                                        seen_message_ids.insert(msg_id.clone());
                                    }
                                    
                                    all_messages.push(message);
                                    eprintln!("[peek_messages] Created 1 message from JSON object");
                                    
                                    // Update sequence number for pagination if available
                                    if let Some(seq) = seq_num {
                                        sequence_number = Some(seq);
                                        eprintln!("[peek_messages] Extracted sequence number {} for pagination", seq);
                                    }
                                    
                                    // When Azure returns JSON, it typically returns one message at a time
                                    // We need to make multiple requests to get more messages
                                    // Track this message ID to avoid duplicates
                                    if let Some(ref msg_id) = message_id {
                                        if seen_message_ids.contains(msg_id) {
                                            eprintln!("[peek_messages] Already seen message ID {}, stopping pagination", msg_id);
                                            break; // We're getting duplicates, stop
                                        }
                                        seen_message_ids.insert(msg_id.clone());
                                    }
                                    
                                    // If we got only 1 message but requested more, continue making requests
                                    if all_messages.len() < max_count as usize {
                                        if sequence_number.is_some() {
                                            eprintln!("[peek_messages] Got 1 JSON message, continuing pagination with sequence number (have {} of {})", all_messages.len(), max_count);
                                            continue; // Continue loop to get more messages
                                        } else {
                                            // No sequence number, but Azure might return different messages on subsequent requests
                                            // Try making another request - Azure might cycle through messages
                                            eprintln!("[peek_messages] Got 1 JSON message without sequence number. Making another request to get next message (have {} of {})", all_messages.len(), max_count);
                                            // Reset to try getting the next message
                                            sequence_number = None;
                                            continue; // Continue to get more messages
                                        }
                                    } else {
                                        // We've reached max_count
                                        break;
                                    }
                                }
                            }
                            Err(json_err) => {
                                eprintln!("[peek_messages] Failed to parse as JSON: {}", json_err);
                                return Err(format!("Failed to parse response as XML or JSON. XML error: {}, JSON error: {}", xml_err, json_err));
                            }
                        }
                    } else {
                        // Not JSON, and XML parsing failed
                        eprintln!("[peek_messages] Response starts with: {}", &response_text[..response_text.len().min(100)]);
                        return Err(format!("Failed to parse message feed: {}", xml_err));
                    }
                }
            }
        }

        Ok(all_messages)
    }
    
    fn message_entry_to_message(&self, entry: &MessageEntry) -> Result<ServiceBusMessage, String> {
        // Parse message body from content
        // Content might be base64 encoded or plain text/JSON
        let body = if let Some(ref content) = entry.content {
            // Try to parse as JSON first
            if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(content) {
                json_value
            } else {
                // If not JSON, wrap as string value
                serde_json::Value::String(content.clone())
            }
        } else {
            serde_json::Value::Null
        };
        
        // Parse BrokerProperties from the entry
        // BrokerProperties is a JSON string in the entry's content or as a property
        let mut message = ServiceBusMessage {
            body,
            message_id: entry.message_id.clone(),
            correlation_id: entry.correlation_id.clone(),
            content_type: entry.content_type.clone(),
            sequence_number: entry.sequence_number.map(|s| s as u64),
            subject: None,
            reply_to: None,
            reply_to_session_id: None,
            session_id: None,
            time_to_live: None,
            to: None,
            application_properties: None,
            delivery_count: None,
            enqueued_time_utc: None,
            locked_until_utc: None,
            dead_letter_reason: None,
            dead_letter_error_description: None,
        };
        
        // Parse BrokerProperties if available
        if let Some(ref broker_props) = entry.broker_properties {
            // BrokerProperties is a JSON string, parse it
            if let Ok(props) = serde_json::from_str::<serde_json::Value>(broker_props) {
                if let Some(msg_id) = props.get("MessageId").and_then(|v| v.as_str()) {
                    message.message_id = Some(msg_id.to_string());
                }
                if let Some(corr_id) = props.get("CorrelationId").and_then(|v| v.as_str()) {
                    message.correlation_id = Some(corr_id.to_string());
                }
                if let Some(seq) = props.get("SequenceNumber").and_then(|v| v.as_i64()) {
                    message.sequence_number = Some(seq as u64);
                }
            }
        }
        
        Ok(message)
    }

    // Send message using azservicebus SDK
    pub async fn send_message(
        &self,
        queue_name: Option<&str>,
        topic_name: Option<&str>,
        message: &ServiceBusMessage,
    ) -> Result<(), String> {
        use azservicebus::prelude::*;
        
        let connection_string = if let Some(ref parsed) = self.parsed_connection {
            // Reconstruct connection string from parsed components
            format!(
                "Endpoint=sb://{}{}/;SharedAccessKeyName={};SharedAccessKey={}",
                self.namespace,
                self.endpoint_domain,
                parsed.shared_access_key_name,
                parsed.shared_access_key
            )
        } else {
            return Err("Connection string not available for SDK".to_string());
        };

        let entity_path = if let Some(q) = queue_name {
            q.to_string()
        } else if let Some(t) = topic_name {
            t.to_string()
        } else {
            return Err("Either queue_name or topic_name must be provided".to_string());
        };

        eprintln!("[send_message] Using azservicebus SDK to send message to: {}", entity_path);

        // Create ServiceBus client
        let mut client = ServiceBusClient::new_from_connection_string(
            &connection_string,
            ServiceBusClientOptions::default(),
        )
        .await
        .map_err(|e| format!("Failed to create ServiceBus client: {}", e))?;

        // Create sender for queue or topic
        let mut sender = client
            .create_sender(&entity_path, ServiceBusSenderOptions::default())
            .await
            .map_err(|e| format!("Failed to create sender: {}", e))?;

        // Convert message body to bytes
        let body_bytes = match &message.body {
            serde_json::Value::String(s) => s.as_bytes().to_vec(),
            serde_json::Value::Object(_) | serde_json::Value::Array(_) => {
                serde_json::to_vec(&message.body)
                    .map_err(|e| format!("Failed to serialize message body: {}", e))?
            }
            serde_json::Value::Number(n) => n.to_string().as_bytes().to_vec(),
            serde_json::Value::Bool(b) => b.to_string().as_bytes().to_vec(),
            serde_json::Value::Null => Vec::new(),
        };

        // Create SDK message
        let mut sdk_message = ServiceBusMessage::new(body_bytes);

        // Set message properties
        // Note: Some setters return Result, others return () - handle accordingly
        if let Some(msg_id) = &message.message_id {
            sdk_message.set_message_id(msg_id.clone())
                .map_err(|e| format!("Failed to set message_id: {}", e))?;
        }
        if let Some(content_type) = &message.content_type {
            sdk_message.set_content_type(content_type.clone());
        }
        if let Some(corr_id) = &message.correlation_id {
            sdk_message.set_correlation_id(corr_id.clone());
        }
        if let Some(session_id) = &message.session_id {
            sdk_message.set_session_id(session_id.clone())
                .map_err(|e| format!("Failed to set session_id: {}", e))?;
        }
        if let Some(reply_to) = &message.reply_to {
            sdk_message.set_reply_to(reply_to.clone());
        }
        if let Some(reply_to_session_id) = &message.reply_to_session_id {
            sdk_message.set_reply_to_session_id(reply_to_session_id.clone())
                .map_err(|e| format!("Failed to set reply_to_session_id: {}", e))?;
        }
        if let Some(subject) = &message.subject {
            sdk_message.set_subject(subject.clone());
        }
        if let Some(ttl) = message.time_to_live {
            sdk_message.set_time_to_live(std::time::Duration::from_secs(ttl))
                .map_err(|e| format!("Failed to set time_to_live: {}", e))?;
        }
        if let Some(to) = &message.to {
            sdk_message.set_to(to.clone());
        }
        // Note: azservicebus SDK doesn't currently support setting application properties
        // directly on ServiceBusMessage. If application properties are needed, they would
        // need to be included in the message body or the SDK would need to be updated.
        // For now, we skip setting application_properties from the message.

        // Send the message
        sender
            .send_message(sdk_message)
            .await
            .map_err(|e| format!("Failed to send message: {}", e))?;

        eprintln!("[send_message] Message sent successfully");

        // Cleanup
        sender.dispose().await.map_err(|e| format!("Failed to dispose sender: {}", e))?;
        client.dispose().await.map_err(|e| format!("Failed to dispose client: {}", e))?;

        Ok(())
    }

    // Purge queue by receiving and completing messages using azservicebus SDK
    pub async fn purge_queue(&self, queue_name: &str, purge_dead_letter: bool) -> Result<u32, String> {
        use azservicebus::prelude::*;
        
        let connection_string = if let Some(ref parsed) = self.parsed_connection {
            // Reconstruct connection string from parsed components
            format!(
                "Endpoint=sb://{}{}/;SharedAccessKeyName={};SharedAccessKey={}",
                self.namespace,
                self.endpoint_domain,
                parsed.shared_access_key_name,
                parsed.shared_access_key
            )
        } else {
            return Err("Connection string not available for SDK".to_string());
        };

        // Create ServiceBus client with longer timeout to ensure we can receive existing messages
        use azservicebus::ServiceBusRetryOptions;
        let mut client_options = ServiceBusClientOptions::default();
        // Increase try_timeout to ensure receive_messages has enough time to get existing messages
        // Default might be too short and cause timeouts before existing messages are returned
        client_options.retry_options = ServiceBusRetryOptions {
            try_timeout: Duration::from_secs(30), // 30 second timeout for operations
            ..ServiceBusRetryOptions::default()
        };
        
        let mut client = ServiceBusClient::new_from_connection_string(
            &connection_string,
            client_options,
        )
        .await
        .map_err(|e| format!("Failed to create ServiceBus client: {}", e))?;

        // Create receiver options with subQueue for dead letter if needed
        // Use ReceiveAndDelete mode for purging - messages are automatically deleted when received
        // This is more efficient than PeekLock + complete, and avoids issues with receive_messages timing out
        let receiver_options = if purge_dead_letter {
            ServiceBusReceiverOptions {
                sub_queue: azservicebus::SubQueue::DeadLetter,
                receive_mode: azservicebus::ServiceBusReceiveMode::ReceiveAndDelete,
                prefetch_count: 0, // No prefetch - we'll receive explicitly
                identifier: None,
            }
        } else {
            ServiceBusReceiverOptions {
                receive_mode: azservicebus::ServiceBusReceiveMode::ReceiveAndDelete,
                prefetch_count: 0, // No prefetch - we'll receive explicitly
                sub_queue: azservicebus::SubQueue::None,
                identifier: None,
            }
        };

        // Create receiver for the queue (or dead letter queue)
        let mut receiver = client
            .create_receiver_for_queue(queue_name, receiver_options)
            .await
            .map_err(|e| format!("Failed to create receiver: {}", e))?;
        
        // First, peek to verify there are messages to purge
        let peek_result = receiver.peek_messages(10, None).await;
        match peek_result {
            Ok(peeked_msgs) => {
                if peeked_msgs.is_empty() {
                    return Ok(0);
                }
            },
            Err(_) => {
                // Continue even if peek fails - will try to receive anyway
            }
        }

        let mut purged_count = 0u32;
        let batch_size = 100u32; // Process messages in batches of 100
        let max_iterations = 100u32; // Safety limit to prevent infinite loops
        let mut iteration = 0u32;
        let mut consecutive_empty_receives = 0u32;
        let max_consecutive_empty = 3u32; // Stop after 3 consecutive empty receives

        // Keep receiving and completing messages until no more are available
        // Strategy: Try receiving with a short timeout first to get existing messages
        // If that times out, try one more time with a longer timeout to catch any in-flight messages
        loop {
            iteration += 1;
            if iteration > max_iterations {
                break;
            }
            
            // Use a timeout to prevent hanging, but make it long enough to get existing messages
            let receive_result = tokio::time::timeout(
                Duration::from_secs(5),
                receiver.receive_messages(batch_size)
            ).await;
            
            let messages = match receive_result {
                Ok(Ok(msgs)) => {
                    if msgs.is_empty() {
                        consecutive_empty_receives += 1;
                    } else {
                        consecutive_empty_receives = 0; // Reset on success
                    }
                    msgs
                },
                Ok(Err(e)) => {
                    return Err(format!("Failed to receive messages: {}", e));
                },
                Err(_) => {
                    // Timeout - no messages available
                    consecutive_empty_receives += 1;
                    
                    if consecutive_empty_receives >= max_consecutive_empty {
                        break;
                    }
                    continue;
                }
            };

            if messages.is_empty() {
                if consecutive_empty_receives >= max_consecutive_empty {
                    break;
                }
                continue;
            }

            // In ReceiveAndDelete mode, messages are automatically deleted when received
            // No need to complete them - just count them
            purged_count += messages.len() as u32;
        }

        // Cleanup
        receiver.dispose().await.map_err(|e| format!("Failed to dispose receiver: {}", e))?;
        client.dispose().await.map_err(|e| format!("Failed to dispose client: {}", e))?;

        Ok(purged_count)
    }

    // Test connection by attempting to list queues (uses REST API)
    pub async fn test_connection(&self) -> Result<bool, String> {
        // Test by trying to list queues (limited to 1)
        match self.list_queues().await {
            Ok(_) => Ok(true),
            Err(e) => {
                eprintln!("Connection test failed: {}", e);
                Ok(false)
            }
        }
    }

    // Helper methods for XML parsing and generation
    fn queue_entry_to_properties(&self, entry: &QueueEntry) -> Result<QueueProperties, String> {
        // Helper function to parse ISO 8601 duration to seconds
        fn duration_to_seconds(duration_str: &str) -> Option<u64> {
            // Parse PT30S, PT1M, PT1H30M, etc.
            let re = regex::Regex::new(r#"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"#).ok()?;
            let cap = re.captures(duration_str)?;
            let hours: u64 = cap.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
            let minutes: u64 = cap.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
            let seconds: u64 = cap.get(3).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
            Some(hours * 3600 + minutes * 60 + seconds)
        }
        
        // Parse message counts from content XML
        let mut message_count: Option<u64> = None;
        let mut active_message_count: Option<u64> = None;
        let mut dead_letter_message_count: Option<u64> = None;
        let mut scheduled_message_count: Option<u64> = None;
        let mut transfer_message_count: Option<u64> = None;
        let mut transfer_dead_letter_message_count: Option<u64> = None;
        
        // Parse queue properties from content XML
        let mut max_size_in_megabytes: Option<u64> = None;
        let mut lock_duration_in_seconds: Option<u64> = None;
        let mut max_delivery_count: Option<u32> = None;
        let mut default_message_time_to_live_in_seconds: Option<u64> = None;
        let mut dead_lettering_on_message_expiration: Option<bool> = None;
        let mut duplicate_detection_history_time_window_in_seconds: Option<u64> = None;
        let mut enable_batched_operations: Option<bool> = None;
        let mut enable_partitioning: Option<bool> = None;
        let mut requires_session: Option<bool> = None;
        let mut requires_duplicate_detection: Option<bool> = None;
        let mut size_in_bytes: Option<u64> = None;
        
        if let Some(ref content) = entry.content {
            // Extract counts from CountDetails using regex
            if let Some(cap) = regex::Regex::new(r#"<d2p1:ActiveMessageCount>(\d+)</d2p1:ActiveMessageCount>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                active_message_count = cap[1].parse().ok();
            }
            if let Some(cap) = regex::Regex::new(r#"<d2p1:DeadLetterMessageCount>(\d+)</d2p1:DeadLetterMessageCount>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                dead_letter_message_count = cap[1].parse().ok();
            }
            if let Some(cap) = regex::Regex::new(r#"<d2p1:ScheduledMessageCount>(\d+)</d2p1:ScheduledMessageCount>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                scheduled_message_count = cap[1].parse().ok();
            }
            if let Some(cap) = regex::Regex::new(r#"<d2p1:TransferMessageCount>(\d+)</d2p1:TransferMessageCount>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                transfer_message_count = cap[1].parse().ok();
            }
            if let Some(cap) = regex::Regex::new(r#"<d2p1:TransferDeadLetterMessageCount>(\d+)</d2p1:TransferDeadLetterMessageCount>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                transfer_dead_letter_message_count = cap[1].parse().ok();
            }
            if let Some(cap) = regex::Regex::new(r#"<MessageCount>(\d+)</MessageCount>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                message_count = cap[1].parse().ok();
            }
            
            // Parse queue properties
            if let Some(cap) = regex::Regex::new(r#"<MaxSizeInMegabytes>(\d+)</MaxSizeInMegabytes>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                max_size_in_megabytes = cap[1].parse().ok();
            }
            if let Some(cap) = regex::Regex::new(r#"<LockDuration>(.*?)</LockDuration>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                lock_duration_in_seconds = duration_to_seconds(&cap[1]);
            }
            if let Some(cap) = regex::Regex::new(r#"<MaxDeliveryCount>(\d+)</MaxDeliveryCount>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                max_delivery_count = cap[1].parse().ok();
            }
            if let Some(cap) = regex::Regex::new(r#"<DefaultMessageTimeToLive>(.*?)</DefaultMessageTimeToLive>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                default_message_time_to_live_in_seconds = duration_to_seconds(&cap[1]);
            }
            if let Some(cap) = regex::Regex::new(r#"<EnableDeadLetteringOnMessageExpiration>(true|false)</EnableDeadLetteringOnMessageExpiration>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                dead_lettering_on_message_expiration = Some(cap.get(1).map(|m| m.as_str() == "true").unwrap_or(false));
            }
            if let Some(cap) = regex::Regex::new(r#"<DuplicateDetectionHistoryTimeWindow>(.*?)</DuplicateDetectionHistoryTimeWindow>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                duplicate_detection_history_time_window_in_seconds = cap.get(1).and_then(|m| duration_to_seconds(m.as_str()));
            }
            if let Some(cap) = regex::Regex::new(r#"<EnableBatchedOperations>(true|false)</EnableBatchedOperations>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                enable_batched_operations = Some(cap.get(1).map(|m| m.as_str() == "true").unwrap_or(false));
            }
            if let Some(cap) = regex::Regex::new(r#"<EnablePartitioning>(true|false)</EnablePartitioning>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                enable_partitioning = Some(cap.get(1).map(|m| m.as_str() == "true").unwrap_or(false));
            }
            if let Some(cap) = regex::Regex::new(r#"<RequiresSession>(true|false)</RequiresSession>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                requires_session = Some(cap.get(1).map(|m| m.as_str() == "true").unwrap_or(false));
            }
            if let Some(cap) = regex::Regex::new(r#"<RequiresDuplicateDetection>(true|false)</RequiresDuplicateDetection>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                requires_duplicate_detection = Some(cap.get(1).map(|m| m.as_str() == "true").unwrap_or(false));
            }
            if let Some(cap) = regex::Regex::new(r#"<SizeInBytes>(\d+)</SizeInBytes>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                size_in_bytes = cap[1].parse().ok();
            }
        }
        
        Ok(QueueProperties {
            name: entry.title.clone(),
            max_size_in_megabytes,
            lock_duration_in_seconds,
            max_delivery_count,
            default_message_time_to_live_in_seconds,
            dead_lettering_on_message_expiration,
            duplicate_detection_history_time_window_in_seconds,
            enable_batched_operations,
            enable_partitioning,
            requires_session,
            requires_duplicate_detection,
            message_count,
            active_message_count,
            dead_letter_message_count,
            scheduled_message_count,
            transfer_message_count,
            transfer_dead_letter_message_count,
            size_in_bytes,
        })
    }

    fn queue_properties_to_xml(&self, queue_name: &str, properties: Option<&QueueProperties>, is_update: bool) -> Result<String, String> {
        // Helper function to convert seconds to ISO 8601 duration (PT30S format)
        fn seconds_to_duration(seconds: u64) -> String {
            if seconds < 60 {
                format!("PT{}S", seconds)
            } else if seconds < 3600 {
                let minutes = seconds / 60;
                let secs = seconds % 60;
                if secs == 0 {
                    format!("PT{}M", minutes)
                } else {
                    format!("PT{}M{}S", minutes, secs)
                }
            } else {
                let hours = seconds / 3600;
                let remainder = seconds % 3600;
                let minutes = remainder / 60;
                let secs = remainder % 60;
                if minutes == 0 && secs == 0 {
                    format!("PT{}H", hours)
                } else if secs == 0 {
                    format!("PT{}H{}M", hours, minutes)
                } else {
                    format!("PT{}H{}M{}S", hours, minutes, secs)
                }
            }
        }
        
        let mut xml = String::from(r#"<?xml version="1.0" encoding="utf-8"?><entry xmlns="http://www.w3.org/2005/Atom"><title>"#);
        xml.push_str(queue_name);
        xml.push_str(r#"</title><content type="application/xml"><QueueDescription xmlns="http://schemas.microsoft.com/netservices/2010/10/servicebus/connect">"#);
        
        if let Some(props) = properties {
            if let Some(max_size) = props.max_size_in_megabytes {
                xml.push_str(&format!("<MaxSizeInMegabytes>{}</MaxSizeInMegabytes>", max_size));
            }
            if let Some(lock_duration) = props.lock_duration_in_seconds {
                xml.push_str(&format!("<LockDuration>{}</LockDuration>", seconds_to_duration(lock_duration)));
            }
            if let Some(max_delivery) = props.max_delivery_count {
                xml.push_str(&format!("<MaxDeliveryCount>{}</MaxDeliveryCount>", max_delivery));
            }
            if let Some(ttl) = props.default_message_time_to_live_in_seconds {
                xml.push_str(&format!("<DefaultMessageTimeToLive>{}</DefaultMessageTimeToLive>", seconds_to_duration(ttl)));
            }
            if let Some(dead_letter) = props.dead_lettering_on_message_expiration {
                xml.push_str(&format!("<EnableDeadLetteringOnMessageExpiration>{}</EnableDeadLetteringOnMessageExpiration>", dead_letter));
            }
            if let Some(dup_window) = props.duplicate_detection_history_time_window_in_seconds {
                xml.push_str(&format!("<DuplicateDetectionHistoryTimeWindow>{}</DuplicateDetectionHistoryTimeWindow>", seconds_to_duration(dup_window)));
            }
            if let Some(batched) = props.enable_batched_operations {
                xml.push_str(&format!("<EnableBatchedOperations>{}</EnableBatchedOperations>", batched));
            }
            // Immutable properties - only include when creating, not when updating
            if !is_update {
                if let Some(partitioning) = props.enable_partitioning {
                    xml.push_str(&format!("<EnablePartitioning>{}</EnablePartitioning>", partitioning));
                }
                if let Some(session) = props.requires_session {
                    xml.push_str(&format!("<RequiresSession>{}</RequiresSession>", session));
                }
                if let Some(dup_detection) = props.requires_duplicate_detection {
                    xml.push_str(&format!("<RequiresDuplicateDetection>{}</RequiresDuplicateDetection>", dup_detection));
                }
            }
        }
        
        xml.push_str(r#"</QueueDescription></content></entry>"#);
        
        Ok(xml)
    }

    fn topic_entry_to_properties(&self, entry: &TopicEntry) -> Result<TopicProperties, String> {
        Ok(TopicProperties {
            name: entry.title.clone(),
            max_size_in_megabytes: None,
            default_message_time_to_live_in_seconds: None,
            duplicate_detection_history_time_window_in_seconds: None,
            enable_batched_operations: None,
            enable_partitioning: None,
            requires_duplicate_detection: None,
            size_in_bytes: None,
            subscription_count: None,
        })
    }

    fn topic_properties_to_xml(&self, topic_name: &str, _properties: Option<&TopicProperties>) -> Result<String, String> {
        Ok(format!(r#"<?xml version="1.0" encoding="utf-8"?><entry xmlns="http://www.w3.org/2005/Atom"><title>{}</title></entry>"#, topic_name))
    }

    fn subscription_entry_to_properties(&self, topic_name: &str, entry: &SubscriptionEntry) -> Result<SubscriptionProperties, String> {
        // Parse message counts from content XML
        let mut message_count: Option<u64> = None;
        let mut active_message_count: Option<u64> = None;
        let mut dead_letter_message_count: Option<u64> = None;
        let mut transfer_message_count: Option<u64> = None;
        let mut transfer_dead_letter_message_count: Option<u64> = None;
        
        if let Some(ref content) = entry.content {
            // Extract counts from CountDetails using regex
            // Format: <d2p1:ActiveMessageCount>0</d2p1:ActiveMessageCount>
            if let Some(cap) = regex::Regex::new(r#"<d2p1:ActiveMessageCount>(\d+)</d2p1:ActiveMessageCount>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                active_message_count = cap[1].parse().ok();
            }
            if let Some(cap) = regex::Regex::new(r#"<d2p1:DeadLetterMessageCount>(\d+)</d2p1:DeadLetterMessageCount>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                dead_letter_message_count = cap[1].parse().ok();
            }
            if let Some(cap) = regex::Regex::new(r#"<d2p1:TransferMessageCount>(\d+)</d2p1:TransferMessageCount>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                transfer_message_count = cap[1].parse().ok();
            }
            if let Some(cap) = regex::Regex::new(r#"<d2p1:TransferDeadLetterMessageCount>(\d+)</d2p1:TransferDeadLetterMessageCount>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                transfer_dead_letter_message_count = cap[1].parse().ok();
            }
            // Also check for MessageCount (total)
            if let Some(cap) = regex::Regex::new(r#"<MessageCount>(\d+)</MessageCount>"#)
                .ok()
                .and_then(|re| re.captures(content))
            {
                message_count = cap[1].parse().ok();
            }
        }
        
        Ok(SubscriptionProperties {
            topic_name: topic_name.to_string(),
            subscription_name: entry.title.clone(),
            max_delivery_count: None,
            lock_duration_in_seconds: None,
            default_message_time_to_live_in_seconds: None,
            dead_lettering_on_message_expiration: None,
            enable_batched_operations: None,
            requires_session: None,
            message_count,
            active_message_count,
            dead_letter_message_count,
            transfer_message_count,
            transfer_dead_letter_message_count,
        })
    }

    fn subscription_properties_to_xml(&self, _topic_name: &str, subscription_name: &str, _properties: Option<&SubscriptionProperties>) -> Result<String, String> {
        Ok(format!(r#"<?xml version="1.0" encoding="utf-8"?><entry xmlns="http://www.w3.org/2005/Atom"><title>{}</title></entry>"#, subscription_name))
    }
}

// XML structures for parsing Azure Service Bus responses
// These are used by the REST API implementation (peek_messages_rest)
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct QueueFeed {
    #[serde(rename = "entry", default)]
    entries: Vec<QueueEntry>,
    // Links can be at feed level - try both approaches
    #[serde(rename = "link", default)]
    #[allow(dead_code)]
    links: Vec<FeedLink>,
    // Also try with namespace prefix
    #[serde(rename = "{http://www.w3.org/2005/Atom}link", default)]
    #[allow(dead_code)]
    links_ns: Vec<FeedLink>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct FeedLink {
    // serde_xml_rs uses @attribute syntax for attributes
    // But it might need the attribute name without @ prefix
    #[serde(rename = "@rel")]
    rel: Option<String>,
    #[serde(rename = "@href")]
    href: Option<String>,
    // Try alternative field names in case serde_xml_rs handles it differently
    #[serde(rename = "rel", default)]
    #[allow(dead_code)]
    rel_alt: Option<String>,
    #[serde(rename = "href", default)]
    #[allow(dead_code)]
    href_alt: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
struct QueueEntry {
    title: String,
    #[serde(skip)]
    content: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct TopicFeed {
    #[serde(rename = "entry", default)]
    entries: Vec<TopicEntry>,
    #[serde(rename = "link", default)]
    links: Vec<FeedLink>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct TopicEntry {
    title: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct SubscriptionFeed {
    #[serde(rename = "entry", default)]
    entries: Vec<SubscriptionEntry>,
    #[serde(rename = "link", default)]
    links: Vec<FeedLink>,
}

#[derive(Debug, Deserialize)]
struct MessageFeed {
    #[serde(rename = "entry", default)]
    entries: Vec<MessageEntry>,
}

#[derive(Debug, Deserialize)]
struct MessageEntry {
    #[serde(rename = "title", default)]
    #[allow(dead_code)]
    title: Option<String>,
    #[serde(rename = "content", default)]
    content: Option<String>,
    #[serde(rename = "BrokerProperties", default)]
    broker_properties: Option<String>,
    #[serde(rename = "MessageId", default)]
    message_id: Option<String>,
    #[serde(rename = "CorrelationId", default)]
    correlation_id: Option<String>,
    #[serde(rename = "ContentType", default)]
    content_type: Option<String>,
    #[serde(rename = "SequenceNumber", default)]
    sequence_number: Option<i64>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
struct SubscriptionEntry {
    title: String,
    #[serde(skip)]
    content: Option<String>,
}

