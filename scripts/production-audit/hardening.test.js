'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeDisplayName,
  normalizeEmail,
  normalizePushEndpoint,
  parseJsonObject,
  sanitizeNotificationPreferences,
  sanitizePushSubscription,
} = require('../../netlify/functions/lib/publicInputValidation');
const {
  isDisallowedBrowserOrigin,
} = require('../../netlify/functions/lib/publicMutationGuard');

function event(headers = {}) {
  return { headers };
}

test('normalizes valid public input without retaining extra fields', () => {
  assert.equal(normalizeEmail('  Reader@Example.COM '), 'reader@example.com');
  assert.equal(normalizeDisplayName('  Ada   Lovelace  '), 'Ada Lovelace');
  assert.deepEqual(parseJsonObject('{"ok":true}'), { ok: true });
});

test('rejects malformed and control-character email input', () => {
  for (const value of ['reader', '@example.com', 'a@@example.com', 'a@-example.com', 'a@example', 'a\n@example.com']) {
    assert.throws(() => normalizeEmail(value));
  }
});

test('normalizes HTTPS push subscriptions and rejects unsafe endpoints', () => {
  const subscription = sanitizePushSubscription({
    endpoint: 'https://push.example.test/subscription/123',
    expirationTime: null,
    keys: {
      p256dh: 'A'.repeat(65),
      auth: 'B'.repeat(22),
    },
    ignored: 'not persisted',
  });

  assert.deepEqual(Object.keys(subscription).sort(), ['endpoint', 'expirationTime', 'keys']);
  assert.equal(normalizePushEndpoint(subscription.endpoint), subscription.endpoint);
  assert.throws(() => normalizePushEndpoint('javascript:alert(1)'));
  assert.throws(() => normalizePushEndpoint('http://push.example.test/subscription'));
});

test('preference sanitizer only keeps supported boolean values', () => {
  assert.deepEqual(
    sanitizeNotificationPreferences({
      breakingNews: true,
      liveUpdates: 'yes',
      prototypePollution: true,
    }, {
      liveUpdates: false,
      majorDevelopments: true,
    }),
    {
      breakingNews: true,
      liveUpdates: false,
      majorDevelopments: true,
    },
  );
});

test('browser-origin guard accepts owned origins and rejects cross-site requests', () => {
  const allowed = new Set(['https://noteworthynews.co']);
  assert.equal(
    isDisallowedBrowserOrigin(event({ origin: 'https://noteworthynews.co', 'sec-fetch-site': 'same-origin' }), allowed),
    false,
  );
  assert.equal(
    isDisallowedBrowserOrigin(event({ origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' }), allowed),
    true,
  );
  assert.equal(isDisallowedBrowserOrigin(event({}), allowed), false);
});
