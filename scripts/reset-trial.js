#!/usr/bin/env node

/**
 * Reset Trial Period Script
 * 
 * This script clears the trial data from localStorage.
 * Run this before starting the dev server to reset the trial.
 * 
 * Usage:
 *   node scripts/reset-trial.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Resetting trial period...\n');

// Note: This script can't directly access browser localStorage
// Instead, it provides instructions and creates a bookmarklet

const bookmarklet = `
javascript:(function(){
  localStorage.removeItem("servicebusexplorer_trial_start");
  localStorage.removeItem("servicebusexplorer_purchase_status");
  window.location.reload();
  console.log("✅ Trial reset!");
})();
`;

console.log('📋 Instructions:');
console.log('1. Open your app in the browser');
console.log('2. Open the browser console (F12 or Cmd+Option+I)');
console.log('3. Copy and paste this code:\n');
console.log(bookmarklet);
console.log('\nOr use the test helper (if in dev mode):');
console.log('  testLicense.reset()\n');

console.log('✅ Instructions printed above!');


