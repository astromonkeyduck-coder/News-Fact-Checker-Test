// ElevenLabs text-to-speech for Noteworthy News.
//
// Two request modes:
//   { id }   — narrate a published article. The server loads the record itself,
//              refuses withheld/review material, caps length, and caches audio
//              in Netlify Blobs so repeat listens do not re-bill.
//   { text } — legacy snippet mode (chat widget). Capped server-side.
//
// Voice selection for articles is fixed server-side; the endpoint never
// narrates arbitrary uncapped input.

const crypto = require('node:crypto');
const { getStore } = require('@netlify/blobs');
const { getPostStore, readPost } = require('./lib/postStore');

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // ElevenLabs "Rachel"
const DEFAULT_MODEL = 'eleven_multilingual_v2';
const ARTICLE_CHAR_CAP = 4800;
const SNIPPET_CHAR_CAP = 1000;
const CACHE_STORE = 'tts-audio';

function getCacheStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
  if (siteID && token) return getStore({ name: CACHE_STORE, siteID, token });
  return getStore({ name: CACHE_STORE });
}

function capAtSentence(text, cap) {
  if (text.length <= cap) return { text, truncated: false };
  const slice = text.slice(0, cap);
  const boundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf('! '));
  const cut = boundary > cap * 0.6 ? slice.slice(0, boundary + 1) : slice;
  return { text: cut.trim(), truncated: true };
}

function buildArticleScript(post) {
  const M = require('../../publication/model');
  const p = M.normalize(post);
  const state = post.editorial_status || post.editorial_state;
  if (!p.title || ['draft', 'review', 'suppressed'].includes(state) || p.review_required) {
    return null;
  }
  const parts = [p.title];
  if (p.agency) parts.push(`An automated summary of ${p.source} material.`);
  if (p.summary) parts.push(p.summary);
  if (p.body && p.body !== p.summary) parts.push(p.body);
  const joined = parts
    .map(s => String(s).trim())
    .filter(Boolean)
    .map(s => (/[.!?…]$/.test(s) ? s : s + '.'))
    .join(' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const { text, truncated } = capAtSentence(joined, ARTICLE_CHAR_CAP);
  return truncated
    ? `${text} This narration was shortened. The full story is on the page.`
    : text;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...headers, Allow: 'POST, OPTIONS' }, body: JSON.stringify({ error: 'Method not allowed. Use POST.' }) };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('[ElevenLabs TTS] ELEVENLABS_API_KEY is not configured');
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Audio narration is not available.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  let text;
  let voiceId = DEFAULT_VOICE_ID;
  let cacheKey = null;

  if (body.id) {
    // Article mode: server loads and caps the content; fixed voice.
    let post;
    try {
      post = await readPost(getPostStore(), String(body.id), { strict: true });
    } catch (error) {
      console.error('[ElevenLabs TTS] storage read failed:', error.message);
      return { statusCode: 503, headers: { ...headers, 'Retry-After': '60' }, body: JSON.stringify({ error: 'Audio narration is temporarily unavailable.' }) };
    }
    if (!post) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Story not found.' }) };
    }
    text = buildArticleScript(post);
    if (!text) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'This story is not available for narration.' }) };
    }
    const digest = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
    cacheKey = `article-${String(body.id)}-${voiceId}-${digest}`;
    try {
      const cached = await getCacheStore().get(cacheKey, { type: 'json' });
      if (cached && cached.audio) {
        return { statusCode: 200, headers, body: JSON.stringify({ ...cached, cached: true }) };
      }
    } catch (error) {
      console.warn('[ElevenLabs TTS] cache read skipped:', error.message);
    }
  } else if (typeof body.text === 'string' && body.text.trim()) {
    // Legacy snippet mode, capped.
    text = capAtSentence(body.text.trim(), SNIPPET_CHAR_CAP).text;
    if (typeof body.voice_id === 'string' && /^[A-Za-z0-9]{10,40}$/.test(body.voice_id)) {
      voiceId = body.voice_id;
    }
  } else {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide a story id or text.' }) };
  }

  console.log(`[ElevenLabs TTS] Generating ${text.length} characters, voice ${voiceId}${cacheKey ? `, key ${cacheKey}` : ''}`);

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: DEFAULT_MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[ElevenLabs TTS] API error:', response.status, detail.slice(0, 300));
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Audio narration is unavailable right now.' }) };
  }

  const audioBuffer = await response.arrayBuffer();
  const payload = {
    audio: Buffer.from(audioBuffer).toString('base64'),
    format: 'mp3',
    character_count: text.length,
    voice_id: voiceId,
    model_id: DEFAULT_MODEL,
  };

  if (cacheKey) {
    try {
      await getCacheStore().set(cacheKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('[ElevenLabs TTS] cache write skipped:', error.message);
    }
  }

  return { statusCode: 200, headers, body: JSON.stringify(payload) };
};
