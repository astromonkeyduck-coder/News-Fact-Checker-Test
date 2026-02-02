#!/usr/bin/env node
/**
 * Generate VAPID Keys for Web Push Notifications
 * 
 * Run this script once to generate VAPID keys:
 *   node scripts/generate-vapid-keys.js
 * 
 * Then add the keys to your Netlify environment variables:
 *   VAPID_PUBLIC_KEY=<public key>
 *   VAPID_PRIVATE_KEY=<private key>
 *   VAPID_SUBJECT=mailto:richard@noteworthynews.co
 */

const webpush = require('web-push');

console.log('Generating VAPID keys for Noteworthy News Push Notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('='.repeat(60));
console.log('VAPID KEYS GENERATED SUCCESSFULLY');
console.log('='.repeat(60));
console.log('\nAdd these to your Netlify environment variables:\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:richard@noteworthynews.co');
console.log('\n' + '='.repeat(60));
console.log('\nIMPORTANT:');
console.log('- Keep the PRIVATE key secret! Never expose it in client-side code.');
console.log('- The PUBLIC key is safe to include in your frontend JavaScript.');
console.log('- Set these in Netlify: Site Settings → Environment Variables');
console.log('='.repeat(60) + '\n');
