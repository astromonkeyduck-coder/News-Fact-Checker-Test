/**
 * NoteworthyNewsletterVerifyEmail — double opt-in confirmation.
 *
 * Calm, factual, zero hype. One job: confirm the address. The what-you'll-
 * receive rows double as a preview of the brief's three-part structure.
 *
 * NOTE: the live signup flow is currently single opt-in (send-email.js sends
 * the welcome directly). This template is production-ready for the day a
 * confirm endpoint exists — see the TODO in netlify/functions/send-email.js.
 */

const { color, font, urls } = require('./theme');
const {
  esc, kicker, h1, para, small, link, panel, btnPrimary,
  hairline, moduleHeader, shell, textShell,
} = require('./shell');

const SUBJECT = 'Confirm your Noteworthy Brief';
const PREHEADER = 'One tap to start receiving the stories that mattered, what changed, and what to watch next.';

/**
 * @param {Object} p
 * @param {string} p.confirmUrl      Signed confirmation link
 * @param {number} [p.expiresHours]  Link validity window (default 48)
 * @param {string} [p.requestedFrom] e.g. "the homepage" — where signup happened
 * @param {string} [p.unsubscribeUrl]
 * @param {string} [p.preferencesUrl]
 */
function NewsletterVerifyEmail({
  confirmUrl,
  expiresHours = 48,
  requestedFrom = 'noteworthynews.co',
  unsubscribeUrl,
  preferencesUrl,
} = {}) {
  const receiveRow = (num, title, body) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 10px">
      <tr>
        <td width="26" style="vertical-align:top;font-family:${font.mono};font-size:11px;color:${color.accentBright};padding:2px 8px 0 0">${num}</td>
        <td style="vertical-align:top">
          <p style="margin:0 0 2px;font-family:${font.ui};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${color.text}">${title}</p>
          <p style="margin:0;font-family:${font.serif};font-size:14px;line-height:21px;color:${color.textSecondary}">${body}</p>
        </td>
      </tr>
    </table>`;

  const content = `
    ${kicker('Email verification')}
    ${h1('Confirm your address.')}
    ${para(`You asked for <strong style="color:${color.text}">The Weekly Brief</strong> from ${esc(requestedFrom)}. Nothing is sent until you confirm this is your inbox.`)}

    <div style="height:8px;font-size:0;line-height:0">&nbsp;</div>
    ${btnPrimary('Confirm and start the brief', confirmUrl)}
    <div style="height:14px;font-size:0;line-height:0">&nbsp;</div>
    ${small(`Button not working? Paste this link into your browser:<br><a href="${confirmUrl}" style="color:${color.accentBright};text-decoration:underline;word-break:break-all">${esc(confirmUrl)}</a>`, { tone: color.textMuted })}

    ${hairline(22)}
    <div style="height:20px;font-size:0;line-height:0">&nbsp;</div>

    ${moduleHeader('&nbsp;', 'What you\u2019ll receive')}
    ${panel(`
      ${receiveRow('01', 'What happened', 'The stories that mattered this week — with the source next to every claim.')}
      ${receiveRow('02', 'What changed', 'Updates and revisions since we first reported, timestamps attached.')}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="26" style="vertical-align:top;font-family:${font.mono};font-size:11px;color:${color.accentBright};padding:2px 8px 0 0">03</td>
          <td style="vertical-align:top">
            <p style="margin:0 0 2px;font-family:${font.ui};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${color.text}">What to watch next</p>
            <p style="margin:0;font-family:${font.serif};font-size:14px;line-height:21px;color:${color.textSecondary}">The deadlines, decisions, and advisories on the board for the week ahead.</p>
          </td>
        </tr>
      </table>
    `)}

    ${para(`One email a week. No noise between issues. ${link('How we verify', urls.howWeVerify)} is public, and so are our corrections.`, { tone: color.textSecondary })}

    ${hairline(18)}
    <div style="height:16px;font-size:0;line-height:0">&nbsp;</div>
    ${small(`Didn\u2019t request this? Ignore it. The link expires in ${expiresHours} hours, this address stays off the list, and nothing else arrives.`, { tone: color.textMuted, marginBottom: 0 })}
  `;

  return shell({
    preheader: PREHEADER,
    headerTag: 'THE WEEKLY BRIEF',
    content,
    unsubscribeUrl,
    preferencesUrl,
    footerNote: 'Sent once, because this address was entered at noteworthynews.co. Confirming is the only way onto the list.',
  });
}

function subject() {
  return SUBJECT;
}

function preheader() {
  return PREHEADER;
}

function text({ confirmUrl, expiresHours = 48, requestedFrom = 'noteworthynews.co', unsubscribeUrl, preferencesUrl } = {}) {
  return textShell(
    [
      'EMAIL VERIFICATION',
      '',
      'Confirm your address.',
      '',
      `You asked for The Weekly Brief from ${requestedFrom}. Nothing is`,
      'sent until you confirm this is your inbox.',
      '',
      `Confirm and start the brief: ${confirmUrl}`,
      '',
      'WHAT YOU\u2019LL RECEIVE',
      '  01  WHAT HAPPENED — the stories that mattered, with the source',
      '      next to every claim.',
      '  02  WHAT CHANGED — updates and revisions since first report,',
      '      timestamps attached.',
      '  03  WHAT TO WATCH NEXT — deadlines, decisions, and advisories',
      '      on the board for the week ahead.',
      '',
      'One email a week. No noise between issues.',
      '',
      `Didn\u2019t request this? Ignore it. The link expires in ${expiresHours}`,
      'hours and nothing else arrives.',
    ],
    { unsubscribeUrl, preferencesUrl },
  );
}

module.exports = NewsletterVerifyEmail;
module.exports.subject = subject;
module.exports.preheader = preheader;
module.exports.text = text;
