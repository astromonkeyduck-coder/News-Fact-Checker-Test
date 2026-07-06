/**
 * NoteworthyNewsletterWelcomeEmail — sent when a subscriber joins the brief.
 *
 * Structure: confirmation state → animated newsroom signal (progressive
 * enhancement, complete without it) → how the brief works (the three
 * modules) → how we verify (the site's five-step pipeline) → CTAs.
 */

const { color, font, urls } = require('./theme');
const {
  esc, kicker, h1, para, small, link, statusChip, timePill,
  hairline, moduleHeader, panel, btnPrimary, btnGhost, gifPanel,
  shell, textShell,
} = require('./shell');

const SUBJECT = 'Welcome to The Weekly Brief';
const PREHEADER = 'Every week: what happened, what changed, and what is confirmed.';

/** The site's verify pipeline, compact. Detect → Verify → Context → Publish → Correct. */
function verifyPipeline() {
  const steps = [
    ['01', 'Detect', 'Signals from official feeds, agency alerts, and primary accounts we watch.'],
    ['02', 'Verify', 'Claims trace to the original source or official data before we publish.'],
    ['03', 'Context', 'What is known, what is not, and who is doing the saying.'],
    ['04', 'Publish', 'Every update ships with a timestamp and a source note attached.'],
    ['05', 'Correct', 'Corrections stay visible. Nothing is silently rewritten.'],
  ];
  return steps
    .map(
      ([num, name, desc], i) => `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 ${i === steps.length - 1 ? 0 : 12}px">
        <tr>
          <td width="30" style="vertical-align:top;font-family:${font.mono};font-size:11px;color:${color.accentBright};padding:1px 8px 0 0">${num}</td>
          <td style="vertical-align:top">
            <span style="font-family:${font.ui};font-size:13px;font-weight:700;color:${color.text}">${name}</span>
            <span style="font-family:${font.serif};font-size:13px;line-height:20px;color:${color.textSecondary}">&nbsp;&mdash; ${desc}</span>
          </td>
        </tr>
      </table>`,
    )
    .join('');
}

/**
 * @param {Object} p
 * @param {string} [p.greetingName]  First name if known; omit for neutral copy
 * @param {string} [p.unsubscribeUrl]
 * @param {string} [p.preferencesUrl]
 */
