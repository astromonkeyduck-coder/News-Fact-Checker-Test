/**
 * Noteworthy email preview bench.
 *
 * Local QA surface for the Noteworthy newsletter templates
 * (emails/noteworthy). Renders every template from sample data:
 *
 *   /emails/noteworthy                          index of all templates
 *   /emails/noteworthy?template=weekly-brief    bench: 600px / 375px / plain text
 *   ...&raw=html                                raw email HTML (iframe source)
 *   ...&raw=text                                plain-text twin
 *
 * Dev: `netlify dev` → http://localhost:8888/emails/noteworthy
 * No auth: sample data only, nothing sensitive; noindex header set.
 * The bench page itself uses JS for width toggles — the EMAILS contain none.
 */

const {
  NewsletterVerifyEmail,
  NewsletterWelcomeEmail,
  WeeklyBriefEmail,
  BreakingNewsWelcomeEmail,
  sampleData,
} = require('../../emails/noteworthy');

const FROM_DEFAULT = process.env.RESEND_FROM_EMAIL || 'Noteworthy News <richard@noteworthynews.co>';

const REGISTRY = [
  {
    slug: 'verify',
    name: 'Newsletter Verify',
    purpose: 'Double opt-in confirmation for The Weekly Brief.',
    template: NewsletterVerifyEmail,
    props: sampleData.sampleVerify,
  },
  {
    slug: 'welcome',
    name: 'Newsletter Welcome',
    purpose: 'Sent on signup — how the brief works, how we verify, live-signal GIF.',
    template: NewsletterWelcomeEmail,
    props: sampleData.sampleWelcome,
  },
  {
    slug: 'weekly-brief',
    name: 'The Weekly Brief',
    purpose: 'The weekly issue: hero, at a glance, what changed, source trail, confirmed/not, watch next, corrections.',
    template: WeeklyBriefEmail,
    props: sampleData.sampleWeeklyBrief,
  },
  {
    slug: 'weekly-brief-clean',
    name: 'Weekly Brief — empty corrections',
    purpose: 'Same issue with a clean correction log, proving the honest empty state.',
    template: WeeklyBriefEmail,
    props: sampleData.sampleWeeklyBriefNoCorrections,
  },
  {
    slug: 'breaking-welcome',
    name: 'Breaking-News Welcome',
    purpose: 'Welcome variant for signups made from a developing story page.',
    template: BreakingNewsWelcomeEmail,
    props: sampleData.sampleBreakingWelcome,
  },
];

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PAGE_CSS = `
  :root{--bg:#04060B;--panel:#0C1220;--border:rgba(255,255,255,.08);--text:rgba(240,242,245,.95);
    --dim:rgba(240,242,245,.55);--muted:rgba(240,242,245,.32);--accent:#3E8DF3;--gold:#D9B545;
    --ui:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    --mono:'SF Mono',Monaco,'Cascadia Code',Consolas,monospace}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:var(--ui);padding:28px 16px 64px}
  .wrap{max-width:960px;margin:0 auto}
  a{color:var(--accent)}
  .crumb{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);text-decoration:none}
  .crumb:hover{color:var(--text)}
  h1{font-size:26px;margin:18px 0 6px}
  .sub{color:var(--dim);font-size:14px;margin:0 0 26px;line-height:1.55}
  .meta{border:1px solid var(--border);background:var(--panel);border-radius:8px;padding:16px 20px;margin:0 0 18px}
  .meta div{display:flex;gap:14px;padding:4px 0;font-size:13px}
  .meta dt{width:86px;flex:none;font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);padding-top:2px}
  .meta dd{margin:0;color:var(--dim)}
  .meta dd.strong{color:var(--text);font-weight:600}
  .bar{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;margin:0 0 14px}
  .group{display:flex;gap:6px}
  button{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;padding:8px 14px;
    border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--dim);cursor:pointer}
  button:hover{border-color:rgba(255,255,255,.25);color:var(--text)}
  button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
  .stage{border:1px solid var(--border);border-radius:8px;background:#02030a;padding:22px;display:flex;justify-content:center}
  iframe{border:0;background:transparent;width:600px;max-width:100%;height:900px;transition:width .25s ease}
  pre{white-space:pre-wrap;word-break:break-word;font-family:var(--mono);font-size:12.5px;line-height:1.6;color:var(--dim);margin:0;max-width:640px;width:100%}
  .card{display:block;border:1px solid var(--border);background:var(--panel);border-radius:8px;padding:18px 22px;margin:0 0 12px;text-decoration:none;color:var(--text)}
  .card:hover{border-color:rgba(62,141,243,.5)}
  .card .k{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);display:flex;justify-content:space-between}
  .card .s{font-size:16px;font-weight:650;margin:8px 0 3px}
  .card .p{font-size:13px;color:var(--dim);margin:0 0 6px;line-height:1.5}
  .card .ph{font-size:12px;color:var(--muted);margin:0}
  .note{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:22px 0 0;line-height:1.9}
`;

