/**
 * Noteworthy News — shared email shell + primitives.
 *
 * The visual contract for every Noteworthy email:
 *   dark navy canvas → 600px card with a 2px live-blue top edge →
 *   left-aligned masthead → editorial serif headlines → mono timestamps →
 *   status/severity chips → public-corrections footer.
 *
 * Hard rules (kept by construction, not by discipline):
 *   - table layout, inline styles, solid hex colors only
 *   - no JavaScript, no CSS animation, no critical text inside images
 *   - single column; the only media query bumps padding on wide screens,
 *     so clients that strip <style> get the (primary) mobile layout
 *   - every template ships a hand-written plain-text twin via textShell()
 */

const { color, font, severity, status, urls } = require('./theme');

/** Escape user/dynamic strings before interpolation into HTML. */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Typography ─────────────────────────────────────────────── */

/** Uppercase mono kicker — section voice, like the site's band-kicker. */
function kicker(text, tone = color.accentBright) {
  return `<p style="margin:0 0 12px;font-family:${font.mono};font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${tone};font-weight:700">${text}</p>`;
}

/** Editorial headline — serif, like the site's band-title. */
function h1(text) {
  return `<h1 style="margin:0 0 14px;font-family:${font.serif};font-size:28px;line-height:34px;font-weight:700;color:${color.text}">${text}</h1>`;
}

function h2(text) {
  return `<h2 style="margin:0 0 10px;font-family:${font.serif};font-size:21px;line-height:27px;font-weight:700;color:${color.text}">${text}</h2>`;
}

/** Dek / standfirst under a headline. */
function dek(text) {
  return `<p style="margin:0 0 8px;font-family:${font.serif};font-size:16px;line-height:24px;color:${color.textSecondary}">${text}</p>`;
}

/** Body paragraph (serif — the site's reading voice). */
function para(text, opts = {}) {
  const c = opts.tone || color.text;
  const mb = opts.marginBottom ?? 14;
  return `<p style="margin:0 0 ${mb}px;font-family:${font.serif};font-size:15px;line-height:23px;color:${c}">${text}</p>`;
}

/** Functional small print (UI sans). */
function small(text, opts = {}) {
  const c = opts.tone || color.textSecondary;
  return `<p style="margin:0 0 ${opts.marginBottom ?? 10}px;font-family:${font.ui};font-size:12px;line-height:18px;color:${c}">${text}</p>`;
}

/** Inline text link. */
function link(label, url, tone = color.accentBright) {
  return `<a href="${url}" style="color:${tone};text-decoration:underline">${label}</a>`;
}

/* ── Newsroom hardware: chips, pills, labels ────────────────── */

/** Status chip: developing / confirmed / corrected / watch / resolved. */
function statusChip(kind) {
  const s = status[kind] || status.watch;
  return `<span style="display:inline-block;font-family:${font.ui};font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${s.text};border:1px solid ${s.border};border-radius:3px;padding:3px 7px;vertical-align:middle">${s.label}</span>`;
}

/** Severity chip: critical / elevated / monitor / stable. */
function severityChip(kind) {
  const s = severity[kind] || severity.monitor;
  return `<span style="display:inline-block;font-family:${font.ui};font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${s.text};border:1px solid ${s.border};border-radius:3px;padding:3px 7px;vertical-align:middle">${s.label}</span>`;
}

/** Mono timestamp pill — the "timestamps stay on every update" signature. */
function timePill(text) {
  return `<span style="display:inline-block;font-family:${font.mono};font-size:10px;letter-spacing:1px;color:${color.textSecondary};border:1px solid ${color.border};border-radius:3px;padding:3px 8px;vertical-align:middle">${text}</span>`;
}

/** Source label — the source sits next to the claim. */
function sourceLabel(name, url) {
  const inner = `SOURCE&nbsp;&middot;&nbsp;${esc(name)}`;
  const body = url
    ? `<a href="${url}" style="color:${color.textSecondary};text-decoration:underline">${inner}</a>`
    : inner;
  return `<span style="font-family:${font.mono};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${color.textSecondary}">${body}</span>`;
}

/** Small live dot + label, e.g. liveMark('LIVE'). Static color, no animation. */
function liveMark(label = 'LIVE') {
  return `<span style="font-family:${font.ui};font-size:10px;font-weight:700;letter-spacing:2px;color:${color.live}">&#9679;&nbsp;${label}</span>`;
}

