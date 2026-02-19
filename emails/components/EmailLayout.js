/**
 * EmailLayout - Base layout component for all Noteworthy News emails
 * 
 * This is the foundation that all email templates build upon.
 * It provides the dark theme, header, footer, and overall structure
 * matching the 11/26/25 DC shooting email design.
 * 
 * @param {Object} props
 * @param {string} props.content - Main email content (HTML)
 * @param {string} props.headerSubtitle - Optional subtitle for header (default: "Weekly Briefing")
 * @param {string} props.unsubscribeUrl - Unsubscribe URL placeholder (default: "{{{UNSUBSCRIBE_URL}}}")
 * @param {string} props.preferencesUrl - Preferences URL placeholder (default: "{{{PREFERENCES_URL}}}")
 * 
 * @returns {string} Complete HTML email
 */
function EmailLayout({ content, headerSubtitle = 'Weekly Briefing', unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}', preferencesUrl = '{{{PREFERENCES_URL}}}' }) {
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
        ${EmailHeader({ subtitle: headerSubtitle })}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:650px;margin:0 auto;background-color:#141b2b!important">
          <tr>
            <td style="padding:50px 40px;background-color:#141b2b!important">
              ${content}
            </td>
          </tr>
        </table>
        ${EmailFooter({ unsubscribeUrl, preferencesUrl })}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * EmailHeader - Header component with logo and branding
 */
function EmailHeader({ subtitle = 'Weekly Briefing' }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:650px;margin:0 auto;background-color:#050814!important">
    <tr>
      <td style="padding:30px 40px;background-color:#050814!important;border-bottom:1px solid rgba(96,165,250,0.2)">
        <img src="https://noteworthynews.co/IMG_5992.PNG" alt="Noteworthy News" style="max-width:60px;height:auto;display:block;margin:0 0 16px 0" />
        <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff!important">Noteworthy News</h1>
        <p style="margin:4px 0 0;color:#9ca3af!important;font-size:11px;letter-spacing:0.12em;text-transform:uppercase">${subtitle}</p>
      </td>
    </tr>
  </table>`;
}

/**
 * EmailFooter - Footer component with logo and unsubscribe link
 */
function EmailFooter({ unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}', preferencesUrl = '{{{PREFERENCES_URL}}}' }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:650px;margin:0 auto;background-color:#050814!important">
    <tr>
      <td style="padding:30px 20px;text-align:center;background-color:#050814!important;width:100%">
        <img src="https://noteworthynews.co/nw-logo.GIF" alt="Noteworthy News Logo" style="width:100%;max-width:100%;height:auto;display:block;margin:0 auto 30px;opacity:0.95" />
        <p style="margin:0 0 6px 0;font-size:11px;color:#6b7280!important;line-height:1.5">You're receiving this email because you subscribed to Noteworthy News.</p>
        <p style="margin:0;font-size:11px;color:#6b7280!important;line-height:1.5"><a href="${preferencesUrl}" style="color:#3b82f6!important;text-decoration:underline;font-weight:500">Manage preferences</a> · <a href="${unsubscribeUrl}" style="color:#3b82f6!important;text-decoration:underline;font-weight:500">Unsubscribe</a> · noteworthynews.co</p>
      </td>
    </tr>
  </table>`;
}

/**
 * EmailSection - Section header component
 */
function EmailSection({ title, subtitle = null }) {
  let html = `<p style="margin:50px 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">${title}</p>`;
  if (subtitle) {
    html += `<p style="margin:0 0 20px 0;color:#9ca3af!important;font-size:13px;font-weight:600">${subtitle}</p>`;
  }
  return html;
}

/**
 * EmailAlertTag - Alert/badge component (BREAKING, UPDATE, etc.)
 */
function EmailAlertTag({ label, bold = true }) {
  const boldTag = bold ? '<strong>' : '';
  const boldClose = bold ? '</strong>' : '';
  return `<p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.14em;color:#3b82f6!important;text-transform:uppercase;font-weight:600">${boldTag}${label}:${boldClose}</p>`;
}

/**
 * EmailBulletList - Bullet list with blue stars
 */
function EmailBulletList({ items }) {
  const itemsHtml = items.map(item => {
    const text = typeof item === 'string' ? item : item.text;
    return `<li style="margin:6px 0;display:flex;align-items:flex-start"><span style="color:#3b82f6!important;font-size:14px;line-height:1;margin-top:3px">★</span><span style="margin-left:8px;font-size:15px;color:#f9fafb!important;line-height:1.6">${text}</span></li>`;
  }).join('');
  
  return `<ul style="list-style:none;margin:8px 0 40px 0;padding:0">${itemsHtml}</ul>`;
}

/**
 * EmailImage - Image component with consistent styling
 */
function EmailImage({ src, alt, marginTop = 10, marginBottom = 50 }) {
  return `<img src="${src}" alt="${alt}" width="100%" style="display:block;width:100%;max-width:100%;border-radius:8px;margin:${marginTop}px 0 ${marginBottom}px 0" />`;
}

/**
 * EmailButton - CTA button component
 */
function EmailButton({ label, url, marginTop = 0, marginBottom = 50 }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:${marginTop}px 0 ${marginBottom}px 0">
    <tr>
      <td style="text-align:center">
        <a href="${url}" style="display:inline-block;padding:14px 28px;background-color:#3b82f6!important;color:#fff!important;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600">${label}</a>
      </td>
    </tr>
  </table>`;
}

/**
 * EmailParagraph - Standard paragraph component
 */
function EmailParagraph({ text, marginTop = 0, marginBottom = 20, fontSize = 15, color = '#f9fafb' }) {
  return `<p style="margin:${marginTop}px 0 ${marginBottom}px 0;color:${color}!important;font-size:${fontSize}px;line-height:1.6">${text}</p>`;
}

/**
 * EmailGraphicWarning - Warning box for graphic content
 */
function EmailGraphicWarning({ message = 'The image below shows graphic content. Viewer discretion is advised.' }) {
  return `<div style="margin:18px 0 10px 0;padding:10px 12px;border-radius:6px;background:rgba(220,38,38,0.12)!important;border:1px solid rgba(248,113,113,0.5)">
    <p style="margin:0;font-size:12px;color:#fecaca!important;font-weight:600;text-transform:uppercase;letter-spacing:0.13em">Graphic content</p>
    <p style="margin:4px 0 0;font-size:13px;color:#f9fafb!important;line-height:1.5">${message}</p>
  </div>`;
}

/**
 * EmailClosing - Standard closing signature
 */
function EmailClosing({ customMessage = null }) {
  const message = customMessage || 'Thank you for reading Noteworthy News.';
  return `<p style="margin:50px 0 20px 0;color:#f9fafb!important;font-size:16px;line-height:1.5">${message}</p>
    <p style="margin:0;color:#f9fafb!important;font-size:16px;line-height:1.5">Stay informed,<br />The Noteworthy News Team</p>`;
}

module.exports = {
  EmailLayout,
  EmailHeader,
  EmailFooter,
  EmailSection,
  EmailAlertTag,
  EmailBulletList,
  EmailImage,
  EmailButton,
  EmailParagraph,
  EmailGraphicWarning,
  EmailClosing,
};


























