/**
 * NoteworthyWeeklyBriefEmail — the actual weekly newsletter.
 *
 * A live-news intelligence briefing with editorial polish. Repeatable
 * format, numbered modules:
 *
 *   HERO STORY            severity + status + source + timestamp
 *   01 AT A GLANCE        the week in four lines
 *   02 WHAT CHANGED       timeline of moves since first report
 *   03 SOURCE TRAIL       one claim, traced end to end
 *   04 DEVELOPING NOW     open live stories
 *   05 CONFIRMED / NOT    the split that defines the product
 *   06 WHAT TO WATCH NEXT the board for the coming week
 *   07 CORRECTION LOG     rendered even when empty — that's the point
 *
 * Every module is optional-safe: pass an empty array and it renders an
 * honest empty state or collapses, so the format survives slow news weeks.
 */

const { color, font, severity: severityTokens, urls } = require('./theme');
const {
  esc, h1, para, small, statusChip, severityChip, timePill, sourceLabel,
  hairline, moduleHeader, panel, btnPrimary, shell, textShell,
} = require('./shell');

function pad3(n) {
  return String(n).padStart(3, '0');
}

function subject(props = {}) {
  const { issueNumber, subjectLine } = props;
  if (subjectLine) return subjectLine;
  const topics = (props.atAGlance || [])
    .slice(0, 2)
    .map((r) => r.text.split('\u2014')[0].split(';')[0].trim());
  const topicStr = topics.length ? ` \u2014 ${topics.join(' \u00b7 ')}` : '';
  return `The Weekly Brief \u2116${pad3(issueNumber || 1)}${topicStr}`;
}

function preheader(props = {}) {
  return props.preheaderLine || props.hero?.dek || 'What happened. What changed. What is confirmed.';
}

/* ── Module renderers ───────────────────────────────────────── */

function heroBlock(hero) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px">
      <tr>
        <td style="vertical-align:middle">
          ${severityChip(hero.severity)}&nbsp;${statusChip(hero.statusKind)}
        </td>
        <td align="right" style="vertical-align:middle">${timePill(esc(hero.updatedAt))}</td>
      </tr>
    </table>
    <p style="margin:0 0 10px;font-family:${font.mono};font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${color.textSecondary}">${esc(hero.kickerLabel)}</p>
    <h1 style="margin:0 0 12px;font-family:${font.serif};font-size:30px;line-height:37px;font-weight:700;color:${color.text}">${esc(hero.headline)}</h1>
    <p style="margin:0 0 14px;font-family:${font.serif};font-size:16px;line-height:24px;color:${color.textSecondary}">${esc(hero.dek)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 4px">
      <tr>
        <td style="vertical-align:middle">${sourceLabel(hero.source.name, hero.source.url)}</td>
        <td align="right" style="vertical-align:middle">
          <a href="${hero.cta.url}" style="font-family:${font.ui};font-size:13px;font-weight:700;color:${color.accentBright};text-decoration:none">${esc(hero.cta.label)}&nbsp;&rarr;</a>
        </td>
      </tr>
    </table>`;
}

function atAGlanceBlock(rows) {
  const items = rows
    .map((r, i) => {
      const tone = (severityTokens[r.severity] || severityTokens.monitor).text;
      return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 ${i === rows.length - 1 ? 0 : 10}px">
        <tr>
          <td width="16" style="vertical-align:top;font-size:11px;line-height:20px;color:${tone};padding:0 8px 0 0">&#9679;</td>
          <td style="vertical-align:top;font-family:${font.serif};font-size:14px;line-height:20px;color:${color.text}">${esc(r.text)}</td>
          <td width="46" align="right" style="vertical-align:top;font-family:${font.mono};font-size:10px;letter-spacing:1px;color:${color.textMuted};padding:3px 0 0 10px;white-space:nowrap">${esc(r.time)}</td>
        </tr>
      </table>`;
    })
    .join('');
  return panel(items);
}

