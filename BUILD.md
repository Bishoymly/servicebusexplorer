# Building and Distributing the Desktop App

This guide covers building the Azure Service Bus Explorer desktop application for distribution.

## Prerequisites

### All Platforms
- Node.js 18+ and npm
- Rust (install from https://rustup.rs/)

### Platform-Specific

**macOS:**
```bash
xcode-select --install
```

**Windows:**
- Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Or install Visual Studio with C++ workload

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

## Local Builds

### Quick Build (Current Platform)

```bash
npm run tauri:build
```

This builds for your current platform and outputs the installer in:
- **Windows**: `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/`
- **macOS**: `src-tauri/target/[arch]/release/bundle/dmg/`
- **Linux**: `src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/`

### Cross-Platform Builds

You can build for other platforms from your current machine:

**Windows (64-bit):**
```bash
npm run tauri:build -- --target x86_64-pc-windows-msvc
```

**macOS Intel:**
```bash
npm run tauri:build -- --target x86_64-apple-darwin
```

**macOS Apple Silicon:**
```bash
npm run tauri:build -- --target aarch64-apple-darwin
```

**Linux (64-bit):**
```bash
npm run tauri:build -- --target x86_64-unknown-linux-gnu
```

**Note:** Cross-platform builds require additional setup:
- Windows → macOS/Linux: Not easily possible, use CI/CD
- macOS → Windows/Linux: Requires Wine (for Windows) or Docker (for Linux)
- Linux → Windows/macOS: Not easily possible, use CI/CD

## Automated Builds with GitHub Actions

The repository includes GitHub Actions workflows for automated cross-platform builds.

### Option 1: Full Release Workflow

**File:** `.github/workflows/build-desktop.yml`

**Features:**
- Builds for all platforms automatically
- Creates GitHub Releases with installers
- Triggers on version tags

**Usage:**

1. Create and push a version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. The workflow will:
   - Build for Windows, macOS (Intel & ARM), and Linux
   - Create a draft GitHub Release
   - Attach all platform installers
   - Generate release notes

3. Review and publish the release on GitHub

### Option 2: Simple Build Workflow

**File:** `.github/workflows/build-desktop-simple.yml`

**Features:**
- Builds artifacts without creating releases
- Useful for testing or manual release creation
- Can be triggered manually or on push

**Usage:**

1. Go to GitHub Actions → Build Desktop App (Simple)
2. Click "Run workflow"
3. Select branch and run
4. Download artifacts from the workflow run

## Build Outputs

### Windows
- **Format**: MSI installer
- **Location**: `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi`
- **Size**: ~15-20 MB
- **Installation**: Double-click the `.msi` file

### macOS
- **Format**: DMG disk image
- **Location**: `src-tauri/target/[arch]/release/bundle/dmg/*.dmg`
- **Size**: ~20-25 MB
- **Installation**: 
  1. Open the `.dmg` file
  2. Drag the app to Applications
  3. May need to allow in System Preferences → Security

**Note:** For distribution outside the App Store, you'll need:
- Apple Developer account ($99/year)
- Code signing certificate
- Notarization (for macOS 10.15+)

### Linux
- **Format**: DEB package (Debian/Ubuntu)
- **Location**: `src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/deb/*.deb`
- **Size**: ~15-20 MB
- **Installation**: 
  ```bash
  sudo dpkg -i *.deb
  sudo apt-get install -f  # Fix dependencies if needed
  ```

## Code Signing (macOS)

For production macOS builds, configure code signing in GitHub Actions:

1. **Export your certificate:**
   ```bash
   # Export from Keychain Access
   # File → Export Items → Save as .p12
   ```

2. **Add GitHub Secrets:**
   - Go to Repository → Settings → Secrets and variables → Actions
   - Add:
     - `APPLE_CERTIFICATE`: Base64 encoded .p12 file
       ```bash
       base64 -i certificate.p12 | pbcopy
       ```
     - `APPLE_CERTIFICATE_PASSWORD`: Your certificate password
     - `APPLE_SIGNING_IDENTITY`: Your signing identity
       ```bash
       security find-identity -v -p codesigning
       ```
     - `APPLE_TEAM_ID`: Your Apple Team ID (from Apple Developer portal)

3. **Update workflow** to use these secrets (see Tauri documentation)

## Troubleshooting

### Build Fails on macOS

**Error:** "No such module 'AppKit'"
- **Solution:** Install Xcode Command Line Tools: `xcode-select --install`

**Error:** Code signing issues
- **Solution:** Ensure you have a valid Apple Developer certificate

### Build Fails on Windows

**Error:** "link.exe not found"
- **Solution:** Install Microsoft C++ Build Tools or Visual Studio

**Error:** "rustup not found"
- **Solution:** Install Rust from https://rustup.rs/

### Build Fails on Linux

**Error:** "Package 'webkit2gtk-4.0' not found"
- **Solution:** Install required dependencies (see Prerequisites)

**Error:** "Permission denied"
- **Solution:** Ensure you have write permissions in the project directory

### General Issues

**Build is slow:**
- First build compiles Rust dependencies (can take 10-20 minutes)
- Subsequent builds are much faster (1-2 minutes)

**Out of memory:**
- Rust compilation can use significant RAM
- Ensure at least 4GB available
- Close other applications

**Build artifacts not found:**
- Check the correct target directory for your platform
- Ensure build completed successfully (check for errors)

## Distribution

### GitHub Releases

1. Use the automated workflow to create releases
2. Or manually:
   - Build locally for each platform
   - Create a new release on GitHub
   - Upload installers as release assets

### Other Distribution Methods

- **macOS**: App Store (requires Apple Developer account)
- **Windows**: Microsoft Store (requires developer account)
- **Linux**: Package repositories (Snap, Flatpak, AppImage)

## Version Management

Update version in:
1. `package.json` - npm version
2. `src-tauri/Cargo.toml` - Rust package version
3. `src-tauri/tauri.conf.json` - App version

Use semantic versioning (e.g., 1.0.0, 1.0.1, 1.1.0)

## Resources

- [Tauri Building Documentation](https://tauri.app/v1/guides/building/)
- [Tauri GitHub Actions](https://tauri.app/v1/guides/ci/github-actions/)
- [Rust Cross-Compilation](https://rust-lang.github.io/rustup/cross-compilation.html)

