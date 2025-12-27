#!/bin/bash

# Prepare icon files for Xcode asset catalog
# This creates properly named icon files that Xcode expects

set -e

SOURCE_ICON="src-tauri/icons/1024x1024.png"
OUTPUT_DIR="./XcodeIcons"

if [ ! -f "$SOURCE_ICON" ]; then
    echo "❌ Error: Source icon not found at $SOURCE_ICON"
    exit 1
fi

echo "🎨 Preparing icons for Xcode asset catalog..."
echo ""

# Create output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Generate all required sizes
echo "📐 Generating icon sizes..."

# 16x16
sips -z 16 16 "$SOURCE_ICON" --out "$OUTPUT_DIR/icon_16x16.png" >/dev/null 2>&1
sips -z 32 32 "$SOURCE_ICON" --out "$OUTPUT_DIR/icon_16x16@2x.png" >/dev/null 2>&1

# 32x32
sips -z 32 32 "$SOURCE_ICON" --out "$OUTPUT_DIR/icon_32x32.png" >/dev/null 2>&1
sips -z 64 64 "$SOURCE_ICON" --out "$OUTPUT_DIR/icon_32x32@2x.png" >/dev/null 2>&1

# 128x128
sips -z 128 128 "$SOURCE_ICON" --out "$OUTPUT_DIR/icon_128x128.png" >/dev/null 2>&1
sips -z 256 256 "$SOURCE_ICON" --out "$OUTPUT_DIR/icon_128x128@2x.png" >/dev/null 2>&1

# 256x256
sips -z 256 256 "$SOURCE_ICON" --out "$OUTPUT_DIR/icon_256x256.png" >/dev/null 2>&1
sips -z 512 512 "$SOURCE_ICON" --out "$OUTPUT_DIR/icon_256x256@2x.png" >/dev/null 2>&1

# 512x512
sips -z 512 512 "$SOURCE_ICON" --out "$OUTPUT_DIR/icon_512x512.png" >/dev/null 2>&1
# 512@2x = 1024x1024 (CRITICAL for App Store)
cp "$SOURCE_ICON" "$OUTPUT_DIR/icon_512x512@2x.png"

# App Store - 2x (1024x1024) - REQUIRED
cp "$SOURCE_ICON" "$OUTPUT_DIR/app_store_1024.png"

echo "✅ Icons prepared in: $OUTPUT_DIR"
echo ""
echo "📋 Next steps:"
echo "1. Open Xcode project"
echo "2. Create Assets.xcassets if it doesn't exist"
echo "3. Right-click Assets.xcassets → New Image Set → Name it 'AppIcon'"
echo "4. Select AppIcon → Set Type to 'Mac'"
echo "5. Drag icons from $OUTPUT_DIR to the appropriate slots:"
echo "   - 16x16 → icon_16x16.png"
echo "   - 16x16 @2x → icon_16x16@2x.png"
echo "   - 32x32 → icon_32x32.png"
echo "   - 32x32 @2x → icon_32x32@2x.png"
echo "   - 128x128 → icon_128x128.png"
echo "   - 128x128 @2x → icon_128x128@2x.png"
echo "   - 256x256 → icon_256x256.png"
echo "   - 256x256 @2x → icon_256x256@2x.png"
echo "   - 512x512 → icon_512x512.png"
echo "   - 512x512 @2x → icon_512x512@2x.png (1024x1024) ✅ CRITICAL"
echo "   - App Store → app_store_1024.png (1024x1024) ✅ CRITICAL"

