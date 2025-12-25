/**
 * Shared function to send email alerts for verified events
 * Used by all engines to send email alerts for notable events
 */

/**
 * Format time for human-readable display
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}

/**
 * Send email alert for a verified event
 * @param {Object} event - Verified event object
 * @param {string} eventType - Event type name (e.g., "Earthquake", "Weather Alert")
 * @param {string} sourceName - Source name (e.g., "USGS", "NWS")
 * @param {string|null} imageUrl - Optional image URL (not used for now)
 * @returns {boolean} True if alert sent successfully
 */
async function sendEventAlert(event, eventType, sourceName, imageUrl = null) {
  // Check if we're in dry run mode
  const dryRun = process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
  if (dryRun) {
    console.log(`[sendAlert] DRY_RUN: Would send ${eventType} alert for ${event.canonical_id}`);
    return false;
  }
  
  // Check if alert already sent
  if (event.alert_sent) {
    console.log(`[sendAlert] Alert already sent for ${event.canonical_id}`);
    return false;
  }
  
  // Get notification emails
  let notificationEmails = [];
  if (process.env.AI_NOTIFICATION_EMAILS) {
    try {
      notificationEmails = JSON.parse(process.env.AI_NOTIFICATION_EMAILS);
      if (!Array.isArray(notificationEmails)) {
        throw new Error('Not an array');
      }
    } catch {
      notificationEmails = process.env.AI_NOTIFICATION_EMAILS.split(',').map(e => e.trim()).filter(e => e);
    }
  }
  
  if (notificationEmails.length === 0 && process.env.ALERT_TO_EMAIL) {
    notificationEmails = [process.env.ALERT_TO_EMAIL];
  }
  
  // Filter out test emails
  notificationEmails = notificationEmails.filter(email => 
    email.toLowerCase() !== 'mr.pangolinman@example.com' && 
    email.toLowerCase() !== 'pangolinman@example.com'
  );
  
  if (notificationEmails.length === 0) {
    console.warn('[sendAlert] No notification emails configured');
    return false;
  }
  
  // Check if Resend API key is configured
  if (!process.env.RESEND_API_KEY) {
    console.warn('[sendAlert] RESEND_API_KEY not configured');
    return false;
  }
  
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  // Format time
  const eventTime = formatTime(event.published_at);
  
  // Build subject based on severity
  let severityText = '';
  if (event.severity >= 5) severityText = 'CRITICAL';
  else if (event.severity >= 4) severityText = 'BREAKING';
  else if (event.severity >= 3) severityText = 'ALERT';
  else severityText = 'UPDATE';
  
  const subject = `${severityText}: ${eventType} - ${event.location_display}`;
  
  // Build message (common-person wording, no jargon)
  const message = `${severityText}: ${event.summary || event.title} at ${eventTime}.\n\nSource: ${sourceName}`;
  
  // Build email content
  const emailContent = {
    from: process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>',
    subject: subject,
    text: message,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #d32f2f; margin-bottom: 20px;">${severityText}: ${eventType}</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #333;">
          ${event.summary || event.title}
        </p>
        <p style="font-size: 14px; color: #666; margin-top: 20px;">
          <strong>Location:</strong> ${event.location_display}<br>
          <strong>Time:</strong> ${eventTime}<br>
          <strong>Source:</strong> ${sourceName}
        </p>
        <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
          <a href="${event.source_url}" style="color: #4a90e2;">View on ${sourceName} website</a>
        </p>
      </div>
    `,
  };
  
  // Send email to all notification emails
  const emailResults = await Promise.allSettled(
    notificationEmails.map(async (email) => {
      return await resend.emails.send({
        ...emailContent,
        to: email,
      });
    })
  );
  
  // Check results
  const successful = emailResults.filter(r => r.status === 'fulfilled' && !r.value.error);
  const failed = emailResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error));
  
  if (failed.length > 0) {
    console.error('[sendAlert] Some emails failed:', failed);
  }
  
  if (successful.length === 0) {
    console.error('[sendAlert] All emails failed');
    return false;
  }
  
  console.log(`[sendAlert] Alert sent successfully to ${successful.length} recipient(s) for ${event.canonical_id}`);
  return true;
}

module.exports = {
  sendEventAlert,
  formatTime,
};

