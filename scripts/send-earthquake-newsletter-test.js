#!/usr/bin/env node
/**
 * Send earthquake alerts rollout newsletter test to a specific email
 * Usage: node scripts/send-earthquake-newsletter-test.js [email] [NEWSLETTER_KEY]
 *   If NEWSLETTER_KEY omitted, uses env NEWSLETTER_KEY or .env
 */

const fs = require('fs');
const path = require('path');

const testEmail = process.argv[2] || 'mr.pangolinman@gmail.com';
const keyArg = process.argv[3];

const newsletterPath = path.join(__dirname, '../newsletter-earthquake-alerts-rollout.html');
if (!fs.existsSync(newsletterPath)) {
  console.error('❌ Newsletter file not found:', newsletterPath);
  process.exit(1);
}

const htmlContent = fs.readFileSync(newsletterPath, 'utf8');
const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const textContent = htmlContent
  .replace(/<[^>]*>/g, '')
  .replace(/\s+/g, ' ')
  .trim();

async function sendTest() {
  // Load .env for NEWSLETTER_KEY
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  const token = keyArg || process.env.NEWSLETTER_KEY;
  if (!token) {
    console.error('❌ NEWSLETTER_KEY required. Either:');
    console.error('   • Add NEWSLETTER_KEY to .env');
    console.error('   • Or: node scripts/send-earthquake-newsletter-test.js mr.pangolinman@gmail.com YOUR_KEY');
    process.exit(1);
  }

  console.log(`📧 Sending earthquake alerts newsletter test to ${testEmail}...\n`);

  const payload = {
    token,
    subject: 'Noteworthy News: Earthquake Alerts Now Live',
    html: htmlContent
      .replace(/\{\{DATE_PLACEHOLDER\}\}/g, dateStr)
      .replace(/\{\{FULL_NAME\}\}/g, 'Reader')
      .replace(/\{\{FIRST_NAME\}\}/g, 'Reader')
      .replace(/\{\{EMAIL_USERNAME\}\}/g, 'reader'),
    text: textContent,
    includeRecentPosts: false,
    sendToEmails: [testEmail],
  };

  try {
    const baseUrl = process.env.URL || process.env.NETLIFY_URL || 'https://noteworthynews.co';
    const url = `${baseUrl.replace(/\/$/, '')}/.netlify/functions/send-newsletter`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ Test email sent successfully!');
      console.log(`   Sent to: ${testEmail}`);
      console.log(`   Subject: ${payload.subject}`);
      console.log('\n💡 Check your inbox (and spam folder) for the email.');
    } else {
      console.error('❌ Failed to send:');
      console.error('   ', data.error || data.message || JSON.stringify(data));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

sendTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
