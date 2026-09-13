'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createCall } = require('../../publication/story-voice');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const context = { articleId: 'usgs-example', title: 'A sourced article', url: 'https://noteworthynews.co/article.html?id=usgs-example' };
const data = () => ({ provider: 'elevenlabs', conversationToken: 'temporary-test-token', overrides: { agent: { prompt: { prompt: 'Server-authorized source context.', tool_ids: [], knowledge_base: [] }, firstMessage: 'Which detail would you like to discuss?' } } });
const response = (body = data()) => ({ ok: true, status: 200, json: async () => body });
function fixture(config = {}) {
  const calls = [], states = [], transcripts = [], frames = [], timers = new Map(), listeners = new Map(), hostCalls = [];
  let timerId = 0, hostStops = 0;
  const conversation = { ended: 0, mutes: [], endSession() { this.ended++; }, setMicMuted(value) { this.mutes.push(value); } };
  const host = { stop() { hostStops++; }, async start(options) { hostCalls.push(options); if (config.hostStart) return config.hostStart(options, conversation); options.onConversationCreated(conversation); return conversation; } };
  const win = { isSecureContext: true, AbortController, RTCPeerConnection: class {},
    navigator: { userActivation: { isActive: config.gesture !== false }, mediaDevices: { getUserMedia() { assert.fail('The host frame, not the article window, owns microphone access'); } } },
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearTimeout(id) { timers.delete(id); },
    addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
    document: { body: { dataset: { preview: String(Boolean(config.preview)) }, appendChild(frame) { frame.attached = true; } }, createElement(tag) {
      assert.equal(tag, 'iframe'); const frame = { attributes: {}, style: {}, contentWindow: { NoteworthyVoiceHost: config.missingHost ? null : host }, setAttribute(name, value) { this.attributes[name] = value; }, remove() { this.removed = true; } }; frames.push(frame); return frame;
    } },
    async fetch(url, options) { calls.push({ url, options }); return config.fetch ? config.fetch(url, options) : response(); } };
  const call = createCall({ window: win, onState: value => states.push(value), onTranscript: value => transcripts.push(value) });
  return { win, call, calls, states, transcripts, frames, timers, listeners, hostCalls, conversation, get hostStops() { return hostStops; },
    async load() { await tick(); const frame = frames.at(-1); assert.ok(frame, 'A frame should exist after a valid server response'); frame.onload(); await tick(); },
    fire(ms) { for (const [id, timer] of [...timers]) if (timer.ms === ms) { timers.delete(id); timer.fn(); } } };
}
function clean(f) { assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0); assert.ok(f.frames.every(frame => frame.removed)); }
async function connect(f) { const pending = f.call.start(context); await f.load(); assert.equal(await pending, true); return f.hostCalls.at(-1); }

test('factory is passive; explicit start requests only the grounded ElevenLabs token then loads the owned frame', async () => {
  const f = fixture(); assert.equal(f.call.supported, true); assert.equal(f.calls.length, 0); assert.equal(f.frames.length, 0);
  const sdk = await connect(f); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].url, '/.netlify/functions/story-voice-session');
  assert.equal(f.calls[0].options.method, 'POST'); assert.deepEqual(JSON.parse(f.calls[0].options.body), { pageContext: { ...context, storySlug: '' } });
  assert.equal(f.frames[0].src, '/publication/vendor/story-voice-frame.html'); assert.equal(f.frames[0].attributes['aria-hidden'], 'true');
  assert.equal(sdk.conversationToken, 'temporary-test-token'); assert.equal(sdk.connectionType, 'webrtc'); assert.deepEqual(sdk.overrides, data().overrides);
  assert.deepEqual(sdk.clientTools, {}); assert.equal(sdk.useWakeLock, false); assert.equal(sdk.onMCPToolApprovalRequest(), false);
  assert.equal(f.states.at(-1).provider, 'elevenlabs'); assert.equal(f.states.at(-1).state, 'listening');
  assert.equal(await f.call.start(context), false); assert.equal(f.calls.length, 1); f.call.stop(); clean(f); assert.ok(f.conversation.ended > 0); assert.ok(f.hostStops > 0);
});

