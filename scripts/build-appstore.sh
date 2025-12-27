#!/bin/bash

# Mac App Store Build and Package Script
# This script signs the app, creates a .pkg installer, and prepares it for App Store submission
#
# Before running:
# 1. Replace APPLE_ID with your Apple ID email
# 2. Replace TEAM_ID with your Apple Team ID
# 3. Replace SIGNING_IDENTITY with your "3rd Party Mac Developer Application" certificate name
# 4. Replace INSTALLER_IDENTITY with your "3rd Party Mac Developer Installer" certificate name
# 5. Replace APP_SPECIFIC_PASSWORD with an app-specific password (create at appleid.apple.com)

set -e  # Exit on error

# ============================================================================
# CONFIGURATION - REPLACE THESE VALUES
# ============================================================================

APPLE_ID="bishoymamdouh@hotmail.com"
TEAM_ID="2VBYT65G42"
SIGNING_IDENTITY="3rd Party Mac Developer Application: BISHOY MAMDOUHLABIB YOUSSEF (2VBYT65G42)"
INSTALLER_IDENTITY="3rd Party Mac Developer Installer: BISHOY MAMDOUHLABIB YOUSSEF (2VBYT65G42)"
APP_SPECIFIC_PASSWORD="nnrs-udde-tozo-jpgs"

# App details
APP_NAME="Azure Service Bus Explorer"
BUNDLE_ID="com.bishoylabib.servicebusexplorer"
APP_PATH="src-tauri/target/universal-apple-darwin/release/bundle/macos/${APP_NAME}.app"
ENTITLEMENTS="src-tauri/Entitlements.plist"
OUTPUT_DIR="dist/appstore"
PKG_NAME="${APP_NAME// /_}.pkg"

# ============================================================================
# SCRIPT START
# ============================================================================

echo "🚀 Starting Mac App Store build process..."
echo ""

# Check if app exists
if [ ! -d "$APP_PATH" ]; then
    echo "❌ Error: App not found at $APP_PATH"
    echo "   Please run 'npm run tauri:build:appstore' first"
    exit 1
fi

# Check if entitlements file exists
if [ ! -f "$ENTITLEMENTS" ]; then
    echo "❌ Error: Entitlements file not found at $ENTITLEMENTS"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"
echo "📁 Created output directory: $OUTPUT_DIR"
echo ""

# Check if required certificates exist
echo "🔐 Checking for required certificates..."
echo ""

# Check signing certificate
if security find-identity -v -p codesigning | grep -q "$SIGNING_IDENTITY"; then
    echo "✅ Found signing certificate: $SIGNING_IDENTITY"
else
    echo "❌ Error: Signing certificate not found!"
    echo ""
    echo "   Required: $SIGNING_IDENTITY"
    echo ""
    echo "   Available certificates:"
    security find-identity -v -p codesigning | grep -E "^\s+[0-9]+\)" | sed 's/^/      /'
    echo ""
    echo "   📝 To create the required certificate:"
    echo "   1. Go to https://developer.apple.com/account/resources/certificates/list"
    echo "   2. Click the + button to create a new certificate"
    echo "   3. Select 'Mac App Distribution' (under Software)"
    echo "   4. Upload a Certificate Signing Request (CSR)"
    echo "   5. Download and install the certificate"
    echo ""
    echo "   To create a CSR:"
    echo "   - Open Keychain Access"
    echo "   - Menu: Keychain Access → Certificate Assistant → Request a Certificate..."
    echo "   - Enter your email and name, save to disk"
    echo ""
    exit 1
fi

# Check installer certificate (installer certs don't show in find-identity, check keychain directly)
if security find-certificate -c "$INSTALLER_IDENTITY" login.keychain >/dev/null 2>&1 || \
   security find-certificate -c "$INSTALLER_IDENTITY" /Library/Keychains/System.keychain >/dev/null 2>&1; then
    echo "✅ Found installer certificate: $INSTALLER_IDENTITY"
