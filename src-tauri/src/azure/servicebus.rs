use crate::azure::auth::{
    generate_sas_token, get_namespace_from_endpoint, get_endpoint_domain, parse_connection_string,
    ParsedConnectionString,
};
use crate::azure::types::*;
use reqwest::Client;
use serde::Deserialize;
use serde_xml_rs::from_str;

const API_VERSION: &str = "2021-05";

pub struct ServiceBusClient {
    client: Client,
    namespace: String,
    endpoint_domain: String,
    parsed_connection: Option<ParsedConnectionString>,
    use_azure_ad: bool,
}

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

            for entry in feed.entries {
                let props = self.queue_entry_to_properties(&entry)?;
                all_queues.push(props);
            }

            eprintln!("[list_queues] Total queues so far: {}", all_queues.len());

            // Use the manually extracted next link
            if let Some(href) = next_link_href {
                eprintln!("[list_queues] Following next link: {}", href);
                
                // href is already a full URL from Azure
                if let Some(href) = href.strip_prefix("http") {
                    url = format!("http{}", href);
                } else {
                    url = href;
                }
                eprintln!("[list_queues] Next page URL: {}", url);
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
        let entry: QueueEntry = from_str(&xml).map_err(|e| format!("Failed to parse XML: {}", e))?;

        self.queue_entry_to_properties(&entry)
    }

    pub async fn create_queue(&self, queue_name: &str, properties: Option<&QueueProperties>) -> Result<(), String> {
        let url = format!("{}/{}?api-version={}", self.get_base_url(), queue_name, API_VERSION);
        let auth_header = self.get_auth_header(&url).await?;

        let xml = self.queue_properties_to_xml(queue_name, properties)?;

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
        
        // Merge properties
        let merged = QueueProperties {
            name: properties.name.clone(),
            max_size_in_megabytes: properties.max_size_in_megabytes.or(existing.max_size_in_megabytes),
            lock_duration_in_seconds: properties.lock_duration_in_seconds.or(existing.lock_duration_in_seconds),
            max_delivery_count: properties.max_delivery_count.or(existing.max_delivery_count),
            default_message_time_to_live_in_seconds: properties.default_message_time_to_live_in_seconds.or(existing.default_message_time_to_live_in_seconds),
            dead_lettering_on_message_expiration: properties.dead_lettering_on_message_expiration.or(existing.dead_lettering_on_message_expiration),
            duplicate_detection_history_time_window_in_seconds: properties.duplicate_detection_history_time_window_in_seconds.or(existing.duplicate_detection_history_time_window_in_seconds),
            enable_batched_operations: properties.enable_batched_operations.or(existing.enable_batched_operations),
            enable_partitioning: properties.enable_partitioning.or(existing.enable_partitioning),
            requires_session: properties.requires_session.or(existing.requires_session),
            requires_duplicate_detection: properties.requires_duplicate_detection.or(existing.requires_duplicate_detection),
            message_count: existing.message_count,
            active_message_count: existing.active_message_count,
            dead_letter_message_count: existing.dead_letter_message_count,
            scheduled_message_count: existing.scheduled_message_count,
            transfer_message_count: existing.transfer_message_count,
            transfer_dead_letter_message_count: existing.transfer_dead_letter_message_count,
            size_in_bytes: existing.size_in_bytes,
        };

        self.create_queue(queue_name, Some(&merged)).await
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

            for entry in feed.entries {
                let props = self.subscription_entry_to_properties(topic_name, &entry)?;
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

    // Message operations
    pub async fn peek_messages(
        &self,
        queue_name: Option<&str>,
        topic_name: Option<&str>,
        subscription_name: Option<&str>,
        max_count: u32,
    ) -> Result<Vec<ServiceBusMessage>, String> {
        let entity_path = if let Some(q) = queue_name {
            q.to_string()
        } else if let (Some(t), Some(s)) = (topic_name, subscription_name) {
            format!("{}/Subscriptions/{}", t, s)
        } else {
            return Err("Either queue_name or (topic_name and subscription_name) must be provided".to_string());
        };

        // Azure Service Bus peek uses GET request, not POST
        // Format: /{entity-path}/messages/head?timeout={seconds}&maxcount={count}&api-version={version}
        let base_url = format!("{}/{}/messages/head?timeout=60&api-version={}", self.get_base_url(), entity_path, API_VERSION);

        let mut all_messages = Vec::new();
        let max_per_request = max_count.min(32); // Azure allows max 32 messages per peek
        let mut sequence_number: Option<i64> = None; // For pagination

        loop {
            let remaining = max_count as usize - all_messages.len();
            if remaining == 0 {
                break;
            }
            
            let count = remaining.min(max_per_request as usize);
            let mut peek_url = format!("{}&maxcount={}", base_url, count);
            
            // Add from parameter for pagination if we have a sequence number
            if let Some(seq) = sequence_number {
                peek_url = format!("{}&from={}", peek_url, seq);
            }
            
            // Update auth header for the new URL
            let auth_header = self.get_auth_header(&peek_url).await?;
            
            let response = self
                .client
                .get(&peek_url)
                .header("Authorization", &auth_header)
                .send()
                .await
                .map_err(|e| format!("Failed to peek messages: {}", e))?;

            let status = response.status();
            if !status.is_success() {
                if status.as_u16() == 204 {
                    // No messages
                    break;
                }
                let error_text = response.text().await.unwrap_or_default();
                return Err(format!("Failed to peek messages: {} - {}", status, error_text));
            }

            // Parse messages from response
            // Azure Service Bus returns messages in Atom feed format
            let xml = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
            
            // Parse the Atom feed
            // The response is an Atom feed with <entry> elements containing messages
            // Each entry has message properties in BrokerProperties header and body in content
            let feed: MessageFeed = from_str(&xml).map_err(|e| format!("Failed to parse message feed: {}", e))?;
            
            let entry_count = feed.entries.len();
            if entry_count == 0 {
                // No more messages
                break;
            }
            
            for entry in &feed.entries {
                let message = self.message_entry_to_message(entry)?;
                all_messages.push(message);
            }
            
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

    pub async fn send_message(
        &self,
        queue_name: Option<&str>,
        topic_name: Option<&str>,
        message: &ServiceBusMessage,
    ) -> Result<(), String> {
        let entity_path = if let Some(q) = queue_name {
            q.to_string()
        } else if let Some(t) = topic_name {
            t.to_string()
        } else {
            return Err("Either queue_name or topic_name must be provided".to_string());
        };

        let url = format!("{}/{}/messages?api-version={}", self.get_base_url(), entity_path, API_VERSION);
        let auth_header = self.get_auth_header(&url).await?;

        // Build message headers
        let mut headers = reqwest::header::HeaderMap::new();
        if let Some(msg_id) = &message.message_id {
            headers.insert("BrokerProperties", format!(r#"{{"MessageId":"{}"}}"#, msg_id).parse().unwrap());
        }
        if let Some(content_type) = &message.content_type {
            headers.insert("Content-Type", content_type.parse().unwrap());
        }

        let body = serde_json::to_string(&message.body).map_err(|e| format!("Failed to serialize message body: {}", e))?;

        let response = self
            .client
            .post(&url)
            .header("Authorization", &auth_header)
            .headers(headers)
            .body(body)
            .send()
            .await
            .map_err(|e| format!("Failed to send message: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to send message: {} - {}", status, error_text));
        }

        Ok(())
    }

    pub async fn purge_queue(&self, _queue_name: &str, _purge_dead_letter: bool) -> Result<u32, String> {
        // Purge by receiving and completing messages
        // This is a simplified implementation
        // Full implementation would use receive-lock-complete pattern
        Ok(0) // Placeholder
    }

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
        // Parse XML entry to QueueProperties
        // This is a simplified version - full implementation would parse all XML fields
        Ok(QueueProperties {
            name: entry.title.clone(),
            max_size_in_megabytes: None,
            lock_duration_in_seconds: None,
            max_delivery_count: None,
            default_message_time_to_live_in_seconds: None,
            dead_lettering_on_message_expiration: None,
            duplicate_detection_history_time_window_in_seconds: None,
            enable_batched_operations: None,
            enable_partitioning: None,
            requires_session: None,
            requires_duplicate_detection: None,
            message_count: None,
            active_message_count: None,
            dead_letter_message_count: None,
            scheduled_message_count: None,
            transfer_message_count: None,
            transfer_dead_letter_message_count: None,
            size_in_bytes: None,
        })
    }

    fn queue_properties_to_xml(&self, queue_name: &str, _properties: Option<&QueueProperties>) -> Result<String, String> {
        // Generate XML for queue creation/update
        // This is a simplified version - full implementation would generate proper XML
        Ok(format!(r#"<?xml version="1.0" encoding="utf-8"?><entry xmlns="http://www.w3.org/2005/Atom"><title>{}</title></entry>"#, queue_name))
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
        Ok(SubscriptionProperties {
            topic_name: topic_name.to_string(),
            subscription_name: entry.title.clone(),
            max_delivery_count: None,
            lock_duration_in_seconds: None,
            default_message_time_to_live_in_seconds: None,
            dead_lettering_on_message_expiration: None,
            enable_batched_operations: None,
            requires_session: None,
            message_count: None,
            active_message_count: None,
            dead_letter_message_count: None,
            transfer_message_count: None,
            transfer_dead_letter_message_count: None,
        })
    }

    fn subscription_properties_to_xml(&self, _topic_name: &str, subscription_name: &str, _properties: Option<&SubscriptionProperties>) -> Result<String, String> {
        Ok(format!(r#"<?xml version="1.0" encoding="utf-8"?><entry xmlns="http://www.w3.org/2005/Atom"><title>{}</title></entry>"#, subscription_name))
    }
}

// XML structures for parsing Azure Service Bus responses
#[derive(Debug, Deserialize)]
struct QueueFeed {
    #[serde(rename = "entry", default)]
    entries: Vec<QueueEntry>,
    // Links can be at feed level - try both approaches
    #[serde(rename = "link", default)]
    links: Vec<FeedLink>,
    // Also try with namespace prefix
    #[serde(rename = "{http://www.w3.org/2005/Atom}link", default)]
    links_ns: Vec<FeedLink>,
}

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
    rel_alt: Option<String>,
    #[serde(rename = "href", default)]
    href_alt: Option<String>,
}

#[derive(Debug, Deserialize)]
struct QueueEntry {
    title: String,
    // Add other fields as needed
}

#[derive(Debug, Deserialize)]
struct TopicFeed {
    #[serde(rename = "entry", default)]
    entries: Vec<TopicEntry>,
    #[serde(rename = "link", default)]
    links: Vec<FeedLink>,
}

#[derive(Debug, Deserialize)]
struct TopicEntry {
    title: String,
}

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

#[derive(Debug, Deserialize)]
struct SubscriptionEntry {
    title: String,
}

