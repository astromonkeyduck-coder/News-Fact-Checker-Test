/**
 * Send Voice Call Summary Email
 * Generates an AI summary of a voice call and sends it via email
 */

const { Resend } = require('resend');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Check if API keys are configured
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set in environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Server configuration error: RESEND_API_KEY not found'
        }),
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set in environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Server configuration error: OPENAI_API_KEY not found'
        }),
      };
    }

    // Parse request body
    let body;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid request body. Expected JSON format.',
          details: parseError.message 
        }),
      };
    }

    const { duration, transcripts, userEmail } = body;

    // Validate required fields
    if (!duration || duration < 30) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Call duration must be at least 30 seconds' }),
      };
    }

    if (!transcripts || !Array.isArray(transcripts) || transcripts.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Transcripts array is required and must not be empty' }),
      };
    }

    // Generate AI summary of the conversation
    let summary = '';
    try {
      // Build conversation text from transcripts
      const conversationText = transcripts
        .map(t => {
          const speaker = t.speaker === 'user' ? 'User' : 'AI';
          return `${speaker}: ${t.text}`;
        })
        .join('\n\n');

      // Call OpenAI to generate summary
      const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that creates concise, informative summaries of voice conversations. Focus on the main topics discussed, key points, and any important information shared. Keep the summary clear and well-organized.'
            },
            {
              role: 'user',
              content: `Please create a summary of this voice conversation. The call lasted ${Math.round(duration)} seconds. Focus on the main topics, key points, and important information discussed.\n\nConversation:\n${conversationText}`
            }
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!summaryResponse.ok) {
        const errorData = await summaryResponse.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to generate summary');
      }

      const summaryData = await summaryResponse.json();
      summary = summaryData.choices[0]?.message?.content || 'Unable to generate summary.';
    } catch (summaryError) {
      console.error('Error generating summary:', summaryError);
      // Fallback to a simple summary
      summary = `Voice call lasted ${Math.round(duration)} seconds. ${transcripts.length} exchanges were recorded.`;
    }

    // Initialize Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Get notification emails from environment variable
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

    // Fallback to default if no emails configured
    if (notificationEmails.length === 0) {
      notificationEmails = [process.env.ADMIN_NOTIFICATION_EMAIL || 'richard@noteworthynews.co'];
    }

    // Use verified domain email
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';

    // Format duration
    const minutes = Math.floor(duration / 60);
    const seconds = Math.round(duration % 60);
    const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    // Build transcript HTML
    const transcriptHtml = transcripts
      .map((t, idx) => {
        const speaker = t.speaker === 'user' ? 'User' : 'AI';
        const bgColor = t.speaker === 'user' ? '#e8f5e9' : '#e3f2fd';
        const borderColor = t.speaker === 'user' ? '#4caf50' : '#2196f3';
        return `
          <div style="margin-bottom: 16px; padding: 16px; background-color: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 8px;">
            <p style="margin: 0 0 8px 0; color: #333; font-weight: 600; font-size: 14px;">${speaker}:</p>
            <p style="margin: 0; color: #666; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${t.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          </div>
        `;
      })
      .join('');

    // Build email content
    const emailContent = {
      from: fromEmail,
      to: notificationEmails,
      subject: `🎤 Voice Call Summary - ${durationText}`,
      text: `Voice Call Summary

Duration: ${durationText}
${userEmail ? `User: ${userEmail}\n` : ''}

Summary:
${summary}

Full Transcript:
${transcripts.map(t => `${t.speaker === 'user' ? 'User' : 'AI'}: ${t.text}`).join('\n\n')}

---
Sent via Noteworthy News AI Assistant`,
      html: `
        <!DOCTYPE html>
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
                    <td style="padding: 30px; background: linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(46, 204, 113, 0.1) 100%); border-radius: 10px 10px 0 0;">
                      <h2 style="color: #4a90e2; margin: 0; font-size: 24px; font-weight: bold;">🎤 Voice Call Summary</h2>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px; background-color: #ffffff;">
                      <div style="margin-bottom: 24px; padding: 20px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 2px solid #4a90e2; border-radius: 8px;">
                        <p style="color: #333333; font-size: 16px; margin: 10px 0; line-height: 1.6;"><strong style="color: #4a90e2;">⏱️ Duration:</strong> <span style="color: #666666;">${durationText}</span></p>
                        ${userEmail ? `<p style="color: #333333; font-size: 16px; margin: 10px 0; line-height: 1.6;"><strong style="color: #4a90e2;">👤 User:</strong> <span style="color: #666666;">${userEmail}</span></p>` : ''}
                        <p style="color: #333333; font-size: 16px; margin: 10px 0; line-height: 1.6;"><strong style="color: #4a90e2;">💬 Exchanges:</strong> <span style="color: #666666;">${transcripts.length}</span></p>
                      </div>
                      
                      <div style="margin-bottom: 24px;">
                        <h3 style="color: #4a90e2; font-size: 18px; font-weight: bold; margin: 0 0 16px 0;">📋 Summary</h3>
                        <div style="padding: 20px; background-color: #f8f9fa; border-left: 4px solid #4a90e2; border-radius: 8px;">
                          <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${summary.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                        </div>
                      </div>
                      
                      <div style="margin-bottom: 24px;">
                        <h3 style="color: #4a90e2; font-size: 18px; font-weight: bold; margin: 0 0 16px 0;">💬 Full Transcript</h3>
                        ${transcriptHtml}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 30px; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-top: 2px solid #4a90e2; border-radius: 0 0 10px 10px;">
                      <p style="color: #999999; font-size: 12px; margin: 0; line-height: 1.5; text-align: center;">Sent via Noteworthy News AI Assistant</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    // Send email
    const result = await resend.emails.send(emailContent);

    if (result.error) {
      console.error('Resend API error:', result.error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to send email',
          details: result.error.message || 'Unknown error',
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Voice call summary email sent successfully',
        emailId: result.data?.id,
      }),
    };

  } catch (error) {
    console.error('Voice call summary error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred',
      }),
    };
  }
};