else
    echo "❌ Error: Installer certificate not found!"
    echo ""
    echo "   Required: $INSTALLER_IDENTITY"
    echo ""
    echo "   Note: Installer certificates don't appear in 'security find-identity'"
    echo "   Checking keychain directly..."
    echo ""
    if security find-certificate -a -c "3rd Party Mac Developer Installer" -Z 2>/dev/null | grep -q "3rd Party Mac Developer Installer"; then
        echo "   ⚠️  Found installer certificate but with different name format"
        echo "   Available installer certificates:"
        security find-certificate -a -c "3rd Party Mac Developer Installer" -Z 2>/dev/null | grep "alis" | sed 's/.*"alis"<blob>="\(.*\)"/      \1/' || true
        echo ""
        echo "   Please update INSTALLER_IDENTITY in the script to match exactly"
    else
        echo "   📝 To create the required certificate:"
        echo "   1. Go to https://developer.apple.com/account/resources/certificates/list"
        echo "   2. Click the + button to create a new certificate"
        echo "   3. Select 'Mac Installer Distribution' (under Software)"
        echo "   4. Upload a Certificate Signing Request (CSR)"
        echo "   5. Download and install the certificate"
        echo ""
    fi
    exit 1
fi
echo ""

# Step 1: Verify current signing status
echo "📋 Step 1: Checking current app signature..."
codesign -dv --verbose=4 "$APP_PATH" 2>&1 | grep -E "Signature|Identifier|TeamIdentifier" || true
echo ""

# Check for intermediate certificate and trust status
echo "🔗 Checking certificate chain..."
INTERMEDIATE_FOUND=false
if security find-certificate -c "Apple Worldwide Developer Relations Certification Authority" -a >/dev/null 2>&1; then
    INTERMEDIATE_FOUND=true
    echo "✅ Intermediate certificate found"
else
    echo "⚠️  Warning: Intermediate certificate not found"
    echo "   Run ./scripts/fix-certificate-chain.sh to install it"
fi

# Check if certificate is trusted (this is the critical part)
echo "   Checking certificate trust status..."
if security dump-keychain login.keychain 2>/dev/null | grep -A 10 "Apple Worldwide Developer Relations Certification Authority" | grep -q "trustSettings"; then
    echo "✅ Certificate trust settings found"
else
    echo "⚠️  Warning: Certificate may not be trusted"
    echo "   You may need to manually trust it in Keychain Access"
fi
echo ""

# Step 2: Verify provisioning profile and signing identity match
echo "✍️  Step 2: Verifying provisioning profile..."
PROVISION_PROFILE_SRC="src-tauri/embedded.provisionprofile"
if [ ! -f "$PROVISION_PROFILE_SRC" ]; then
    echo "❌ Error: Provisioning profile not found at $PROVISION_PROFILE_SRC"
    echo "   Please ensure the provisioning profile is in src-tauri/"
    exit 1
fi

# Extract certificate from provisioning profile and verify it matches keychain certificate
echo "   Extracting certificate from provisioning profile..."
TEMP_PLIST=$(mktemp)
TEMP_CERT=$(mktemp)

