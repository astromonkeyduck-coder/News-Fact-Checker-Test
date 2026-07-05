/**
 * Visit Streak Tracker
 * Tracks daily visits and calculates streaks (starts counting after day 2)
 * Sends celebration emails for streak milestones
 */

// Load environment variables
if (process.env.NETLIFY_DEV || !process.env.RESEND_API_KEY) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) {
    // dotenv not needed in production
  }
}

const { getStore } = require("@netlify/blobs");
const { Resend } = require('resend');
const { requireAuth } = require("./middleware/requireAuth");

/**
 * Get today's date string (YYYY-MM-DD)
 */
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get yesterday's date string (YYYY-MM-DD)
 */
function getYesterdayString() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Check if two dates are consecutive days
 */
function isConsecutiveDay(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

/**
 * Get user's streak data
 */
async function getStreakData(userEmail) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    return null;
  }

  try {
    const store = getStore({
      name: "user-data",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    const userKey = `user-${userEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const streakKey = `${userKey}-streak`;

    const data = await store.get(streakKey, { type: "json" });
    return data || {
      currentStreak: 0,
      longestStreak: 0,
      lastVisitDate: null,
      visitDates: [],
      streakStarted: null,
    };
  } catch (error) {
    console.error('[Streak Tracker] Error getting streak data:', error);
    return null;
  }
}

/**
 * Save user's streak data
 */
async function saveStreakData(userEmail, streakData) {
  if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_BLOB_READ_WRITE_TOKEN) {
    return false;
  }

  try {
    const store = getStore({
      name: "user-data",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    const userKey = `user-${userEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const streakKey = `${userKey}-streak`;

    await store.set(streakKey, JSON.stringify(streakData));
    return true;
  } catch (error) {
    console.error('[Streak Tracker] Error saving streak data:', error);
    return false;
  }
}

/**
 * Track a visit and update streak
 * @param {string} userEmail - User's email
 * @param {string} userName - User's display name (optional)
 * @returns {Object} Updated streak data
 */
async function trackVisit(userEmail, userName = null) {
  if (!userEmail) {
    return { error: 'Email required' };
  }

  const today = getTodayString();
  const yesterday = getYesterdayString();

  let streakData = await getStreakData(userEmail);
  if (!streakData) {
    // Initialize streak data
    streakData = {
      currentStreak: 0,
      longestStreak: 0,
      lastVisitDate: today,
      visitDates: [today],
      streakStarted: null,
    };
  }

  // Check if already visited today
  if (streakData.lastVisitDate === today) {
    return { ...streakData, alreadyVisitedToday: true };
  }

  // Check if this is a consecutive visit
  const wasConsecutive = streakData.lastVisitDate && isConsecutiveDay(streakData.lastVisitDate, today);
  const previousStreak = streakData.currentStreak;

  if (wasConsecutive) {
    // Continue streak
    streakData.currentStreak += 1;
    streakData.lastVisitDate = today;
    
    // Streak starts counting after day 2 (so day 2 = streak of 1)
    // Day 1 visit doesn't count, day 2 visit = streak 1, day 3 visit = streak 2, etc.
    const streakCount = streakData.currentStreak - 1; // Subtract 1 because we start counting after day 2
    
    if (!streakData.streakStarted) {
      streakData.streakStarted = yesterday; // Streak started yesterday (day 2)
    }

    // Update longest streak
    if (streakData.currentStreak > streakData.longestStreak) {
      streakData.longestStreak = streakData.currentStreak;
    }

    // Add today to visit dates
    if (!streakData.visitDates.includes(today)) {
      streakData.visitDates.push(today);
    }

    await saveStreakData(userEmail, streakData);

    // Check if this is a milestone (streak of 2, 3, 5, 7, 10, 14, 30, etc.)
    // Use the streakCount already calculated above (line 146)
    
    // Check if we've already sent email for this milestone (avoid duplicates)
    const lastEmailSent = streakData.lastEmailSent || {};
    const milestoneKey = streakCount.toString();
    
    if (streakCount > 0 && [1, 2, 3, 5, 7, 10, 14, 30, 50, 100].includes(streakCount)) {
      // Only send if we haven't sent for this milestone yet
      if (!lastEmailSent[milestoneKey]) {
        // Check user email preferences
        const { isEmailEnabled } = require('./lib/emailPreferences');
        const emailEnabled = await isEmailEnabled(userEmail, 'streak');
        
        if (emailEnabled) {
          // Check rate limit (max 1 per day)
          const { checkRateLimit } = require('./lib/emailRateLimit');
          const rateLimit = await checkRateLimit(userEmail, 'streak', 1);
          
          if (rateLimit.allowed) {
            // Mark as sent
            lastEmailSent[milestoneKey] = new Date().toISOString();
            streakData.lastEmailSent = lastEmailSent;
            await saveStreakData(userEmail, streakData);
            
            // Send celebration email (non-blocking)
            sendStreakCelebrationEmail(userEmail, userName, streakCount).catch(err => {
              console.error('[Streak Tracker] Error sending celebration email:', err);
            });
          } else {
            console.log(`[Streak Tracker] Rate limit exceeded for ${userEmail}: ${rateLimit.reason}`);
          }
        } else {
          console.log(`[Streak Tracker] User ${userEmail} has disabled streak emails`);
        }
      }
    }

    return { ...streakData, streakIncreased: true, previousStreak };
  } else {
    // Break streak or start new one
    if (streakData.lastVisitDate && !isConsecutiveDay(streakData.lastVisitDate, today)) {
      // Streak broken
      streakData.currentStreak = 1; // Start new streak (day 1 of new streak)
      streakData.streakStarted = today;
    } else {
      // First visit ever or first visit in a while
      streakData.currentStreak = 1;
      streakData.streakStarted = today;
    }

    streakData.lastVisitDate = today;
    
    // Add today to visit dates
    if (!streakData.visitDates.includes(today)) {
      streakData.visitDates.push(today);
    }

    await saveStreakData(userEmail, streakData);
    return { ...streakData, newStreak: true };
  }
}

/**
 * Send streak celebration email
 */
async function sendStreakCelebrationEmail(userEmail, userName, streakDays) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Streak Tracker] RESEND_API_KEY not configured, skipping email');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';

  // Emoji and message based on streak length
  let emoji = '🔥';
  let message = '';
  let title = '';

  if (streakDays === 1) {
    emoji = '🎉';
    title = '2-Day Streak!';
    message = 'You\'ve visited Noteworthy News 2 days in a row! Keep it up!';
  } else if (streakDays === 2) {
    emoji = '🔥';
    title = '3-Day Streak!';
    message = 'You\'re on fire! 3 days in a row!';
  } else if (streakDays === 3) {
    emoji = '⚡';
    title = '4-Day Streak!';
    message = 'Incredible! 4 days in a row!';
  } else if (streakDays === 5) {
    emoji = '🌟';
    title = '6-Day Streak!';
    message = 'Amazing! You\'ve visited 6 days in a row!';
  } else if (streakDays === 7) {
    emoji = '💪';
    title = '8-Day Streak!';
    message = 'A full week plus one! You\'re dedicated!';
  } else if (streakDays === 10) {
    emoji = '🏆';
    title = '11-Day Streak!';
    message = 'Double digits! You\'re a Noteworthy News champion!';
  } else if (streakDays === 14) {
    emoji = '👑';
    title = '15-Day Streak!';
    message = 'Two weeks strong! You\'re a true fact-checker!';
  } else if (streakDays === 30) {
    emoji = '🎊';
    title = '31-Day Streak!';
    message = 'A full month! You\'re unstoppable!';
  } else if (streakDays === 50) {
    emoji = '🚀';
    title = '51-Day Streak!';
    message = 'Over 50 days! You\'re a Noteworthy News legend!';
  } else if (streakDays === 100) {
    emoji = '💎';
    title = '101-Day Streak!';
    message = 'Over 100 days! You\'re absolutely incredible!';
  } else {
    emoji = '🔥';
    title = `${streakDays + 1}-Day Streak!`;
    message = `You've visited ${streakDays + 1} days in a row! Keep it going!`;
  }

  const subject = `${emoji} ${title}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background: linear-gradient(135deg, #07152a 0%, #0d1f3a 100%); padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 10px;">${emoji}</div>
        <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 700;">${title}</h1>
      </div>
      
      <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #07152a; margin-top: 0; font-size: 20px;">Hey ${userName || 'there'},</h2>
        
        <p style="font-size: 18px; color: #555; text-align: center; margin: 30px 0;">
          ${message}
        </p>
        
        <div style="background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
          <div style="font-size: 36px; font-weight: 700; margin-bottom: 10px;">${streakDays + 1}</div>
          <div style="font-size: 16px; opacity: 0.9;">Days in a Row!</div>
        </div>
        
        <p style="font-size: 16px; color: #555; text-align: center;">
          Come back tomorrow to keep your streak alive! 🔥
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://noteworthynews.co" 
             style="display: inline-block; background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Visit Noteworthy News
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
      console.error('[Streak Tracker] Resend error:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`[Streak Tracker] Celebration email sent to ${userEmail} for ${streakDays + 1}-day streak`);
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('[Streak Tracker] Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// verifyAuthToken removed - replaced by requireAuth middleware

/**
 * Main handler - can be called as a Netlify function or imported
 */
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const auth = await requireAuth(event);
    if (auth.statusCode) return auth;

    // Extract identity from verified JWT
    const userEmail =
      auth.user.email ||
      auth.user["https://noteworthynews.co/email"];
    const body = JSON.parse(event.body || '{}');
    const userName = body.userName;

    if (!userEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token does not contain email claim' }),
      };
    }

    // Check user email preferences (if they've disabled streak emails)
    const { getUserLocationPreferences } = require('./send-location-alert');
    // We'll add email preferences check here once preferences system is set up
    // For now, proceed with tracking

    const result = await trackVisit(userEmail, userName);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        streak: result,
      }),
    };
  } catch (error) {
    console.error('[Streak Tracker] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

module.exports = {
  trackVisit,
  getStreakData,
  sendStreakCelebrationEmail,
};

