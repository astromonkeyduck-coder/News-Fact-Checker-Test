'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../../netlify/functions/lib/publicationAiGrounding');

test('withheld FDA imports are projected and excluded without changing stored records', () => {
  const input = { id: 'fda-page-fixture', source: 'FDA', title: 'An incorrectly imported recall', source_url: 'https://www.fda.gov/food/foodborne-pathogens/cyclospora-research-action-plan' };
  const original = JSON.stringify(input);
  assert.equal(g.projectArticle(input), null);
  assert.equal(JSON.stringify(input), original);
});
test('all supported private workflow state fields are excluded, including mixed case', () => {
  for (const state of ['draft', 'review', 'suppressed', 'unpublished', 'DRAFT']) {
    for (const key of ['state', 'editorial_state', 'editorial_status', 'publish_state']) {
      assert.equal(g.projectArticle({ id: 'fixture', title: 'Fixture', [key]: state }), null);
    }
  }
  assert.equal(g.projectArticle({ id: 'fixture', title: 'Fixture', review_required: true }), null);
  assert.equal(g.projectArticle({ id: 'fixture', title: 'Fixture', import: { ambiguous: true } }), null);
});
test('agency summary attribution stays distinct from claim status and lifecycle', () => {
  const input = { id: 'usgs-fixture', source: 'USGS', title: 'M 3.1 earthquake fixture', text: 'Agency event description.', lifecycle: 'updating', claimStatus: 'attributed', source_url: 'https://earthquake.usgs.gov/earthquakes/eventpage/fixture' };
  const result = g.articleDetails(g.projectArticle(input), 'https://noteworthynews.co');
  assert.equal(result.label, 'Automated agency summary · USGS');
  assert.equal(result.claimStatus, 'attributed');
  assert.equal(result.lifecycle, 'updating');
  assert.match(result.limitation, /do not imply independent human/);
  assert.ok(!result.sourceText.includes('human-verified'));
  assert.equal(result.references[0].url, input.source_url);
});
test('ordinary updates do not acquire a verified label and distribution links remain distinct', () => {
  const result = g.articleDetails({ id: 'fixture', title: 'Complete supported title', text: 'Short update.', source_url: 'https://x.com/newsnoteworthy/status/123' }, 'https://noteworthynews.co');
  assert.equal(result.label, 'News update');
  assert.equal(result.claimStatus, 'Not independently verified by this assistant');
  assert.equal(result.references[0].label, 'Distribution link · not underlying evidence');
});
test('source chips require exact cited registry links, not URL substrings or uncited results', () => {
  const a = { url: 'https://example.com/report', title: 'Report' };
  const b = { url: 'https://example.com/other', title: 'Other' };
  assert.deepEqual(g.citedSources('Here are facts without citations.', [a, b]), []);
  assert.deepEqual(g.citedSources('[Wrong page](https://example.com/report-extra)', [a]), []);
  assert.deepEqual(g.citedSources('[Wrong query](https://example.com/report?fake=true)', [a]), []);
  assert.deepEqual(g.citedSources('[Made up](https://fabricated.example/doc)', [a]), []);
  assert.deepEqual(g.citedSources('[Report](https://example.com/report)', [a, b]), [a]);
  assert.deepEqual(g.citedSources('[Report](https://example.com/report) and <https://example.com/report>', [a, a]), [a]);
});
test('citation parsing retains balanced parentheses in real source URLs', () => {
  const source = { url: 'https://example.com/report_(update)', title: 'Update' };
  assert.deepEqual(g.citedSources('[Update](https://example.com/report_(update))', [source]), [source]);
});
test('news with no publication or search material receives an explicit no-support state', () => {
  assert.equal(g.newsNeedsUnavailableFallback({ question: 'What happened in Miami today?' }), true);
  assert.equal(g.newsNeedsUnavailableFallback({ question: 'Summarize this article.', pageContext: { articleId: 'missing' } }), true);
  assert.equal(g.newsNeedsUnavailableFallback({ question: 'A question', searchQuery: 'a news query' }), true);
  assert.match(g.NO_SUPPORT_REPLY, /cannot verify/);
  assert.equal(g.newsNeedsUnavailableFallback({ question: 'Latest news?', webSources: [{ url: 'https://example.com' }] }), false);
  assert.equal(g.newsNeedsUnavailableFallback({ question: 'Latest news?', groundingSources: [{ url: 'https://example.com' }] }), false);
});
test('no-support news fallback preserves non-news and existing image/file/email tools', () => {
  assert.equal(g.newsNeedsUnavailableFallback({ question: 'What is 2 plus 2?' }), false);
  for (const special of [{ hasAttachments: true }, { hasGeneratedImage: true }, { emailConfirmation: {} }, { isSpotlightRequest: true }]) {
    assert.equal(g.newsNeedsUnavailableFallback({ question: 'Latest news?', ...special }), false);
  }
});
