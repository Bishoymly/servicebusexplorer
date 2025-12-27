# Testing License & Purchase Flow

This guide explains how to test the trial and purchase system.

## Quick Testing Methods

### Method 1: Browser DevTools (Easiest for Development)

1. **Open the app in browser** (`npm run dev`)
2. **Open Browser DevTools** (F12 or Cmd+Option+I)
3. **Go to Console tab**
4. **Run these commands to test different states:**

#### Test Fresh Install (New Trial)
```javascript
localStorage.removeItem('servicebusexplorer_trial_start')
localStorage.removeItem('servicebusexplorer_purchase_status')
location.reload()
```
Expected: Should show "3 days remaining" banner

#### Test Trial Day 2
```javascript
const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000)
localStorage.setItem('servicebusexplorer_trial_start', twoDaysAgo.toString())
localStorage.removeItem('servicebusexplorer_purchase_status')
location.reload()
```
Expected: Should show "1 day remaining" banner

#### Test Trial Expired (Grace Period)
```javascript
const fourDaysAgo = Date.now() - (4 * 24 * 60 * 60 * 1000)
localStorage.setItem('servicebusexplorer_trial_start', fourDaysAgo.toString())
localStorage.removeItem('servicebusexplorer_purchase_status')
location.reload()
```
Expected: Should show "Trial expired. You have 1 day grace period" banner, app still works

#### Test Trial Fully Expired (After Grace)
```javascript
const fiveDaysAgo = Date.now() - (5 * 24 * 60 * 60 * 1000)
localStorage.setItem('servicebusexplorer_trial_start', fiveDaysAgo.toString())
localStorage.removeItem('servicebusexplorer_purchase_status')
location.reload()
```
Expected: Should show purchase screen blocking access

#### Test Purchased State
```javascript
const purchaseStatus = {
  purchased: true,
  purchaseDate: Date.now(),
  productId: 'com.bishoylabib.servicebusexplorer.full'
}
localStorage.setItem('servicebusexplorer_purchase_status', JSON.stringify(purchaseStatus))
location.reload()
```
Expected: No banner, full access, no restrictions

#### Check Current License Status
```javascript
const trialStart = localStorage.getItem('servicebusexplorer_trial_start')
const purchaseStatus = localStorage.getItem('servicebusexplorer_purchase_status')
console.log('Trial Start:', trialStart ? new Date(parseInt(trialStart)).toLocaleString() : 'Not set')
console.log('Purchase Status:', purchaseStatus ? JSON.parse(purchaseStatus) : 'Not purchased')
```

### Method 2: Tauri Desktop App Testing

1. **Build and run the Tauri app:**
   ```bash
   npm run tauri:dev
   ```

2. **Open DevTools in Tauri:**
   - Right-click in the app window
   - Select "Inspect Element" or press `Cmd+Option+I` (macOS) / `Ctrl+Shift+I` (Windows/Linux)

3. **Use the same localStorage commands** as Method 1

4. **Test Tauri-specific features:**
   - Purchase button should open App Store (or show error in dev)
   - Native license check commands should work

### Method 3: Manual Time Manipulation (For Quick Testing)

Create a test utility file to quickly switch between states:

```javascript
// In browser console, paste this helper:
window.testLicense = {
  reset: () => {
    localStorage.removeItem('servicebusexplorer_trial_start')
    localStorage.removeItem('servicebusexplorer_purchase_status')
    location.reload()
  },
  setTrialDays: (days) => {
    const startDate = Date.now() - ((3 - days) * 24 * 60 * 60 * 1000)
    localStorage.setItem('servicebusexplorer_trial_start', startDate.toString())
    localStorage.removeItem('servicebusexplorer_purchase_status')
    location.reload()
  },
  expireTrial: () => {
    const fiveDaysAgo = Date.now() - (5 * 24 * 60 * 60 * 1000)
    localStorage.setItem('servicebusexplorer_trial_start', fiveDaysAgo.toString())
    localStorage.removeItem('servicebusexplorer_purchase_status')
    location.reload()
  },
  setPurchased: () => {
    localStorage.setItem('servicebusexplorer_purchase_status', JSON.stringify({
      purchased: true,
      purchaseDate: Date.now(),
      productId: 'com.bishoylabib.servicebusexplorer.full'
    }))
    location.reload()
  },
  status: () => {
    const trialStart = localStorage.getItem('servicebusexplorer_trial_start')
    const purchase = localStorage.getItem('servicebusexplorer_purchase_status')
    console.table({
      'Trial Start': trialStart ? new Date(parseInt(trialStart)).toLocaleString() : 'Not set',
      'Purchase Status': purchase ? 'Purchased' : 'Not purchased',
      'Days Remaining': trialStart ? Math.ceil((parseInt(trialStart) + (3 * 24 * 60 * 60 * 1000) - Date.now()) / (24 * 60 * 60 * 1000)) : 'N/A'
    })
  }
}
```

