#!/bin/bash

# Xcode Build Script to Copy Tauri App
# This script copies the Tauri-built app into the Xcode app bundle

set -e

# Path to the Tauri-built app (adjust relative path as needed)
# If Xcode project is in a different location, update this path
TAURI_APP="${SRCROOT}/../src-tauri/target/universal-apple-darwin/release/bundle/macos/Azure Service Bus Explorer.app"

# Xcode output app path
XCODE_APP="${BUILT_PRODUCTS_DIR}/${PRODUCT_NAME}.app"

echo "🔍 Looking for Tauri app at: $TAURI_APP"

# Check if Tauri app exists
if [ ! -d "$TAURI_APP" ]; then
    echo "❌ Error: Tauri app not found at: $TAURI_APP"
    echo ""
    echo "Please run: npm run tauri:build:appstore"
    echo "from the project root directory"
    exit 1
fi

# Check if main executable exists
if [ ! -f "$TAURI_APP/Contents/MacOS/servicebusexplorer" ]; then
    echo "❌ Error: Main executable not found in Tauri app"
    exit 1
fi

# Remove existing Xcode app (if any)
if [ -d "$XCODE_APP" ]; then
    echo "🗑️  Removing existing app bundle"
    rm -rf "$XCODE_APP"
fi

# Copy Tauri app to Xcode output location
echo "📦 Copying Tauri app to: $XCODE_APP"
cp -R "$TAURI_APP" "$XCODE_APP"

# Verify copy was successful
if [ -d "$XCODE_APP" ] && [ -f "$XCODE_APP/Contents/MacOS/servicebusexplorer" ]; then
    echo "✅ App copied successfully"
else
    echo "❌ Error: Failed to copy app"
    exit 1
fi

