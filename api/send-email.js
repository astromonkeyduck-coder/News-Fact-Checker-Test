import { Resend } from 'resend';

// Initialize Resend with API key from environment variable
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Send notification email to richard@noteworthynews.co
    const notificationResult = await resend.emails.send({
      from: 'Noteworthy News <richard@noteworthynews.co>', // Make sure to verify noteworthynews.co domain in Resend
      to: 'richard@noteworthynews.co',
      subject: 'New Newsletter Subscription',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a90e2;">New Newsletter Subscription</h2>
          <p>A new subscriber has signed up for the Noteworthy News newsletter:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p style="color: #666; font-size: 14px;">This is an automated notification from your website.</p>
        </div>
      `,
    });

    // Send auto-reply to the subscriber
    const autoReplyResult = await resend.emails.send({
      from: 'Noteworthy News <richard@noteworthynews.co>', // Make sure to verify noteworthynews.co domain in Resend
      to: email,
      replyTo: 'richard@noteworthynews.co',
      subject: 'Welcome to Noteworthy News! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a90e2;">Thanks for subscribing!</h2>
          <p>Hi there,</p>
          <p>Thank you for subscribing to Noteworthy News! We're thrilled to have you join our community of fact-checkers and critical thinkers.</p>
          <p>You'll now receive:</p>
          <ul>
            <li>📰 Weekly fact-checked news stories</li>
            <li>🔍 Media literacy tips and insights</li>
            <li>🎮 Updates about our interactive fact-checking games</li>
            <li>💡 Critical thinking resources</li>
          </ul>
          <p>Stay informed and stay curious!</p>
          <p style="margin-top: 30px;">Best regards,<br><strong>The Noteworthy News Team</strong></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">If you didn't subscribe to this newsletter, you can safely ignore this email.</p>
        </div>
      `,
    });

    // Check if both emails were sent successfully
    if (notificationResult.error || autoReplyResult.error) {
      console.error('Resend errors:', notificationResult.error, autoReplyResult.error);
      return res.status(500).json({ 
        error: 'Failed to send email',
        details: notificationResult.error || autoReplyResult.error 
      });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Subscription successful! Check your email for a welcome message.',
      notificationId: notificationResult.data?.id,
      autoReplyId: autoReplyResult.data?.id
    });

  } catch (error) {
    console.error('Email sending error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

