#!/usr/bin/env node
/**
 * List Resend newsletter audience (subscribed vs unsubscribed).
 * Usage: node scripts/list-newsletter-audience.js
 * Requires RESEND_API_KEY and RESEND_AUDIENCE_ID in .env
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Resend } = require('resend');

async function listAudience() {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) {
    console.error('❌ RESEND_API_KEY and RESEND_AUDIENCE_ID required in .env');
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  const subscribed = [];
  const unsubscribed = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await resend.contacts.list({ audienceId, page });
    const contacts = res.data?.data || [];
    (contacts || []).forEach((c) => {
      if (c.unsubscribed) unsubscribed.push({ email: c.email, firstName: c.firstName, lastName: c.lastName });
      else subscribed.push({ email: c.email, firstName: c.firstName, lastName: c.lastName });
    });
    const pagination = res.data || {};
    const hasMoreFlag = pagination.has_more === true || pagination.hasMore === true;
    hasMore = contacts.length > 0 || hasMoreFlag;
    page++;
    if (page > 100) hasMore = false;
  }

  console.log('\n📋 Newsletter audience');
  console.log('   Subscribed (receive emails):', subscribed.length);
  subscribed.forEach((c) => console.log('   •', c.email));
  console.log('\n   Unsubscribed (do not receive):', unsubscribed.length);
  unsubscribed.forEach((c) => console.log('   •', c.email));
  console.log('');
}

listAudience().catch((e) => {
  console.error(e);
  process.exit(1);
});
