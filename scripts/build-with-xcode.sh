#!/bin/bash

# Build Tauri App and Sign Using Xcode Archive Method
# This script prepares the app for Xcode Archive signing

set -e

APP_NAME="Azure Service Bus Explorer"
BUNDLE_ID="com.bishoylabib.servicebusexplorer"
APP_PATH="src-tauri/target/universal-apple-darwin/release/bundle/macos/${APP_NAME}.app"
OUTPUT_DIR="dist/appstore"

echo "🚀 Preparing app for Xcode Archive signing..."
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

# Step 2: Verify app structure
echo "🔍 Step 2: Verifying app structure..."
if [ ! -f "$APP_PATH/Contents/Info.plist" ]; then
    echo "❌ Error: Info.plist not found"
    exit 1
fi

if [ ! -f "$APP_PATH/Contents/MacOS/servicebusexplorer" ]; then
    echo "❌ Error: Main executable not found"
    exit 1
fi

echo "✅ App structure verified"
echo ""

# Step 3: Copy to output directory for easy access
echo "📁 Step 3: Copying app to output directory..."
mkdir -p "$OUTPUT_DIR"
cp -R "$APP_PATH" "$OUTPUT_DIR/"
echo "✅ App copied to: $OUTPUT_DIR/${APP_NAME}.app"
echo ""

# Step 4: Instructions
echo "📋 Next Steps:"
echo ""
echo "1. Open Xcode"
echo "2. File → New → Project"
echo "3. Select macOS → App"
echo "4. Configure:"
echo "   - Product Name: Azure Service Bus Explorer"
echo "   - Team: Select your Apple Developer team"
echo "   - Bundle Identifier: com.bishoylabib.servicebusexplorer"
echo "5. In Build Phases, add a Run Script Phase before 'Copy Bundle Resources':"
echo "   cp -R \"$OUTPUT_DIR/${APP_NAME}.app\" \"\${BUILT_PRODUCTS_DIR}/\${PRODUCT_NAME}.app\""
echo "6. Product → Archive"
echo "7. Distribute App → App Store Connect → Upload"
echo ""
echo "📖 See scripts/BUILD_WITH_XCODE.md for detailed instructions"
echo ""
echo "✅ App ready for Xcode Archive signing!"