test('preview, missing article, unsupported browser and absent user gesture refuse before network or frame creation', async () => {
  for (const config of [{ preview: true }, { gesture: false }, {}]) {
    const f = fixture(config); assert.equal(await f.call.start(config.preview || config.gesture === false ? context : {}), false);
    assert.equal(f.calls.length, 0); assert.equal(f.frames.length, 0); assert.equal(f.states.at(-1).state, 'error');
  }
  const call = createCall({ window: { isSecureContext: false } }); assert.equal(call.supported, false); assert.equal(await call.start(context), false);
  const f = fixture(); assert.equal(await f.call.start({ ...context, preview: true }), false); assert.equal(f.calls.length, 0);
});

test('wrong provider, absent settings or extra tools cannot start an ungrounded or alternate call', async () => {
  const invalid = [{ ...data(), provider: 'openai' }, { ...data(), conversationToken: '' }, { ...data(), overrides: {} },
    { ...data(), overrides: { agent: { prompt: { prompt: 'Source', tool_ids: ['unexpected-tool'], knowledge_base: [] } } } },
    { ...data(), overrides: { agent: { prompt: { prompt: 'Source', tool_ids: [], knowledge_base: ['unreviewed'] } } } }];
  for (const payload of invalid) {
    const f = fixture({ fetch: async () => response(payload) }); assert.equal(await f.call.start(context), false);
    assert.equal(f.frames.length, 0); assert.equal(f.calls.length, 1); assert.match(f.states.at(-1).message, /grounded ElevenLabs/); clean(f);
  }
});

test('server refusals expose useful configuration/article/rate-limit messages without leaking response details', async () => {
  for (const [status, pattern] of [[409, /article is not available/], [503, /not configured/], [429, /busy/], [500, /temporarily unavailable/]]) {
    const f = fixture({ fetch: async () => ({ ok: false, status, json: async () => ({ error: 'secret provider detail' }) }) });
    assert.equal(await f.call.start(context), false); assert.match(f.states.at(-1).message, pattern); assert.doesNotMatch(f.states.at(-1).message, /secret/);
    assert.equal(f.frames.length, 0); clean(f);
  }
});

test('stop aborts a pending token request, resolves promptly and ignores a late successful response', async () => {
  const token = deferred(), f = fixture({ fetch: () => token.promise }); const pending = f.call.start(context); await tick();
  f.call.stop(); assert.equal(await pending, false); assert.equal(f.calls[0].options.signal.aborted, true);
  token.resolve(response()); await tick(); assert.equal(f.frames.length, 0); assert.equal(f.states.at(-1).state, 'ended'); clean(f);
});

test('startup timeout removes a pending local frame and late loading cannot start its SDK', async () => {
  const f = fixture(), pending = f.call.start(context); await tick(); const lateLoad = f.frames[0].onload;
  f.fire(30000); assert.equal(await pending, false); assert.match(f.states.at(-1).message, /timed out/); clean(f);
  lateLoad(); await tick(); assert.equal(f.hostCalls.length, 0);
});

test('stop during SDK startup ends early-created and late-returned conversations and releases the frame', async () => {
  const sdkResult = deferred(), f = fixture({ hostStart: (options, conversation) => { options.onConversationCreated(conversation); return sdkResult.promise; } });
  const pending = f.call.start(context); await f.load(); f.call.stop(); assert.equal(await pending, false); clean(f);
  assert.ok(f.conversation.ended > 0); assert.ok(f.hostStops > 0);
  const late = { ended: 0, endSession() { this.ended++; } }; sdkResult.resolve(late); await tick(); assert.equal(late.ended, 1);
  const later = { ended: 0, endSession() { this.ended++; } }; f.hostCalls[0].onConversationCreated(later); assert.equal(later.ended, 1);
});

