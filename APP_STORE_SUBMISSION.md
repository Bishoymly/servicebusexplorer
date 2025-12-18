# macOS App Store Submission Guide

This guide explains how to prepare and submit your Tauri app to the macOS App Store.

## Prerequisites

1. **Apple Developer Program Membership** ($99/year)
   - Active Apple Developer account
   - Access to App Store Connect

2. **App Store Connect Setup**
   - Create your app in App Store Connect
   - Get your App Store Connect API key (optional, but recommended)

## Key Differences from Direct Distribution

| Aspect | Direct Distribution (Current) | App Store |
|--------|------------------------------|-----------|
| Certificate | Developer ID Application | Apple Distribution |
| Bundle Target | `dmg` | `app-store` |
| Notarization | Required (manual) | Automatic (via App Store) |
| Sandboxing | Optional | **Required** |
| Provisioning Profile | Not needed | **Required** |
| Entitlements | Minimal | App Sandbox required |

## Step-by-Step Setup

### 1. Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Click **My Apps** → **+** → **New App**
3. Select **macOS**
4. Fill in:
   - **Name**: Azure Service Bus Explorer
   - **Primary Language**: English
   - **Bundle ID**: `com.servicebusexplorer.app` (must match your `identifier` in `tauri.conf.json`)
   - **SKU**: A unique identifier (e.g., `servicebusexplorer-001`)
5. Click **Create**

### 2. Create App Store Provisioning Profile

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Go to **Profiles** → Click **+**
4. Select **macOS App Store** under **Distribution**
5. Select your App ID (`com.servicebusexplorer.app`)
6. Select your **Apple Distribution** certificate
7. Name it (e.g., "Azure Service Bus Explorer App Store")
8. Click **Generate** → **Download** the `.provisionprofile` file
9. Save it as `src-tauri/embedded.provisionprofile`

### 3. Create Apple Distribution Certificate

1. In Apple Developer Portal → **Certificates**
2. Click **+** → Select **Apple Distribution** (under macOS)
3. Upload a Certificate Signing Request (CSR):
   - Open **Keychain Access**
   - **Certificate Assistant** → **Request a Certificate From a Certificate Authority**
   - Enter your email and name
   - Select **Saved to disk**
   - Save the `.certSigningRequest` file
4. Upload the CSR in the portal
5. Download the `.cer` file and double-click to install in Keychain

### 4. Create Entitlements File

Create `src-tauri/Entitlements.plist` with App Sandbox enabled:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

**Note**: App Sandbox restricts file system access. Your app may need additional entitlements depending on functionality.

### 5. Update Tauri Configuration

Update `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "targets": ["app-store"],  // Changed from ["dmg"]
    "macOS": {
      "entitlements": "Entitlements.plist",
      "files": {
        "embedded.provisionprofile": "embedded.provisionprofile"
      },
      "category": "public.app-category.developer-tools"  // Or appropriate category
    }
  }
}
```

### 6. Get Your Signing Identity

Run this command to find your Apple Distribution certificate:

```bash
security find-identity -v -p codesigning | grep "Apple Distribution"
```

You'll see something like:
```
Apple Distribution: Your Name (TEAM_ID)
```

This is your `APPLE_SIGNING_IDENTITY` for App Store builds.

### 7. Update GitHub Secrets (for CI/CD)

Update your GitHub secrets:

- **`APPLE_SIGNING_IDENTITY`**: Change to your Apple Distribution identity
  - Example: `Apple Distribution: Your Name (TEAM_ID)`
- **`APPLE_CERTIFICATE`**: Export your Apple Distribution certificate as .p12
- Keep `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` the same

**Optional - Use App Store Connect API Keys** (more secure):

Instead of app-specific password, you can use API keys:

1. Go to App Store Connect → **Users and Access** → **Keys**
2. Click **+** → Create a new key with **App Manager** or **Admin** role
3. Download the `.p8` key file
4. Note the **Key ID** and **Issuer ID**
5. Add to GitHub Secrets:
   - `APPLE_API_KEY`: Your Key ID
   - `APPLE_API_ISSUER`: Your Issuer ID  
   - `APPLE_API_KEY_PATH`: Base64-encoded .p8 file content