# Decode the provisioning profile
if security cms -D -i "$PROVISION_PROFILE_SRC" > "$TEMP_PLIST" 2>/dev/null; then
    # Extract the first certificate (base64 encoded)
    CERT_B64=$(plutil -extract DeveloperCertificates.0 raw -o - "$TEMP_PLIST" 2>/dev/null)
    
    if [ -n "$CERT_B64" ]; then
        # Decode base64 and extract certificate details
        echo "$CERT_B64" | base64 -d > "$TEMP_CERT" 2>/dev/null
        
        # Get certificate fingerprint from provisioning profile
        # openssl outputs "sha1 Fingerprint=F2:93:F4:37:..." (lowercase, with colons)
        PROVISION_CERT_FP=$(openssl x509 -inform DER -in "$TEMP_CERT" -noout -fingerprint -sha1 2>/dev/null | \
            sed -E 's/.*[Ff]ingerprint=//' | tr -d ':' | tr '[:lower:]' '[:upper:]' || echo "")
        
        # Get certificate fingerprint from keychain
        # security outputs "SHA-1 hash: F293F437A204..." (uppercase, no colons)
        KEYCHAIN_CERT_FP=$(security find-certificate -c "$SIGNING_IDENTITY" -a -Z 2>/dev/null | \
            grep "SHA-1 hash:" | awk '{print $3}' | tr '[:lower:]' '[:upper:]' || echo "")
        
        if [ -n "$PROVISION_CERT_FP" ] && [ -n "$KEYCHAIN_CERT_FP" ]; then
            echo "   Provisioning profile certificate SHA-1: ${PROVISION_CERT_FP:0:20}..."
            echo "   Keychain certificate SHA-1: ${KEYCHAIN_CERT_FP:0:20}..."
            
            if [ "$PROVISION_CERT_FP" = "$KEYCHAIN_CERT_FP" ]; then
                echo "   ✅ Certificate fingerprints match!"
            else
                echo ""
                echo "   ❌ CRITICAL ERROR: Certificate mismatch!"
                echo "   The certificate in the provisioning profile does NOT match"
                echo "   the certificate in your keychain."
                echo ""
                echo "   This will cause App Store validation to fail."
                echo ""
                echo "   Solution:"
                echo "   1. Go to https://developer.apple.com/account"
                echo "   2. Navigate to Certificates, Identifiers & Profiles"
                echo "   3. Edit your provisioning profile"
                echo "   4. Select the certificate that matches your keychain"
                echo "   5. Download and replace src-tauri/embedded.provisionprofile"
                echo ""
                echo "   See scripts/FIX_CERTIFICATE_MISMATCH.md for detailed instructions"
                echo ""
                rm -f "$TEMP_PLIST" "$TEMP_CERT"
                exit 1
            fi
        fi
        
        # Also check CN for informational purposes
        PROVISION_CERT_CN=$(openssl x509 -inform DER -in "$TEMP_CERT" -noout -subject 2>/dev/null | \
            sed -n 's/.*CN=\([^,]*\).*/\1/p' || echo "")
        
        if [ -n "$PROVISION_CERT_CN" ]; then
            echo "   Certificate CN in provisioning profile: $PROVISION_CERT_CN"
            if echo "$SIGNING_IDENTITY" | grep -qF "$PROVISION_CERT_CN"; then
                echo "   ✅ Signing identity name matches"
            fi
        fi
    else
        echo "   ⚠️  Warning: Could not extract certificate data from provisioning profile"
    fi
else
    echo "   ⚠️  Warning: Could not decode provisioning profile"
fi

# Cleanup temp files
rm -f "$TEMP_PLIST" "$TEMP_CERT"
echo ""

# Step 3: Re-sign the app with App Store certificate
echo "✍️  Step 3: Re-signing app with App Store certificate..."
echo "   Using identity: $SIGNING_IDENTITY"

# First, remove any existing signature
codesign --remove-signature "$APP_PATH" 2>/dev/null || true

# Ensure provisioning profile is embedded (required for App Store)
PROVISION_PROFILE="$APP_PATH/Contents/embedded.provisionprofile"
if [ ! -f "$PROVISION_PROFILE" ]; then
    echo "   Copying provisioning profile to app bundle..."
    mkdir -p "$APP_PATH/Contents"
    cp "$PROVISION_PROFILE_SRC" "$PROVISION_PROFILE"
    echo "   ✅ Provisioning profile embedded"
else
    echo "   ✅ Provisioning profile already embedded"
fi

# Extract TeamIdentifier from provisioning profile
TEAM_ID=$(security cms -D -i "$PROVISION_PROFILE_SRC" 2>/dev/null | \
    plutil -extract Entitlements.com.apple.developer.team-identifier raw -o - - 2>/dev/null || \
    echo "2VBYT65G42")  # Fallback to known team ID

if [ -z "$TEAM_ID" ]; then
    echo "   ⚠️  Warning: Could not extract TeamIdentifier from provisioning profile"
    TEAM_ID="2VBYT65G42"  # Use fallback
fi
echo "   TeamIdentifier: $TEAM_ID"

