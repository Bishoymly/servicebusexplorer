#!/bin/bash

# Generate ICNS file with all required sizes for App Store
# This script creates a proper .iconset and converts it to .icns

set -e

ICONS_DIR="src-tauri/icons"
SOURCE_ICON="$ICONS_DIR/1024x1024.png"
OUTPUT_ICNS="$ICONS_DIR/icon.icns"
ICONSET_DIR="/tmp/app-icon.iconset"

echo "🎨 Generating ICNS file with all required sizes..."
echo ""

# Check if source icon exists
if [ ! -f "$SOURCE_ICON" ]; then
    echo "❌ Error: Source icon not found at $SOURCE_ICON"
    exit 1
fi

# Clean up old iconset
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

echo "📐 Creating icon sizes from $SOURCE_ICON..."

# Create all required icon sizes for macOS App Store
# Format: icon_[size]x[size][@2x].png

# 16x16
sips -z 16 16 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null 2>&1
sips -z 32 32 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null 2>&1

# 32x32
sips -z 32 32 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null 2>&1
sips -z 64 64 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null 2>&1

# 128x128
sips -z 128 128 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null 2>&1
sips -z 256 256 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null 2>&1

# 256x256
sips -z 256 256 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null 2>&1
sips -z 512 512 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null 2>&1

# 512x512 (CRITICAL for App Store - this is what's missing)
sips -z 512 512 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null 2>&1
# 512@2x = 1024x1024 (REQUIRED for App Store)
cp "$SOURCE_ICON" "$ICONSET_DIR/icon_512x512@2x.png"

echo "✅ Created all icon sizes"
echo ""

# Verify critical sizes exist
if [ ! -f "$ICONSET_DIR/icon_512x512@2x.png" ]; then
    echo "❌ Error: Failed to create icon_512x512@2x.png (1024x1024)"
    exit 1
fi

# Verify dimensions
ICON_512_2X_SIZE=$(sips -g pixelWidth -g pixelHeight "$ICONSET_DIR/icon_512x512@2x.png" 2>/dev/null | grep -E "pixelWidth|pixelHeight" | awk '{print $2}' | head -1)
if [ "$ICON_512_2X_SIZE" != "1024" ]; then
    echo "❌ Error: icon_512x512@2x.png is not 1024x1024 (got ${ICON_512_2X_SIZE}x${ICON_512_2X_SIZE})"
    exit 1
fi

echo "✅ Verified icon_512x512@2x.png is 1024x1024"
echo ""

# Convert iconset to icns
echo "🔄 Converting iconset to ICNS format..."
iconutil --convert icns "$ICONSET_DIR" --output "$OUTPUT_ICNS"

if [ ! -f "$OUTPUT_ICNS" ]; then
    echo "❌ Error: Failed to create ICNS file"
    exit 1
fi

echo "✅ ICNS file created: $OUTPUT_ICNS"
echo ""

# Clean up
rm -rf "$ICONSET_DIR"

echo "🎉 Done! ICNS file is ready for App Store submission."
echo ""
echo "📋 Icon sizes included:"
echo "   - 16x16, 32x32 (@2x versions)"
echo "   - 128x128, 256x256 (@2x versions)"
echo "   - 512x512, 512x512@2x (1024x1024) ✅ REQUIRED"