test('missing frame host and microphone denial fail honestly and release startup resources', async () => {
  for (const config of [{ missingHost: true }, { hostStart: async () => { throw Object.assign(Error('Private detail'), { name: 'NotAllowedError' }); } }]) {
    const f = fixture(config), pending = f.call.start(context); await f.load(); assert.equal(await pending, false); clean(f);
    assert.match(f.states.at(-1).message, config.missingHost ? /component could not load/ : /permission was denied/);
    assert.doesNotMatch(f.states.at(-1).message, /Private detail/);
  }
});

test('mute, final transcripts, duplicate events and speaking state follow the ElevenLabs callback contract', async () => {
  const f = fixture(); f.call.setMuted(true); const sdk = await connect(f); assert.equal(f.conversation.mutes.at(-1), true); assert.equal(f.states.at(-1).state, 'muted');
  sdk.onMessage({ role: 'user', message: ' What changed? ', event_id: 'u1' }); sdk.onMessage({ role: 'agent', message: 'Source-based answer', event_id: 'a1' });
  sdk.onMessage({ role: 'agent', message: 'Source-based answer', event_id: 'a1' }); sdk.onMessage({ role: 'tool', message: 'Ignore this', event_id: 'x' });
  assert.deepEqual(f.transcripts.map(value => [value.role, value.id, value.final]), [['user', 'u1', true], ['assistant', 'a1', true]]);
  assert.equal(f.transcripts[0].text, 'What changed?'); sdk.onModeChange({ mode: 'speaking' }); assert.equal(f.states.at(-1).state, 'speaking');
  sdk.onModeChange({ mode: 'listening' }); assert.equal(f.states.at(-1).state, 'muted'); f.call.setMuted(false); assert.equal(f.states.at(-1).state, 'listening');
  f.call.stop(); clean(f); const count = f.transcripts.length; sdk.onMessage({ role: 'agent', message: 'Late answer', event_id: 'a2' }); sdk.onModeChange({ mode: 'speaking' });
  assert.equal(f.transcripts.length, count); assert.equal(f.states.at(-1).state, 'ended');
});

test('pagehide, tool attempts and network disconnect end the owned call; normal agent goodbye ends cleanly', async () => {
  for (const action of ['pagehide', 'tool', 'network', 'goodbye']) {
    const f = fixture(), sdk = await connect(f);
    if (action === 'pagehide') f.listeners.get('pagehide')();
    if (action === 'tool') sdk.onUnhandledClientToolCall({ tool_name: 'send_email' });
    if (action === 'network') sdk.onDisconnect({ reason: 'error' });
    if (action === 'goodbye') sdk.onDisconnect({ reason: 'agent' });
    clean(f); assert.equal(f.calls.length, 1); assert.equal(f.states.at(-1).state, ['tool', 'network'].includes(action) ? 'error' : 'ended');
  }
});

