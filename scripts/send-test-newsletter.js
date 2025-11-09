#!/usr/bin/env node
/**
 * Send a test newsletter email to a specific email address
 * Usage: node scripts/send-test-newsletter.js [email] [subject]
 */

const testEmail = process.argv[2] || 'richard@noteworthynews.co';
const subject = process.argv[3] || 'Test Newsletter - Noteworthy News';

const testHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%); border-radius: 10px 10px 0 0;">
              <img src="https://noteworthynews.co/IMG_5992.PNG" alt="Noteworthy News Logo" style="max-width: 150px; height: auto; border-radius: 50%; display: block; margin: 0 auto 20px; border: 3px solid #4a90e2; box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);" />
              <h2 style="color: #4a90e2; margin: 0; font-size: 24px; font-weight: bold;">🧪 Test Newsletter</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hi there,</p>
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">This is a <strong>test email</strong> to verify that your newsletter system is working correctly!</p>
              
              <div style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-left: 4px solid #4a90e2; padding: 20px; margin: 20px 0; border-radius: 5px;">
                <h3 style="color: #4a90e2; margin: 0 0 15px 0; font-size: 20px;">📰 Test Content</h3>
                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0;">If you're seeing this email, your newsletter sending system is working! You can now send newsletters to your full audience.</p>
              </div>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 25px 0 0 0;"><strong>Ready to send to your audience!</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 30px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-top: 2px solid #4a90e2; border-radius: 0 0 10px 10px;">
              <p style="color: #333333; font-size: 16px; margin: 0 0 8px 0; line-height: 1.5;"><strong>The Noteworthy News Team</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const testText = `Test Newsletter - Noteworthy News

Hi there,

This is a test email to verify that your newsletter system is working correctly!

📰 Test Content
If you're seeing this email, your newsletter sending system is working! You can now send newsletters to your full audience.

Ready to send to your audience!

The Noteworthy News Team`;

async function sendTestEmail() {
  console.log(`📧 Sending test newsletter to ${testEmail}...\n`);
  
  try {
    const response = await fetch('https://noteworthynews.co/.netlify/functions/send-newsletter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: subject,
        html: testHTML,
        text: testText,
        testEmail: testEmail, // Add test email parameter
      }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Test email sent successfully!');
      console.log(`   Sent to: ${testEmail}`);
      console.log(`   Subject: ${subject}`);
      console.log(`\n💡 Check your inbox (and spam folder) for the test email.`);
    } else {
      console.error('❌ Failed to send test email:');
      console.error('   Error:', data.error || data.message);
    }
  } catch (error) {
    console.error('❌ Error sending test email:', error.message);
  }
}

sendTestEmail().catch(console.error);