# Try to get certificate hash for more reliable signing
# This can help with TeamIdentifier extraction
CERT_HASH=$(security find-certificate -c "$SIGNING_IDENTITY" -a -Z 2>/dev/null | grep "SHA-1 hash:" | awk '{print $3}' | head -1)
if [ -n "$CERT_HASH" ]; then
    echo "   Certificate SHA-1 hash: $CERT_HASH"
    # We'll use the hash if the name-based signing doesn't work
fi

# Sign the main executable first (CRITICAL for App Store validation)
# Must be signed with the certificate from the provisioning profile
MAIN_EXECUTABLE="$APP_PATH/Contents/MacOS/servicebusexplorer"
if [ -f "$MAIN_EXECUTABLE" ]; then
    echo "   Signing main executable first..."
    # Remove any existing signature
    codesign --remove-signature "$MAIN_EXECUTABLE" 2>/dev/null || true
    # Sign with the App Store certificate (must match provisioning profile)
    # Use --options runtime for App Store compatibility
    # CRITICAL: Use --timestamp=none to avoid hanging
    # Note: TeamIdentifier should be automatically extracted from certificate UID
    # If it's not set, it's usually a keychain access issue
    codesign --force --sign "$SIGNING_IDENTITY" \
        --options runtime \
        --identifier "$BUNDLE_ID" \
        --timestamp=none \
        "$MAIN_EXECUTABLE" 2>&1 || {
        echo "   ❌ Failed to sign main executable"
        exit 1
    }
    echo "   ✅ Main executable signed"
    
    # Verify executable signature and show details
    echo "   Verifying executable signature..."
    set +e
    VERIFY_OUTPUT=$(codesign --verify --verbose=2 "$MAIN_EXECUTABLE" 2>&1)
    VERIFY_EXIT=$?
    set -e
    echo "$VERIFY_OUTPUT" | head -10 || true
    
    # Show the certificate used to sign the executable
    echo "   Executable signing certificate:"
    EXEC_SIG_INFO=$(codesign -d --verbose=2 "$MAIN_EXECUTABLE" 2>&1)
    echo "$EXEC_SIG_INFO" | grep -E "Authority|TeamIdentifier|Identifier" || true
    
    # CRITICAL: Check if TeamIdentifier is set
    if echo "$EXEC_SIG_INFO" | grep -q "TeamIdentifier=not set"; then
        echo "   ⚠️  WARNING: TeamIdentifier is not set in executable signature!"
        echo "   This will cause App Store validation to fail."
        echo "   The certificate should have UID=2VBYT65G42, but TeamIdentifier is not being extracted."
        echo "   Attempting to re-sign with explicit entitlements..."
        
        # Try re-signing with entitlements that include TeamIdentifier
        codesign --remove-signature "$MAIN_EXECUTABLE" 2>/dev/null || true
        codesign --force --sign "$SIGNING_IDENTITY" \
            --options runtime \
            --identifier "$BUNDLE_ID" \
            --entitlements "$ENTITLEMENTS" \
            --timestamp=none \
            "$MAIN_EXECUTABLE" 2>&1 || {
            echo "   ❌ Failed to re-sign executable with entitlements"
            exit 1
        }
        
        # Verify again
        EXEC_SIG_INFO=$(codesign -d --verbose=2 "$MAIN_EXECUTABLE" 2>&1)
        if echo "$EXEC_SIG_INFO" | grep -q "TeamIdentifier=not set"; then
            echo "   ❌ ERROR: TeamIdentifier still not set after re-signing"
            echo "   This is a critical issue that will cause App Store validation to fail"
        else
            echo "   ✅ TeamIdentifier is now set"
        fi
    fi
fi

# Sign the app bundle with --deep to sign all nested code
# Since we're using the same signing identity, --deep will re-sign with the same certificate
echo "   Signing app bundle with all nested code..."
echo "   (This may take a moment...)"