function hostFixture() {
  const streams = [], peers = [], sockets = [], contexts = [], listeners = new Map();
  const permission = deferred(); let requests = 0, sdkOptions;
  const nativeMedia = () => { requests++; return permission.promise; };
  class Peer { constructor() { peers.push(this); } close() { this.closed = true; } }
  class Socket { constructor() { sockets.push(this); } close() { this.closed = true; } }
  class Context { constructor() { contexts.push(this); } close() { this.closed = true; } }
  const conversation = { ended: 0, endSession() { this.ended++; } }, result = deferred();
  const mediaElement = { src: 'blob:voice', srcObject: null, pause() { this.paused = true; }, removeAttribute(name) { if (name === 'src') this.src = ''; } };
  const outer = { RTCPeerConnection: Peer, WebSocket: Socket, AudioContext: Context, navigator: { mediaDevices: { getUserMedia: nativeMedia } } };
  const frame = { ...outer, navigator: { mediaDevices: { getUserMedia: nativeMedia } },
    document: { querySelectorAll: () => [mediaElement] }, addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
    ElevenLabsStoryClient: { Conversation: { startSession(options) { sdkOptions = options; return result.promise; } } } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../publication/vendor/story-voice-host.js'), 'utf8'), { window: frame, DOMException });
  const stream = () => { const track = { stopped: 0, stop() { this.stopped++; } }; const value = { track, getTracks: () => [track] }; streams.push(value); return value; };
  return { frame, outer, nativeMedia, Peer, Socket, Context, streams, peers, sockets, contexts, listeners, permission, result, conversation, mediaElement, stream, get requests() { return requests; }, get sdkOptions() { return sdkOptions; } };
}

test('owned host import does no media work and wraps only its frame APIs, leaving the parent APIs intact', () => {
  const f = hostFixture(); assert.equal(f.requests, 0); assert.equal(f.peers.length, 0); assert.equal(f.sockets.length, 0); assert.equal(f.contexts.length, 0);
  assert.equal(f.outer.RTCPeerConnection, f.Peer); assert.equal(f.outer.WebSocket, f.Socket); assert.equal(f.outer.AudioContext, f.Context);
  assert.equal(f.outer.navigator.mediaDevices.getUserMedia, f.nativeMedia); assert.notEqual(f.frame.navigator.mediaDevices.getUserMedia, f.nativeMedia);
  f.frame.NoteworthyVoiceHost.stop(); assert.equal(f.listeners.size, 0);
});

test('owned host stop closes tracked microphone, peer, socket, audio context and media output once', async () => {
  const f = hostFixture(), live = f.stream(); const permission = f.frame.navigator.mediaDevices.getUserMedia({ audio: true }); f.permission.resolve(live); await permission;
  new f.frame.RTCPeerConnection(); new f.frame.WebSocket('wss://example.test'); new f.frame.AudioContext();
  f.mediaElement.srcObject = f.stream(); f.frame.NoteworthyVoiceHost.stop(); f.frame.NoteworthyVoiceHost.stop();
  assert.equal(live.track.stopped, 1); assert.ok(f.peers.every(value => value.closed)); assert.ok(f.sockets.every(value => value.closed)); assert.ok(f.contexts.every(value => value.closed));
  assert.equal(f.streams[1].track.stopped, 1); assert.equal(f.mediaElement.srcObject, null); assert.equal(f.mediaElement.src, ''); assert.equal(f.mediaElement.paused, true);
  assert.throws(() => new f.frame.RTCPeerConnection(), /Call ended/); await assert.rejects(f.frame.navigator.mediaDevices.getUserMedia({ audio: true }), /Call ended/);
});

test('owned host stops a microphone permission granted after cancellation and rejects late SDK startup', async () => {
  const f = hostFixture(), live = f.stream(); const permission = f.frame.navigator.mediaDevices.getUserMedia({ audio: true });
  const started = f.frame.NoteworthyVoiceHost.start({ onConversationCreated() { assert.fail('Canceled host must not expose a conversation'); } });
  f.frame.NoteworthyVoiceHost.stop(); f.permission.resolve(live); await assert.rejects(permission, /Call ended/); assert.equal(live.track.stopped, 1);
  f.sdkOptions.onConversationCreated(f.conversation); assert.ok(f.conversation.ended > 0);
  f.result.resolve(f.conversation); await assert.rejects(started, /Call ended/); assert.ok(f.conversation.ended >= 2);
});

test('the pinned ElevenLabs SDK preserves denied tool/knowledge overrides and maps the first message', async () => {
  const location = path.join(path.dirname(require.resolve('@elevenlabs/client')), 'utils/overrides.js');
  const { constructOverrides } = await import(require('node:url').pathToFileURL(location).href);
  const payload = constructOverrides({ overrides: { agent: { prompt: { prompt: 'Server source context', tool_ids: [], knowledge_base: [] }, firstMessage: 'Ask about this article.', language: 'en' } } });
  assert.deepEqual(payload.conversation_config_override.agent.prompt, { prompt: 'Server source context', tool_ids: [], knowledge_base: [] });
  assert.equal(payload.conversation_config_override.agent.first_message, 'Ask about this article.');
  assert.equal(payload.conversation_config_override.agent.language, 'en');
  assert.equal(payload.type, 'conversation_initiation_client_data');
});
