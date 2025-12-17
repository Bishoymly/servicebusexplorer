# Apple Code Signing Setup Guide

This guide explains how to obtain the required Apple Developer credentials for signing macOS DMG files in GitHub Actions.

## Required GitHub Secrets

You need to configure the following secrets in your GitHub repository:

1. `APPLE_CERTIFICATE` - Base64-encoded .p12 certificate file
2. `APPLE_CERTIFICATE_PASSWORD` - Password for the .p12 certificate
3. `APPLE_SIGNING_IDENTITY` - Signing identity (e.g., "Developer ID Application: Your Name")
4. `APPLE_TEAM_ID` - Your Apple Developer Team ID

## Step-by-Step Instructions

### 1. Get Your Apple Team ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Sign in with your Apple Developer account
3. Click on **Membership** in the left sidebar
4. Your **Team ID** is displayed at the top (e.g., `ABC123DEF4`)
5. Copy this value - this is your `APPLE_TEAM_ID`

### 2. Create a Developer ID Application Certificate

1. Go to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list)
2. Click the **+** button to create a new certificate
3. Select **Developer ID Application** (under the "Software" section)
4. Click **Continue**
5. Follow the instructions to create a Certificate Signing Request (CSR):
   - Open **Keychain Access** on your Mac
   - Go to **Keychain Access** → **Certificate Assistant** → **Request a Certificate From a Certificate Authority**
   - Enter your email address and name
   - Select **Saved to disk** and click **Continue**
   - Save the `.certSigningRequest` file
6. Upload the CSR file in the Apple Developer Portal
7. Click **Continue** and then **Download** the certificate
8. Double-click the downloaded `.cer` file to install it in Keychain Access

### 3. Export the Certificate as a .p12 File

1. Open **Keychain Access** on your Mac
2. Select **login** keychain (or **System** if you installed it there)
3. Find your **Developer ID Application** certificate
4. Expand it to see the associated private key
5. Select both the certificate and its private key
6. Right-click and choose **Export 2 items...**
7. Choose **Personal Information Exchange (.p12)** format
8. Save the file (e.g., `certificate.p12`)
9. **Important**: Set a password when prompted - this is your `APPLE_CERTIFICATE_PASSWORD`
10. Save this password securely

### 4. Convert .p12 to Base64

Run this command in Terminal (replace `certificate.p12` with your actual filename):

```bash
base64 -i certificate.p12 | pbcopy
```

This copies the base64-encoded certificate to your clipboard. Alternatively, save it to a file:

```bash
base64 -i certificate.p12 > certificate_base64.txt
```

The entire base64 string (including the header/footer if present) is your `APPLE_CERTIFICATE`.

### 5. Get Your Signing Identity

Run this command in Terminal to list your available signing identities:

```bash
security find-identity -v -p codesigning
```

Look for a line that contains **Developer ID Application** and your name/company. It will look like:

```
Developer ID Application: Your Name (TEAM_ID)
```

The full string (including "Developer ID Application:") is your `APPLE_SIGNING_IDENTITY`.

Example:
- `Developer ID Application: John Doe (ABC123DEF4)`

### 6. Add Secrets to GitHub

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each of the following:

   **APPLE_CERTIFICATE:**
   - Name: `APPLE_CERTIFICATE`
   - Value: Paste the entire base64 string from step 4

   **APPLE_CERTIFICATE_PASSWORD:**
   - Name: `APPLE_CERTIFICATE_PASSWORD`
   - Value: The password you set when exporting the .p12 file

   **APPLE_SIGNING_IDENTITY:**
   - Name: `APPLE_SIGNING_IDENTITY`
   - Value: The full signing identity from step 5 (e.g., `Developer ID Application: Your Name (TEAM_ID)`)

   **APPLE_TEAM_ID:**
   - Name: `APPLE_TEAM_ID`
   - Value: Your Team ID from step 1 (e.g., `ABC123DEF4`)

## Verification

After adding the secrets, trigger a build and check:

1. The build should complete successfully
2. DMG files should be created and uploaded as artifacts
3. The DMG files should be properly signed (you can verify this by downloading and checking)

## Troubleshooting

### Certificate Not Found
- Ensure the certificate is installed in the **login** keychain
- Make sure you exported both the certificate AND its private key

### Invalid Signing Identity
- Verify the exact string matches what `security find-identity` shows
- Include the full string including "Developer ID Application:"

### Base64 Encoding Issues
- Make sure you're encoding the entire .p12 file, not just the certificate
- Don't include line breaks in the base64 string when adding to GitHub secrets

### Team ID Issues
- Verify your Team ID is correct (it's case-sensitive)
- Make sure you're using the Team ID, not your Apple ID

## Security Notes

- Never commit these secrets to your repository
- Keep your .p12 certificate file secure
- Rotate certificates periodically (Apple certificates expire)
- Use GitHub Secrets to store all sensitive values

## Additional Resources

- [Apple Code Signing Guide](https://developer.apple.com/documentation/security/code_signing_services)
- [Tauri Code Signing Documentation](https://tauri.app/v1/guides/building/macos#code-signing)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)