function indexPage() {
  const cards = REGISTRY.map((r) => {
    const subject = r.template.subject(r.props);
    const preheader = r.template.preheader(r.props);
    return `<a class="card" href="?template=${r.slug}">
      <span class="k"><span>${esc(r.name)}</span><span>proof &rarr;</span></span>
      <p class="s">${esc(subject)}</p>
      <p class="p">${esc(r.purpose)}</p>
      <p class="ph">Preheader: ${esc(preheader)}</p>
    </a>`;
  }).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
  <title>Noteworthy — email previews</title><style>${PAGE_CSS}</style></head>
  <body><div class="wrap">
    <a class="crumb" href="/">&larr; noteworthynews.co</a>
    <h1>Noteworthy email previews</h1>
    <p class="sub">The newsletter templates, rendered live from sample data (a Sanriku earthquake, ceasefire talks,
    a derecho watch, a source trail, and one on-record correction). Open a template to proof it at 600px and 375px
    and read its plain-text twin.</p>
    ${cards}
    <p class="note">Sample data only &middot; real sends receive live props &middot; emails contain no JavaScript</p>
  </div></body></html>`;
}

function benchPage(entry) {
  const subject = entry.template.subject(entry.props);
  const preheader = entry.template.preheader(entry.props);
  const textVersion = entry.template.text(entry.props);

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
  <title>${esc(entry.name)} — Noteworthy email previews</title><style>${PAGE_CSS}</style></head>
  <body><div class="wrap">
    <a class="crumb" href="?">&larr; all templates</a>
    <h1>${esc(entry.name)}</h1>
    <p class="sub">${esc(entry.purpose)}</p>

    <dl class="meta">
      <div><dt>From</dt><dd>${esc(FROM_DEFAULT)}</dd></div>
      <div><dt>Subject</dt><dd class="strong">${esc(subject)}</dd></div>
      <div><dt>Preheader</dt><dd>${esc(preheader)}</dd></div>
    </dl>

    <div class="bar">
      <div class="group" role="group" aria-label="Preview width">
        <button id="w600" aria-pressed="true">Desktop &middot; 600</button>
        <button id="w375" aria-pressed="false">Mobile &middot; 375</button>
      </div>
      <div class="group" role="group" aria-label="Preview format">
        <button id="vHtml" aria-pressed="true">Rendered</button>
        <button id="vText" aria-pressed="false">Plain text</button>
      </div>
    </div>

    <div class="stage">
      <iframe id="frame" title="${esc(entry.name)} rendered preview" src="?template=${entry.slug}&amp;raw=html"></iframe>
      <pre id="plain" hidden>${esc(textVersion)}</pre>
    </div>
  </div>
  <script>
    var frame=document.getElementById('frame'),plain=document.getElementById('plain');
    var w600=document.getElementById('w600'),w375=document.getElementById('w375');
    var vHtml=document.getElementById('vHtml'),vText=document.getElementById('vText');
    function setW(px,on,off){frame.style.width=px+'px';on.setAttribute('aria-pressed','true');off.setAttribute('aria-pressed','false');}
    w600.onclick=function(){setW(600,w600,w375)};
    w375.onclick=function(){setW(375,w375,w600)};
    vHtml.onclick=function(){frame.hidden=false;plain.hidden=true;vHtml.setAttribute('aria-pressed','true');vText.setAttribute('aria-pressed','false');};
    vText.onclick=function(){frame.hidden=true;plain.hidden=false;vText.setAttribute('aria-pressed','true');vHtml.setAttribute('aria-pressed','false');};
    frame.addEventListener('load',function(){try{var d=frame.contentDocument;if(d&&d.body)frame.style.height=Math.max(700,d.body.scrollHeight+40)+'px';}catch(e){}});
  </script></body></html>`;
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const baseHeaders = {
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store',
  };

  const entry = params.template ? REGISTRY.find((r) => r.slug === params.template) : null;

  if (params.template && !entry) {
    return { statusCode: 404, headers: { ...baseHeaders, 'Content-Type': 'text/plain' }, body: 'Unknown template' };
  }

  if (entry && params.raw === 'html') {
    return {
      statusCode: 200,
      headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      body: entry.template(entry.props),
    };
  }

  if (entry && params.raw === 'text') {
    return {
      statusCode: 200,
      headers: { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      body: entry.template.text(entry.props),
    };
  }

  return {
    statusCode: 200,
    headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    body: entry ? benchPage(entry) : indexPage(),
  };
};
