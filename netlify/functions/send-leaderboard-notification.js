/**
 * Leaderboard Position Change Email
 * Sends email when user gets knocked out of their leaderboard position
 * 
 * Triggered from leaderboard.js when a new score is submitted
 */

// Load environment variables
if (process.env.NETLIFY_DEV || !process.env.RESEND_API_KEY) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) {
    // dotenv not needed in production
  }
}

const { Resend } = require('resend');
const { getStore } = require("@netlify/blobs");

/**
 * Get user's previous leaderboard position
 */
async function getPreviousPosition(userId, gameType) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    return null;
  }

  try {
    const store = getStore({
      name: "leaderboard-positions",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    const key = `position-${gameType}-${userId}`;
    const data = await store.get(key, { type: "json" });
    return data;
  } catch (error) {
    console.error('[Leaderboard Notification] Error getting previous position:', error);
    return null;
  }
}

/**
 * Save user's current leaderboard position
 */
async function savePosition(userId, gameType, position, score, userName) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    return;
  }

  try {
    const store = getStore({
      name: "leaderboard-positions",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    const key = `position-${gameType}-${userId}`;
    await store.set(key, JSON.stringify({
      position,
      score,
      userName,
      gameType,
      lastUpdated: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('[Leaderboard Notification] Error saving position:', error);
  }
}

/**
 * Get user email from userId (if available)
 */
async function getUserEmail(userId) {
  // Try to get from user-data store
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    return null;
  }

  try {
    const store = getStore({
      name: "user-data",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    // Search for user by userId in user data
    // Note: This is a simplified approach - you may need to adjust based on your user ID structure
    // If userId contains email or you have a mapping, use that instead
    
    // For now, return null - email should be passed in when calling this function
    return null;
  } catch (error) {
    console.error('[Leaderboard Notification] Error getting user email:', error);
    return null;
  }
}

/**
 * Send leaderboard position change email
 * @param {string} userEmail - User's email address
 * @param {string} userName - User's display name
 * @param {string} gameType - Type of game (fact-checker, geography, etc.)
 * @param {number} oldPosition - Previous position (null if new to leaderboard)
 * @param {number} newPosition - Current position
 * @param {number} score - User's score
 */
async function sendLeaderboardNotification(userEmail, userName, gameType, oldPosition, newPosition, score) {
  // Check if email notifications are enabled
  if (!process.env.RESEND_API_KEY) {
    console.log('[Leaderboard Notification] RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'Email not configured' };
  }

  // Check user email preferences
  const { isEmailEnabled } = require('./lib/emailPreferences');
  const emailEnabled = await isEmailEnabled(userEmail, 'leaderboard');
  if (!emailEnabled) {
    console.log(`[Leaderboard Notification] User ${userEmail} has disabled leaderboard emails`);
    return { success: false, reason: 'User disabled leaderboard emails' };
  }

  // Check rate limit (max 1 per day)
  const { checkRateLimit } = require('./lib/emailRateLimit');
  const rateLimit = await checkRateLimit(userEmail, 'leaderboard', 1);
  if (!rateLimit.allowed) {
    console.log(`[Leaderboard Notification] Rate limit exceeded for ${userEmail}: ${rateLimit.reason}`);
    return { success: false, reason: rateLimit.reason };
  }

  // Only send if user was knocked out of a position (oldPosition exists and newPosition > oldPosition)
  if (!oldPosition || newPosition <= oldPosition) {
    console.log(`[Leaderboard Notification] No notification needed - old: ${oldPosition}, new: ${newPosition}`);
    return { success: false, reason: 'No position change or improved position' };
  }

  // Check if we've already sent an email for this position change today (rate limiting)
  // This prevents spam if multiple people beat their score in quick succession
  const today = new Date().toISOString().split('T')[0];
  const notificationKey = `notification-${userEmail}-${gameType}-${today}`;
  
  // Check if notification already sent today (simple rate limiting)
  // In production, you'd want to store this in a database or cache
  // For now, we'll rely on the position tracking to prevent duplicates
  
  // Don't send if position change is too small (e.g., only dropped 1 spot)
  // Adjust threshold as needed
  const positionDrop = newPosition - oldPosition;
  if (positionDrop < 1) {
    return { success: false, reason: 'Position drop too small' };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';

  // Game type display names
  const gameNames = {
    'fact-checker': 'Breaking News Fact Checker',
    'geography': 'Geography Challenge',
  };
  const gameDisplayName = gameNames[gameType] || gameType;

  // Format position with ordinal suffix
  function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  const oldPositionText = getOrdinal(oldPosition);
  const newPositionText = getOrdinal(newPosition);

  const subject = `You got knocked out of your #${oldPosition} spot!`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background: linear-gradient(135deg, #07152a 0%, #0d1f3a 100%); padding: 30px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 700;">Noteworthy News</h1>
      </div>
      
      <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #07152a; margin-top: 0; font-size: 20px;">Hey ${userName || 'there'},</h2>
        
        <p style="font-size: 16px; color: #555;">
          Someone just beat your score in <strong>${gameDisplayName}</strong>!
        </p>
        
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 16px; color: #856404;">
            <strong>You were knocked out of your #${oldPositionText} spot!</strong><br>
            You're now in ${newPositionText} place with a score of ${score.toLocaleString()}.
          </p>
        </div>
        
        <p style="font-size: 16px; color: #555;">
          Time to reclaim your spot! Play again and see if you can get back to the top.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://noteworthynews.co/game.html?gameType=${gameType}" 
             style="display: inline-block; background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Play Now & Reclaim Your Spot
          </a>
        </div>
        
        <p style="font-size: 14px; color: #888; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          Want to turn off these notifications? <a href="https://noteworthynews.co/profile.html" style="color: #4A90E2;">Update your preferences</a>
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #888; font-size: 12px;">
        <p>Noteworthy News - Fact-Checked Journalism & Media Literacy</p>
        <p><a href="https://noteworthynews.co" style="color: #4A90E2;">noteworthynews.co</a></p>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: subject,
      html: html,
    });

    if (result.error) {
      console.error('[Leaderboard Notification] Resend error:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`[Leaderboard Notification] Email sent to ${userEmail} - knocked out of #${oldPosition}`);
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('[Leaderboard Notification] Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check leaderboard position and send notification if needed
 * This is called from leaderboard.js after a score is submitted
 * 
 * @param {string} userId - User ID
 * @param {string} userEmail - User email (optional, will try to find if not provided)
 * @param {string} userName - User display name
 * @param {string} gameType - Game type
 * @param {number} score - User's score
 * @param {Array} leaderboardScores - Full sorted leaderboard array
 */
async function checkAndNotifyPositionChange(userId, userEmail, userName, gameType, score, leaderboardScores) {
  try {
    // Find user's current position
    const userIndex = leaderboardScores.findIndex(s => s.userId === userId);
    if (userIndex === -1) {
      console.log('[Leaderboard Notification] User not found in leaderboard');
      return { success: false, reason: 'User not in leaderboard' };
    }

    const newPosition = userIndex + 1; // Position is 1-indexed

    // Get previous position
    const previousData = await getPreviousPosition(userId, gameType);
    const oldPosition = previousData?.position || null;

    // Save current position
    await savePosition(userId, gameType, newPosition, score, userName);

    // If no email provided, try to get it (you may need to adjust this based on your user ID structure)
    if (!userEmail) {
      // For now, skip if no email - you'll need to pass email when calling this
      console.log('[Leaderboard Notification] No email provided, skipping notification');
      return { success: false, reason: 'No email provided' };
    }

    // Send notification if knocked out
    if (oldPosition && newPosition > oldPosition) {
      return await sendLeaderboardNotification(userEmail, userName, gameType, oldPosition, newPosition, score);
    }

    return { success: false, reason: 'No position change or improved position' };
  } catch (error) {
    console.error('[Leaderboard Notification] Error checking position:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  checkAndNotifyPositionChange,
  sendLeaderboardNotification,
  getPreviousPosition,
  savePosition,
};

