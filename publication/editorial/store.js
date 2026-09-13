'use strict';

// Local editorial records only. This module deliberately has no network clients.
const crypto = require('node:crypto');
const STATES = ['draft', 'review', 'published', 'corrected'];
const FORMATS = ['reporting', 'analysis', 'opinion', 'wire-update', 'automated-agency-summary'];
const CLAIMS = ['confirmed', 'attributed', 'disputed', 'not-independently-verified'];
const LIFECYCLES = ['updating', 'paused', 'closed'];
const PUBLIC_FIELDS = ['id', 'title', 'summary', 'body', 'format', 'byline', 'sources', 'media', 'lifecycle', 'claimStatus', 'sourcePublishedAt', 'import', 'sourcingLimitation'];
const clone = value => JSON.parse(JSON.stringify(value));
const timestamp = value => {
  if (typeof value !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('Use an ISO timestamp with an explicit timezone.');
  return value;
};
const identity = actor => {
  if (!actor || typeof actor.name !== 'string' || !actor.name.trim() || !actor.role || actor.verified !== true) throw new Error('Provide an actual responsible person with name, role and verified: true; do not invent staff.');
  return clone(actor);
};
const content = record => Object.fromEntries(PUBLIC_FIELDS.filter(key => record[key] !== undefined).map(key => [key, record[key]]));
const hash = record => crypto.createHash('sha256').update(JSON.stringify({ content: content(record), pendingChange: record.pendingChange || null,
  publishedAt: record.publishedAt || null, updatedAt: record.updatedAt || null, corrections: record.corrections || [], updates: record.updates || [] })).digest('hex');
const isUrl = value => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } };

function validateRecord(record, { ready = false } = {}) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['Record must be an object.'];
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(record.id || '')) errors.push('Keep an existing safe article ID; slashes and traversal are not allowed.');
  if (!STATES.includes(record.state)) errors.push('Unknown workflow state.');
  if (!FORMATS.includes(record.format)) errors.push('Choose a supported content format.');
  if (!CLAIMS.includes(record.claimStatus)) errors.push('Choose claim status separately from coverage lifecycle.');
  if (!LIFECYCLES.includes(record.lifecycle)) errors.push('Choose a coverage lifecycle.');
  try { timestamp(record.createdAt); } catch { errors.push('createdAt requires a timestamp and timezone.'); }
  for (const key of ['publishedAt', 'updatedAt', 'sourcePublishedAt']) {
    if (record[key] != null) { try { timestamp(record[key]); } catch { errors.push(`${key} requires a timestamp and timezone.`); } }
  }
  if (record.publishedAt && record.updatedAt && Date.parse(record.updatedAt) < Date.parse(record.publishedAt)) errors.push('updatedAt cannot precede publishedAt.');
  if (!Array.isArray(record.sources)) errors.push('sources must be an array.');
  const sourceIds = new Set();
  for (const source of record.sources || []) {
    if (!source.id || sourceIds.has(source.id)) errors.push('Every source needs a unique ID.');
    sourceIds.add(source.id);
    if (!source.name || !isUrl(source.url)) errors.push('Every source needs a name and an HTTP(S) URL.');
    if (!['primary', 'upstream-reporting', 'distribution'].includes(source.kind)) errors.push('Source kind must distinguish evidence from original distribution.');
  }
  if (!Array.isArray(record.body)) errors.push('body must be an array of paragraphs with text and sourceIds.');
  for (const paragraph of record.body || []) {
    if (typeof paragraph.text !== 'string' || !paragraph.text.trim()) errors.push('Each body paragraph needs supported text.');
    if (!Array.isArray(paragraph.sourceIds) || paragraph.sourceIds.some(id => !sourceIds.has(id))) errors.push('Paragraph sourceIds must reference known sources.');
  }
  for (const media of record.media || []) {
    if (!isUrl(media.url) || !media.credit || !media.caption) errors.push('Media requires an HTTP(S) URL, caption and credit.');
  }
  if (ready) {
    if (!record.title || !record.title.trim()) errors.push('A complete supported headline is required.');
    if (/(?:…|\.{3})\s*$/.test(record.title || '')) errors.push('Recover the complete headline; do not publish a stored truncation.');
    if (!record.body?.length) errors.push('At least one supported paragraph is required; short updates are welcome.');
    const evidence = (record.sources || []).filter(source => source.kind !== 'distribution');
    if (!evidence.length && !record.sourcingLimitation) errors.push('Provide underlying evidence or explicitly describe the sourcing limitation.');
    if (!evidence.length && record.claimStatus === 'confirmed') errors.push('A distribution link alone does not support confirmed claim status.');
    if (record.format === 'automated-agency-summary') {
      if (!record.import?.agency || !evidence.some(source => source.kind === 'primary')) errors.push('Agency summaries need the agency name and primary documentation.');
      if (record.byline?.type === 'person') errors.push('Do not give an automated import a fabricated human author; editorial responsibility is recorded separately.');
      if (!['earthquake-event', 'food-recall', 'drug-recall', 'outbreak-notice', 'weather-alert'].includes(record.import?.pageType)) errors.push('Validate the source document type before calling it an agency alert.');
    }
    if (record.import?.ambiguous === true && !record.import.reviewDecision?.approved) errors.push('Ambiguous imports require an explicit source review decision.');
    if (record.byline?.type === 'person' && (!record.byline.name || !record.byline.biographyUrl)) errors.push('A known human byline needs a name and biography URL.');
  }
  return [...new Set(errors)];
}

