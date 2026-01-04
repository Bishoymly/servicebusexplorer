use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceBusConnection {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connection_string: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "useAzureAD")]
    pub use_azure_ad: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueProperties {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_size_in_megabytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lock_duration_in_seconds: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_delivery_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_message_time_to_live_in_seconds: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dead_lettering_on_message_expiration: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duplicate_detection_history_time_window_in_seconds: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_batched_operations: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_partitioning: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires_session: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires_duplicate_detection: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_message_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dead_letter_message_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scheduled_message_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transfer_message_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transfer_dead_letter_message_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_in_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicProperties {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_size_in_megabytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_message_time_to_live_in_seconds: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duplicate_detection_history_time_window_in_seconds: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_batched_operations: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_partitioning: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires_duplicate_detection: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_in_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription_count: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionProperties {
    pub topic_name: String,
    pub subscription_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_delivery_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lock_duration_in_seconds: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_message_time_to_live_in_seconds: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dead_lettering_on_message_expiration: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_batched_operations: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires_session: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_message_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dead_letter_message_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transfer_message_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transfer_dead_letter_message_count: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceBusMessage {
    pub body: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_to_live: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub application_properties: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delivery_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enqueued_time_utc: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locked_until_utc: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sequence_number: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dead_letter_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dead_letter_error_description: Option<String>,
}

