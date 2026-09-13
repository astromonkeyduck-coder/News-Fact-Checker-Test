'use strict';

const articleCompanion = require('./lib/articleCompanion');

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const reply = (statusCode, body) => ({ statusCode, headers: HEADERS, body: JSON.stringify(body) });

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Use POST to start an article voice session.' });
  let body;
  try {
    const json = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '{}';
    body = JSON.parse(json);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('Invalid request');
  } catch (_) { return reply(400, { error: 'Invalid JSON body.' }); }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId || !/^[A-Za-z0-9_-]{1,200}$/.test(agentId)) {
    return reply(503, { error: 'The ElevenLabs article voice service is not configured.', voiceUnavailable: true });
  }
  let article;
  try { article = await articleCompanion.loadArticle(body.pageContext); }
  catch (_) {
    return reply(409, { error: 'The public source record for this article is unavailable. Please reload the article and try again.', groundingUnavailable: true });
  }

  // A token authorizes the WebRTC connection; it does not bind an article
  // prompt. The supported client must pass these server-authored overrides.
  // The configured ElevenLabs agent must allow the documented overrides.
  const overrides = { agent: {
    // @elevenlabs/client 1.25.0 forwards the nested prompt unchanged: these
    // fields use the API's snake_case, unlike SDK agent.firstMessage.
    prompt: { prompt: articleCompanion.voiceInstructions(article), tool_ids: [], knowledge_base: [] },
    firstMessage: "I'm an AI voice guide to this article. What would you like to discuss?",
    language: 'en',
  } };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`, {
      method: 'GET', headers: { 'xi-api-key': apiKey }, signal: controller.signal,
    });
    if (!response.ok) return reply(response.status === 429 ? 429 : 502, {
      error: 'The ElevenLabs voice service could not start this conversation. Please try again.', voiceUnavailable: true,
    });
    const data = await response.json();
    if (typeof data.token !== 'string' || !data.token.trim() || data.token.length > 20000) {
      return reply(502, { error: 'The ElevenLabs voice service returned an invalid conversation token.', voiceUnavailable: true });
    }
    return reply(200, { provider: 'elevenlabs', conversationToken: data.token, overrides,
      articleId: article.id, articleUrl: article.url });
  } catch (error) {
    return reply(error.name === 'AbortError' ? 504 : 502, {
      error: error.name === 'AbortError' ? 'The ElevenLabs voice service timed out. Please try again.' : 'The ElevenLabs voice service is unavailable right now.',
      voiceUnavailable: true,
    });
  } finally { clearTimeout(timeout); }
};