function assertValid(record, ready = false) {
  const errors = validateRecord(record, { ready });
  if (errors.length) throw new Error(errors.join('\n'));
}

function event(record, action, actor, at, note) {
  record.history.push({ action, at: timestamp(at), actor: identity(actor), note });
}

function createDraft(input, actor, at = new Date().toISOString()) {
  const record = {
    ...content(input), format: input.format || 'wire-update', lifecycle: input.lifecycle || 'paused',
    claimStatus: input.claimStatus || 'not-independently-verified', sources: input.sources || [], body: input.body || [],
    state: 'draft', createdAt: timestamp(at), publishedAt: input.publishedAt ? timestamp(input.publishedAt) : null, updatedAt: input.updatedAt ? timestamp(input.updatedAt) : null,
    editorialResponsibility: identity(actor), history: [], corrections: [], updates: [],
  };
  event(record, 'created', actor, at, 'Local draft; no production record changed.');
  assertValid(record);
  return record;
}

function submitReview(input, actor, at = new Date().toISOString()) {
  const record = clone(input);
  if (record.state !== 'draft') throw new Error('Only a draft can be submitted for review.');
  // Ambiguity is intentionally permitted into review, never directly into publication.
  assertValid(record);
  record.state = 'review';
  record.review = null;
  record.preview = null;
  event(record, 'submitted-for-review', actor, at, 'Check source documents, claims, attribution and preview.');
  return record;
}

function markPreview(input, actor, at = new Date().toISOString()) {
  const record = clone(input);
  assertValid(record);
  record.preview = { contentHash: hash(record), at: timestamp(at) };
  event(record, 'previewed', actor, at, 'Local HTML generated; inspect layout and sources before approval.');
  return record;
}

function approveReview(input, actor, note, at = new Date().toISOString(), resolveAmbiguity = false) {
  const record = clone(input);
  if (record.state !== 'review') throw new Error('Submit the draft for review first.');
  if (!note?.trim()) throw new Error('Record what the editor checked.');
  if (resolveAmbiguity && record.import?.ambiguous) {
    record.import.reviewDecision = { approved: true, actor: identity(actor), at: timestamp(at), note };
    // This decision changes the previewed content; preview once more before publishing.
    record.preview = null;
  }
  assertValid(record, true);
  record.review = { contentHash: hash(record), actor: identity(actor), at: timestamp(at), note };
  event(record, 'review-approved', actor, at, note);
  return record;
}

function publishRecord(input, actor, at = new Date().toISOString()) {
  const record = clone(input);
  if (record.state !== 'review') throw new Error('Only a reviewed record can be published locally.');
  assertValid(record, true);
  if (record.preview?.contentHash !== hash(record)) throw new Error('Generate and inspect a current preview before publishing.');
  if (record.review?.contentHash !== hash(record)) throw new Error('Content changed after review; approve the current version.');
  timestamp(at);
  if (Date.parse(at) < Date.parse(record.updatedAt || record.publishedAt || record.createdAt)) throw new Error('Publication timestamps cannot move backwards.');
  record.editorialResponsibility = identity(actor);
  const change = record.pendingChange;
  if (change) {
    const entry = { ...change, at, actor: identity(actor), reviewer: record.review.actor };
    if (change.type === 'correction') record.corrections.push(entry);
    else record.updates.push(entry);
    record.updatedAt = at;
  }
  if (!record.publishedAt) record.publishedAt = at;
  record.state = record.corrections.length ? 'corrected' : 'published';
  delete record.pendingChange;
  delete record.publishedVersion;
  record.publication = { contentHash: hash(record), at };
  event(record, change?.type === 'correction' ? 'correction-published' : 'published', actor, at, change?.note || 'Published to local export only.');
  return record;
}

function reviseRecord(input, patch, actor, change, at = new Date().toISOString()) {
  if (!['published', 'corrected'].includes(input.state)) throw new Error('Only a published record can start a revision.');
  if (!['update', 'correction'].includes(change?.type) || !change.note?.trim()) throw new Error('Choose update or correction and explain the change.');
  if (change.type === 'correction' && (!change.before?.trim() || !change.after?.trim())) throw new Error('A substantive correction needs the original error and corrected information.');
  const record = { ...clone(input), ...content({ ...input, ...patch }) };
  if (record.id !== input.id) throw new Error('Preserve the original article ID and inbound URL.');
  if (hash(record) === hash(input)) throw new Error('No content change: do not refresh publication dates.');
  record.publishedVersion = clone(input);
  record.state = 'draft';
  record.review = null;
  record.preview = null;
  record.pendingChange = clone(change);
  event(record, 'revision-started', actor, at, change.note);
  assertValid(record);
  return record;
}

