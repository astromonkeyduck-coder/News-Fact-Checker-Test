'use strict';

class ValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
  }
}

const EMAIL_MAX_LENGTH = 254;
const PUSH_ENDPOINT_MAX_LENGTH = 4096;
const PREFERENCE_KEYS = [
  'breakingNews',
  'liveUpdates',
  'majorDevelopments',
  'earthquakes',
  'weatherAlerts',
];

function parseJsonObject(body) {
  if (typeof body !== 'string' || body.trim() === '') {
    throw new ValidationError('Request body is required');
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  return parsed;
}

function normalizeEmail(value, { optional = false } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (optional) return null;
    throw new ValidationError('A valid email address is required');
  }

  const email = String(value).trim().toLowerCase();
  if (email.length > EMAIL_MAX_LENGTH || /[\s\u0000-\u001f\u007f]/.test(email)) {
    throw new ValidationError('A valid email address is required');
  }

  const at = email.lastIndexOf('@');
  if (at < 1 || at !== email.indexOf('@')) {
    throw new ValidationError('A valid email address is required');
  }

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || domain.length > 253 || !domain.includes('.')) {
    throw new ValidationError('A valid email address is required');
  }

  const labels = domain.split('.');
  if (labels.some((label) => (
    !label
    || label.length > 63
    || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  ))) {
    throw new ValidationError('A valid email address is required');
  }

  return email;
}

function normalizeDisplayName(value) {
  if (value === undefined || value === null) return '';
  const name = String(value)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length > 80) throw new ValidationError('Name is too long');
  return name;
}

function normalizePushEndpoint(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > PUSH_ENDPOINT_MAX_LENGTH) {
    throw new ValidationError('Invalid push subscription endpoint');
  }

  let endpoint;
  try {
    endpoint = new URL(value);
  } catch {
    throw new ValidationError('Invalid push subscription endpoint');
  }
  if (endpoint.protocol !== 'https:') {
    throw new ValidationError('Push subscription endpoint must use HTTPS');
  }
  return endpoint.toString();
}

function normalizePushKey(value, name, minLength, maxLength) {
  if (typeof value !== 'string'
    || value.length < minLength
    || value.length > maxLength
    || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new ValidationError(`Invalid push subscription ${name} key`);
  }
  return value;
}

function sanitizePushSubscription(value, { endpointOnly = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('Invalid push subscription');
  }

  const endpoint = normalizePushEndpoint(value.endpoint);
  if (endpointOnly) return { endpoint };

  const keys = value.keys;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) {
    throw new ValidationError('Push subscription keys are required');
  }

  const expirationTime = value.expirationTime === null || value.expirationTime === undefined
    ? null
    : Number(value.expirationTime);
  if (expirationTime !== null && (!Number.isFinite(expirationTime) || expirationTime < 0)) {
    throw new ValidationError('Invalid push subscription expiration time');
  }

  return {
    endpoint,
    expirationTime,
    keys: {
      p256dh: normalizePushKey(keys.p256dh, 'p256dh', 40, 512),
      auth: normalizePushKey(keys.auth, 'auth', 8, 256),
    },
  };
}

function sanitizeNotificationPreferences(value, defaults = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = {};
  for (const key of PREFERENCE_KEYS) {
    if (typeof input[key] === 'boolean') result[key] = input[key];
    else if (typeof defaults[key] === 'boolean') result[key] = defaults[key];
  }
  return result;
}

module.exports = {
  EMAIL_MAX_LENGTH,
  PREFERENCE_KEYS,
  ValidationError,
  normalizeDisplayName,
  normalizeEmail,
  normalizePushEndpoint,
  parseJsonObject,
  sanitizeNotificationPreferences,
  sanitizePushSubscription,
};
