# StoreKit Integration Implementation

## Overview

Full StoreKit integration has been implemented for macOS App Store purchases. The system uses receipt validation to verify purchases.

## Implementation Details

### Files Created/Modified

1. **`src-tauri/src/storekit.rs`** - New StoreKit module
   - Receipt reading from app bundle
   - Receipt verification with Apple's servers
   - Purchase status checking
   - Purchase initiation

2. **`src-tauri/src/main.rs`** - Updated Tauri commands
   - `check_license_status()` - Now checks actual App Store receipts
   - `initiate_purchase()` - Uses StoreKit module
   - `verify_receipt()` - Full receipt verification implementation

3. **`src-tauri/Cargo.toml`** - Added dependencies
   - `reqwest` - HTTP client for receipt verification
   - `base64` - Base64 encoding for receipt data

### Features Implemented

#### 1. Receipt Reading
- Reads App Store receipt from `Contents/_MASReceipt/receipt` in app bundle
- Handles both development and production builds
- Returns receipt data as `Vec<u8>`

#### 2. Receipt Verification
- Base64 encodes receipt data
- Verifies with Apple's servers:
  - Production: `https://buy.itunes.apple.com/verifyReceipt`
  - Sandbox: `https://sandbox.itunes.apple.com/verifyReceipt`
- Automatically tries both endpoints (production first in release, sandbox first in debug)
- Parses JSON response and checks for valid transactions
- Validates product ID matches `com.bishoylabib.servicebusexplorer.full`

#### 3. Purchase Status Checking
- Checks if receipt exists
- Verifies receipt with Apple's servers
- Returns `true` if valid purchase found, `false` otherwise

#### 4. Purchase Initiation
- Opens App Store page for the app
- Uses `macappstore://` URL scheme
- Falls back gracefully if App Store not available

### How It Works

1. **On App Launch:**
   - `check_license_status()` is called
   - Reads receipt from app bundle
   - Verifies receipt with Apple's servers
   - Returns purchase status

2. **Purchase Flow:**
   - User clicks "Purchase" button
   - `initiate_purchase()` opens App Store
   - User completes purchase in App Store
   - App detects receipt and verifies on next launch

3. **Receipt Verification:**
   - Receipt is read from `Contents/_MASReceipt/receipt`
   - Base64 encoded and sent to Apple's servers
   - Response parsed for transaction data
   - Product ID checked against expected value

### Status Codes Handled

- `0` - Valid receipt, checks for product ID
- `21007` - Receipt is from sandbox (tries sandbox endpoint)
- `21008` - Receipt is from production (tries production endpoint)
- Other codes - Invalid receipt

### Limitations

1. **StoreKit 2 Not Fully Implemented**
   - Currently uses receipt validation (StoreKit 1 approach)
   - StoreKit 2 Transaction APIs would require Swift/Objective-C bridge
   - Receipt validation works for all macOS versions

2. **In-App Purchase Flow**
   - Currently opens App Store page instead of in-app purchase
   - Full StoreKit 2 implementation would allow in-app purchases
   - Works for non-consumable products distributed via App Store

3. **Shared Secret**
   - Currently uses empty password for receipt verification
   - Can be configured in App Store Connect and added to code
   - Not required for basic verification

### Testing

#### Development/Testing
- In debug builds, tries sandbox endpoint first
- Can test with sandbox test accounts
- Receipt may not exist in development builds (expected)

#### Production
- Tries production endpoint first
- Verifies actual App Store receipts
- Works with real purchases

### Next Steps (Optional Enhancements)

1. **StoreKit 2 Transaction APIs**
   - Implement native StoreKit 2 using Swift/Objective-C bridge
   - Enable in-app purchase flow
   - Real-time transaction updates

2. **Shared Secret Configuration**
   - Add shared secret from App Store Connect
   - Improves receipt security

3. **Transaction History**
   - Store transaction IDs locally
   - Prevent duplicate verification
   - Better purchase tracking

4. **Offline Support**
   - Cache verified purchase status
   - Verify when online, use cache when offline

## Usage

The StoreKit integration is automatically used by the license system:

- `check_license_status()` - Checks purchase status via receipts
- `verify_receipt()` - Manually verify receipt
- `initiate_purchase()` - Open App Store for purchase

No additional configuration needed - works automatically when app is distributed via App Store.

## Notes

- Receipts only exist in App Store distributed apps
- Development builds won't have receipts (normal behavior)
- Sandbox testing requires sandbox test accounts
- Production verification requires actual App Store purchase

