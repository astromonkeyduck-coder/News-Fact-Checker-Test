'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCall } = require('../../publication/story-voice');

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function stream() {
  const track = { enabled: true, stops: 0, stop() { this.stops++; }, onended: null };
  return { track, getTracks: () => [track], getAudioTracks: () => [track] };
}
function fixture(config = {}) {
  const local = stream(), remote = stream(), calls = [], states = [], transcripts = [], peers = [], audio = [], timers = new Map(), listeners = new Map();
  let timerId = 0, permissions = 0;
  const win = {
    isSecureContext: true, AbortController,
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
    navigator: { mediaDevices: { getUserMedia(settings) { permissions++; assert.equal(settings.video, false); return config.media ? config.media(local) : Promise.resolve(local); } } },
    document: {
      body: { dataset: config.preview ? { preview: 'true' } : {}, appendChild(el) { el.attached = true; } },
      createElement(type) {
        assert.equal(type, 'audio');
        const el = { setAttribute() {}, play: () => config.playError ? Promise.reject(Error('blocked')) : Promise.resolve(), pause() { this.paused = true; }, remove() { this.removed = true; } };
        audio.push(el); return el;
      },
    },
    RTCPeerConnection: class {
      constructor() { this.connectionState = 'new'; this.tracks = []; peers.push(this); }
      addTrack(track) { this.tracks.push(track); }
      createDataChannel(name) {
        assert.equal(name, 'oai-events');
        return this.channel = { readyState: 'connecting', messages: [], send(message) { this.messages.push(JSON.parse(message)); }, close() { this.closed = true; } };
      }
      async createOffer() { return { type: 'offer', sdp: 'local-sdp' }; }
      async setLocalDescription(offer) { this.localDescription = offer; }
      async setRemoteDescription(answer) {
        this.remoteDescription = answer;
        if (!config.noOpen) { this.channel.readyState = 'open'; this.channel.onopen(); }
      }
      close() { this.closed = true; }
    },
    async fetch(url, options) {
      calls.push({ url, options });
      if (config.fetch) return config.fetch(url, options, calls.length);
      return url.startsWith('/') ? { ok: true, status: 200, json: async () => ({ ephemeralToken: 'ek_test_secret', model: 'gpt-realtime' }) } : { ok: true, status: 200, text: async () => 'remote-sdp' };
    },
  };
  const call = createCall({ window: win, onState: state => states.push(state), onTranscript: item => transcripts.push(item) });
  return { win, call, local, remote, calls, states, transcripts, peers, audio, timers, listeners,
    permissions: () => permissions,
    fire(ms) { for (const [id, timer] of timers) if (timer.ms === ms) { timers.delete(id); timer.fn(); } },
    message(data) { peers.at(-1).channel.onmessage({ data: JSON.stringify(data) }); },
  };
}
const context = { articleId: 'usgs-example', title: 'A source-led article', url: 'https://noteworthynews.co/article.html?id=usgs-example' };
function clean(f) {
  assert.equal(f.local.track.stops, 1);
  assert(f.peers.every(pc => pc.closed));
  assert(f.audio.every(el => el.removed && el.paused && el.srcObject === null));
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
}

test('factory is passive; explicit start uses server article mode and an ephemeral WebRTC SDP exchange', async () => {
  const f = fixture();
  assert(f.call.supported);
  assert.equal(f.permissions(), 0);
  assert.equal(f.calls.length, 0);
  assert.equal(await f.call.start(context), true);
  assert.equal(f.permissions(), 1);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].url, '/.netlify/functions/realtime-voice');
  assert.deepEqual(JSON.parse(f.calls[0].options.body), { mode: 'article', voice: 'marin', pageContext: { ...context, storySlug: '' } });
  assert.equal(f.calls[1].url, 'https://api.openai.com/v1/realtime/calls');
  assert.equal(f.calls[1].options.headers.Authorization, 'Bearer ek_test_secret');
  assert.equal(f.calls[1].options.headers['Content-Type'], 'application/sdp');
  assert.equal(f.calls[1].options.body, 'local-sdp');
  assert.deepEqual(f.peers[0].remoteDescription, { type: 'answer', sdp: 'remote-sdp' });
  assert.equal(f.peers[0].channel.messages[0].type, 'response.create');
  assert.equal(f.states.at(-1).state, 'listening');
  assert.equal(f.local.track.enabled, true);
  assert.equal(await f.call.start(context), false);
  f.call.stop(); clean(f);
  assert.equal(f.states.at(-1).state, 'ended');
});

test('local preview, unsupported browser and missing article refuse before mic or network', async () => {
  for (const config of [{ preview: true }, {}]) {
    const f = fixture(config);
    assert.equal(await f.call.start(config.preview ? context : {}), false);
    assert.equal(f.permissions(), 0); assert.equal(f.calls.length, 0);
    assert.equal(f.states.at(-1).state, 'error');
  }
  const states = [];
  const call = createCall({ window: { isSecureContext: false }, onState: s => states.push(s) });
  assert.equal(call.supported, false);
  assert.equal(await call.start(context), false);
  assert.match(states[0].message, /secure browser/);
});

test('microphone denial is readable and never mints a session', async () => {
  const f = fixture({ media: () => Promise.reject(Object.assign(Error('secret detail'), { name: 'NotAllowedError' })) });
  assert.equal(await f.call.start(context), false);
  assert.match(f.states.at(-1).message, /permission was denied/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.listeners.size, 0); assert.equal(f.timers.size, 0);
});

test('browsers exposing user activation require a reader gesture before microphone access', async () => {
  const f = fixture();
  f.win.navigator.userActivation = { isActive: false };
  assert.equal(await f.call.start(context), false);
  assert.equal(f.permissions(), 0); assert.equal(f.calls.length, 0);
  assert.match(f.states.at(-1).message, /Start call/);
  f.win.navigator.userActivation.isActive = true;
  assert.equal(await f.call.start(context), true);
  f.call.stop(); clean(f);
});