Then use:
- `testLicense.reset()` - Fresh install
- `testLicense.setTrialDays(2)` - 2 days remaining
- `testLicense.expireTrial()` - Expired (blocked)
- `testLicense.setPurchased()` - Purchased state
- `testLicense.status()` - Check current status

## Testing Checklist

### ✅ Trial System
- [ ] **Fresh Install**: Shows "3 days remaining" banner
- [ ] **Day 2**: Shows "1 day remaining" banner  
- [ ] **Day 3**: Shows "0 days remaining" or grace period message
- [ ] **Grace Period**: Shows grace period message, app still works
- [ ] **Expired**: Shows purchase screen, blocks access

### ✅ UI Components
- [ ] **Trial Banner**: Appears at top when in trial
- [ ] **Trial Banner**: Hidden when purchased
- [ ] **Purchase Button**: Appears in header during trial
- [ ] **Purchase Dialog**: Opens when clicking purchase button
- [ ] **Purchase Dialog**: Shows correct pricing ($19.99)
- [ ] **License Gate**: Blocks content when expired
- [ ] **License Gate**: Allows access during trial and after purchase

### ✅ Purchase Flow
- [ ] **Purchase Button**: Opens purchase dialog
- [ ] **App Store Link**: Opens App Store page (in production)
- [ ] **Purchase Status**: Saves correctly after purchase
- [ ] **After Purchase**: Banner disappears, full access granted

### ✅ Edge Cases
- [ ] **Web Version**: No restrictions (should work normally)
- [ ] **Offline**: Trial status cached, works offline
- [ ] **Multiple Tabs**: License status syncs (via localStorage)
- [ ] **App Restart**: Trial start date persists
- [ ] **Purchase Persists**: Purchase status survives app restart

### ✅ Tauri-Specific
- [ ] **Native Commands**: `check_license_status` works
- [ ] **Purchase Initiation**: `initiate_purchase` opens App Store
- [ ] **Receipt Verification**: `verify_receipt` returns status
- [ ] **Platform Detection**: macOS shows restrictions, others don't

## Testing Purchase Flow (Production)

### Sandbox Testing (Before Release)

1. **Create Sandbox Tester Account:**
   - App Store Connect → Users and Access → Sandbox Testers
   - Create test Apple ID (use different email than your main account)

2. **Test on Device:**
   - Sign out of App Store on test device
   - Run app, attempt purchase
   - Sign in with sandbox tester account when prompted
   - Complete purchase (it's free in sandbox)

3. **Verify Purchase:**
   - Check that purchase status is saved
   - Restart app, verify purchase persists
   - Check receipt validation

### Production Testing

1. **TestFlight Build:**
   - Upload build with in-app purchase configured
   - Test with real purchase (will be charged)
   - Verify receipt validation works

2. **App Store Release:**
   - Submit app with in-app purchase
   - Apple will review the purchase flow
   - Once approved, test with real purchase

## Debugging Tips

### Check License State in Console
```javascript
// Get current license state
const trialStart = localStorage.getItem('servicebusexplorer_trial_start')
const purchase = localStorage.getItem('servicebusexplorer_purchase_status')

console.log('Trial Start:', trialStart)
console.log('Purchase:', purchase)

// Calculate days remaining
if (trialStart) {
  const start = parseInt(trialStart)
  const now = Date.now()
  const days = Math.ceil((start + (3 * 24 * 60 * 60 * 1000) - now) / (24 * 60 * 60 * 1000))
  console.log('Days Remaining:', days)
}
```

### Check React Context State
In browser console, you can access the license context if you expose it:
```javascript
// The license state is managed in React context
// Check the Network tab for any API calls
// Check Console for any errors
```

### Common Issues

**Issue**: Banner not showing
- **Fix**: Check if running in Tauri (`__TAURI__` in window)
- **Fix**: Check localStorage for trial start date

**Issue**: Purchase not saving
- **Fix**: Check browser console for errors
- **Fix**: Verify localStorage is writable
- **Fix**: Check Tauri command responses

**Issue**: App blocked when it shouldn't be
- **Fix**: Check purchase status in localStorage
- **Fix**: Verify trial start date calculation
- **Fix**: Check if grace period logic is correct

## Automated Testing (Future)

Consider adding:
- Unit tests for license storage functions
- Integration tests for license context
- E2E tests for purchase flow (with mocks)

