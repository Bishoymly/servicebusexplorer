# macOS Code Signing Guide (Without Paid Developer Account)

This guide explains how to handle macOS code signing for your Tauri app when you don't have a paid Apple Developer account.

## Options Overview

### Option 1: Ad-Hoc Signing (Recommended for CI/CD) ✅
**Cost:** Free  
**Best for:** CI/CD builds, testing, personal distribution  
**Limitations:** Users will see "unidentified developer" warning

### Option 2: Skip DMG Creation (Simplest) ✅
**Cost:** Free  
**Best for:** When you just need the app bundle  
**Limitations:** No DMG installer, users need to manually install .app

### Option 3: Self-Signed Certificate (Local Only)
**Cost:** Free  
**Best for:** Local development/testing only  
**Limitations:** Won't work in CI, users see security warnings

### Option 4: Free Apple Developer Account
**Cost:** Free  
**Best for:** Basic signing for personal use  
**Limitations:** Still shows warnings, no notarization

---

## Option 1: Ad-Hoc Signing (Recommended)

Ad-hoc signing uses the identity `-` and doesn't require any certificates. This works in CI/CD.

### For GitHub Actions CI:

The workflow is already configured to use ad-hoc signing. No additional setup needed!

**How it works:**
- Tauri will automatically use ad-hoc signing if no certificate is provided
- The app will be signed with identity `-`
- Users will see a security warning but can still run the app

**User experience:**
1. User downloads DMG
2. macOS shows "unidentified developer" warning
3. User can right-click → Open to bypass, or go to System Settings → Privacy & Security → Allow

---

## Option 2: Skip DMG Creation (Simplest)

If DMG creation is causing issues, you can configure Tauri to only build the app bundle.

### Update `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "active": true,
    "targets": ["app"],  // Only build .app, skip DMG
    "icon": [...]
  }
}
```

**Pros:**
- No signing needed
- Simpler build process
- App bundle works fine for distribution

**Cons:**
- No DMG installer
- Users need to manually copy .app to Applications

---

## Option 3: Create Free Apple Developer Account

Even without a paid account, you can create a free Apple ID and use it for basic signing.

### Steps:

1. **Create Apple ID** (if you don't have one):
   - Go to https://appleid.apple.com
   - Create a free account

2. **Add Apple ID to Xcode** (on your Mac):
   ```bash
   # Open Xcode
   # Xcode → Settings → Accounts
   # Click + → Add Apple ID
   # Enter your Apple ID credentials
   ```

3. **Create Development Certificate**:
   - In Xcode Accounts tab, select your Apple ID
   - Click "Manage Certificates"
   - Click + → "Apple Development"
   - Certificate will be created automatically

4. **Export Certificate for CI**:
   ```bash
   # Find your certificate in Keychain Access
   # Right-click → Export → Save as .p12
   # Set a password
   ```

5. **Add to GitHub Secrets**:
   - `APPLE_CERTIFICATE`: Base64 encode the .p12 file
     ```bash
     base64 -i certificate.p12 | pbcopy
     ```
   - `APPLE_CERTIFICATE_PASSWORD`: The password you set
   - `APPLE_SIGNING_IDENTITY`: Usually "Apple Development: Your Name (TEAM_ID)"
   - `APPLE_TEAM_ID`: Found in Xcode → Accounts → Your Apple ID

**Note:** Free accounts still show warnings, but it's better than ad-hoc signing.

---

## Option 4: Self-Signed Certificate (Local Only)

This only works for local builds, not CI/CD.

### Steps:

1. **Create Self-Signed Certificate**:
   ```bash
   # Open Keychain Access
   # Keychain Access → Certificate Assistant → Create a Certificate
   # Name: "Developer ID Application: Your Name"
   # Identity Type: Self Signed Root
   # Certificate Type: Code Signing
   # Check "Let me override defaults"
   # Continue through prompts
   ```

2. **Use for Local Builds**:
   ```bash
   # Sign the app manually after build
   codesign --deep --force --verify --verbose \
     --sign "Developer ID Application: Your Name" \
     "src-tauri/target/release/bundle/macos/YourApp.app"
   ```

**Limitations:**
- Only works locally
- Users will see security warnings
- Not suitable for distribution

---

## Recommended Approach for Your Project

**For GitHub Actions CI (Current Setup):**

✅ **Use Option 1 (Ad-Hoc Signing)** - Already configured!

The workflow will:
1. Build the app with ad-hoc signing (identity `-`)
2. Create DMG (if possible)
3. Users can run the app after allowing it in System Settings

**If DMG creation still fails:**

Use **Option 2** - Configure Tauri to skip DMG:

```json
"bundle": {
  "targets": ["app"]  // Only .app bundle
}
```

Then users can:
1. Download the .app from GitHub Releases
2. Drag it to Applications folder
3. Right-click → Open (first time only)

---

## Testing Locally

To test ad-hoc signing locally:

```bash
# Build without signing
npm run tauri:build

# Sign with ad-hoc identity
codesign --deep --force --sign "-" \
  "src-tauri/target/release/bundle/macos/Azure Service Bus Explorer.app"

# Verify signing
codesign --verify --verbose \
  "src-tauri/target/release/bundle/macos/Azure Service Bus Explorer.app"
```

---

## When You Need Proper Signing

If you want to distribute without warnings, you'll need:

1. **Apple Developer Program** ($99/year)
   - Provides Developer ID certificates
   - Enables notarization
   - No security warnings for users

2. **Set up in GitHub Secrets** (same as Option 3, but with paid account certificates)

---

## Current Status

Your GitHub Actions workflow is configured to:
- ✅ Use ad-hoc signing automatically (no setup needed)
- ✅ Build DMG if possible
- ✅ Fall back gracefully if DMG creation fails

**Next Steps:**
1. Test the build in GitHub Actions
2. If DMG creation fails, consider Option 2 (skip DMG)
3. For production distribution, consider getting a Developer account

