(function (root, factory) {
  const state = typeof module === 'object' && module.exports ? require('./reading-state') : root.NoteworthyReadingState;
  const api = factory(state);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (state && root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => api.init(root));
    else api.init(root);
  }
})(typeof window === 'object' ? window : this, function (state) {
  'use strict';

  // Reading is side-effect free. Only an explicit action calls apply(). A
  // provider function also handles browsers where obtaining localStorage fails.
  function createStorageAccess(provider) {
    function read() {
      try { return state.parse(provider().getItem(state.STORAGE_KEY)); }
      catch (_) { return { ok: false, reason: 'unavailable', state: state.emptyState() }; }
    }
    function apply(action, guide) {
      try {
        if (action === 'clear') {
          provider().removeItem(state.STORAGE_KEY);
          return { ok: true, state: state.emptyState() };
        }
        const loaded = read();
        if (!loaded.ok) return loaded;
        const operation = { remember: state.remember, acknowledge: state.acknowledge, forget: state.forget }[action];
        if (!operation) return { ...loaded, ok: false, reason: 'invalid' };
        const next = operation(loaded.state, guide);
        if (next.briefings.length) provider().setItem(state.STORAGE_KEY, state.serialize(next));
        else provider().removeItem(state.STORAGE_KEY);
        return { ok: true, state: next };
      } catch (_) {
        return { ok: false, reason: 'unavailable', state: state.emptyState() };
      }
    }
    return { read, apply };
  }

  function formatRevision(revision) {
    return new Date(`${revision}T00:00:00.000Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  function guideFrom(element) {
    return { slug: element.dataset.guideSlug, title: element.dataset.guideTitle, updatedAt: element.dataset.guideUpdatedAt,
      version: /^[1-9]\d*$/.test(element.dataset.guideVersion || '') ? Number(element.dataset.guideVersion) : NaN };
  }
  function errorText(reason, duringAction = false) {
    return reason === 'corrupt'
      ? 'Remembered briefing data could not be read. Nothing was changed. Use “Clear remembered briefings” on the Story so far page to reset it.'
      : (duringAction ? 'This browser could not save your reading preference. Your choice was not saved. Check browser storage settings and try again.' : 'This browser could not read remembered briefings. Reading memory is unavailable; this page has not saved any reading progress.');
  }

  function init(win) {
    const roots = [...win.document.querySelectorAll('[data-story-guide], [data-story-guide-index]')];
    if (!roots.length) return;
    const storage = createStorageAccess(() => win.localStorage);
    const controllers = [];
    function text(scope, selector, value) { const element = scope.querySelector(selector); if (element) element.textContent = value; }
    function showAction(scope, action, visible, disabled = false) {
      const button = scope.querySelector(`[data-reading-action="${action}"]`);
      if (button) { button.hidden = !visible; button.disabled = disabled; }
    }
    function badge(scope, visible) {
      const element = scope.querySelector('[data-reading-updated]');
      if (element) { element.hidden = !visible; element.textContent = visible ? 'Updated since you read' : ''; }
    }

    roots.forEach(scope => {
      if (scope.dataset.readingInitialized === 'true') return;
      scope.dataset.readingInitialized = 'true';
      const isIndex = scope.hasAttribute('data-story-guide-index');
      const cards = isIndex ? [...scope.querySelectorAll('[data-story-guide-card]')] : [scope];
      const guide = isIndex ? null : guideFrom(scope);
      const message = scope.querySelector('[data-reading-message]');
      if (message) { message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite'); }

      function render(result, actionMessage) {
        const validCurrentGuide = isIndex || state.validGuide(guide);
        if (!validCurrentGuide) {
          ['remember', 'acknowledge', 'forget'].forEach(action => showAction(scope, action, false));
          text(scope, '[data-reading-message]', 'Reading memory is unavailable because this briefing has incomplete publication information.');
          return;
        }
        cards.forEach(card => {
          const info = guideFrom(card);
          if (!state.validGuide(info)) {
            badge(card, false);
            text(card, '[data-reading-status]', 'Reading status unavailable.');
            return;
          }
          if (!result.ok) {
            badge(card, false);
            text(card, '[data-reading-status]', 'Remembered status unavailable in this browser.');
            return;
          }
          const progress = state.status(result.state, info);
          badge(card, progress.updated);
          const statusText = progress.remembered
            ? `Remembered on this device. Last marked read: version ${progress.acknowledgedVersion}, dated ${formatRevision(progress.acknowledgedRevision)}.${progress.updated ? ` Current version: ${info.version}, dated ${formatRevision(info.updatedAt)}.` : ''}`
            : 'Not remembered on this device.';
          text(card, '[data-reading-status]', statusText);
        });
        if (isIndex) {
          const knownSlugs = new Set(cards.map(guideFrom).filter(state.validGuide).map(info => info.slug));
          const knownCount = result.state.briefings.filter(item => knownSlugs.has(item.slug)).length;
          text(scope, '[data-reading-index-status]', !result.ok ? 'Remembered briefing status is unavailable.' :
            knownCount ? `${knownCount} of these briefings remembered on this device.` :
              result.state.briefings.length ? 'None of these briefings are remembered. Older reading records on this device can be cleared below.' :
                'No briefings remembered. This feature saves nothing until you choose Remember on a briefing.');
          showAction(scope, 'clear', !result.ok || result.state.briefings.length > 0);
        } else {
          const progress = result.ok ? state.status(result.state, guide) : { remembered: false, updated: false };
          showAction(scope, 'remember', !progress.remembered, !result.ok && result.reason === 'corrupt');
          showAction(scope, 'acknowledge', progress.updated);
          showAction(scope, 'forget', progress.remembered);
        }
        text(scope, '[data-reading-message]', actionMessage || (!result.ok ? errorText(result.reason) : ''));
      }

      scope.querySelectorAll('[data-reading-action]').forEach(button => {
        button.addEventListener('click', () => {
          const action = button.dataset.readingAction;
          if ((isIndex && action !== 'clear') || (!isIndex && !['remember', 'acknowledge', 'forget'].includes(action))) return;
          const result = storage.apply(action, guide);
          if (!result.ok) {
            // Re-read on a failed write so valid previous preferences remain
            // visible; do not falsely announce that a failed action succeeded.
            render(storage.read(), errorText(result.reason, true));
            return;
          }
          const messages = {
            remember: 'This briefing is remembered only in this browser. No alerts or account sync were enabled.',
            acknowledge: 'This version is marked as read on this device.',
            forget: 'This briefing has been forgotten on this device.',
            clear: 'Remembered briefings have been cleared from this browser. Other saved articles and account preferences were not changed.',
          };
          controllers.forEach(controller => controller.render(result, controller.scope === scope ? messages[action] : ''));
          // The clicked button can disappear after success. Move keyboard
          // focus to the next available action rather than leaving it hidden.
          if (button.hidden) {
            const next = [...scope.querySelectorAll('[data-reading-action]')].find(item => !item.hidden && !item.disabled);
            if (next) next.focus();
            else if (message) { message.setAttribute('tabindex', '-1'); message.focus(); }
          }
        });
      });
      controllers.push({ scope, render });
      render(storage.read());
    });
    win.addEventListener('storage', event => {
      if (event.key !== state.STORAGE_KEY && event.key !== null) return;
      const result = storage.read();
      controllers.forEach(controller => controller.render(result));
    });
  }

  return { createStorageAccess, formatRevision, init };
});