function exportPublished(records) {
  const articles = [];
  const ids = new Set();
  for (const entry of records) {
    const record = ['published', 'corrected'].includes(entry.state) ? entry : entry.publishedVersion;
    if (!record) continue;
    assertValid(record, true);
    if (record.publication?.contentHash !== hash(record)) throw new Error(`Published content or correction history changed outside review: ${record.id}. Start a reviewed revision.`);
    if (ids.has(record.id)) throw new Error(`Duplicate article ID: ${record.id}`);
    ids.add(record.id);
    const publicContent = content(record);
    if (publicContent.import) {
      const { reviewDecision, reasons, ...sourceImport } = publicContent.import;
      publicContent.import = sourceImport;
    }
    articles.push({ ...publicContent, state: record.state, publishedAt: record.publishedAt, updatedAt: record.updatedAt,
      editorialResponsibility: { name: record.editorialResponsibility.name, role: record.editorialResponsibility.role },
      corrections: record.corrections.map(({ actor, reviewer, ...correction }) => ({ ...correction, responsibility: actor.name })),
      updates: record.updates.map(({ actor, reviewer, ...update }) => ({ ...update, responsibility: actor.name })),
    });
  }
  return { version: 1, articles, corrections: articles.flatMap(article => article.corrections.map(correction => ({ articleId: article.id, title: article.title, url: `/article.html?id=${encodeURIComponent(article.id)}`, ...correction }))) };
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function previewRecord(record) {
  const e = escapeHtml;
  const errors = validateRecord(record, { ready: true });
  const sources = record.sources || [];
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Preview — ${e(record.title)}</title><style>body{margin:0;background:#faf9f6;color:#182536;font:19px/1.65 Georgia,serif}main{max-width:72ch;margin:auto;padding:24px}aside,small,nav{font:15px/1.5 system-ui}h1{font-size:clamp(32px,5vw,50px);line-height:1.1}a{color:#075aa4}aside{padding:16px;border:1px solid #abc;background:#edf3fa}li{margin:8px 0}img{max-width:100%}footer{border-top:1px solid #abc;margin-top:30px}</style><main><aside><strong>LOCAL EDITORIAL PREVIEW · ${e(record.state)}</strong><br>This draft is not a live publication. ${errors.length ? `<ul>${errors.map(error => `<li>${e(error)}</li>`).join('')}</ul>` : 'Validation passed. Check claims against the linked documents.'}</aside><p><small>${e(record.format)} · Coverage ${e(record.lifecycle)} · Claims ${e(record.claimStatus)}</small></p><h1>${e(record.title)}</h1>${record.summary ? `<p>${e(record.summary)}</p>` : ''}<p><small>${e(record.byline?.name || (record.format === 'automated-agency-summary' ? record.import?.agency : 'Byline not supplied'))}<br>Original publication: ${e(record.publishedAt || 'Not published')}<br>Editorial responsibility: ${e(record.editorialResponsibility?.name)}</small></p>${(record.body || []).map(paragraph => `<p>${e(paragraph.text)} ${(paragraph.sourceIds || []).map(id => { const source = sources.find(source => source.id === id); return source ? `<a href="${e(isUrl(source.url) ? source.url : '#')}" rel="noreferrer">[${e(source.name)}]</a>` : ''; }).join(' ')}</p>`).join('')}${record.sourcingLimitation ? `<aside><strong>Sourcing limitation:</strong> ${e(record.sourcingLimitation)}</aside>` : ''}${record.pendingChange ? `<aside><strong>Pending ${e(record.pendingChange.type)}</strong><p>${e(record.pendingChange.note)}</p>${record.pendingChange.type === 'correction' ? `<p>Previously: ${e(record.pendingChange.before)}<br>Corrected: ${e(record.pendingChange.after)}</p>` : ''}</aside>` : ''}<h2>Sources</h2><ul>${sources.map(source => `<li><a href="${e(isUrl(source.url) ? source.url : '#')}" rel="noreferrer">${e(source.name)}</a> — ${e(source.kind)}</li>`).join('')}</ul>${(record.corrections || []).map(correction => `<aside><strong>Correction · ${e(correction.at)}</strong><p>${e(correction.note)}</p><p>Previously: ${e(correction.before)}<br>Corrected: ${e(correction.after)}</p></aside>`).join('')}<footer><p><a href="mailto:richard@noteworthynews.co?subject=${encodeURIComponent('Correction request')}&amp;body=${encodeURIComponent(`Article: https://noteworthynews.co/article.html?id=${record.id}\n\nClaim and evidence: `)}">Request a correction</a></p></footer></main></html>`;
}

module.exports = { validateRecord, createDraft, submitReview, markPreview, approveReview, publishRecord, reviseRecord, exportPublished, previewRecord, contentHash: hash };
