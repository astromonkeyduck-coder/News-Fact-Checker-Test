/**
 * Script to create newsletter templates based on the Nov 26, 2025 design
 * Creates templates for major holidays and general-purpose newsletters
 */

// Load environment variables
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const https = require('https');
const http = require('http');

// Base template structure from Nov 26, 2025 newsletter
const BASE_TEMPLATE_STRUCTURE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark only">
  <style>
    body,html{background-color:#0b1020!important;color:#f9fafb!important;margin:0;padding:0}
    table,td,tr,div,p,h1,h2,h3,a,span{background-color:inherit!important;color:inherit!important}
    table[role="presentation"]{background-color:#0b1020!important}
    u+.body .gmail-blend-screen,u+.body .gmail-blend-difference,.gmail-blend-screen,.gmail-blend-difference{background-color:#0b1020!important}
    .ii a[href]{color:#60a5fa!important}
    [data-ogsc] body,[data-ogsc] table{background-color:#0b1020!important}
    @media (prefers-color-scheme:light){body,html,table,td{background-color:#0b1020!important;color:#f9fafb!important}}
  </style>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#0b1020!important;color-scheme:dark only">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0b1020!important">
    <tr>
      <td style="padding:40px 20px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:650px;margin:0 auto;background-color:#050814!important">
          <tr>
            <td style="padding:30px 40px;background-color:#050814!important;border-bottom:1px solid rgba(96,165,250,0.2)">
              <img src="https://noteworthynews.co/IMG_5992.PNG" alt="Noteworthy News" style="max-width:60px;height:auto;display:block;margin:0 0 16px 0" />
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff!important">Noteworthy News</h1>
              <p style="margin:4px 0 0;color:#9ca3af!important;font-size:11px;letter-spacing:0.12em;text-transform:uppercase">Weekly Briefing</p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:650px;margin:0 auto;background-color:#141b2b!important">
          <tr>
            <td style="padding:50px 40px;background-color:#141b2b!important">
              {{CONTENT}}
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:650px;margin:0 auto;background-color:#050814!important">
          <tr>
            <td style="padding:30px 20px;text-align:center;background-color:#050814!important;width:100%">
              <img src="https://noteworthynews.co/nw-logo.GIF" alt="Noteworthy News Logo" style="width:100%;max-width:100%;height:auto;display:block;margin:0 auto 30px;opacity:0.95" />
              <p style="margin:0 0 6px 0;font-size:11px;color:#6b7280!important;line-height:1.5">You're receiving this email because you subscribed to Noteworthy News.</p>
              <p style="margin:0;font-size:11px;color:#6b7280!important;line-height:1.5"><a href="{{{UNSUBSCRIBE_URL}}}" style="color:#3b82f6!important;text-decoration:underline;font-weight:500">Unsubscribe</a> · noteworthynews.co</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// Template definitions
const TEMPLATES = [
  // HOLIDAY TEMPLATES
  {
    id: 'template-christmas-2025',
    name: 'Christmas Newsletter 2025',
    subject: 'Merry Christmas from Noteworthy News',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Merry Christmas! As we celebrate this special time of year, we're grateful for your continued trust in Noteworthy News for fact-checked, reliable journalism.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">This Week's Highlights</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">Key stories from the week</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Stay informed with our latest fact-checked stories and breaking news coverage.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our team continues to provide accurate, timely reporting you can trust.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for being part of our community of informed readers.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Wishing you and your family a joyful holiday season!</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-new-year-2026',
    name: 'New Year Newsletter 2026',
    subject: 'Happy New Year from Noteworthy News',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Happy New Year! As we begin 2026, we're committed to bringing you the most important, fact-checked news stories that matter.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">Looking Ahead</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">What to expect this year</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Enhanced coverage of breaking news with real-time fact-checking.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">New features and tools to help you stay informed and media-literate.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Deeper investigative reporting on the stories that shape our world.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Thank you for being part of our community. Here's to a year of truth, clarity, and informed citizenship!</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-thanksgiving-2025',
    name: 'Thanksgiving Newsletter 2025',
    subject: 'Happy Thanksgiving from Noteworthy News',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Happy Thanksgiving! We're grateful for readers like you who value fact-checked journalism and media literacy.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">This Week's Stories</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">Important news you may have missed</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our team has been hard at work bringing you the most important stories of the week.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Every story is fact-checked and verified before publication.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for trusting us to keep you informed.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">We hope you have a wonderful Thanksgiving with family and friends!</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-independence-day-2026',
    name: 'Independence Day Newsletter 2026',
    subject: 'Happy Independence Day from Noteworthy News',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Happy Independence Day! Today we celebrate the freedoms that make independent, fact-checked journalism possible.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">This Week's Coverage</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">Stories that matter</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our commitment to truth and accuracy remains unwavering.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">We're proud to serve readers who value informed citizenship.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for being part of our community of fact-checked news readers.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Have a safe and happy Fourth of July!</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-memorial-day-2026',
    name: 'Memorial Day Newsletter 2026',
    subject: 'Memorial Day - Honoring Those Who Served',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">On this Memorial Day, we pause to honor and remember those who made the ultimate sacrifice in service to our nation.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">This Week's News</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">Important stories from the week</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">We continue to bring you fact-checked coverage of the stories that matter.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our commitment to accurate, timely reporting remains strong.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for trusting Noteworthy News for reliable journalism.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">We remember and honor those who gave their lives for our freedom.</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-labor-day-2026',
    name: 'Labor Day Newsletter 2026',
    subject: 'Labor Day - Celebrating Workers Everywhere',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Happy Labor Day! Today we celebrate the contributions of workers across America and around the world.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">This Week's Stories</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">Key developments</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our team continues to deliver fact-checked news you can trust.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">We're committed to accurate reporting on labor, economy, and workers' rights.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for being part of our community of informed readers.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Enjoy your Labor Day weekend!</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-veterans-day-2025',
    name: 'Veterans Day Newsletter 2025',
    subject: 'Veterans Day - Thank You for Your Service',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">On Veterans Day, we express our deepest gratitude to all who have served in our nation's armed forces.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">This Week's Coverage</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">Important stories</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">We continue to provide fact-checked coverage of military and veterans' affairs.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our commitment to accurate, respectful reporting remains unwavering.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for trusting Noteworthy News for reliable journalism.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">To all veterans: Thank you for your service and sacrifice.</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-halloween-2025',
    name: 'Halloween Newsletter 2025',
    subject: 'Happy Halloween from Noteworthy News',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Happy Halloween! While the scariest thing this season might be misinformation, we're here to help you separate fact from fiction.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">This Week's Stories</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">Fact-checked news you can trust</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our fact-checking team works tirelessly to verify every story.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">We debunk myths and provide accurate information you can rely on.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for being part of our community of media-literate readers.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Have a safe and fun Halloween!</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-easter-2026',
    name: 'Easter Newsletter 2026',
    subject: 'Happy Easter from Noteworthy News',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Happy Easter! We hope you're enjoying this time of renewal and reflection with family and friends.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">This Week's News</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">Important stories</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our team continues to bring you the most important, fact-checked stories.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Every story is verified before publication to ensure accuracy.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for trusting Noteworthy News for reliable journalism.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Wishing you a blessed and joyful Easter!</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-valentines-day-2026',
    name: 'Valentine\'s Day Newsletter 2026',
    subject: 'Happy Valentine\'s Day from Noteworthy News',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Happy Valentine's Day! Today we celebrate the love of truth, accuracy, and informed citizenship.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">This Week's Coverage</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">Stories that matter</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our commitment to fact-checked journalism remains strong.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">We're grateful for readers who value truth and accuracy.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for being part of our community of informed readers.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Have a wonderful Valentine's Day!</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-mothers-day-2026',
    name: 'Mother\'s Day Newsletter 2026',
    subject: 'Happy Mother\'s Day from Noteworthy News',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Happy Mother's Day! Today we honor all mothers and the important role they play in raising media-literate, informed citizens.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">This Week's Stories</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">Important news</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our team continues to deliver fact-checked news you can trust.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">We're committed to helping families stay informed with accurate reporting.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for being part of our community of informed readers.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">To all mothers: Thank you for everything you do!</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-fathers-day-2026',
    name: 'Father\'s Day Newsletter 2026',
    subject: 'Happy Father\'s Day from Noteworthy News',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Happy Father's Day! Today we celebrate all fathers and their important role in raising informed, media-literate children.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">This Week's Coverage</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">Key stories</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our team continues to provide fact-checked news you can trust.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">We're committed to helping families stay informed with accurate reporting.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for being part of our community of informed readers.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">To all fathers: Thank you for everything you do!</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  // GENERAL PURPOSE TEMPLATES
  {
    id: 'template-weekly-newsletter',
    name: 'Weekly Newsletter Template',
    subject: 'Weekly Newsletter - Noteworthy News',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Here's what's happening this week in the world of fact-checked news.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">This Week's Highlights</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">Key developments</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Stay informed with our latest fact-checked stories and breaking news coverage.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our team continues to provide accurate, timely reporting you can trust.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for being part of our community of informed readers.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Thank you for reading Noteworthy News.</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-breaking-news',
    name: 'Breaking News Template',
    subject: 'Breaking: {{HEADLINE}}',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#ef4444!important;text-transform:uppercase;font-weight:600"><strong>BREAKING:</strong></p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">{{BREAKING_NEWS_CONTENT}}</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">Key Details</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">What we know so far</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our team is actively fact-checking and verifying all information.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">We will continue to update you as more information becomes available.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">All information has been verified by our fact-checking team.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">We'll keep you updated as this story develops.</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-special-report',
    name: 'Special Report Template',
    subject: 'Special Report: {{TOPIC}}',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Today we're bringing you an in-depth special report on an important topic that deserves careful examination.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">Special Report</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">In-depth analysis</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our investigative team has spent weeks researching and fact-checking this story.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Every claim has been verified through multiple independent sources.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">We're committed to providing you with the full, accurate picture.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Thank you for reading our special report.</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-monthly-roundup',
    name: 'Monthly Roundup Template',
    subject: 'Monthly Roundup - {{MONTH}} {{YEAR}}',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Here's a look back at the most important stories from the past month.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">Month in Review</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">Top stories</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">We covered the most significant breaking news stories of the month.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Every story was fact-checked and verified before publication.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for trusting Noteworthy News for reliable journalism.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">We look forward to bringing you more important stories next month.</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-year-in-review',
    name: 'Year in Review Template',
    subject: 'Year in Review - {{YEAR}}',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">As the year comes to a close, we're reflecting on the most important stories we covered in {{YEAR}}.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">Year in Review</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">The stories that defined {{YEAR}}</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">We covered breaking news, investigative reports, and in-depth analysis throughout the year.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Every story was fact-checked and verified to ensure accuracy.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for being part of our community of informed readers.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">We're grateful for your trust and look forward to bringing you more important stories in the year ahead.</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-weekend-briefing',
    name: 'Weekend Briefing Template',
    subject: 'Weekend Briefing - Noteworthy News',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Here's your weekend briefing with the most important stories you may have missed.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">Weekend Highlights</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">What happened this week</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our team covered the week's most important breaking news stories.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Every story was fact-checked and verified before publication.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for trusting Noteworthy News for reliable journalism.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Enjoy your weekend, and stay informed!</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-morning-briefing',
    name: 'Morning Briefing Template',
    subject: 'Morning Briefing - Noteworthy News',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Good morning! Here's what you need to know to start your day informed.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">Today's Top Stories</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">What's happening now</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our team is covering breaking news as it happens.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Every story is fact-checked and verified before we share it with you.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for starting your day with Noteworthy News.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Have a great day, and stay informed!</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-evening-digest',
    name: 'Evening Digest Template',
    subject: 'Evening Digest - Noteworthy News',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Here's your evening digest of today's most important stories.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">Today's Summary</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">What happened today</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Our team covered today's breaking news and important developments.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Every story was fact-checked and verified before publication.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for ending your day with Noteworthy News.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Rest well, and we'll see you tomorrow with more important stories.</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  },
  {
    id: 'template-announcement',
    name: 'Announcement Template',
    subject: 'Important Announcement from Noteworthy News',
    content: `
              <p style="margin:0 0 30px 0;color:#9ca3af!important;font-size:14px">{{DATE_PLACEHOLDER}}</p>
              <p style="margin:0 0 30px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">Hey {{FULL_NAME}},</p>
              <p style="margin:0 0 50px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">We have an important announcement to share with you.</p>
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">Announcement</p>
              <p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">What's new</p>
              <ul style="list-style:none;margin:8px 0 40px 0;padding:0">
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">We're excited to share this update with our community of readers.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Your feedback and support make everything we do possible.</span></li>
                <li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">Thank you for being part of the Noteworthy News community.</span></li>
              </ul>
              <p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">We appreciate your continued support!</p>
              <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>
            `
  }
];

// Helper function to generate preview HTML
function generatePreviewHtml(html) {
  return html
    .replace(/\{\{FULL_NAME\}\}/g, 'Preview User')
    .replace(/\{\{FIRST_NAME\}\}/g, 'Preview')
    .replace(/\{\{EMAIL_USERNAME\}\}/g, 'preview')
    .replace(/\{\{\{UNSUBSCRIBE_URL\}\}\}/g, '#')
    .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, '#')
    .replace(/\{\{DATE_PLACEHOLDER\}\}/g, new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
    .replace(/\{\{HEADLINE\}\}/g, 'Major News Story')
    .replace(/\{\{BREAKING_NEWS_CONTENT\}\}/g, 'This is a breaking news story that requires immediate attention.')
    .replace(/\{\{TOPIC\}\}/g, 'Important Topic')
    .replace(/\{\{MONTH\}\}/g, new Date().toLocaleDateString('en-US', { month: 'long' }))
    .replace(/\{\{YEAR\}\}/g, new Date().getFullYear().toString());
}

// Helper function to generate text version
function generateTextVersion(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper function to make HTTP/HTTPS requests
function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };
    
    if (data) {
      const body = JSON.stringify(data);
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.headers['Content-Length'] = Buffer.byteLength(body);
    }
    
    const req = client.request(requestOptions, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Main function to create all templates
async function createTemplates() {
  const newsletterKey = process.env.NEWSLETTER_KEY || '';
  const netlifyFunctionUrl = process.env.NETLIFY_FUNCTION_URL || 'http://localhost:8888/.netlify/functions/newsletter-templates';
  
  if (!newsletterKey) {
    console.error('❌ Missing required environment variable: NEWSLETTER_KEY');
    console.error('\nPlease set NEWSLETTER_KEY in your .env file or environment variables.');
    console.error('Alternatively, you can pass it as an argument: node scripts/create-newsletter-templates.js YOUR_KEY');
    process.exit(1);
  }

  console.log(`\n📧 Creating ${TEMPLATES.length} newsletter templates...\n`);
  console.log(`🌐 Using API endpoint: ${netlifyFunctionUrl}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const templateDef of TEMPLATES) {
    try {
      // Generate full HTML
      const html = BASE_TEMPLATE_STRUCTURE.replace('{{CONTENT}}', templateDef.content);
      
      // Generate preview HTML
      const previewHtml = generatePreviewHtml(html);
      
      // Generate text version
      const text = generateTextVersion(html);

      const now = new Date().toISOString();
      
      const templateData = {
        id: templateDef.id,
        name: templateDef.name,
        subject: templateDef.subject,
        preheader: '',
        html: html,
        text: text,
        previewHtml: previewHtml,
        createdAt: now,
        updatedAt: now,
      };

      // Save via API endpoint
      const url = `${netlifyFunctionUrl}?token=${encodeURIComponent(newsletterKey)}`;
      const response = await makeRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': newsletterKey,
        },
      }, templateData);

      if (response.status === 200 && response.data.success) {
        console.log(`✅ Created: ${templateDef.name}`);
        successCount++;
      } else {
        throw new Error(response.data.error || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Error creating ${templateDef.name}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Successfully created: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total templates: ${TEMPLATES.length}\n`);
}

// Run the script
if (require.main === module) {
  // Allow passing newsletter key as command line argument
  if (process.argv[2] && !process.env.NEWSLETTER_KEY) {
    process.env.NEWSLETTER_KEY = process.argv[2];
  }
  
  createTemplates()
    .then(() => {
      console.log('✨ Template creation complete!\n');
      console.log('💡 You can now view these templates in the admin newsletter page.\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { createTemplates, TEMPLATES };