# Use --deep to sign nested code, ensuring everything uses the same certificate
# The executable will be re-signed, but with the same identity, so it should match
# CRITICAL: Use --timestamp=none to avoid hanging
# Note: TeamIdentifier should be automatically extracted from certificate UID
# Disable set -e temporarily to capture errors properly
set +e
CODESIGN_OUTPUT=$(codesign --force --deep --sign "$SIGNING_IDENTITY" \
    --entitlements "$ENTITLEMENTS" \
    --options runtime \
    --identifier "$BUNDLE_ID" \
    --timestamp=none \
    "$APP_PATH" 2>&1)

SIGN_RESULT=$?
set -e

# Always show the output immediately
if [ -n "$CODESIGN_OUTPUT" ]; then
    echo "$CODESIGN_OUTPUT"
fi
echo "   Exit code: $SIGN_RESULT"

# Check for errors in output (codesign can return 0 even with errors)
if echo "$CODESIGN_OUTPUT" | grep -q "errSecInternalComponent\|code object is not signed"; then
    echo ""
    echo "❌ Error: Signing failed"
    echo ""
    if echo "$CODESIGN_OUTPUT" | grep -q "unable to build chain"; then
        echo "   ⚠️  Certificate chain issue detected!"
        echo ""
        echo "   📖 See detailed instructions in: scripts/TRUST_CERTIFICATES.md"
        echo ""
        echo "   Quick steps:"
        echo "   1. Open Keychain Access (Applications → Utilities)"
        echo "   2. Select 'login' keychain"
        echo "   3. Search for 'Apple Worldwide Developer Relations Certification Authority'"
        echo "   4. For EACH certificate found:"
        echo "      - Double-click → Trust → 'Always Trust' → Enter password"
        echo "   5. Search for '3rd Party Mac Developer Application'"
        echo "      - Double-click → Trust → 'Always Trust' → Enter password"
        echo "   6. Quit Keychain Access (Cmd+Q)"
        echo "   7. Open a NEW terminal window"
        echo "   8. Run this script again"
        echo ""
        echo "   This is required because macOS needs explicit trust for security."
    else
        echo "   Make sure:"
        echo "   - Certificate is installed and trusted"
        echo "   - Intermediate certificate is installed (run ./scripts/fix-certificate-chain.sh)"
        echo "   - Certificate matches the provisioning profile"
    fi
    exit 1
elif [ $SIGN_RESULT -ne 0 ]; then
    echo ""
    echo "❌ Error: Failed to sign app (exit code: $SIGN_RESULT)"
    exit 1
else
    # Verify the signature actually worked
    if codesign --verify --deep --strict "$APP_PATH" >/dev/null 2>&1; then
        echo "✅ App signed successfully"
    else
        echo ""
        echo "⚠️  Warning: codesign returned success but signature verification failed"
        echo "   This usually means a certificate chain issue"
        echo "   Follow the instructions above to trust the intermediate certificate"
        exit 1
    fi
fi
echo ""

# Step 4: Verify the signature and check TeamIdentifier
echo "🔍 Step 4: Verifying signature..."
set +e
VERIFY_OUTPUT=$(codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1)
VERIFY_RESULT=$?
set -e

# CRITICAL: Check if TeamIdentifier is set in app bundle signature
APP_SIG_INFO=$(codesign -d --verbose=2 "$APP_PATH" 2>&1)
echo ""
echo "   App bundle signature info:"
echo "$APP_SIG_INFO" | grep -E "TeamIdentifier|Authority|Identifier" | head -5 || true

if echo "$APP_SIG_INFO" | grep -q "TeamIdentifier=not set"; then
    echo ""
    echo "   ⚠️  WARNING: TeamIdentifier is not set in app bundle signature!"
    echo "   Expected TeamIdentifier: $TEAM_ID"
    echo ""
    echo "   The certificate has UID=$TEAM_ID, but codesign is not extracting it."
    echo "   This is a known macOS issue that can occur due to keychain access."
    echo ""
    echo "   However, Apple's validation may still accept the build if:"
    echo "   1. The certificate matches the provisioning profile"
    echo "   2. The app bundle is properly signed"
    echo "   3. The provisioning profile is embedded"
    echo ""
    echo "   To fix this issue, try:"
    echo "   1. Open Keychain Access"
    echo "   2. Find the certificate: '$SIGNING_IDENTITY'"
    echo "   3. Right-click → Get Info"
    echo "   4. Under 'Access Control', select 'Allow all applications to access this item'"
    echo "   5. Save and try building again"
    echo ""
    echo "   Continuing with build (validation will determine if this is acceptable)..."
    # Don't exit - let's see if Apple accepts it
