#!/usr/bin/env node
/**
 * Send earthquake alerts rollout newsletter to full Resend audience.
 * Usage: node scripts/send-earthquake-newsletter-to-audience.js [NEWSLETTER_KEY]
 *   If NEWSLETTER_KEY omitted, uses env NEWSLETTER_KEY or .env
 * Optional: NEWSLETTER_KEY forceSend  (e.g. your-secret-key true) to bypass 24h cooldown.
 */

const fs = require('fs');
const path = require('path');

const keyArg = process.argv[2];
const forceArg = process.argv[3];

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

async function sendToAudience() {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  const token = keyArg || process.env.NEWSLETTER_KEY;
  if (!token) {
    console.error('❌ NEWSLETTER_KEY required. Either:');
    console.error('   • Add NEWSLETTER_KEY to .env');
    console.error('   • Or: node scripts/send-earthquake-newsletter-to-audience.js YOUR_KEY');
    process.exit(1);
  }

  const forceSend = forceArg === 'true' || forceArg === '1';

  console.log('📧 Sending earthquake alerts newsletter to full audience...');
  if (forceSend) console.log('   (forceSend: true – bypassing 24h cooldown)\n');

  const baseUrl = process.env.URL || process.env.NETLIFY_URL || 'https://noteworthynews.co';
  try {
    const genRes = await fetch(`${baseUrl.replace(/\/$/, '')}/.netlify/functions/generate-sample-earthquake-map`);
    if (genRes.ok) {
      const genData = await genRes.json();
      console.log('✅ Sample map image ready:', genData.url?.substring(0, 60) + '...');
    }
  } catch (e) {
    console.warn('⚠️ Could not generate sample map (may already exist):', e.message);
  }

  // No sendToEmails or testEmail = send to audience. Placeholders filled per-contact on server.
  const payload = {
    token,
    subject: 'Noteworthy News: Earthquake Alerts Now Live',
    html: htmlContent.replace(/\{\{DATE_PLACEHOLDER\}\}/g, dateStr),
    text: textContent,
    includeRecentPosts: false,
    forceSend: forceSend,
    includeFailedRecipients: true, // Get back who didn't receive it (failed sends)
  };

  try {
    const url = `${baseUrl.replace(/\/$/, '')}/.netlify/functions/send-newsletter`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('\n✅ Newsletter sent to audience successfully!');
      console.log('   Subject: Noteworthy News: Earthquake Alerts Now Live');
      if (data.emailsSent != null) console.log(`   Emails sent: ${data.emailsSent}`);
      if (data.contactsCount != null) console.log(`   Contacts (subscribed): ${data.contactsCount}`);
      if (data.failedCount > 0 && data.failedRecipients && data.failedRecipients.length > 0) {
        console.log(`\n❌ Did not receive (${data.failedRecipients.length}):`);
        data.failedRecipients.forEach((r) => console.log(`   • ${r.email}  ${r.error || ''}`));
      }
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

sendToAudience().catch((e) => {
  console.error(e);
  process.exit(1);
});