/* ── Structure ──────────────────────────────────────────────── */

function hairline(marginY = 24) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:1px solid ${color.border};font-size:0;line-height:0;padding-top:${marginY}px;mso-line-height-rule:exactly">&nbsp;</td></tr></table>`;
}

function spacer(h = 16) {
  return `<div style="height:${h}px;line-height:${h}px;font-size:0">&nbsp;</div>`;
}

/**
 * Numbered module header — mirrors the site's verify-step numbering.
 * moduleHeader('02', 'What changed') →  02 ─ WHAT CHANGED ───────
 */
function moduleHeader(num, title) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px">
    <tr>
      <td width="30" style="font-family:${font.mono};font-size:11px;color:${color.accentBright};padding:0 8px 0 0;white-space:nowrap">${num}</td>
      <td style="font-family:${font.ui};font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${color.text};padding:0 12px 0 0;white-space:nowrap">${title}</td>
      <td width="100%" style="border-top:1px solid ${color.border};font-size:0;line-height:0">&nbsp;</td>
    </tr>
  </table>`;
}

/** Inset panel — module surface on the card. */
function panel(innerHtml, opts = {}) {
  const bg = opts.bg || color.panel;
  const pad = opts.padding || '18px 20px';
  const borderLeft = opts.accentLeft ? `border-left:2px solid ${opts.accentLeft};` : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 ${opts.marginBottom ?? 14}px">
    <tr><td bgcolor="${bg}" style="background-color:${bg};border:1px solid ${color.border};${borderLeft}border-radius:4px;padding:${pad}">${innerHtml}</td></tr>
  </table>`;
}

/* ── Buttons (bulletproof: table + padded cell) ─────────────── */

function btnPrimary(label, url, opts = {}) {
  const align = opts.align || 'left';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${align === 'center' ? 'align="center" style="margin:0 auto"' : ''}>
    <tr><td bgcolor="${color.accent}" style="background-color:${color.accent};border-radius:6px;mso-padding-alt:13px 28px">
      <a href="${url}" style="display:inline-block;padding:13px 28px;font-family:${font.ui};font-size:13px;font-weight:700;letter-spacing:0.3px;color:${color.white};text-decoration:none">${label}</a>
    </td></tr>
  </table>`;
}

function btnGhost(label, url, opts = {}) {
  const align = opts.align || 'left';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${align === 'center' ? 'align="center" style="margin:0 auto"' : ''}>
    <tr><td style="border:1px solid ${color.borderLit};border-radius:6px;mso-padding-alt:12px 26px">
      <a href="${url}" style="display:inline-block;padding:12px 26px;font-family:${font.ui};font-size:13px;font-weight:600;color:${color.text};text-decoration:none">${label}</a>
    </td></tr>
  </table>`;
}

/* ── Motion (progressive enhancement only) ──────────────────── */

/**
 * Animated GIF block. The email must be complete without it:
 * solid dark backdrop behind the image, real alt text, fixed dimensions.
 * GIF spec: strong first frame, loop, hosted on the site, < 800 KB.
 */
