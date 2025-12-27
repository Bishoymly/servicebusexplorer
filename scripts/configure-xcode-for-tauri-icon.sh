#!/bin/bash

# Configure Xcode project to use Tauri icon instead of asset catalog
# This script modifies the Xcode project settings

set -e

echo "🔧 Configuring Xcode project to use Tauri icon..."
echo ""

# Find Xcode project
XCODE_PROJECT=$(find . -name "*.xcodeproj" -type d 2>/dev/null | head -1)

if [ -z "$XCODE_PROJECT" ]; then
    echo "⚠️  No Xcode project found in current directory"
    echo "   Searching parent directories..."
    XCODE_PROJECT=$(find .. -name "*.xcodeproj" -type d 2>/dev/null | head -1)
fi

if [ -z "$XCODE_PROJECT" ]; then
    echo "❌ No Xcode project found"
    echo ""
    echo "Please run this script from your Xcode project directory"
    exit 1
fi

PROJECT_DIR=$(dirname "$XCODE_PROJECT")
PBXPROJ="$XCODE_PROJECT/project.pbxproj"

echo "✅ Found Xcode project: $XCODE_PROJECT"
echo ""

# Check if project.pbxproj exists
if [ ! -f "$PBXPROJ" ]; then
    echo "❌ Error: project.pbxproj not found"
    exit 1
fi

# Backup project file
cp "$PBXPROJ" "$PBXPROJ.backup"
echo "✅ Created backup: $PBXPROJ.backup"
echo ""

# Remove ASSETCATALOG_COMPILER_APPICON_NAME setting
echo "📝 Removing ASSETCATALOG_COMPILER_APPICON_NAME setting..."
if grep -q "ASSETCATALOG_COMPILER_APPICON_NAME" "$PBXPROJ"; then
    # Remove the line containing ASSETCATALOG_COMPILER_APPICON_NAME
    sed -i '' '/ASSETCATALOG_COMPILER_APPICON_NAME/d' "$PBXPROJ"
    echo "✅ Removed ASSETCATALOG_COMPILER_APPICON_NAME"
else
    echo "ℹ️  ASSETCATALOG_COMPILER_APPICON_NAME not found (already removed or never set)"
fi

echo ""

# Instructions for manual steps
echo "📋 Manual steps required:"
echo ""
echo "1. Open Xcode project"
echo "2. Select your project in navigator"
echo "3. Select the target 'Azure Service Bus Explorer'"
echo "4. Go to 'Build Settings' tab"
echo "5. Search for 'Asset Catalog Compiler'"
echo "6. Find 'Asset Catalog App Icon Set Name'"
echo "7. Clear/delete the value (leave it empty)"
echo ""
echo "OR:"
echo ""
echo "1. In Xcode navigator, find 'Assets.xcassets'"
echo "2. Find 'AppIcon.appiconset' inside it"
echo "3. Right-click → Delete → Move to Trash"
echo ""
echo "4. Clean build folder: Product → Clean Build Folder (Shift+Cmd+K)"
echo "5. Rebuild archive"
echo ""
echo "✅ After these steps, Xcode will use the icon from the Tauri app bundle"
echo "   (icon.icns in AppName.app/Contents/Resources/)"

