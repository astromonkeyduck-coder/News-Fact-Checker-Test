/**
 * Unified Notification Dispatcher
 *
 * Given a normalized AlertEvent, routes delivery to the correct channels:
 *  - Email (earthquake-specific rich email, or generic event email)
 *  - Push notifications (via web-push)
 *  - Location-based alerts
 *
 * Engines never call delivery functions directly.  They return events;
 * the orchestrator (ingest-all) calls notifyForEvent() after storage.
 *
 * Design constraints:
 *  - Never block on image generation - send text-fallback immediately.
 *  - Rate-limit per user per type per day.
 *  - Deduplicate by event ID - never notify twice for the same event.
 *  - Fail gracefully - one channel failure does not block others.
 */

const { getNotificationChannels, getPushType } = require('./alertEvent');
const { checkAlertDedup, recordAlertSent } = require('./alertRateLimit');

/**
 * Dispatch notifications for a single AlertEvent.
 *
 * @param {Object} alertEvent - Normalized AlertEvent from alertEvent.js.
 * @param {Object} [options]
 * @param {Object} [options.logger] - Structured logger ({ info, warn, error }).
 * @param {boolean} [options.dryRun=false] - Log but don't actually send.
 * @param {boolean} [options.skipDedup=false] - Bypass dedup check (for retries).
 * @returns {Object} { emailResult, pushResult, locationResult }
 */
async function notifyForEvent(alertEvent, options = {}) {
  const logger = options.logger || console;
  const dryRun = options.dryRun || process.env.DRY_RUN === 'true';

  const result = {
    eventId: alertEvent.id,
    channels: { email: false, push: false, locationEmail: false },
    email: { sent: false, reason: null },
    push: { sent: 0, failed: 0 },
    location: { sent: 0, skipped: 0 },
  };

  // Determine which channels apply
  const channels = getNotificationChannels(alertEvent);
  result.channels = { ...channels };

  if (!channels.email && !channels.push && !channels.locationEmail) {
    logger.info?.('[notify] No channels active for event', { id: alertEvent.id, type: alertEvent.type, severity: alertEvent.severity });
    return result;
  }

  // Dedup: check if we already notified for this event
  if (!options.skipDedup) {
    const alreadySent = await checkAlertDedup(alertEvent.id);
    if (alreadySent) {
      logger.info?.('[notify] Already notified for event, skipping', { id: alertEvent.id });
      result.email.reason = 'dedup';
      return result;
    }
  }

  if (dryRun) {
    logger.info?.('[notify] DRY_RUN: would notify', { id: alertEvent.id, channels });
    return result;
  }

  // Run channels in parallel - failures in one channel don't block others
  const promises = [];

  if (channels.email) {
    promises.push(
      sendEmailNotification(alertEvent, logger)
        .then(r => { result.email = r; })
        .catch(err => {
          logger.error?.('[notify] Email failed', { id: alertEvent.id, error: err.message });
          result.email = { sent: false, reason: err.message };
        })
    );
  }

  if (channels.push) {
    promises.push(
      sendPushNotification(alertEvent, logger)
        .then(r => { result.push = r; })
        .catch(err => {
          logger.error?.('[notify] Push failed', { id: alertEvent.id, error: err.message });
          result.push = { sent: 0, failed: 0, reason: err.message };
        })
    );
  }

  if (channels.locationEmail) {
    promises.push(
      sendLocationNotifications(alertEvent, logger)
        .then(r => { result.location = r; })
        .catch(err => {
          logger.error?.('[notify] Location email failed', { id: alertEvent.id, error: err.message });
          result.location = { sent: 0, skipped: 0, reason: err.message };
        })
    );
  }

  await Promise.all(promises);

  // Record that we notified for this event (dedup marker)
  const anySent = result.email.sent || result.push.sent > 0 || result.location.sent > 0;
  if (anySent) {
    await recordAlertSent(alertEvent.id, result).catch(err => {
      logger.warn?.('[notify] Failed to record dedup marker', { error: err.message });
    });
  }

  logger.info?.('[notify] Dispatch complete', {
    id: alertEvent.id,
    type: alertEvent.type,
    email: result.email.sent,
    push: result.push.sent,
    location: result.location.sent,
  });

  return result;
}

/* ── Email channel ─────────────────────────────────── */

async function sendEmailNotification(alertEvent, logger) {
  if (alertEvent.type === 'earthquake') {
    return sendEarthquakeEmail(alertEvent, logger);
  }
  return sendGenericEventEmail(alertEvent, logger);
}

