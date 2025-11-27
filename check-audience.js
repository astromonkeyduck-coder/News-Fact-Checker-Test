#!/usr/bin/env node
/**
 * Check audience contacts - diagnostic tool
 */

require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;

if (!AUDIENCE_ID) {
  console.error('❌ RESEND_AUDIENCE_ID not set in .env');
  process.exit(1);
}

async function checkAudience() {
  console.log('🔍 Checking audience:', AUDIENCE_ID);
  console.log('📋 Looking for audience named: Newsletter Subscribers\n');

  try {
    // First, list all audiences to find the right one
    console.log('📊 Listing all audiences...');
    const audiencesResponse = await resend.audiences.list();
    const audiences = audiencesResponse.data?.data || [];
    
    console.log(`Found ${audiences.length} audiences:\n`);
    audiences.forEach((audience, index) => {
      console.log(`${index + 1}. ${audience.name} (ID: ${audience.id})`);
      if (audience.name === 'Newsletter Subscribers' || audience.name.includes('Newsletter')) {
        console.log(`   ⭐ MATCHES! This might be the one.`);
        if (audience.id !== AUDIENCE_ID) {
          console.log(`   ⚠️  WARNING: ID mismatch! Expected: ${AUDIENCE_ID}, Got: ${audience.id}`);
        }
      }
    });

    console.log(`\n📧 Using Audience ID: ${AUDIENCE_ID}\n`);

    // Now fetch contacts from the audience
    console.log('📬 Fetching contacts from audience...\n');
    let allContacts = [];
    let page = 1;
    let hasMore = true;
    let totalPages = 0;

    while (hasMore) {
      try {
        const contactsResponse = await resend.contacts.list({
          audienceId: AUDIENCE_ID,
          page: page,
        });

        const contacts = contactsResponse.data?.data || [];
        const pagination = contactsResponse.data || {};
        
        console.log(`Page ${page}:`);
        console.log(`  Total contacts on page: ${contacts.length}`);
        
        if (contacts.length > 0) {
          const subscribed = contacts.filter(c => !c.unsubscribed);
          const unsubscribed = contacts.filter(c => c.unsubscribed === true);
          
          console.log(`  ✅ Subscribed: ${subscribed.length}`);
          console.log(`  ❌ Unsubscribed: ${unsubscribed.length}`);
          
          if (subscribed.length > 0) {
            console.log(`  📧 Subscribed emails:`);
            subscribed.forEach(c => {
              console.log(`     - ${c.email} (ID: ${c.id})`);
            });
          }
          
          if (unsubscribed.length > 0) {
            console.log(`  🚫 Unsubscribed emails:`);
            unsubscribed.forEach(c => {
              console.log(`     - ${c.email} (ID: ${c.id})`);
            });
          }
          
          allContacts = allContacts.concat(contacts);
        }

        hasMore = pagination.has_more === true && contacts.length > 0;
        totalPages = page;
        page++;
        
        if (page > 100) {
          console.log('\n⚠️  Reached page limit (100)');
          break;
        }
      } catch (error) {
        console.error(`\n❌ Error on page ${page}:`, error.message);
        if (error.response) {
          console.error('Response:', JSON.stringify(error.response, null, 2));
        }
        hasMore = false;
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`  Total pages checked: ${totalPages}`);
    console.log(`  Total contacts found: ${allContacts.length}`);
    
    const subscribed = allContacts.filter(c => !c.unsubscribed);
    const unsubscribed = allContacts.filter(c => c.unsubscribed === true);
    
    console.log(`  ✅ Subscribed: ${subscribed.length}`);
    console.log(`  ❌ Unsubscribed: ${unsubscribed.length}`);
    
    if (subscribed.length > 0) {
      console.log(`\n📧 All subscribed emails:`);
      subscribed.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.email}`);
      });
    } else {
      console.log(`\n⚠️  No subscribed contacts found!`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response, null, 2));
    }
    console.error(error.stack);
    process.exit(1);
  }
}

checkAudience();

