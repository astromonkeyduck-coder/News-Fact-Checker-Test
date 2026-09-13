'use strict';

// Curated connections between existing coverage and reviewed source documents.
// No clustering by headline similarity, inferred evidence, or refreshed dates.
const M = require('./model');
const data = require('./data/story-guides.json');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const href = guide => {
  if (!guide || typeof guide.slug !== 'string' || guide.slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guide.slug)) {
    throw new Error('Invalid story briefing slug');
  }
  return `/story-so-far/${guide.slug}/`;
};
const guides = data.guides;

function date(value) {
  if (!value) return '';
  // Do not convert calendar-only source dates into the previous local day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
  }
  return Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-US', {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'}) : '';
}
const time = value => `<time datetime="${esc(value)}">${esc(date(value))}</time>`;
const bySlug = slug => guides.find(guide => guide.slug === slug);
const forArticle = id => guides.find(guide => guide.articleIds.includes(String(id)));
const sourceKind = kind => ({primary:'Primary source','credited-reporting':'Credited reporting',distribution:'Original distribution'})[kind] || 'Source document';
const sourceLink = (url, label) => M.url(url) ? `<a href="${esc(M.url(url))}" class="claim-source">${esc(label)} <span aria-hidden="true">↗</span></a>` : '';

function card(guide) {
  return `<article class="brief-card" data-story-guide-card data-guide-slug="${esc(guide.slug)}" data-guide-title="${esc(guide.title)}" data-guide-updated-at="${esc(guide.updatedAt)}" data-guide-version="${esc(guide.version)}">
    <div class="brief-card-top"><span class="eyebrow">${guide.articleIds.length} connected updates</span><span class="brief-memory-badge" data-reading-updated hidden></span></div>
    <h3><a href="${href(guide)}">${esc(guide.title)}</a></h3>
    <p>${esc(guide.intro)}</p>
    <div class="brief-card-bottom"><span>Sources through ${time(guide.updatedAt)}</span><a href="${href(guide)}" class="text-link">Read the briefing <span aria-hidden="true">→</span></a></div><p class="small brief-memory-status" data-reading-status></p>
  </article>`;
}

function feature() {
  return `<section class="brief-feature" aria-labelledby="brief-feature-heading">
    <div class="section-heading"><h2 id="brief-feature-heading">The story so far</h2><a href="/story-so-far/">All briefings →</a></div>
    <p class="section-note">Connected coverage. Evidence beside the claims. A clear account of what changed.</p>
    <div class="brief-grid">${guides.map(card).join('')}</div>
  </section>`;
}

function articleContext(id) {
  const guide = forArticle(id);
  if (!guide) return '';
  return `<aside class="story-context" aria-label="Follow-up context">
    <div class="eyebrow">Read this with the follow-up</div>
    <p>${esc(guide.intro)}</p>
    <a href="${href(guide)}" class="text-link">Read the story so far →</a>
    <span class="small">Sources through ${time(guide.updatedAt)}</span>
  </aside>`;
}

function leadLink(id) {
  const guide = forArticle(id);
  return guide ? `<a class="lead-brief-link" href="${href(guide)}"><span>The story so far</span> Evidence, context &amp; follow-up <span aria-hidden="true">→</span></a>` : '';
}

function indexContent() {
  return `<header class="page-heading brief-index-heading"><div class="eyebrow">The story so far</div>
    <h1>Catch up. See the evidence.</h1>
    <p>What happened, what changed, and what the sources have yet to establish.</p>
  </header>
  <p class="brief-index-note">Each briefing connects selected Noteworthy updates with dated source documents. These are snapshots of the evidence through the date shown.</p>
  <div data-story-guide-index><div class="brief-grid brief-index-grid">${guides.map(card).join('')}</div>
  <section class="brief-reading-note"><h2>Pick up where you left off.</h2><p>You can choose to remember a briefing on this device. On your next visit, we’ll show whether a newer version has been added. Nothing is saved until you choose to remember it.</p><p class="small" data-reading-index-status></p><button class="button" data-reading-action="clear" hidden>Clear all remembered briefings</button><p class="small" data-reading-message role="status" aria-live="polite"></p><p class="small">Device only. No account, email alerts or automatic monitoring. <a href="/privacy.html#story-briefing-memory">How this is stored</a></p></section></div>
  <section class="brief-method"><h2>How to read a briefing</h2><div class="brief-method-grid"><p><strong>Start with the change.</strong> See how a later source document advances or resolves the earlier coverage.</p><p><strong>Check each claim.</strong> Links beside the text take you to the supporting agency, public document or credited reporting.</p><p><strong>Keep the dates in view.</strong> A briefing’s source date and an original article’s publication time describe different things.</p></div></section>`;
}