function whatChangedBlock(entries) {
  return entries
    .map(
      (e, i) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 ${i === entries.length - 1 ? 0 : 14}px">
      <tr>
        <td width="82" style="vertical-align:top;font-family:${font.mono};font-size:10px;letter-spacing:0.5px;line-height:16px;color:${color.textSecondary};padding:3px 12px 0 0;white-space:nowrap">${esc(e.time)}</td>
        <td style="vertical-align:top;border-left:2px solid ${color.border};padding:0 0 0 14px">
          <p style="margin:0 0 5px">${statusChip(e.status)}</p>
          <p style="margin:0;font-family:${font.serif};font-size:14px;line-height:21px;color:${color.text}">${esc(e.text)}</p>
        </td>
      </tr>
    </table>`,
    )
    .join('');
}

function sourceTrailBlock(trail) {
  const rows = trail.sources
    .map((s, i) => {
      const branch = i === trail.sources.length - 1 ? '&#9492;&#9472;' : '&#9500;&#9472;';
      const name = s.url
        ? `<a href="${s.url}" style="color:${color.accentBright};text-decoration:none">${esc(s.name).toUpperCase()}</a>`
        : `<span style="color:${color.text}">${esc(s.name).toUpperCase()}</span>`;
      return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 ${i === trail.sources.length - 1 ? 0 : 7}px">
        <tr>
          <td width="24" style="vertical-align:top;font-family:${font.mono};font-size:11px;color:${color.textMuted};padding:1px 6px 0 0;white-space:nowrap">${branch}</td>
          <td width="118" style="vertical-align:top;font-family:${font.mono};font-size:11px;letter-spacing:0.5px;font-weight:700;padding:1px 10px 0 0;white-space:nowrap">${name}</td>
          <td style="vertical-align:top;font-family:${font.ui};font-size:12px;line-height:18px;color:${color.textSecondary}">${esc(s.role)}</td>
        </tr>
      </table>`;
    })
    .join('');

  return panel(
    `
    <p style="margin:0 0 4px;font-family:${font.mono};font-size:9px;letter-spacing:2px;color:${color.textMuted}">CLAIM</p>
    <p style="margin:0 0 10px;font-family:${font.serif};font-style:italic;font-size:16px;line-height:24px;color:${color.text}">${esc(trail.claim)}</p>
    <p style="margin:0 0 14px;font-family:${font.ui};font-size:12px;line-height:18px;color:${color.textSecondary}">${esc(trail.context)}</p>
    ${rows}`,
    { accentLeft: color.gold },
  );
}

function developingNowBlock(items) {
  return items
    .map(
      (d, i) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 ${i === items.length - 1 ? 0 : 10}px">
      <tr><td bgcolor="${color.panel}" style="background-color:${color.panel};border:1px solid ${color.border};border-left:2px solid ${color.live};border-radius:4px;padding:13px 16px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:middle">${statusChip('developing')}</td>
            <td align="right" style="vertical-align:middle">${timePill('UPDATED ' + esc(d.lastUpdate))}</td>
          </tr>
        </table>
        <p style="margin:9px 0 0;font-family:${font.serif};font-size:15px;line-height:22px;font-weight:700">
          <a href="${d.url}" style="color:${color.text};text-decoration:none">${esc(d.headline)}</a>
        </p>
      </td></tr>
    </table>`,
    )
    .join('');
}

function confirmedSplitBlock(confirmed, notConfirmed) {
  const confirmedRows = confirmed
    .map(
      (c, i) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 ${i === confirmed.length - 1 ? 0 : 10}px">
      <tr>
        <td width="18" style="vertical-align:top;font-family:${font.ui};font-size:12px;font-weight:700;color:${color.stable};padding:1px 6px 0 0">&#10003;</td>
        <td style="vertical-align:top">
          <p style="margin:0 0 2px;font-family:${font.serif};font-size:14px;line-height:20px;color:${color.text}">${esc(c.text)}</p>
          ${sourceLabel(c.source)}
        </td>
      </tr>
    </table>`,
    )
    .join('');

  const notConfirmedRows = notConfirmed
    .map(
      (n, i) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 ${i === notConfirmed.length - 1 ? 0 : 10}px">
      <tr>
        <td width="18" style="vertical-align:top;font-family:${font.ui};font-size:12px;font-weight:700;color:${color.elevated};padding:1px 6px 0 0">&#9675;</td>
        <td style="vertical-align:top">
          <p style="margin:0 0 2px;font-family:${font.serif};font-size:14px;line-height:20px;color:${color.text}">${esc(n.text)}</p>
          <span style="font-family:${font.ui};font-size:11px;line-height:16px;color:${color.textSecondary}">${esc(n.note)}</span>
        </td>
      </tr>
    </table>`,
    )
    .join('');

  return `
    ${panel(
      `<p style="margin:0 0 12px;font-family:${font.ui};font-size:10px;font-weight:700;letter-spacing:2px;color:${color.stable}">CONFIRMED</p>${confirmedRows}`,
      { accentLeft: color.stable, marginBottom: 10 },
    )}
    ${panel(
      `<p style="margin:0 0 4px;font-family:${font.ui};font-size:10px;font-weight:700;letter-spacing:2px;color:${color.elevated}">NOT CONFIRMED</p>
       <p style="margin:0 0 12px;font-family:${font.ui};font-size:11px;color:${color.textMuted}">Reported, not verified. We carry these as claims until they trace to source.</p>
       ${notConfirmedRows}`,
      { accentLeft: color.elevated },
    )}`;
}

function watchNextBlock(items) {
  return items
    .map(
      (w, i) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 ${i === items.length - 1 ? 0 : 10}px">
      <tr>
        <td width="66" style="vertical-align:top;padding:0 12px 0 0;white-space:nowrap">${timePill(esc(w.when))}</td>
        <td style="vertical-align:top;font-family:${font.serif};font-size:14px;line-height:21px;color:${color.text};padding-top:3px">${esc(w.text)}</td>
      </tr>
    </table>`,
    )
    .join('');
}