function NewsletterWelcomeEmail({ greetingName, unsubscribeUrl, preferencesUrl } = {}) {
  const greet =
    greetingName && greetingName !== 'there'
      ? `${esc(greetingName)}, you\u2019re on the brief.`
      : 'You\u2019re on the brief.';

  const moduleRow = (num, title, body) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 12px">
      <tr>
        <td width="26" style="vertical-align:top;font-family:${font.mono};font-size:11px;color:${color.accentBright};padding:3px 8px 0 0">${num}</td>
        <td style="vertical-align:top">
          <p style="margin:0 0 3px;font-family:${font.ui};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${color.text}">${title}</p>
          <p style="margin:0;font-family:${font.serif};font-size:14px;line-height:21px;color:${color.textSecondary}">${body}</p>
        </td>
      </tr>
    </table>`;

  const content = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px">
      <tr>
        <td style="vertical-align:middle">${statusChip('confirmed')}</td>
        <td align="right" style="vertical-align:middle">${timePill('SUBSCRIPTION ACTIVE')}</td>
      </tr>
    </table>

    ${h1(greet)}
    ${para(`One email a week: the stories that mattered, what changed since we first reported them, and what to watch next. The source sits next to the claim. Timestamps stay on every update. Corrections stay visible.`)}

    <div style="height:10px;font-size:0;line-height:0">&nbsp;</div>

    <!-- Animated newsroom signal — progressive enhancement only.
         Static first frame is complete; alt text carries the meaning;
         everything it shows is repeated in HTML below. -->
    ${gifPanel({
      src: urls.liveSignalGif,
      alt: 'A Noteworthy live story panel: timestamped updates arriving, with the story status moving from developing to confirmed.',
      width: 1080,
      height: 540,
      caption: 'A LIVE STORY, THE WAY WE RUN IT — TIMESTAMPS ON, SOURCES ATTACHED',
    })}

    <div style="height:22px;font-size:0;line-height:0">&nbsp;</div>

    ${moduleHeader('&nbsp;', 'How the brief works')}
    ${panel(`
      ${moduleRow('01', 'What happened', 'The week\u2019s stories, told straight — with the source next to every claim.')}
      ${moduleRow('02', 'What changed', 'Where the facts moved after the first alert. Revisions are labeled, never buried.')}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="26" style="vertical-align:top;font-family:${font.mono};font-size:11px;color:${color.accentBright};padding:3px 8px 0 0">03</td>
          <td style="vertical-align:top">
            <p style="margin:0 0 3px;font-family:${font.ui};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${color.text}">What to watch next</p>
            <p style="margin:0;font-family:${font.serif};font-size:14px;line-height:21px;color:${color.textSecondary}">Deadlines, decisions, and advisories already on the board for the coming week.</p>
          </td>
        </tr>
      </table>
    `)}

    <div style="height:8px;font-size:0;line-height:0">&nbsp;</div>

    ${moduleHeader('&nbsp;', 'How we verify')}
    ${panel(verifyPipeline(), { accentLeft: color.accent })}
    ${small(`The full standard is public: ${link('how we verify', urls.howWeVerify)} &middot; ${link('editorial policy', urls.editorialPolicy)}.`, { tone: color.textMuted })}

    ${hairline(20)}
    <div style="height:20px;font-size:0;line-height:0">&nbsp;</div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:0 10px 0 0">${btnPrimary('Read today\u2019s top stories', urls.topStories)}</td>
        <td>${btnGhost('Follow live stories', urls.liveStories)}</td>
      </tr>
    </table>

    <div style="height:18px;font-size:0;line-height:0">&nbsp;</div>
    ${small('The first issue lands this week. Between issues: nothing, unless news genuinely breaks.', { tone: color.textMuted, marginBottom: 0 })}
  `;

  return shell({
    preheader: PREHEADER,
    headerTag: 'THE WEEKLY BRIEF',
    content,
    unsubscribeUrl,
    preferencesUrl,
  });
}

function subject() {
  return SUBJECT;
}

function preheader() {
  return PREHEADER;
}

function text({ greetingName, unsubscribeUrl, preferencesUrl } = {}) {
  const greet =
    greetingName && greetingName !== 'there'
      ? `${greetingName}, you\u2019re on the brief.`
      : 'You\u2019re on the brief.';
  return textShell(
    [
      'SUBSCRIPTION ACTIVE',
      '',
      greet,
      '',
      'One email a week: the stories that mattered, what changed since',
      'we first reported them, and what to watch next. The source sits',
      'next to the claim. Timestamps stay on every update. Corrections',
      'stay visible.',
      '',
      'HOW THE BRIEF WORKS',
      '  01  WHAT HAPPENED — the week\u2019s stories, told straight, with',
      '      the source next to every claim.',
      '  02  WHAT CHANGED — where the facts moved after the first alert.',
      '      Revisions are labeled, never buried.',
      '  03  WHAT TO WATCH NEXT — deadlines, decisions, and advisories',
      '      already on the board.',
      '',
      'HOW WE VERIFY',
      '  01  DETECT — signals from official feeds, agency alerts, and',
      '      primary accounts we watch.',
      '  02  VERIFY — claims trace to the original source or official',
      '      data before we publish.',
      '  03  CONTEXT — what is known, what is not, who is saying it.',
      '  04  PUBLISH — every update ships with a timestamp and source.',
      '  05  CORRECT — corrections stay visible. Nothing is silently',
      '      rewritten.',
      '',
      `Read today\u2019s top stories: ${urls.topStories}`,
      `Follow live stories: ${urls.liveStories}`,
      '',
      'The first issue lands this week. Between issues: nothing,',
      'unless news genuinely breaks.',
    ],
    { unsubscribeUrl, preferencesUrl },
  );
}

module.exports = NewsletterWelcomeEmail;
module.exports.subject = subject;
module.exports.preheader = preheader;
module.exports.text = text;