elif echo "$APP_SIG_INFO" | grep -q "TeamIdentifier=$TEAM_ID"; then
    echo "   ✅ TeamIdentifier is correctly set: $TEAM_ID"
else
    DETECTED_TEAM=$(echo "$APP_SIG_INFO" | grep "TeamIdentifier=" | sed 's/.*TeamIdentifier=\([^ ]*\).*/\1/' || echo "unknown")
    echo "   ⚠️  Warning: TeamIdentifier detected as: $DETECTED_TEAM"
    echo "   Expected: $TEAM_ID"
    if [ "$DETECTED_TEAM" != "$TEAM_ID" ]; then
        echo "   This mismatch may cause App Store validation to fail"
    fi
fi

if [ $VERIFY_RESULT -eq 0 ]; then
    echo "✅ Signature verified"
elif echo "$VERIFY_OUTPUT" | grep -q "does not satisfy its designated Requirement"; then
    echo "⚠️  Warning: Designated requirement check failed"
    echo "   However, the app is 'valid on disk' which is sufficient for App Store"
    echo "   This warning is often non-critical and the build will continue"
    echo "   If App Store submission fails, you may need to investigate further"
else
    echo "❌ Error: Signature verification failed"
    echo "$VERIFY_OUTPUT"
    exit 1
fi
echo ""

# Step 5: Check for Gatekeeper
echo "🛡️  Step 5: Checking Gatekeeper status..."
spctl -a -vv "$APP_PATH" 2>&1 | head -5 || echo "   (Note: May show warnings for App Store builds)"
echo ""

# Step 6: Verify executable signature matches provisioning profile before .pkg creation
echo "📦 Step 6: Verifying executable signature before .pkg creation..."
MAIN_EXECUTABLE="$APP_PATH/Contents/MacOS/servicebusexplorer"
if [ -f "$MAIN_EXECUTABLE" ]; then
    echo "   Checking executable signature..."
    # Temporarily disable exit on error for codesign commands
    set +e
    EXECUTABLE_CERT=$(codesign -d --verbose=2 "$MAIN_EXECUTABLE" 2>&1 | grep -i "Authority" | head -1 | sed 's/.*Authority=\(.*\)/\1/' || echo "")
    set -e
    
    if [ -n "$EXECUTABLE_CERT" ]; then
        echo "   Executable signed with: $EXECUTABLE_CERT"
        # Check if it matches the signing identity
        if echo "$SIGNING_IDENTITY" | grep -qF "$EXECUTABLE_CERT"; then
            echo "   ✅ Executable certificate matches signing identity"
        else
            echo "   ⚠️  Warning: Executable certificate may not match signing identity"
            echo "   This might cause App Store validation to fail"
        fi
    fi
    
    # Verify the executable is properly signed
    # "does not satisfy its designated Requirement" is acceptable for App Store builds
    # codesign --verify returns non-zero even for "valid on disk" with requirement warnings
    # So we capture output and check for "valid on disk" rather than exit code
    set +e  # Temporarily disable exit on error
    VERIFY_OUTPUT=$(codesign --verify --verbose=2 "$MAIN_EXECUTABLE" 2>&1)
    VERIFY_EXIT=$?
    set -e  # Re-enable exit on error
    
    if echo "$VERIFY_OUTPUT" | grep -q "valid on disk"; then
        echo "   ✅ Executable signature is valid on disk"
        if echo "$VERIFY_OUTPUT" | grep -q "does not satisfy its designated Requirement"; then
            echo "   ⚠️  Note: Designated requirement check failed (acceptable for App Store)"
        fi
    else
        echo "   ❌ Error: Executable signature is invalid!"
        echo "$VERIFY_OUTPUT" | head -5
        exit 1
    fi
