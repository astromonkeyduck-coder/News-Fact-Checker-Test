'use strict';

/**
 * Rights/provenance guardrails for clip pipeline.
 * Every clip job must document rights_basis before clipping or uploading.
 */

function hasRightsBasis(jobOrBasis) {
  const basis = typeof jobOrBasis === 'string' ? jobOrBasis : jobOrBasis?.rights_basis;
  return typeof basis === 'string' && basis.trim().length > 0;
}

function assertRightsForClipping(jobOrBasis, action = 'clip') {
  if (hasRightsBasis(jobOrBasis)) {
    return;
  }
  throw new Error(
    `rights_basis is required before ${action}. ` +
      'Document your rights (e.g. "Official White House government-produced feed", "Licensed pool feed").'
  );
}

function assertRightsForUpload(jobOrBasis) {
  assertRightsForClipping(jobOrBasis, 'upload to X');
}

function warnIfMissingRights(jobOrBasis) {
  if (!hasRightsBasis(jobOrBasis)) {
    console.warn('[clip-pipeline] WARNING: rights_basis is empty. Metadata save allowed; clipping/upload blocked.');
    return false;
  }
  return true;
}

module.exports = {
  hasRightsBasis,
  assertRightsForClipping,
  assertRightsForUpload,
  warnIfMissingRights,
};
