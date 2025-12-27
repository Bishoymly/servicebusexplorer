#!/bin/bash

# Check for icon files in Xcode project that might be overriding Tauri icon

set -e

echo "🔍 Checking for icon files in Xcode project..."
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
    echo "If you created the Xcode project elsewhere, navigate to that directory"
    echo "and run this script from there."
    exit 1
fi

echo "✅ Found Xcode project: $XCODE_PROJECT"
echo ""

PROJECT_DIR=$(dirname "$XCODE_PROJECT")

# Check for asset catalogs
echo "📁 Checking for asset catalogs..."
ASSET_CATALOGS=$(find "$PROJECT_DIR" -name "*.xcassets" -type d 2>/dev/null)
if [ -n "$ASSET_CATALOGS" ]; then
    echo "$ASSET_CATALOGS" | while read -r catalog; do
        echo "   Found: $catalog"
        
        # Check for AppIcon
        if [ -d "$catalog/AppIcon.appiconset" ]; then
            echo "   ⚠️  Found AppIcon.appiconset - this might override Tauri icon!"
            echo "   Contents:"
            ls -lh "$catalog/AppIcon.appiconset/" 2>/dev/null | head -10
            
            # Check for macOS App Store icon
            if [ -f "$catalog/AppIcon.appiconset/icon_512x512@2x.png" ] || \
               [ -f "$catalog/AppIcon.appiconset/App Store - 2x.png" ]; then
                echo "   ✅ Found App Store icon"
            else
                echo "   ❌ Missing App Store icon (512@2x or 'App Store - 2x')"
            fi
        fi
    done
else
    echo "   No asset catalogs found"
fi

echo ""

# Check for ICNS files in project
echo "📁 Checking for ICNS files in project..."
ICNS_FILES=$(find "$PROJECT_DIR" -name "*.icns" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null)
if [ -n "$ICNS_FILES" ]; then
    echo "$ICNS_FILES" | while read -r icns; do
        echo "   Found: $icns"
        
        # Verify it contains 512@2x
        TEMP_ICONSET="/tmp/check-$(basename "$icns").iconset"
        rm -rf "$TEMP_ICONSET"
        if iconutil --convert iconset --output "$TEMP_ICONSET" "$icns" 2>/dev/null; then
            if [ -f "$TEMP_ICONSET/icon_512x512@2x.png" ]; then
                SIZE=$(sips -g pixelWidth "$TEMP_ICONSET/icon_512x512@2x.png" 2>/dev/null | grep pixelWidth | awk '{print $2}')
                if [ "$SIZE" = "1024" ]; then
                    echo "   ✅ Contains 512@2x (1024x1024)"
                else
                    echo "   ❌ 512@2x is not 1024x1024 (got ${SIZE}x${SIZE})"
                fi
            else
                echo "   ❌ Missing icon_512x512@2x.png"
            fi
            rm -rf "$TEMP_ICONSET"
        fi
    done
else
    echo "   No ICNS files found in project"
fi

echo ""

# Check project.pbxproj for icon references
echo "📋 Checking Xcode project settings..."
PBXPROJ="$XCODE_PROJECT/project.pbxproj"
if [ -f "$PBXPROJ" ]; then
    # Check for ASSETCATALOG_COMPILER_APPICON_NAME
    ASSET_ICON=$(grep -i "ASSETCATALOG_COMPILER_APPICON_NAME" "$PBXPROJ" | head -1 | sed 's/.*= *\(.*\);/\1/' | tr -d ' ' || echo "")
    if [ -n "$ASSET_ICON" ]; then
        echo "   Asset Catalog Icon Name: $ASSET_ICON"
        echo "   ⚠️  Xcode is using asset catalog for icon"
    fi
    
    # Check for INFOPLIST_FILE
    INFO_PLIST=$(grep -i "INFOPLIST_FILE" "$PBXPROJ" | head -1 | sed 's/.*= *\(.*\);/\1/' | tr -d ' ' || echo "")
    if [ -n "$INFO_PLIST" ]; then
        echo "   Info.plist: $INFO_PLIST"
    fi
fi

echo ""
echo "💡 Recommendations:"
echo ""
echo "1. If using Xcode Archive, ensure the Tauri-built app's icon is used"
echo "2. If Xcode has an AppIcon asset catalog, either:"
echo "   a) Remove it and let Xcode use the icon from the app bundle, OR"
echo "   b) Add 512@2x (1024x1024) image to the asset catalog"
echo "3. The icon should be in: AppName.app/Contents/Resources/icon.icns"
echo "4. Info.plist should reference it: CFBundleIconFile = 'icon'"