function correctionLogBlock(corrections) {
  if (!corrections || corrections.length === 0) {
    return panel(
      `<p style="margin:0 0 4px;font-family:${font.serif};font-size:14px;line-height:21px;color:${color.text}">No corrections this issue.</p>
       <p style="margin:0;font-family:${font.ui};font-size:12px;line-height:18px;color:${color.textSecondary}">When we get something wrong, the correction is published here and stays on the story. This section never disappears.</p>`,
      { accentLeft: color.border },
    );
  }
  const rows = corrections
    .map(
      (c, i) => `
      <div style="margin:0 0 ${i === corrections.length - 1 ? 0 : 16}px">
        <p style="margin:0 0 8px">${timePill(esc(c.date))}</p>
        <p style="margin:0 0 4px;font-family:${font.serif};font-size:14px;line-height:20px;color:${color.textSecondary}"><span style="font-family:${font.ui};font-size:10px;font-weight:700;letter-spacing:1.5px;color:${color.critical}">WAS&nbsp;&nbsp;</span>${esc(c.was)}</p>
        <p style="margin:0 0 4px;font-family:${font.serif};font-size:14px;line-height:20px;color:${color.text}"><span style="font-family:${font.ui};font-size:10px;font-weight:700;letter-spacing:1.5px;color:${color.stable}">NOW&nbsp;</span>${esc(c.now)}</p>
        ${c.note ? `<p style="margin:0;font-family:${font.ui};font-size:11px;line-height:16px;color:${color.textMuted}">${esc(c.note)}</p>` : ''}
      </div>`,
    )
    .join('');
  return panel(rows, { accentLeft: color.critical });
}

/* ── Template ───────────────────────────────────────────────── */

function WeeklyBriefEmail(props = {}) {
  const {
    issueNumber = 1,
    dateline = '',
    weekOf = '',
    hero,
    atAGlance = [],
    whatChanged = [],
    sourceTrail,
    developingNow = [],
    confirmed = [],
    notConfirmed = [],
    watchNext = [],
    corrections = [],
    followCta = { label: 'Follow live stories', url: urls.liveStories },
    unsubscribeUrl,
    preferencesUrl,
  } = props;

  let mod = 0;
  const nextNum = () => pad3(++mod).slice(1); // 01, 02, ...
  const gap = (h = 26) => `<div style="height:${h}px;font-size:0;line-height:0">&nbsp;</div>`;

  const content = `
    ${hero ? heroBlock(hero) : ''}
    ${hero ? hairline(24) + gap(24) : ''}

    ${atAGlance.length ? moduleHeader(nextNum(), 'At a glance') + atAGlanceBlock(atAGlance) + gap() : ''}
    ${whatChanged.length ? moduleHeader(nextNum(), 'What changed') + whatChangedBlock(whatChanged) + gap() : ''}
    ${sourceTrail ? moduleHeader(nextNum(), 'Source trail') + sourceTrailBlock(sourceTrail) + gap() : ''}
    ${developingNow.length ? moduleHeader(nextNum(), 'Developing now') + developingNowBlock(developingNow) + gap() : ''}
    ${confirmed.length || notConfirmed.length ? moduleHeader(nextNum(), 'Confirmed / Not confirmed') + confirmedSplitBlock(confirmed, notConfirmed) + gap() : ''}
    ${watchNext.length ? moduleHeader(nextNum(), 'What to watch next') + watchNextBlock(watchNext) + gap() : ''}
    ${moduleHeader(nextNum(), 'Correction log') + correctionLogBlock(corrections)}

    ${gap(28)}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td bgcolor="${color.raised}" style="background-color:${color.raised};border:1px solid ${color.border};border-radius:4px;padding:20px 22px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:middle">
              <p style="margin:0 0 3px;font-family:${font.ui};font-size:14px;font-weight:700;color:${color.text}">The story keeps moving after this email.</p>
              <p style="margin:0;font-family:${font.ui};font-size:12px;line-height:18px;color:${color.textSecondary}">Follow live stories for confirmed updates as they land &mdash; timestamps on, sources attached.</p>
            </td>
          </tr>
          <tr><td style="padding-top:14px">${btnPrimary(esc(followCta.label), followCta.url)}</td></tr>
        </table>
      </td></tr>
    </table>
  `;

  return shell({
    preheader: preheader(props),
    headerTag: 'THE WEEKLY BRIEF',
    headerMeta: `ISSUE &#8470;${pad3(issueNumber)}&nbsp;&nbsp;&middot;&nbsp;&nbsp;${esc(dateline).toUpperCase()}${weekOf ? `&nbsp;&nbsp;&middot;&nbsp;&nbsp;WEEK OF ${esc(weekOf).toUpperCase()}` : ''}`,
    content,
    unsubscribeUrl,
    preferencesUrl,
    footerNote: "You're receiving The Weekly Brief because you subscribed at noteworthynews.co.",
  });
}

