/**
 * Food-safety processing pipeline: claim → fetch canonical → parse →
 * correlate → build → version → media → persist → publish.
 *
 * Shared by process-food-safety-background.js and the manual replay tools.
 */

const { config } = require('./config');
const { scopeFilter } = require('./classify');
const { fetchCanonicalPage, parseCanonicalPage } = require('./providers/fda/canonicalPage');
const { canonicalizeFdaUrl } = require('./providers/fda/rss');
const { buildEventCandidate } = require('./buildEvent');
const { validateEventCandidate, decidePublishState } = require('./validate');
const { correlateDocument, findRelatedOfficialUrls, canonicalKeyForCore } = require('./correlate');
const { diffEvents, isNotStale } = require('./versioning');
const { rankImageCandidates, buildEventImages } = require('./media');
const {
  updateSourceDocument, markDocumentFailed,
  getEventByCanonicalKey, insertEvent, updateEvent,
  upsertProducts, getProducts, insertVersion,
} = require('./store');
const { publishPost, upsertVerifiedEvent } = require('./publish');

/**
 * Process one claimed source document end to end.
 * Returns a structured outcome for observability.
 */
async function processSourceDocument(docRow, { logger = console, fetchPage = fetchCanonicalPage, skipMedia = false } = {}) {
  const outcome = {
    docId: docRow.id,
    sourceKind: docRow.source_kind,
    status: null,
    eventId: null,
    publishState: null,
    error: null,
  };

  try {
    // ---------------------------------------------------------------------
    // 1. Resolve the canonical URL to fetch
    // ---------------------------------------------------------------------
    const payload = docRow.parsed_payload || {};
    const canonicalUrl = canonicalizeFdaUrl(docRow.canonical_url || payload.canonicalUrl || payload.advisoryUrl);
    const coreRow = docRow.source_kind === 'fda_core' ? payload : null;

    if (!canonicalUrl && docRow.source_kind !== 'fda_core') {
      await markDocumentFailed(docRow, 'no_canonical_fda_url', { permanent: true });
      outcome.status = 'failed_permanent';
      return outcome;
    }

    // ---------------------------------------------------------------------
    // 2. Scope filter using discovery metadata (cheap reject before fetch)
    // ---------------------------------------------------------------------
    const preScope = scopeFilter({
      title: payload.title || '',
      description: payload.description || payload.excerpt || '',
      productType: payload.productType || '',
    });
    // Filtered safety-net feeds must pass the scope filter at discovery
    // metadata level; primary feeds get a second chance from the page itself.
    const isFilteredFeed = payload.filtered === true;
    if (!preScope.include && isFilteredFeed) {
      await updateSourceDocument(docRow.id, {
        processing_status: 'skipped',
        last_error: preScope.reason,
        locked_at: null,
        locked_by: null,
      });
      outcome.status = `skipped:${preScope.reason}`;
      return outcome;
    }

    // ---------------------------------------------------------------------
    // 3. Fetch + parse the canonical page (CORE rows may not have one yet)
    // ---------------------------------------------------------------------
    let parse = null;
    let pageHtml = null;
    if (canonicalUrl) {
      const page = await fetchPage(canonicalUrl);
      pageHtml = page.html;
      parse = parseCanonicalPage(page.html, page.canonicalUrl);
    } else if (coreRow) {
      // CORE-only row without advisory: build a minimal parse result
      parse = {
        parserVersion: 'fda-core-row-1.0.0',
        layout: 'core_row',
        canonicalUrl: null,
        title: coreRow.pathogen
          ? `FDA investigation: ${coreRow.pathogen} (ref #${coreRow.referenceNumber})`
          : `FDA outbreak investigation ref #${coreRow.referenceNumber}`,
        fdaPublishDate: coreRow.datePosted ? `${coreRow.datePosted}T00:00:00.000Z` : null,
        sourceUpdatedAt: coreRow.datePosted ? `${coreRow.datePosted}T00:00:00.000Z` : null,
        companyAnnouncementDate: null,
        company: null,
        brands: [],
        productType: null,
        recallReason: null,
        productDescription: coreRow.productLinked || null,
        announcementText: null,
        recommendations: [],
        publicActionText: null,
        products: [],
        images: [],
        metrics: {
          illnesses: typeof coreRow.totalCaseCount === 'number' ? coreRow.totalCaseCount : null,
          hospitalizations: null,
          deaths: null,
          husCases: null,
          qualifiers: {},
          evidence: { illnesses: coreRow.caseCountText || null },
        },
        caseStates: [],
        distributionStates: [],
        distributionText: null,
        nationwide: false,
        distributionConfident: false,
        retailers: [],
        status: /ended|closed/i.test(coreRow.investigationStatus || '') ? 'ended' : 'ongoing',
        bodyHash: coreRow.rowHash || null,
        warnings: [],
      };
    }

    // ---------------------------------------------------------------------
    // 4. Post-fetch scope filter (full facts now available)
    // ---------------------------------------------------------------------
    const fullScope = scopeFilter({
      title: parse.title || '',
      description: [parse.recallReason, parse.productDescription, (parse.announcementText || '').slice(0, 1500)]
        .filter(Boolean).join('\n'),
      productType: parse.productType || '',
    });
    if (!fullScope.include) {
      await updateSourceDocument(docRow.id, {
        processing_status: 'skipped',
        last_error: fullScope.reason,
        fetched_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
      });
      outcome.status = `skipped:${fullScope.reason}`;
      return outcome;
    }

    // ---------------------------------------------------------------------
    // 5. Correlate to a canonical event
    // ---------------------------------------------------------------------
    const referenceNumber = coreRow ? coreRow.referenceNumber : (payload.referenceNumber || null);
    const correlation = await correlateDocument({
      sourceKind: docRow.source_kind,
      canonicalUrl,
      referenceNumber,
      recallNumbers: docRow.recall_numbers || null,
    });

    if (!correlation.canonicalKey) {
      await markDocumentFailed(docRow, correlation.reviewReason || 'no_canonical_identity', { permanent: true });
      outcome.status = 'failed_no_identity';
      return outcome;
    }

    // ---------------------------------------------------------------------
    // 6. Build normalized candidate
    // ---------------------------------------------------------------------
    const relatedUrls = pageHtml ? findRelatedOfficialUrls(parse, pageHtml) : [];
    const { event: candidate, products, warnings, evidence } = buildEventCandidate(parse, {
      sourceKind: docRow.source_kind,
      coreRow,
      canonicalKey: correlation.canonicalKey,
      referenceNumber,
      relatedUrls,
    });

    // ---------------------------------------------------------------------
    // 7. Validate
    // ---------------------------------------------------------------------
    const validation = validateEventCandidate(candidate, { products, parseWarnings: warnings });
    if (!validation.valid) {
      await markDocumentFailed(docRow, `validation_errors: ${validation.errors.join(', ')}`, { permanent: true });
      outcome.status = 'failed_validation';
      outcome.error = validation.errors.join(', ');
      return outcome;
    }
    const reviewReasons = [...validation.reviewReasons];
    if (correlation.needsReview && correlation.reviewReason) reviewReasons.push(correlation.reviewReason);

    // ---------------------------------------------------------------------
    // 8. Version + persist event
    // ---------------------------------------------------------------------
    const existing = correlation.event || await getEventByCanonicalKey(correlation.canonicalKey);

    if (existing && !isNotStale(existing, candidate)) {
      // Stale document: never overwrite newer official data
      await updateSourceDocument(docRow.id, {
        processing_status: 'skipped',
        last_error: 'stale_source_older_than_stored_event',
        event_id: existing.id,
        locked_at: null,
        locked_by: null,
      });
      outcome.status = 'skipped:stale';
      outcome.eventId = existing.id;
      return outcome;
    }

    const previousProducts = existing ? await getProducts(existing.id) : [];
    const diff = diffEvents(existing, candidate, { previousProducts, nextProducts: products });

    if (existing && !diff.hasMaterialChange && existing.publish_state === 'published') {
      // Cosmetic change only: refresh last_seen, do not bump versions
      await updateEvent(existing.id, { last_seen_at: new Date().toISOString() });
      await updateSourceDocument(docRow.id, {
        processing_status: 'parsed',
        event_id: existing.id,
        fetched_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
      });
      outcome.status = 'no_material_change';
      outcome.eventId = existing.id;
      return outcome;
    }

    // ---------------------------------------------------------------------
    // 9. Media (best effort — never blocks publication)
    // ---------------------------------------------------------------------
    let images = existing && Array.isArray(existing.images) ? existing.images : [];
    if (!skipMedia && parse.images && parse.images.length) {
      try {
        const ranked = rankImageCandidates(parse.images, { eventKind: candidate.event_kind });
        if (ranked.length) {
          const processed = await buildEventImages(ranked, { ...candidate, id: existing ? existing.id : 'new' }, { logger });
          if (processed.length) images = processed;
        }
      } catch (e) {
        logger.warn && logger.warn(`[food-safety] media pipeline failed (continuing): ${e.message}`);
      }
    }

    const publishDecision = decidePublishState(candidate, {
      reviewReasons,
      materialChanged: diff.hasMaterialChange,
      previousPublishState: existing ? existing.publish_state : null,
    });

    const persistRow = {
      canonical_key: candidate.canonical_key,
      event_kind: candidate.event_kind,
      provider: 'fda',
      source_url: candidate.source_url,
      official_reference_number: candidate.official_reference_number,
      openfda_event_id: candidate.openfda_event_id,
      recall_numbers: candidate.recall_numbers,
      title: candidate.title,
      display_title: candidate.display_title,
      short_dek: candidate.short_dek,
      public_action: candidate.public_action,
      company: candidate.company,
      brands: candidate.brands,
      product_name: candidate.product_name,
      product_description: candidate.product_description,
      hazard_category: candidate.hazard_category,
      hazard_name: candidate.hazard_name,
      organism: candidate.organism,
      serotype: candidate.serotype,
      allergens: candidate.allergens,
      status: candidate.status,
      fda_recall_classification: candidate.fda_recall_classification,
      voluntary_or_mandated: candidate.voluntary_or_mandated,
      company_announcement_date: candidate.company_announcement_date,
      fda_publish_date: candidate.fda_publish_date,
      source_updated_at: candidate.source_updated_at,
      last_illness_onset: candidate.last_illness_onset,
      illnesses: candidate.illnesses,
      hospitalizations: candidate.hospitalizations,
      deaths: candidate.deaths,
      hus_cases: candidate.hus_cases,
      other_outcomes: candidate.other_outcomes,
      geographic_scope: candidate.geographic_scope,
      case_states: candidate.case_states,
      distribution_states: candidate.distribution_states,
      case_counts_by_state: candidate.case_counts_by_state,
      distribution_text: candidate.distribution_text,
      retailers: candidate.retailers,
      recommendations: candidate.recommendations,
      source_links: candidate.source_links,
      images,
      severity: candidate.severity,
      severity_reasons: candidate.severity_reasons,
      publish_state: publishDecision.publishState,
      review_reason: publishDecision.reason,
      extraction_method: candidate.extraction_method,
      extraction_confidence: candidate.extraction_confidence,
      source_hash: candidate.source_hash,
      material_hash: candidate.material_hash,
      last_seen_at: new Date().toISOString(),
    };

    let eventRow;
    let versionNumber;
    if (existing) {
      versionNumber = (existing.current_version || 1) + (diff.hasMaterialChange ? 1 : 0);
      const updateNumber = diff.hasMaterialChange
        ? (existing.update_number || 0) + 1
        : (existing.update_number || 0);
      eventRow = await updateEvent(existing.id, {
        ...persistRow,
        current_version: versionNumber,
        update_number: updateNumber,
        // status transitions to 'updated' when material data changed and the
        // parse did not set a stronger status
        status: diff.hasMaterialChange && persistRow.status === 'active' ? 'updated' : persistRow.status,
      });
    } else {
      versionNumber = 1;
      eventRow = await insertEvent({
        ...persistRow,
        update_number: 0,
        current_version: 1,
        first_seen_at: new Date().toISOString(),
      });
    }

    outcome.eventId = eventRow.id;

    // Products
    if (products.length) await upsertProducts(eventRow.id, products);
    const allProducts = await getProducts(eventRow.id);

    // Version record for every material change
    if (diff.hasMaterialChange) {
      await insertVersion({
        event_id: eventRow.id,
        version_number: versionNumber,
        observed_at: new Date().toISOString(),
        source_updated_at: candidate.source_updated_at,
        changed_fields: diff.changedFields,
        material_changes: diff.materialChanges,
        snapshot: { ...persistRow, evidence },
        source_document_ids: [docRow.id],
        source_hash: candidate.source_hash,
      });
    }

    // ---------------------------------------------------------------------
    // 10. Publish (post + verified_events) when allowed
    // ---------------------------------------------------------------------
    outcome.publishState = publishDecision.publishState;
    if (publishDecision.publishState === 'published' && !config.dryRun) {
      const hasMapData = Boolean(
        (eventRow.case_states && eventRow.case_states.length)
        || (eventRow.distribution_states && eventRow.distribution_states.length)
        || eventRow.geographic_scope === 'nationwide',
      );
      const { postId } = await publishPost({ ...eventRow, images }, {
        products: allProducts, hasMapData, logger,
      });
      if (eventRow.post_id !== postId) {
        await updateEvent(eventRow.id, { post_id: postId });
      }
      await upsertVerifiedEvent({ ...eventRow, images, post_id: postId }, { logger });
    }

    await updateSourceDocument(docRow.id, {
      processing_status: publishDecision.publishState === 'published' ? 'published'
        : publishDecision.publishState === 'review' ? 'review' : 'correlated',
      event_id: eventRow.id,
      fetched_at: new Date().toISOString(),
      http_status: 200,
      last_error: null,
      locked_at: null,
      locked_by: null,
    });

    outcome.status = 'processed';
    return outcome;
  } catch (e) {
    logger.error && logger.error(`[food-safety] processing failed for doc ${docRow.id}: ${e.message}`);
    try {
      await markDocumentFailed(docRow, e.message, { permanent: Boolean(e.permanent) });
    } catch (persistErr) {
      logger.error && logger.error(`[food-safety] could not persist failure: ${persistErr.message}`);
    }
    outcome.status = 'failed';
    outcome.error = e.message;
    return outcome;
  }
}

module.exports = { processSourceDocument };