function gifPanel({ src, alt, width, height, caption }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 6px">
    <tr><td bgcolor="${color.raised}" style="background-color:${color.raised};border:1px solid ${color.border};border-radius:4px;padding:0;font-size:0;line-height:0">
      <img src="${src}" alt="${esc(alt)}" width="${width}" height="${height}"
        style="display:block;width:100%;max-width:${width}px;height:auto;border:0;border-radius:3px" />
    </td></tr>
    ${caption ? `<tr><td style="padding:8px 2px 0"><span style="font-family:${font.mono};font-size:10px;letter-spacing:1px;color:${color.textMuted}">${caption}</span></td></tr>` : ''}
  </table>`;
}

/* ── The shell ──────────────────────────────────────────────── */

/**
 * Wrap rendered content in the full HTML document.
 *
 * @param {Object} p
 * @param {string} p.preheader        Inbox preview text (hidden in body)
 * @param {string} p.headerTag        Right side of masthead, e.g. "THE WEEKLY BRIEF"
 * @param {string} p.headerMeta       Optional second masthead row (issue/date line)
 * @param {string} p.content          Inner card HTML
 * @param {string} p.unsubscribeUrl   Defaults to the send pipeline's placeholder
 * @param {string} p.preferencesUrl
 * @param {string} p.footerNote       Why-you-got-this line override
 */
function shell({
  preheader,
  headerTag = 'THE WEEKLY BRIEF',
  headerMeta = '',
  content,
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
  preferencesUrl = '{{{PREFERENCES_URL}}}',
  footerNote = "You're receiving this because you signed up for The Weekly Brief at noteworthynews.co.",
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark only">
  <!--[if mso]><style>table{border-collapse:collapse}div,td,p,a,span{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]-->
  <style>
    body,html{background-color:${color.bg}!important;margin:0;padding:0}
    [data-ogsc] body,[data-ogsc] table{background-color:${color.bg}!important}
    @media (prefers-color-scheme:light){body,html{background-color:${color.bg}!important}}
    @media only screen and (min-width:600px){
      .nw-card-pad{padding:38px 44px 34px!important}
      .nw-outer-pad{padding:36px 20px 44px!important}
    }
  </style>
</head>
<body bgcolor="${color.bg}" style="margin:0;padding:0;background-color:${color.bg};color-scheme:dark only;-webkit-text-size-adjust:100%">
  <!-- Preheader: inbox preview only -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(30)}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${color.bg}" style="background-color:${color.bg}">
    <tr>
      <td align="center" class="nw-outer-pad" style="padding:24px 12px 36px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px">

          <!-- Masthead -->
          <tr>
            <td style="padding:0 4px 14px">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="30" style="padding:0 10px 0 0;vertical-align:middle">
                    <img src="${urls.logo}" alt="" width="26" height="26" style="display:block;border:0;border-radius:5px" />
                  </td>
                  <td style="vertical-align:middle;font-family:${font.ui};font-size:15px;font-weight:800;letter-spacing:2px;color:${color.text};white-space:nowrap">NOTEWORTHY&nbsp;NEWS</td>
                  <td align="right" style="vertical-align:middle;font-family:${font.mono};font-size:9px;letter-spacing:2.5px;color:${color.gold};white-space:nowrap">${headerTag}</td>
                </tr>
              </table>
              ${headerMeta ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:10px 0 0;font-family:${font.mono};font-size:10px;letter-spacing:1.5px;color:${color.textSecondary}">${headerMeta}</td></tr></table>` : ''}
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td bgcolor="${color.card}" class="nw-card-pad" style="background-color:${color.card};border:1px solid ${color.border};border-top:2px solid ${color.accent};border-radius:6px;padding:28px 22px 26px">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 6px 0;text-align:center">
              <p style="margin:0 0 10px;font-family:${font.mono};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${color.textSecondary}">Independent newsroom &middot; No paywall &middot; Corrections in public</p>
              <p style="margin:0 0 6px;font-family:${font.ui};font-size:11px;line-height:17px;color:${color.textMuted}">${footerNote}</p>
              <p style="margin:0;font-family:${font.ui};font-size:11px;line-height:17px;color:${color.textMuted}">
                <a href="${preferencesUrl}" style="color:${color.textSecondary};text-decoration:underline">Manage preferences</a>
                &nbsp;&middot;&nbsp;
                <a href="${unsubscribeUrl}" style="color:${color.textSecondary};text-decoration:underline">Unsubscribe</a>
                &nbsp;&middot;&nbsp;
                <a href="${urls.site}" style="color:${color.textSecondary};text-decoration:underline">noteworthynews.co</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ── Plain-text twin ────────────────────────────────────────── */

/**
 * Wrap plain-text body lines with the standard header/footer.
 * @param {string[]} lines
 */
function textShell(lines, {
  headerTag = 'THE WEEKLY BRIEF',
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
  preferencesUrl = '{{{PREFERENCES_URL}}}',
} = {}) {
  return [
    `NOTEWORTHY NEWS — ${headerTag}`,
    '='.repeat(52),
    '',
    ...lines,
    '',
    '-'.repeat(52),
    'Independent newsroom. No paywall. Corrections in public.',
    '',
    `Manage preferences: ${preferencesUrl}`,
    `Unsubscribe: ${unsubscribeUrl}`,
    'https://noteworthynews.co',
  ].join('\n');
}

module.exports = {
  esc,
  kicker,
  h1,
  h2,
  dek,
  para,
  small,
  link,
  statusChip,
  severityChip,
  timePill,
  sourceLabel,
  liveMark,
  hairline,
  spacer,
  moduleHeader,
  panel,
  btnPrimary,
  btnGhost,
  gifPanel,
  shell,
  textShell,
};