/* ── Plain text ─────────────────────────────────────────────── */

function text(props = {}) {
  const {
    issueNumber = 1, dateline = '', weekOf = '', hero, atAGlance = [],
    whatChanged = [], sourceTrail, developingNow = [], confirmed = [],
    notConfirmed = [], watchNext = [], corrections = [],
    followCta = { label: 'Follow live stories', url: urls.liveStories },
    unsubscribeUrl, preferencesUrl,
  } = props;

  const lines = [
    `ISSUE No.${pad3(issueNumber)} · ${dateline}${weekOf ? ` · Week of ${weekOf}` : ''}`,
    '',
  ];

  if (hero) {
    lines.push(
      `[${(hero.severity || '').toUpperCase()} · ${(hero.statusKind || '').toUpperCase()}] ${hero.kickerLabel}`,
      '',
      hero.headline,
      '',
      hero.dek,
      '',
      `Source: ${hero.source.name} · Updated ${hero.updatedAt}`,
      `${hero.cta.label}: ${hero.cta.url}`,
      '',
    );
  }

  if (atAGlance.length) {
    lines.push('01 — AT A GLANCE', '');
    atAGlance.forEach((r) => lines.push(`  [${r.time}] ${r.text}`));
    lines.push('');
  }

  if (whatChanged.length) {
    lines.push('02 — WHAT CHANGED', '');
    whatChanged.forEach((e) => lines.push(`  ${e.time}  [${e.status.toUpperCase()}]`, `    ${e.text}`, ''));
  }

  if (sourceTrail) {
    lines.push('03 — SOURCE TRAIL', '', `  CLAIM: ${sourceTrail.claim}`, `  ${sourceTrail.context}`, '');
    sourceTrail.sources.forEach((s, i) => {
      const branch = i === sourceTrail.sources.length - 1 ? '└─' : '├─';
      lines.push(`  ${branch} ${s.name.toUpperCase()} — ${s.role}`);
    });
    lines.push('');
  }

  if (developingNow.length) {
    lines.push('04 — DEVELOPING NOW', '');
    developingNow.forEach((d) => lines.push(`  [DEVELOPING · updated ${d.lastUpdate}]`, `  ${d.headline}`, `  ${d.url}`, ''));
  }

  if (confirmed.length || notConfirmed.length) {
    lines.push('05 — CONFIRMED / NOT CONFIRMED', '', '  CONFIRMED:');
    confirmed.forEach((c) => lines.push(`    + ${c.text} (${c.source})`));
    lines.push('', '  NOT CONFIRMED (reported, not verified):');
    notConfirmed.forEach((n) => lines.push(`    - ${n.text}`, `      ${n.note}`));
    lines.push('');
  }

  if (watchNext.length) {
    lines.push('06 — WHAT TO WATCH NEXT', '');
    watchNext.forEach((w) => lines.push(`  [${w.when}] ${w.text}`));
    lines.push('');
  }

  lines.push('07 — CORRECTION LOG', '');
  if (!corrections.length) {
    lines.push('  No corrections this issue. When we correct something, it', '  stays here — this section never disappears.', '');
  } else {
    corrections.forEach((c) => {
      lines.push(`  ${c.date}`, `    WAS: ${c.was}`, `    NOW: ${c.now}`);
      if (c.note) lines.push(`    ${c.note}`);
      lines.push('');
    });
  }

  lines.push(`${followCta.label}: ${followCta.url}`);

  return textShell(lines, { unsubscribeUrl, preferencesUrl });
}

module.exports = WeeklyBriefEmail;
module.exports.subject = subject;
module.exports.preheader = preheader;
module.exports.text = text;
