(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./contentNormalize') : root.ContentNormalize);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.PublicationSourceQuality = api;
})(typeof window === 'object' ? window : {}, function (cn) {
'use strict';
const cleanHeadline = cn.cleanHeadline;
const NON_FOOD_PRODUCT_RE = /\b(epinephrine|injection|injectable|prescription|medical device|catheter|vaccine|sildenafil|tadalafil|dietary supplements?|canine milk|pet food|dog food|cat food)\b/i;
const INFORMATIONAL_PAGE_RE = /\/(foodborne-pathogens|science-research|research|guidance-regulation)\/|(?:action-plan|research-action|prevention-plan)(?:$|[?#])/i;

// Development source correction; timestamp is the actual review, never the build date.
const SOURCE_CORRECTIONS = [{
  articleId: 'fda-page-cea1b405db7be04c',
  title: 'Whole Foods Market recalls cheese over undeclared egg',
  url: '/article.html?id=fda-page-cea1b405db7be04c',
  at: '2026-09-13T15:03:09Z',
  note: 'The generic imported action incorrectly suggested physically returning the cheese. The FDA-hosted company announcement instructs customers to destroy the product and offers a refund with a valid receipt.',
  before: 'Return for a refund',
  after: 'Destroy the affected product; a full refund is available with a valid receipt from the place of purchase.'
}];

/** Read-time safety projection for legacy imports. Does not mutate stored records. */
function reviewReason(post) {
  if (!post || String(post.source || '').toUpperCase() !== 'FDA') return null;
  const source = post.source_url || post.sourceUrl || post.link || post.url || '';
  if (INFORMATIONAL_PAGE_RE.test(source)) return 'source_is_information_or_research';
  const product = post.food_safety_summary && post.food_safety_summary.product;
  if (NON_FOOD_PRODUCT_RE.test([post.title, product].filter(Boolean).join(' '))) return 'non_food_product_classified_as_food';
  if (/youtube|webinar|metodolog[ií]a|investigaci[oó]n/i.test(product || '')) return 'product_field_contains_reference_title';
  return null;
}

function publicationPost(post) {
  if (!post || typeof post !== 'object') return post;
  const reason = reviewReason(post);
  if (!reason) {
    const out = { ...post, title: cleanHeadline(post) };
    if (String(post.source).toUpperCase() === 'FDA' && post.food_safety_summary?.illnesses === 0) {
      for (const field of ['story', 'text']) if (typeof out[field] === 'string') out[field] = out[field].replace(/FDA reports 0 illnesses\./g, 'No illnesses had been reported in the source announcement.');
    }
    if (String(post.id) === 'fda-page-cea1b405db7be04c') {
      out.food_safety_summary = { ...post.food_safety_summary, public_action: 'Destroy the affected product' };
      for (const field of ['summary', 'dek']) if (typeof out[field] === 'string') out[field] = out[field].replace(/Return for a refund/g, 'Destroy the affected product');
      for (const field of ['story', 'text']) if (typeof out[field] === 'string') {
        out[field] = out[field].replace(/What to do: Return for a refund\.\s*/g, 'What to do: Destroy the affected product. ');
        if (!out[field].includes('valid receipt')) out[field] += '\n\nThe company says a full refund is available with a valid receipt from the place of purchase.';
      }
      out.corrections = [...(post.corrections || []), SOURCE_CORRECTIONS[0]].filter((item, index, list) => list.findIndex(other => other.at === item.at) === index);
    }
    // The original FDA page supplies the complete headline where even the
    // upstream product summary was cut off. Verified September 12, 2026.
    if (String(post.id) === 'fda-page-d51a22246d293688' && String(post.source_url || '').includes('/clover-hill-dairy-expands-recall-include-all-clover-hill-dairy-brand-cheese-due-possible-health-risk')) {
      out.title = 'Clover Hill Dairy Expands Recall to Include All Clover Hill Dairy Brand Cheese Due to Possible Health Risk';
    }
    if (String(post.id) === '2096717577204502980') {
      out.source_references = [...(post.source_references || []), {
        url: 'https://www.local10.com/news/local/2026/09/06/cargo-plane-crashes-after-going-off-miami-international-airport-runway/',
        label: 'WPLG Local 10 — reporting from the sheriff’s news conference',
        role: 'credited_upstream_reporting',
        claim: 'Supports the attributed death and injury report in this update. Source reviewed September 12, 2026.'
      }].filter((item, index, list) => list.findIndex(other => other.url === item.url) === index);
      out.claim_status = 'Attributed to the sheriff’s office';
    }
    return out;
  }
  const isResearch = reason === 'source_is_information_or_research';
  const message = isResearch
    ? 'The linked FDA document is an information or research page. The previous automated import incorrectly presented it as a current food safety alert. That claim has been withheld pending editorial review. Read the original FDA document below.'
    : 'This automated import has conflicting product or source information. Its previous food safety claims have been withheld pending editorial review. Consult the original FDA announcement below.';
  // A stable public notice preserves inbound links without repeating the bad claim.
  return {
    id: post.id, postId: post.postId, slug: post.slug,
    title: isResearch ? 'FDA source document: editorial review notice' : 'FDA import: editorial review notice',
    story: message, text: message, summary: message,
    source: 'FDA', category: 'Editorial notice', content_type: 'Editorial notice',
    editorial_state: 'review', editorial_status: 'review', review_required: true, review_notice: message, review_reason: reason,
    datePosted: post.datePosted, createdAt: post.createdAt, created_at: post.created_at,
    updated_at: post.updated_at,
    source_url: post.source_url || post.link || post.url,
    source_urls: [{ url: post.source_url || post.link || post.url, display: 'Original FDA source document' }],
    link: post.link, url: post.url,
  };
}

function isListedPost(post) {
  return Boolean(post && !reviewReason(post) && !post.review_required && !['draft', 'review', 'suppressed'].includes(post.editorial_status || post.editorial_state || post.publish_state));
}

return { reviewReason, publicationPost, isListedPost, SOURCE_CORRECTIONS };
});