/**
 * Earthquake-specific rich email.
 * Delegates to the existing send-earthquake-alert function's logic,
 * but called as a library, not via HTTP.
 */
async function sendEarthquakeEmail(alertEvent, logger) {
  // Env kill-switch preserved for operational safety
  if (process.env.EARTHQUAKE_EMAIL_ALERTS_DISABLED === 'true') {
    return { sent: false, reason: 'disabled_by_env' };
  }

  const { getEarthquakeAlertRecipients } = require('./getEarthquakeAlertUsers');

  const magnitude = alertEvent.assets?.magnitude || 0;
  const recipients = await getEarthquakeAlertRecipients(magnitude);

  // Also include admin/notification emails
  const adminEmails = getAdminNotificationEmails();
  const allRecipients = deduplicateEmails([...recipients, ...adminEmails]);

  if (allRecipients.length === 0) {
    return { sent: false, reason: 'no_recipients' };
  }

  const { Resend } = require('resend');
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: 'resend_not_configured' };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
  const severityLabel = alertEvent.priority === 'critical' ? 'CRITICAL' : alertEvent.priority === 'high' ? 'BREAKING' : 'ALERT';
  const location = alertEvent.location.display || 'Unknown Location';
  const eventTime = formatTime(alertEvent.publishedAt);

  const subject = `${severityLabel}: M${magnitude} Earthquake - ${location}`;
  const imageUrl = alertEvent.assets?.imageUrl;

  const html = buildEarthquakeEmailHtml({
    severityLabel,
    magnitude,
    location,
    eventTime,
    summary: alertEvent.summary || alertEvent.title,
    sourceUrl: alertEvent.sourceUrl,
    imageUrl,
    eventId: alertEvent.id,
  });

  const results = await Promise.allSettled(
    allRecipients.map(email =>
      resend.emails.send({ from: fromEmail, to: email, subject, html, text: `${severityLabel}: M${magnitude} Earthquake near ${location} at ${eventTime}. ${alertEvent.summary || ''}` })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
  const failed = results.length - sent;

  if (failed > 0) {
    logger.warn?.('[notify:email] Some earthquake emails failed', { sent, failed, total: allRecipients.length });
  }

  return { sent: sent > 0, count: sent, failed, total: allRecipients.length };
}

/**
 * Generic event email for non-earthquake events.
 * Sends to admin/notification email list.
 */
async function sendGenericEventEmail(alertEvent, logger) {
  const adminEmails = getAdminNotificationEmails();
  if (adminEmails.length === 0) {
    return { sent: false, reason: 'no_admin_emails' };
  }

  const { Resend } = require('resend');
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: 'resend_not_configured' };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';
  const severityLabel = getSeverityLabel(alertEvent.severity);
  const eventTime = formatTime(alertEvent.publishedAt);
  const sourceName = alertEvent.source.toUpperCase();

  const subject = `${severityLabel}: ${capitalize(alertEvent.type)} - ${alertEvent.location.display || 'Alert'}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #d32f2f; margin-bottom: 20px;">${severityLabel}: ${capitalize(alertEvent.type)}</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #333;">${alertEvent.summary || alertEvent.title}</p>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">
        <strong>Location:</strong> ${alertEvent.location.display || 'N/A'}<br>
        <strong>Time:</strong> ${eventTime}<br>
        <strong>Source:</strong> ${sourceName}
      </p>
      ${alertEvent.sourceUrl ? `<p style="margin-top: 20px;"><a href="${alertEvent.sourceUrl}" style="color: #4a90e2;">View on ${sourceName}</a></p>` : ''}
    </div>
  `;

  const text = `${severityLabel}: ${alertEvent.title}\n${alertEvent.summary || ''}\nLocation: ${alertEvent.location.display}\nTime: ${eventTime}\nSource: ${sourceName}`;

  const results = await Promise.allSettled(
    adminEmails.map(email => resend.emails.send({ from: fromEmail, to: email, subject, html, text }))
  );

  const sent = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
  return { sent: sent > 0, count: sent, total: adminEmails.length };
}

/* ── Push channel ──────────────────────────────────── */

