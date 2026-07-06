/**
 * NoteworthyBreakingNewsWelcomeEmail — welcome variant for readers who
 * sign up from a breaking/developing story page.
 *
 * More urgent than the standard welcome, but calm: the promise is less
 * noise, not more. Shows the story they came from and routes them back.
 */

const { color, font, urls } = require('./theme');
const {
  esc, h1, para, small, link, statusChip, timePill,
  hairline, moduleHeader, panel, btnPrimary, btnGhost,
  shell, textShell,
} = require('./shell');

const SUBJECT = 'You\u2019re on the brief. Confirmed updates only.';
const PREHEADER = 'Follow the story without losing the source trail. Corrections stay visible.';

/**
 * @param {Object} p
 * @param {string} [p.greetingName]
 * @param {Object} [p.story]            The story they signed up from
 * @param {string} p.story.headline
 * @param {string} p.story.statusKind   'developing' | 'confirmed' | ...
 * @param {string} p.story.url
 * @param {string} [p.story.lastUpdate] e.g. "21:47 UTC"
 * @param {string} [p.unsubscribeUrl]
 * @param {string} [p.preferencesUrl]
 */
function BreakingNewsWelcomeEmail({ greetingName, story, unsubscribeUrl, preferencesUrl } = {}) {
  const promiseRow = (title, body, isLast = false) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 ${isLast ? 0 : 12}px">
      <tr>
        <td width="18" style="vertical-align:top;font-family:${font.ui};font-size:12px;font-weight:700;color:${color.stable};padding:1px 6px 0 0">&#10003;</td>
        <td style="vertical-align:top">
          <p style="margin:0 0 2px;font-family:${font.ui};font-size:13px;font-weight:700;color:${color.text}">${title}</p>
          <p style="margin:0;font-family:${font.serif};font-size:14px;line-height:20px;color:${color.textSecondary}">${body}</p>
        </td>
      </tr>
    </table>`;

  const storyPanel = story
    ? `
    ${moduleHeader('&nbsp;', 'The story you followed')}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px">
      <tr><td bgcolor="${color.panel}" style="background-color:${color.panel};border:1px solid ${color.border};border-left:2px solid ${color.live};border-radius:4px;padding:15px 18px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:middle">${statusChip(story.statusKind || 'developing')}</td>
            ${story.lastUpdate ? `<td align="right" style="vertical-align:middle">${timePill('UPDATED ' + esc(story.lastUpdate))}</td>` : ''}
          </tr>
        </table>
        <p style="margin:10px 0 12px;font-family:${font.serif};font-size:17px;line-height:24px;font-weight:700;color:${color.text}">${esc(story.headline)}</p>
        <a href="${story.url}" style="font-family:${font.ui};font-size:13px;font-weight:700;color:${color.accentBright};text-decoration:none">Back to the live story&nbsp;&rarr;</a>
      </td></tr>
    </table>`
    : '';

  const greet =
    greetingName && greetingName !== 'there'
      ? `${esc(greetingName)}, you\u2019ll get the brief, not noise.`
      : 'You\u2019ll get the brief, not noise.';

  const content = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px">
      <tr>
        <td style="vertical-align:middle">${statusChip('confirmed')}</td>
        <td align="right" style="vertical-align:middle">${timePill('FROM A DEVELOPING STORY')}</td>
      </tr>
    </table>

    ${h1(greet)}
    ${para('You signed up while a story was still moving. Here\u2019s exactly what that gets you: the weekly brief, plus nothing between issues unless news genuinely breaks. No pile-on alerts. No recycled headlines.')}

    <div style="height:8px;font-size:0;line-height:0">&nbsp;</div>
    ${storyPanel}
    <div style="height:10px;font-size:0;line-height:0">&nbsp;</div>

    ${moduleHeader('&nbsp;', 'The standard')}
    ${panel(
      `${promiseRow('Confirmed updates only', 'A claim reaches you after it traces to the original source or official data \u2014 not before.')}
       ${promiseRow('Corrections stay visible', 'If we get something wrong, the correction is published and stays on the story. Nothing is silently rewritten.')}
       ${promiseRow('The source sits next to the claim', 'Every update carries its timestamp and its source label. You can check our work.', true)}`,
      { accentLeft: color.accent },
    )}
    ${small(`The full pipeline is public: ${link('how we verify', urls.howWeVerify)}.`, { tone: color.textMuted })}

    ${hairline(20)}
    <div style="height:20px;font-size:0;line-height:0">&nbsp;</div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${story ? `<td style="padding:0 10px 0 0">${btnPrimary('Back to the live story', story.url)}</td><td>${btnGhost('All live stories', urls.liveStories)}</td>` : `<td>${btnPrimary('Follow live stories', urls.liveStories)}</td>`}
      </tr>
    </table>
  `;

  return shell({
    preheader: PREHEADER,
    headerTag: 'THE WEEKLY BRIEF',
    content,
    unsubscribeUrl,
    preferencesUrl,
    footerNote: "You're receiving this because you signed up for The Weekly Brief from a developing story at noteworthynews.co.",
  });
}

function subject() {
  return SUBJECT;
}

function preheader() {
  return PREHEADER;
}

function text({ greetingName, story, unsubscribeUrl, preferencesUrl } = {}) {
  const greet =
    greetingName && greetingName !== 'there'
      ? `${greetingName}, you\u2019ll get the brief, not noise.`
      : 'You\u2019ll get the brief, not noise.';
  const lines = [
    'FROM A DEVELOPING STORY',
    '',
    greet,
    '',
    'You signed up while a story was still moving. Here\u2019s exactly',
    'what that gets you: the weekly brief, plus nothing between',
    'issues unless news genuinely breaks.',
    '',
  ];
  if (story) {
    lines.push(
      'THE STORY YOU FOLLOWED',
      `  [${(story.statusKind || 'developing').toUpperCase()}${story.lastUpdate ? ` · updated ${story.lastUpdate}` : ''}]`,
      `  ${story.headline}`,
      `  ${story.url}`,
      '',
    );
  }
  lines.push(
    'THE STANDARD',
    '  + Confirmed updates only — a claim reaches you after it traces',
    '    to the original source or official data, not before.',
    '  + Corrections stay visible — published, and kept on the story.',
    '  + The source sits next to the claim — timestamp and source',
    '    label on every update.',
    '',
    `Follow live stories: ${urls.liveStories}`,
  );
  return textShell(lines, { unsubscribeUrl, preferencesUrl });
}

module.exports = BreakingNewsWelcomeEmail;
module.exports.subject = subject;
module.exports.preheader = preheader;
module.exports.text = text;
