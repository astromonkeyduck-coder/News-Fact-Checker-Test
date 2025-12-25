/**
 * House Style Template for Noteworthy News Newsletter
 * Based on the Nov 26, 2025 "Weekly Newsletter - Noteworthy News" design
 * This is the canonical scaffold that AI must preserve when generating newsletters
 */

function getHouseStyleTemplate() {
  return `<!DOCTYPE html>
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
        <!-- HEADER SECTION - DO NOT MODIFY STRUCTURE -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:650px;margin:0 auto;background-color:#050814!important">
          <tr>
            <td style="padding:30px 40px;background-color:#050814!important;border-bottom:1px solid rgba(96,165,250,0.2)">
              <img src="https://noteworthynews.co/IMG_5992.PNG" alt="Noteworthy News" style="max-width:60px;height:auto;display:block;margin:0 0 16px 0" />
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff!important">Noteworthy News</h1>
              <p style="margin:4px 0 0;color:#9ca3af!important;font-size:11px;letter-spacing:0.12em;text-transform:uppercase">Weekly Briefing</p>
            </td>
          </tr>
        </table>
        
        <!-- CONTENT SECTION - AI WILL FILL THIS -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:650px;margin:0 auto;background-color:#141b2b!important">
          <tr>
            <td style="padding:50px 40px;background-color:#141b2b!important">
              <!-- CONTENT_PLACEHOLDER -->
            </td>
          </tr>
        </table>
        
        <!-- FOOTER SECTION - DO NOT MODIFY STRUCTURE -->
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
}

/**
 * Style guide constants for AI generation
 */
const STYLE_GUIDE = {
  // Colors
  backgroundDark: '#0b1020',
  backgroundCard: '#141b2b',
  backgroundHeader: '#050814',
  textPrimary: '#f9fafb',
  textSecondary: '#9ca3af',
  accentBlue: '#3b82f6',
  linkBlue: '#60a5fa',
  
  // Typography
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
  h1Size: '26px',
  h1Weight: '700',
  bodySize: '15px',
  bodyLineHeight: '1.6',
  smallSize: '11px',
  sectionLabelSize: '11px',
  sectionLabelSpacing: '0.14em',
  
  // Spacing
  sectionSpacing: '50px',
  paragraphSpacing: '20px',
  imageMargin: '10px 0',
  imageBorderRadius: '8px',
  
  // Layout
  maxWidth: '650px',
  padding: '50px 40px',
  headerPadding: '30px 40px',
  
  // Image styles
  imageStyle: 'display:block;width:100%;max-width:100%;border-radius:8px',
  
  // Section label style
  sectionLabelStyle: 'font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600',
  
  // Bullet list style
  bulletListStyle: 'list-style:none;margin:8px 0 40px 0;padding:0',
  bulletItemStyle: 'margin:6px 0;display:flex;align-items:flex-start',
  bulletStarStyle: 'color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px',
  bulletTextStyle: 'margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6',
};

module.exports = {
  getHouseStyleTemplate,
  STYLE_GUIDE,
};

