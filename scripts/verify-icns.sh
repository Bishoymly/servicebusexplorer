#!/bin/bash

# Verify ICNS file contains all required sizes for App Store

set -e

ICNS_FILE="src-tauri/icons/icon.icns"
ICONSET_DIR="/tmp/verify-icns.iconset"

echo "🔍 Verifying ICNS file: $ICNS_FILE"
echo ""

if [ ! -f "$ICNS_FILE" ]; then
    echo "❌ Error: ICNS file not found at $ICNS_FILE"
    exit 1
fi

# Extract iconset
rm -rf "$ICONSET_DIR"
iconutil --convert iconset --output "$ICONSET_DIR" "$ICNS_FILE" 2>&1

echo "📋 Checking required icon sizes..."
echo ""

# Check for 512x512@2x (1024x1024) - CRITICAL for App Store
if [ -f "$ICONSET_DIR/icon_512x512@2x.png" ]; then
    SIZE=$(sips -g pixelWidth -g pixelHeight "$ICONSET_DIR/icon_512x512@2x.png" 2>/dev/null | grep pixelWidth | awk '{print $2}')
    if [ "$SIZE" = "1024" ]; then
        echo "✅ icon_512x512@2x.png exists and is 1024x1024"
    else
        echo "❌ icon_512x512@2x.png is not 1024x1024 (got ${SIZE}x${SIZE})"
        exit 1
    fi
else
    echo "❌ icon_512x512@2x.png NOT FOUND - This is required for App Store!"
    exit 1
fi

# Check for 512x512
if [ -f "$ICONSET_DIR/icon_512x512.png" ]; then
    echo "✅ icon_512x512.png exists"
else
    echo "⚠️  icon_512x512.png not found (recommended)"
fi

# List all sizes
echo ""
echo "📐 All icon sizes in ICNS:"
ls -lh "$ICONSET_DIR" | awk '{print $9, $5}' | grep -E "icon_" | sort

# Clean up
rm -rf "$ICONSET_DIR"

echo ""
echo "✅ ICNS file verification complete!"

