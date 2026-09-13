'use strict';

const quality = require('./publicationQuality');
const HIDDEN_STATES = new Set(['draft', 'review', 'suppressed', 'unpublished']);
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const httpUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; } };

function isPublicRecord(record) {
  return Boolean(record && !record.review_required && !record.requires_review && !(record.import?.ambiguous && !record.import?.reviewDecision?.approved) &&
    !['state', 'editorial_state', 'editorial_status', 'publish_state'].some(key => HIDDEN_STATES.has(clean(record[key]).toLowerCase())));
}

function projectArticle(input) {
  const record = quality.publicationPost(input);
  return quality.isListedPost(record) && isPublicRecord(record) ? record : null;
}

function articleDetails(record, siteBase) {
  const agency = clean(record.source || record.import?.agency).toUpperCase();
  const format = clean(record.format || record.content_type);
  const automated = /automated|agency.summary/i.test(format) || ['FDA', 'USGS', 'NWS', 'NOAA'].includes(agency);
  const label = automated ? `Automated agency summary${agency ? ` · ${agency}` : ''}` : (format || 'News update');
  const title = clean(record.title || record.story || record.text || 'Article');
  const url = `${siteBase}/article.html?id=${encodeURIComponent(record.id || record.postId || '')}`;
  const body = Array.isArray(record.body) ? record.body.map(paragraph => paragraph.text || '').join('\n\n') : record.body;
  const text = String(body || record.story || record.text || record.summary || '').substring(0, 1800);
  const claimStatus = clean(record.claimStatus || record.claim_status) || 'Not independently verified by this assistant';
  const lifecycle = clean(record.lifecycle || record.coverage_lifecycle) || 'Not supplied';
  const references = [];
  const seen = new Set();
  const add = item => {
    const sourceUrl = httpUrl(item.url);
    if (!sourceUrl || seen.has(sourceUrl)) return;
    seen.add(sourceUrl);
    const distribution = /distribution/i.test(item.kind || item.role || '') || /^https:\/\/(?:www\.)?(?:x|twitter)\.com\/(?:newsnoteworthy|noteworthynews)\//i.test(sourceUrl);
    references.push({ title: clean(item.name || item.label || item.display) || (distribution ? 'Original distribution post' : 'Linked source document'), url: sourceUrl,
      type: 'source', label: distribution ? 'Distribution link · not underlying evidence' : 'Linked source', claim: clean(item.claim) });
  };
  [record.sources, record.source_references, record.source_urls].flatMap(items => Array.isArray(items) ? items : []).filter(item => item && typeof item === 'object').forEach(add);
  const primaryUrl = record.source_url || record.sourceUrl;
  if (primaryUrl) add({ url: primaryUrl, name: agency ? `${agency} source` : 'Original source' });
  const sourceText = references.map(source => `  - [${source.title}](${source.url}) — ${source.label}${source.claim ? `; supports: ${source.claim}` : ''}`).join('\n');
  const limitation = clean(record.sourcingLimitation || record.sourcing_limitation) ||
    (automated ? 'Automated source summary; do not imply independent human reporting or review.' : 'Use only the claims and attribution supplied; the publication link alone does not establish independent verification.');
  return { title, url, text, label, claimStatus, lifecycle, references, sourceText, limitation };
}

// Only explicit Markdown/autolink citations count. This verifies a URL's
// presence in the offered registry, not whether its contents entail a claim.
function citedSources(reply, registry, limit = 6) {
  const cited = new Set();
  const text = String(reply || '');
  for (const match of text.matchAll(/\]\(\s*(<?https?:\/\/)/g)) {
    const start = match.index + match[0].length - match[1].length;
    let value = ''; let depth = 0; let cursor = start;
    const angled = text[cursor] === '<';
    if (angled) cursor++;
    for (; cursor < text.length; cursor++) {
      const char = text[cursor];
      if ((angled && char === '>') || (!angled && (/\s/.test(char) || (char === ')' && depth === 0)))) break;
      if (!angled && char === '(') depth++;
      if (!angled && char === ')') depth--;
      value += char;
    }
    if (httpUrl(value)) cited.add(value);
  }
  for (const match of text.matchAll(/<(https?:\/\/[^<>\s]+)>/g)) cited.add(match[1]);
  const seen = new Set();
  return registry.filter(source => source && httpUrl(source.url) && cited.has(source.url) && !seen.has(source.url) && seen.add(source.url)).slice(0, limit);
}

function newsNeedsUnavailableFallback({ question, pageContext, groundingSources = [], webSources = [], searchQuery, isSpotlightRequest, hasAttachments, hasGeneratedImage, emailConfirmation }) {
  if (isSpotlightRequest || hasAttachments || hasGeneratedImage || emailConfirmation) return false;
  const newsQuestion = /\b(news|latest|today|breaking|headline|earthquake|recall|outbreak|election|war|crash|reported|reporting|happened|current events|fact.check)\b/i.test(String(question || '')) ||
    (pageContext?.articleId && /\b(this|article|story|summari[sz]e|explain|source|confirm|verify)\b/i.test(String(question || '')));
  return Boolean((newsQuestion || searchQuery) && groundingSources.length === 0 && webSources.length === 0);
}
const NO_SUPPORT_REPLY = 'I do not have supporting Noteworthy coverage or usable search sources for that news question in this request, so I cannot verify the details. Please open the original agency notice or a credited report, or try again when sources are available. This is an AI-generated response, not edited reporting.';

module.exports = { isPublicRecord, projectArticle, articleDetails, citedSources, newsNeedsUnavailableFallback, NO_SUPPORT_REPLY };