### 8. Build for App Store

**Local Build:**

```bash
npm run build
npm run tauri build -- --bundles app-store --target universal-apple-darwin
```

This creates a signed `.app` bundle in:
`src-tauri/target/universal-apple-darwin/release/bundle/app-store/`

**CI/CD Build:**

Update your GitHub Actions workflow to use `app-store` target:

```yaml
- name: Build Tauri app for App Store
  uses: tauri-apps/tauri-action@v0
  env:
    APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}  # Apple Distribution
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
  with:
    projectPath: .
    args: --bundles app-store --target universal-apple-darwin
```

### 9. Create Archive and Upload

**Option A: Using Xcode (Recommended)**

1. Open Xcode → **Window** → **Organizer**
2. Click **+** → **Distribute App**
3. Select **App Store Connect**
4. Choose **Upload**
5. Select your `.app` bundle
6. Follow the wizard to upload

**Option B: Using `altool` (Command Line)**

```bash
xcrun altool --upload-app \
  --type macos \
  --file "src-tauri/target/universal-apple-darwin/release/bundle/app-store/Azure Service Bus Explorer.app" \
  --apiKey YOUR_API_KEY \
  --apiIssuer YOUR_ISSUER_ID
```

**Option C: Using `notarytool` (Newer)**

```bash
xcrun notarytool submit \
  "Azure Service Bus Explorer.app" \
  --key-path path/to/AuthKey_KEYID.p8 \
  --key-id YOUR_KEY_ID \
  --issuer YOUR_ISSUER_ID \
  --wait
```

### 10. Submit for Review

1. Go to App Store Connect → Your App
2. Click **+ Version** or select your build
3. Fill in:
   - **Version**: Match your `tauri.conf.json` version
   - **What's New**: Release notes
   - **Screenshots**: Required (at least 1)
   - **Description**: App description
   - **Keywords**: Search keywords
   - **Support URL**: Your support website
   - **Marketing URL** (optional): Your marketing site
4. Select your build
5. Answer App Review questions
6. Click **Submit for Review**

## App Sandbox Considerations

App Sandbox restricts your app's capabilities. You may need to:

1. **Network Access**: Already included in entitlements
2. **File Access**: Limited to user-selected files or specific directories
3. **System Access**: Restricted - you can't access system files
4. **Local Server**: Your Next.js server running on localhost should work, but test thoroughly

**Common Issues:**

- **File System**: Can't write to arbitrary locations
- **Network**: Outbound connections work, inbound may be restricted
- **System Integration**: Limited access to system APIs

## Testing Before Submission

1. **Test on Clean macOS**: Install on a Mac without your development tools
2. **Test Sandbox Restrictions**: Ensure all features work within sandbox
3. **Test Network**: Verify Azure Service Bus connections work
4. **Test File Operations**: If your app saves files, test user-selected file access

## Version Management

Update version in three places:

1. `package.json`: `"version": "1.0.0"`
2. `src-tauri/Cargo.toml`: `version = "1.0.0"`
3. `src-tauri/tauri.conf.json`: `"version": "1.0.0"`

Version must match App Store Connect.

## Troubleshooting

### "Invalid Bundle" Error

- Ensure `identifier` matches App Store Connect Bundle ID exactly
- Verify provisioning profile is correct
- Check entitlements file is valid

### "Code Signing Failed"

- Verify Apple Distribution certificate is installed
- Check signing identity matches exactly
- Ensure provisioning profile matches Bundle ID

### "Sandbox Violation"

- Review entitlements file
- Add necessary entitlements for your app's functionality
- Test thoroughly in sandboxed environment

### Build Fails with "app-store target not found"

- Ensure you're using Tauri v2
- Update `@tauri-apps/cli` to latest version
- Check `tauri.conf.json` syntax

## Resources

- [Tauri App Store Distribution](https://v2.tauri.app/distribute/app-store/)
- [macOS App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Sandbox Design Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/AppSandboxDesignGuide/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)

## Next Steps

1. Create App Store Connect app
2. Set up certificates and provisioning profile
3. Create entitlements file
4. Update configuration
5. Build and test locally
6. Upload to App Store Connect
7. Submit for review

Good luck with your submission! 🚀