function detailContent(guide, rawPosts) {
  const posts = M.prepare(rawPosts);
  const timeline = guide.timeline.map(item => ({...item, post:posts.find(p => p.id === item.articleId)})).filter(item => item.post).sort((a,b) => Date.parse(a.post.published) - Date.parse(b.post.published));
  const supporting = guide.sources.filter(source => source.kind !== 'distribution');
  const distribution = guide.sources.filter(source => source.kind === 'distribution');
  const correction = `mailto:richard@noteworthynews.co?subject=${encodeURIComponent('Correction request: '+guide.title)}&body=${encodeURIComponent('Briefing: https://noteworthynews.co'+href(guide)+'\n\nWhat needs correcting:\n\nSupporting source:')}`;
  return `<div class="article-breadcrumb"><a href="/story-so-far/">The story so far</a> / Source briefing</div>
  <article class="brief-detail" data-story-guide data-guide-slug="${esc(guide.slug)}" data-guide-updated-at="${esc(guide.updatedAt)}" data-guide-version="${esc(guide.version)}" data-guide-title="${esc(guide.title)}">
    <header class="brief-heading"><div class="eyebrow">Connected coverage / Source briefing</div><h1>${esc(guide.title)}</h1><p class="brief-deck">${esc(guide.intro)}</p>
      <div class="brief-edition">Sources through ${time(guide.updatedAt)} <span>Compiled by Noteworthy News from the documents below</span><span class="brief-memory-badge" data-reading-updated hidden></span></div>
      <nav class="brief-jump-links" aria-label="In this briefing"><a href="#what-changed">What changed</a><a href="#what-we-know">What we know</a><a href="#unknowns">Still unknown</a><a href="#coverage-timeline">Our coverage</a><a href="#source-documents">Sources</a></nav>
    </header>
    <section class="brief-change" id="what-changed" aria-labelledby="change-heading"><div class="eyebrow">What changed</div><h2 id="change-heading">${esc(guide.change?.title || 'The latest source context')}</h2><p>${esc(guide.change?.text || guide.intro)}</p>${guide.change ? sourceLink(guide.change.sourceUrl,guide.change.label) : ''}</section>
    <div class="brief-evidence-grid"><section class="brief-known" id="what-we-know" aria-labelledby="known-heading"><div class="section-heading"><h2 id="known-heading">What the sources establish</h2><span>${supporting.length} source documents</span></div><ol>${guide.known.map((claim,index) => `<li><span class="claim-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><div><p>${esc(claim.text)}</p>${sourceLink(claim.sourceUrl,claim.label)}</div></li>`).join('')}</ol></section>
    <aside class="brief-unknown" id="unknowns"><div class="eyebrow">The limits of this account</div><h2>What remains unknown</h2><ul>${guide.unknown.map(claim => `<li>${esc(claim.text)}</li>`).join('')}</ul><p class="small">An unanswered question is not evidence for a particular explanation.</p></aside></div>
    <section class="brief-timeline" id="coverage-timeline"><div class="section-heading"><h2>How our coverage developed</h2><span>Oldest first</span></div><p class="small">These are Noteworthy publication times, not the times the events occurred. Earlier updates may have been superseded by the source account above.</p><ol>${timeline.map(item => `<li><div class="timeline-time">${time(item.post.published)}</div><div><span class="eyebrow">${esc(item.label)}</span><h3><a href="${esc(item.post.href)}">${esc(item.post.title)}</a></h3><a class="text-link" href="${esc(item.post.href)}">Read the original update →</a></div></li>`).join('')}</ol></section>
    <section class="brief-sources" id="source-documents"><div class="section-heading"><h2>The source documents</h2></div><p class="small">${esc(guide.sourcingNote)}</p><ol>${supporting.map(source => `<li><div><span class="source-kind">${sourceKind(source.kind)}</span> ${time(source.updatedAt || source.publishedAt)}</div>${sourceLink(source.url,source.label)}</li>`).join('')}</ol>${distribution.length?`<details><summary>Original distribution posts (${distribution.length})</summary><p class="small">These are Noteworthy’s own posts; they are not independent corroboration.</p><ul>${distribution.map(source=>`<li>${sourceLink(source.url,source.label)}</li>`).join('')}</ul></details>`:''}</section>
    <section class="brief-reading-note"><h2>Pick up where you left off.</h2><p>Choose to remember this source version so you can tell what has changed when you return.</p><p data-reading-status class="small"></p><div class="brief-memory-actions"><button class="button button-blue" data-reading-action="remember" hidden>Remember this briefing on this device</button><button class="button button-blue" data-reading-action="acknowledge" hidden>Mark this version as read</button><button class="button" data-reading-action="forget" hidden>Forget this briefing</button></div><p data-reading-message role="status" aria-live="polite" class="small"></p><noscript><p>Remembering a briefing on this device requires JavaScript. All coverage and sources are available above.</p></noscript><p class="small">Nothing is saved until you choose to remember it. Device only. No account, email alerts or automatic monitoring. <a href="/privacy.html#story-briefing-memory">How this is stored</a></p></section>
    <div class="brief-end"><div><h2>Help complete the picture.</h2><p>Have a correction or a source that changes this account?</p><a href="${esc(correction)}" class="text-link">Send a correction with evidence →</a></div><a class="button" href="/story-so-far/">Browse all briefings →</a></div>
  </article>`;
}

module.exports = {guides,href,date,bySlug,forArticle,feature,articleContext,leadLink,indexContent,detailContent};
