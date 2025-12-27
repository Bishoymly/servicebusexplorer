#!/bin/bash

# Create AppIcon.appiconset with all required sizes for Xcode
# Use this if you want to keep using Xcode's asset catalog

set -e

SOURCE_ICON="src-tauri/icons/1024x1024.png"
OUTPUT_DIR="${1:-./AppIcon.appiconset}"

if [ ! -f "$SOURCE_ICON" ]; then
    echo "❌ Error: Source icon not found at $SOURCE_ICON"
    exit 1
fi

echo "🎨 Creating AppIcon.appiconset for Xcode..."
echo ""

# Create directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Create all required sizes
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
# App Store - 2x (also 1024x1024)
cp "$SOURCE_ICON" "$OUTPUT_DIR/App Store - 2x.png"

echo "✅ Created all icon sizes"
echo ""

# Create Contents.json
cat > "$OUTPUT_DIR/Contents.json" << 'EOF'
{
  "images" : [
    {
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "16x16"
    },
    {
      "filename" : "icon_16x16@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "16x16"
    },
    {
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "32x32"
    },
    {
      "filename" : "icon_32x32@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "32x32"
    },
    {
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "128x128"
    },
    {
      "filename" : "icon_128x128@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "128x128"
    },
    {
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "256x256"
    },
    {
      "filename" : "icon_256x256@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "256x256"
    },
    {
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "512x512"
    },
    {
      "filename" : "icon_512x512@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "512x512"
    },
    {
      "filename" : "App Store - 2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF

echo "✅ Created Contents.json"
echo ""
echo "📁 AppIcon.appiconset created at: $OUTPUT_DIR"
echo ""
echo "📋 Next steps:"
echo "1. In Xcode, delete the existing AppIcon.appiconset"
echo "2. Drag this new AppIcon.appiconset into Assets.xcassets"
echo "3. Clean build folder and rebuild archive"