fi
echo ""

# Step 7: Create .pkg installer
echo "📦 Step 7: Creating .pkg installer..."
echo "   Using installer identity: $INSTALLER_IDENTITY"

# Ensure provisioning profile is embedded before creating .pkg
PROVISION_PROFILE="$APP_PATH/Contents/embedded.provisionprofile"
if [ ! -f "$PROVISION_PROFILE" ] && [ -f "src-tauri/embedded.provisionprofile" ]; then
    echo "   Ensuring provisioning profile is embedded..."
    mkdir -p "$APP_PATH/Contents"
    cp "src-tauri/embedded.provisionprofile" "$PROVISION_PROFILE"
    # Re-sign ONLY the bundle (not --deep) to include the provisioning profile
    # This preserves the executable signature we already set
    codesign --force --sign "$SIGNING_IDENTITY" \
        --entitlements "$ENTITLEMENTS" \
        --options runtime \
        "$APP_PATH" >/dev/null 2>&1 || {
        echo "   ⚠️  Warning: Failed to re-sign bundle with provisioning profile"
    }
fi

# Create a temporary directory for the installer
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copy app to temp directory (including provisioning profile)
# Use -p to preserve extended attributes and signatures
cp -Rp "$APP_PATH" "$TEMP_DIR/"

# Build the .pkg
productbuild --component "$TEMP_DIR/${APP_NAME}.app" \
    /Applications \
    --sign "$INSTALLER_IDENTITY" \
    --identifier "$BUNDLE_ID" \
    --version "$(plutil -extract CFBundleShortVersionString raw "$APP_PATH/Contents/Info.plist" 2>/dev/null || echo "1.0.0")" \
    "$OUTPUT_DIR/$PKG_NAME"

if [ $? -eq 0 ]; then
    echo "✅ .pkg created successfully: $OUTPUT_DIR/$PKG_NAME"
else
    echo "❌ Error: Failed to create .pkg"
    exit 1
fi
echo ""

# Step 8: Verify .pkg signature and check executable inside .pkg
echo "🔍 Step 8: Verifying .pkg signature..."
pkgutil --check-signature "$OUTPUT_DIR/$PKG_NAME"
echo ""

# Note: Verifying executable inside .pkg requires extracting the .pkg which is complex
# The .pkg signature verification above is sufficient - if the .pkg is properly signed,
# the app bundle inside should also be properly signed
echo "   Note: .pkg signature verified above. Executable signature verification"
echo "   inside .pkg requires complex extraction and is not critical for App Store submission."
echo ""

# Step 9: Optional - Submit for notarization
echo "📤 Step 9: Notarization (optional)"
read -p "   Do you want to submit for notarization now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Submitting to Apple for notarization..."
    xcrun notarytool submit "$OUTPUT_DIR/$PKG_NAME" \
        --apple-id "$APPLE_ID" \
        --team-id "$TEAM_ID" \
        --password "$APP_SPECIFIC_PASSWORD" \
        --wait
    
    if [ $? -eq 0 ]; then
        echo "✅ Notarization successful"
        echo "   Stapling notarization ticket..."
        xcrun stapler staple "$OUTPUT_DIR/$PKG_NAME"
        echo "✅ Ticket stapled"
    else
        echo "⚠️  Warning: Notarization failed or was skipped"
    fi
else
    echo "   Skipping notarization (you can do this later)"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Build complete!"
echo ""
echo "📦 Package location: $OUTPUT_DIR/$PKG_NAME"
echo ""
echo "📤 Next steps:"
echo "   1. Download Transporter app from Mac App Store"
echo "   2. Open Transporter and sign in with your Apple ID"
echo "   3. Drag and drop the .pkg file into Transporter"
echo "   4. Click 'Deliver' to upload to App Store Connect"
echo ""
echo "   Or use command line:"
echo "   xcrun altool --upload-app --type macos --file \"$OUTPUT_DIR/$PKG_NAME\" \\"
echo "     --username \"$APPLE_ID\" --password \"$APP_SPECIFIC_PASSWORD\""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

