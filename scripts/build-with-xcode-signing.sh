#!/bin/bash

# Build Tauri App and Sign Using Xcode-Compatible Approach
# This builds the app first, then signs it with better error handling

set -e

APP_NAME="Azure Service Bus Explorer"
BUNDLE_ID="com.bishoylabib.servicebusexplorer"
APP_PATH="src-tauri/target/universal-apple-darwin/release/bundle/macos/${APP_NAME}.app"
ENTITLEMENTS="src-tauri/Entitlements.plist"
OUTPUT_DIR="dist/appstore"

echo "🚀 Building Tauri app for App Store..."
echo ""

# Step 1: Build with Tauri (unsigned)
echo "📦 Step 1: Building app with Tauri..."
npm run tauri:build:appstore

if [ ! -d "$APP_PATH" ]; then
    echo "❌ Error: App not found at $APP_PATH"
    exit 1
fi

echo "✅ App built successfully"
echo ""

# Step 2: Find signing identity (let codesign find it automatically)
echo "🔍 Step 2: Finding signing identity..."

# Try to find the certificate automatically
SIGNING_IDENTITY=$(security find-identity -v -p codesigning | grep "3rd Party Mac Developer Application" | head -1 | sed 's/.*"\(.*\)"/\1/')

if [ -z "$SIGNING_IDENTITY" ]; then
    echo "❌ Error: No App Store signing certificate found"
    echo ""
    echo "Available certificates:"
    security find-identity -v -p codesigning
    echo ""
    echo "Please:"
    echo "1. Open Xcode → Settings → Accounts"
    echo "2. Select your Apple ID"
    echo "3. Click 'Manage Certificates...'"
    echo "4. Click '+' and select 'Mac App Distribution'"
    echo "5. Run this script again"
    exit 1
fi

echo "✅ Found: $SIGNING_IDENTITY"
echo ""

# Step 3: Remove existing signature
echo "✍️  Step 3: Removing existing signature..."
codesign --remove-signature "$APP_PATH" 2>/dev/null || true

# Step 4: Sign with better error handling
echo "✍️  Step 4: Signing app..."
echo "   This may take a moment..."

# Use --timestamp=none to avoid hanging
# Use --deep for nested code signing
set +e
CODESIGN_OUTPUT=$(codesign --force --deep --sign "$SIGNING_IDENTITY" \
    --entitlements "$ENTITLEMENTS" \
    --options runtime \
    --timestamp=none \
    "$APP_PATH" 2>&1)
SIGN_RESULT=$?
set -e

if [ $SIGN_RESULT -ne 0 ]; then
    echo ""
    echo "❌ Signing failed!"
    echo "$CODESIGN_OUTPUT"
    echo ""
    
    if echo "$CODESIGN_OUTPUT" | grep -q "unable to build chain"; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "CERTIFICATE TRUST ISSUE DETECTED"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Fix this using Xcode:"
        echo ""
        echo "1. Open Xcode"
        echo "2. Xcode → Settings → Accounts"
        echo "3. Select your Apple ID"
        echo "4. Click 'Manage Certificates...'"
        echo "5. Xcode will download and trust certificates automatically"
        echo ""
        echo "OR fix manually in Keychain Access:"
        echo "1. Open Keychain Access (Applications → Utilities)"
        echo "2. Select 'login' keychain"
        echo "3. Search for 'Apple Worldwide Developer Relations'"
        echo "4. Double-click each certificate → Trust → 'Always Trust'"
        echo "5. Search for '3rd Party Mac Developer Application'"
        echo "6. Double-click → Trust → 'Always Trust'"
        echo "7. Quit Keychain Access completely (Cmd+Q)"
        echo "8. Run this script again"
        echo ""
    fi
    exit 1
fi

# Step 5: Verify signature
echo "🔍 Step 5: Verifying signature..."
if codesign --verify --deep --strict "$APP_PATH" >/dev/null 2>&1; then
    echo "✅ App signed and verified successfully"
else
    echo "❌ Signature verification failed"
    codesign --verify --deep --strict --verbose=2 "$APP_PATH"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Build complete!"
echo ""
echo "📦 Signed app location: $APP_PATH"
echo ""
echo "📤 Next steps:"
echo "   1. Create .pkg installer: ./scripts/build-appstore.sh"
echo "   2. Or use Transporter app to upload the .app directly"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"