async function sendPushNotification(alertEvent, logger) {
  try {
    const pushModule = require('../send-push-notification');
    if (typeof pushModule.sendPushNotification !== 'function') {
      return { sent: 0, failed: 0, reason: 'push_module_not_available' };
    }

    const pushType = getPushType(alertEvent);
    const magnitude = alertEvent.assets?.magnitude;
    const titlePrefix = alertEvent.type === 'earthquake' && magnitude
      ? `M${magnitude} Earthquake`
      : capitalize(alertEvent.type);

    const pushResult = await pushModule.sendPushNotification({
      type: pushType,
      title: titlePrefix,
      body: alertEvent.location.display || alertEvent.summary || alertEvent.title,
      url: alertEvent.sourceUrl || '/',
      image: alertEvent.assets?.imageUrl || undefined,
      mapUrl: alertEvent.assets?.mapUrl || undefined,
      id: alertEvent.id,
      tag: `noteworthy-${alertEvent.type}-${alertEvent.id}`,
    });

    return {
      sent: pushResult?.sent || 0,
      failed: pushResult?.failed || 0,
    };
  } catch (err) {
    logger.error?.('[notify:push] Error', { error: err.message });
    return { sent: 0, failed: 0, reason: err.message };
  }
}

/* ── Location-based email channel ──────────────────── */

async function sendLocationNotifications(alertEvent, logger) {
  // Location alerts require lat/lon on the event
  if (!alertEvent.location.lat || !alertEvent.location.lon) {
    return { sent: 0, skipped: 0, reason: 'no_event_coordinates' };
  }

  try {
    const { checkAndSendLocationAlert } = require('../send-location-alert');

    // For now, location alerts are checked per-user by the engine at event time.
    // The unified dispatcher logs intent; actual per-user iteration stays in
    // checkAndSendLocationAlert which already handles prefs, rate limits, and radius.
    // Future: iterate user list here for full decoupling.

    return { sent: 0, skipped: 0, reason: 'delegated_to_engines' };
  } catch (err) {
    return { sent: 0, skipped: 0, reason: err.message };
  }
}

/* ── Helpers ───────────────────────────────────────── */

function getAdminNotificationEmails() {
  let emails = [];
  if (process.env.AI_NOTIFICATION_EMAILS) {
    try {
      emails = JSON.parse(process.env.AI_NOTIFICATION_EMAILS);
      if (!Array.isArray(emails)) emails = [];
    } catch {
      emails = process.env.AI_NOTIFICATION_EMAILS.split(',').map(e => e.trim()).filter(Boolean);
    }
  }
  if (emails.length === 0 && process.env.ALERT_TO_EMAIL) {
    emails = [process.env.ALERT_TO_EMAIL];
  }
  return emails.filter(e => !e.toLowerCase().includes('example.com'));
}

function deduplicateEmails(arr) {
  const seen = new Set();
  return arr.filter(e => {
    const lower = e.toLowerCase().trim();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

function formatTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
  } catch {
    return String(timestamp);
  }
}

function getSeverityLabel(severity) {
  if (severity >= 5) return 'CRITICAL';
  if (severity >= 4) return 'BREAKING';
  if (severity >= 3) return 'ALERT';
  return 'UPDATE';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ');
}

function buildEarthquakeEmailHtml({ severityLabel, magnitude, location, eventTime, summary, sourceUrl, imageUrl, eventId }) {
  const siteUrl = process.env.URL || 'https://noteworthynews.co';
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: linear-gradient(135deg, #07152a 0%, #0d1f3a 100%); padding: 24px 30px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Noteworthy News</h1>
      </div>
      <div style="background: #fff; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #d32f2f; margin: 0 0 16px;">${severityLabel}: M${magnitude} Earthquake</h2>
        <p style="font-size: 16px; color: #333;">${summary}</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 4px 0; font-size: 14px; color: #555;">
            <strong>Location:</strong> ${location}<br>
            <strong>Time:</strong> ${eventTime}<br>
            <strong>Magnitude:</strong> ${magnitude}
          </p>
        </div>
        ${imageUrl ? `<img src="${imageUrl}" alt="Earthquake map" style="max-width: 100%; border-radius: 6px; margin: 16px 0;">` : ''}
        <div style="text-align: center; margin: 24px 0;">
          <a href="${siteUrl}/article.html?id=${eventId}" style="display: inline-block; background: #4A90E2; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Details</a>
        </div>
        ${sourceUrl ? `<p style="font-size: 13px; color: #888; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;"><a href="${sourceUrl}" style="color: #4a90e2;">View on USGS</a></p>` : ''}
        <p style="font-size: 12px; color: #999; margin-top: 16px;">
          <a href="${siteUrl}/profile.html" style="color: #4a90e2;">Manage alert preferences</a> ·
          <a href="${siteUrl}/unsubscribe.html" style="color: #4a90e2;">Unsubscribe</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  notifyForEvent,
};
