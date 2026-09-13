(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NoteworthyReadingState = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';

  const STORAGE_KEY = 'noteworthy-story-briefs-v1';
  const MAX_BRIEFINGS = 500;
  const emptyState = () => ({ version: 1, briefings: [] });
  const validVersion = value => Number.isSafeInteger(value) && value > 0;
  const validSlug = value => typeof value === 'string' && value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  const validRevision = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const validGuide = guide => Boolean(guide && validSlug(guide.slug) && validRevision(guide.updatedAt) && validVersion(guide.version) &&
    typeof guide.title === 'string' && guide.title.trim().length > 0 && guide.title.length <= 500);

  function validateState(state) {
    if (!state || typeof state !== 'object' || state.version !== 1 || !Array.isArray(state.briefings) || state.briefings.length > MAX_BRIEFINGS) return false;
    const slugs = new Set();
    return state.briefings.every(record => {
      if (!record || !validSlug(record.slug) || !validRevision(record.revision) || !validVersion(record.version) || slugs.has(record.slug)) return false;
      slugs.add(record.slug);
      return true;
    });
  }

  function parse(raw) {
    if (raw == null) return { ok: true, state: emptyState() };
    try {
      const parsed = JSON.parse(raw);
      if (!validateState(parsed)) throw new Error('Invalid reading state');
      // Store only the fields needed for opt-in reading continuity. Do not
      // carry titles, external URLs, visit times or unknown fields forward.
      return { ok: true, state: { version: 1, briefings: parsed.briefings.map(({ slug, revision, version }) => ({ slug, revision, version })) } };
    } catch (_) {
      return { ok: false, reason: 'corrupt', state: emptyState() };
    }
  }

  function assertInputs(state, guide) {
    if (!validateState(state)) throw new Error('Invalid reading state');
    if (!validGuide(guide)) throw new Error('Invalid published briefing metadata');
  }
  function status(state, guide) {
    assertInputs(state, guide);
    const record = state.briefings.find(item => item.slug === guide.slug);
    return { remembered: Boolean(record), acknowledgedRevision: record?.revision || null, acknowledgedVersion: record?.version || null,
      updated: Boolean(record && guide.version > record.version) };
  }

  function remember(state, guide) {
    assertInputs(state, guide);
    const previous = state.briefings.find(item => item.slug === guide.slug);
    if (!previous && state.briefings.length >= MAX_BRIEFINGS) throw new Error('Remembered briefing limit reached');
    // An older page or tab cannot erase the acknowledgement of a newer version.
    const next = previous && previous.version >= guide.version
      ? { ...previous }
      : { slug: guide.slug, revision: guide.updatedAt, version: guide.version };
    return { version: 1, briefings: [...state.briefings.filter(item => item.slug !== guide.slug), next].sort((a, b) => a.slug.localeCompare(b.slug)) };
  }
  function acknowledge(state, guide) {
    assertInputs(state, guide);
    if (!status(state, guide).remembered) throw new Error('Remember this briefing first');
    return remember(state, guide);
  }
  function forget(state, guide) {
    assertInputs(state, guide);
    return { version: 1, briefings: state.briefings.filter(item => item.slug !== guide.slug).map(item => ({ ...item })) };
  }
  function serialize(state) {
    if (!validateState(state)) throw new Error('Invalid reading state');
    return JSON.stringify({ version: 1, briefings: state.briefings.map(({ slug, revision, version }) => ({ slug, revision, version })) });
  }

  return { STORAGE_KEY, emptyState, validSlug, validRevision, validVersion, validGuide, validateState, parse, status, remember, acknowledge, forget, serialize };
});
