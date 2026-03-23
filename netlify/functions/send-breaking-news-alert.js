/**
 * Send Breaking News Alert
 *
 * Admin-authenticated endpoint that dispatches a breaking news alert
 * through the unified notification pipeline: push + optional email.
 *
 * This wires up the "breaking-news" push type that subscribers can
 * opt into but previously had no server-side sender.
 *
 * POST body: { title, summary, url?, severity?, imageUrl? }
 * Auth: requireAdminAuth (JWT)
 */

const { requireAdminAuth } = require('./middleware/requireAuth');
const { createAlertEvent } = require('./lib/alertEvent');
const { notifyForEvent } = require('./lib/notifyForEvent');
const { corsHeaders: headers, optionsResponse } = require('./lib/corsHeaders');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse;

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Require admin auth
  const authResult = await requireAdminAuth(event);
  if (authResult.statusCode) return { ...authResult, headers };

  try {
    const body = JSON.parse(event.body || '{}');
    const { title, summary, url, severity, imageUrl } = body;

    if (!title) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'title is required' }),
      };
    }

    const alertEvent = createAlertEvent({
      id: `breaking-${Date.now()}`,
      source: 'admin',
      type: 'breaking-news',
      severity: Math.max(3, Math.min(5, Number(severity) || 4)),
      title,
      summary: summary || title,
      location: { display: '' },
      publishedAt: new Date().toISOString(),
      sourceUrl: url || null,
      assets: {
        imageUrl: imageUrl || null,
      },
    });

    const result = await notifyForEvent(alertEvent, {
      logger: console,
      dryRun: process.env.DRY_RUN === 'true',
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        eventId: alertEvent.id,
        notifications: {
          push: result.push,
          email: result.email,
        },
      }),
    };
  } catch (error) {
    console.error('[send-breaking-news-alert] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
