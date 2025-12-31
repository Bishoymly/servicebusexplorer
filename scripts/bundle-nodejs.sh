#!/bin/bash

# Bundle Node.js runtime with the app for macOS
# This script downloads Node.js for both architectures and creates a universal binary

set -e

NODE_VERSION="20.18.0"  # Use LTS version
NODE_DIR="src-tauri/target/resources/nodejs"

echo "📦 Bundling Node.js runtime for macOS (universal: arm64 + x64)..."

# Create directory
mkdir -p "$NODE_DIR"

# Download Node.js for both architectures
download_node() {
    local arch=$1
    local tarball="node-v${NODE_VERSION}-darwin-${arch}.tar.gz"
    local url="https://nodejs.org/dist/v${NODE_VERSION}/${tarball}"
    local extract_dir="$NODE_DIR/node-v${NODE_VERSION}-darwin-${arch}"
    
    if [ ! -f "$NODE_DIR/$tarball" ]; then
        echo "⬇️  Downloading Node.js v${NODE_VERSION} for ${arch}..." >&2
        curl -L "$url" -o "$NODE_DIR/$tarball"
    else
        echo "✅ Node.js tarball for ${arch} already exists" >&2
    fi
    
    # Extract if not already extracted
    if [ ! -d "$extract_dir" ]; then
        echo "📂 Extracting Node.js for ${arch}..." >&2
        tar -xzf "$NODE_DIR/$tarball" -C "$NODE_DIR"
    fi
    
    # Return path to the node binary (to stdout, redirecting echo to stderr above)
    echo "$extract_dir/bin/node"
}

# Download both architectures
echo "🔧 Downloading Node.js for both architectures..."
ARM64_NODE=$(download_node "arm64")
X64_NODE=$(download_node "x64")

# Verify both binaries exist
if [ ! -f "$ARM64_NODE" ]; then
    echo "❌ ARM64 Node.js binary not found at $ARM64_NODE"
    exit 1
fi

if [ ! -f "$X64_NODE" ]; then
    echo "❌ x64 Node.js binary not found at $X64_NODE"
    exit 1
fi

# Create universal binary using lipo
UNIVERSAL_NODE="$NODE_DIR/node"
echo "🔗 Creating universal Node.js binary..."

# Check if lipo is available
if ! command -v lipo &> /dev/null; then
    echo "❌ Error: 'lipo' command not found. This script requires Xcode Command Line Tools."
    echo "   Install with: xcode-select --install"
    exit 1
fi

# Create universal binary
lipo -create "$ARM64_NODE" "$X64_NODE" -output "$UNIVERSAL_NODE"

# Verify the universal binary
if [ -f "$UNIVERSAL_NODE" ]; then
    chmod +x "$UNIVERSAL_NODE"
    echo "✅ Universal Node.js binary created at: $UNIVERSAL_NODE"
    
    # Show architectures in the binary
    ARCHITECTURES=$(lipo -info "$UNIVERSAL_NODE" | cut -d: -f3)
    echo "✅ Binary architectures: $ARCHITECTURES"
    
    # Verify it works (will run on current architecture)
    VERSION=$("$UNIVERSAL_NODE" --version 2>&1)
    echo "✅ Node.js version: $VERSION"
else
    echo "❌ Failed to create universal Node.js binary"
    exit 1
fi

echo "✅ Node.js bundling complete (universal binary ready)!"