test('stop while permission is pending resolves promptly and stops a late-granted microphone', async () => {
  const permission = deferred();
  const f = fixture({ media: () => permission.promise });
  const started = f.call.start(context);
  f.call.stop();
  assert.equal(await started, false);
  permission.resolve(f.local); await tick();
  assert.equal(f.local.track.stops, 1);
  assert.equal(f.calls.length, 0);
  assert.equal(f.states.at(-1).state, 'ended');
});

test('startup timeout releases pending permissions and cannot revive an old call', async () => {
  const permission = deferred();
  const f = fixture({ media: () => permission.promise });
  const started = f.call.start(context);
  f.fire(30000);
  assert.equal(await started, false);
  assert.match(f.states.at(-1).message, /timed out/);
  permission.resolve(f.local); await tick();
  assert.equal(f.local.track.stops, 1);
  assert.equal(f.calls.length, 0);
});

test('pending token request is aborted and a late response cannot connect', async () => {
  const pending = deferred();
  const f = fixture({ fetch: () => pending.promise });
  const started = f.call.start(context); await tick();
  assert.equal(f.local.track.enabled, false);
  f.call.stop(); assert.equal(await started, false);
  assert(f.calls[0].options.signal.aborted);
  pending.resolve({ ok: true, json: async () => ({ ephemeralToken: 'ek_late' }) }); await tick();
  assert.equal(f.peers.length, 0); clean(f);
});

test('article refusal and invalid tokens never initiate a WebRTC call or expose service details', async () => {
  for (const response of [
    { ok: false, status: 409, json: async () => ({ error: '<script>secret</script>' }) },
    { ok: true, status: 200, json: async () => ({ ephemeralToken: 'sk_never_use_standard_key' }) },
  ]) {
    const f = fixture({ fetch: async () => response });
    assert.equal(await f.call.start(context), false);
    assert.equal(f.calls.length, 1); assert.equal(f.peers.length, 0);
    assert.doesNotMatch(f.states.at(-1).message, /secret|script|sk_/);
    clean(f);
  }
});

test('SDP failure releases microphone, peer, data channel and audio', async () => {
  const f = fixture({ fetch: async (url) => url.startsWith('/') ? { ok: true, json: async () => ({ ephemeralToken: 'ek_test' }) } : { ok: false, status: 500 } });
  assert.equal(await f.call.start(context), false);
  clean(f); assert(f.peers[0].channel.closed);
});

test('data channel opening is bounded and microphone stays silent until ready', async () => {
  const f = fixture({ noOpen: true });
  const started = f.call.start(context); await tick();
  assert.equal(f.local.track.enabled, false);
  f.fire(30000);
  assert.equal(await started, false); clean(f);
});

test('mute, final transcripts, duplicate events, and actual audio speaking states are distinct', async () => {
  const f = fixture(); await f.call.start(context);
  f.call.setMuted(true); assert.equal(f.local.track.enabled, false); assert.equal(f.states.at(-1).state, 'muted');
  f.message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: 'What changed?' });
  f.message({ type: 'response.output_audio_transcript.delta', item_id: 'a1', delta: 'A partial' });
  const reply = { type: 'response.output_audio_transcript.done', item_id: 'a1', transcript: 'According to the supplied source.' };
  f.message(reply); f.message(reply);
  assert.deepEqual(f.transcripts.map(t => [t.role, t.id, t.final]), [['user', 'u1', true], ['assistant', 'a1', true]]);
  f.message({ type: 'output_audio_buffer.started' }); assert.equal(f.states.at(-1).state, 'speaking');
  f.message({ type: 'output_audio_buffer.stopped' }); assert.equal(f.states.at(-1).state, 'muted');
  f.call.setMuted(false); assert.equal(f.local.track.enabled, true);
  f.call.stop(); clean(f);
});

test('pagehide closes audio and tracks; late call events cannot change ended state', async () => {
  const f = fixture(); await f.call.start(context);
  const late = f.peers[0].channel.onmessage;
  f.peers[0].ontrack({ streams: [f.remote] });
  f.listeners.get('pagehide')();
  clean(f); assert.equal(f.remote.track.stops, 1);
  late({ data: JSON.stringify({ type: 'output_audio_buffer.started' }) });
  assert.equal(f.states.at(-1).state, 'ended');
});

test('blocked remote playback fails visibly and turns off the microphone', async () => {
  const f = fixture({ playError: true }); await f.call.start(context);
  f.peers[0].ontrack({ streams: [f.remote] }); await tick();
  assert.equal(f.states.at(-1).state, 'error'); assert.match(f.states.at(-1).message, /audio could not play/);
  clean(f);
});

test('temporary disconnection can recover; persistent loss closes the call', async () => {
  const f = fixture(); await f.call.start(context);
  const pc = f.peers[0];
  pc.connectionState = 'disconnected'; pc.onconnectionstatechange();
  pc.connectionState = 'connected'; pc.onconnectionstatechange();
  assert.equal(f.timers.size, 0);
  pc.connectionState = 'disconnected'; pc.onconnectionstatechange(); f.fire(5000);
  assert.match(f.states.at(-1).message, /connection was lost/); clean(f);
});

test('unexpected tool requests execute nothing and close the misconfigured call', async () => {
  const f = fixture(); await f.call.start(context);
  f.message({ type: 'response.function_call_arguments.done', name: 'send_email', arguments: '{}' });
  assert.equal(f.calls.length, 2);
  assert.match(f.states.at(-1).message, /unavailable tool/); clean(f);
});
