/* ElevenLabs-only article calls. The pinned SDK loads in an owned local frame
 * only after Start call. There is no alternative provider or CDN fallback.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NoteworthyStoryVoice = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ENDPOINT = '/.netlify/functions/story-voice-session';
  const FRAME = '/publication/vendor/story-voice-frame.html';
  function createCall(options) {
    options = options || {};
    const w = options.window || (typeof window !== 'undefined' ? window : null);
    const supported = Boolean(w && w.isSecureContext !== false && w.RTCPeerConnection &&
      w.navigator?.mediaDevices?.getUserMedia && w.fetch && w.AbortController && w.document);
    const emit = (fn, value) => { try { if (typeof fn === 'function') fn(value); } catch (_) {} };
    const quiet = fn => { try { const result = fn(); result?.catch?.(() => {}); } catch (_) {} };
    let current = null, muted = false;
    const notify = (state, message) => emit(options.onState, {
      state, message, muted, active: ['listening', 'speaking', 'muted'].includes(state), provider: 'elevenlabs',
    });
    function finish(session, state, message) {
      if (current !== session) return;
      current = null;
      w.clearTimeout(session.timer);
      w.removeEventListener('pagehide', session.pagehide);
      session.controller.abort();
      quiet(() => session.host?.stop());
      quiet(() => session.conversation?.endSession());
      if (session.frame) {
        session.frame.onload = session.frame.onerror = null;
        // Destroy the SDK's browser context even when startup is still pending.
        quiet(() => session.frame.remove());
      }
      session.cancel();
      notify(state, message);
    }
    const fail = (session, message) => finish(session, 'error', message);
    const stop = () => { if (current) finish(current, 'ended', 'Call ended.'); };
    function announce(session) {
      if (current !== session || !session.ready) return;
      if (session.mode === 'speaking') notify('speaking', 'ElevenLabs AI is speaking.');
      else notify(muted ? 'muted' : 'listening', muted ? 'Microphone muted.' : 'Connected with ElevenLabs. You can speak.');
    }
    function setMuted(value) {
      muted = Boolean(value);
      if (current?.conversation) {
        try { current.conversation.setMicMuted(muted); } catch (_) { fail(current, 'The microphone control failed. Please start a new call.'); }
      }
      if (current) announce(current);
      return muted;
    }
    function errorMessage(error) {
      if (['NotAllowedError', 'PermissionDeniedError'].includes(error?.name)) return 'Microphone permission was denied. Allow microphone access, then start a new call.';
      if (['NotFoundError', 'DevicesNotFoundError'].includes(error?.name)) return 'No microphone was found. Connect a microphone and try again.';
      if (error?.name === 'NotReadableError') return 'The microphone is unavailable or in use. Check it and try again.';
      return error?.publicMessage || 'The ElevenLabs call could not connect. Please try again.';
    }
    function publicError(message) { const error = new Error('ElevenLabs call unavailable'); error.publicMessage = message; return error; }
    function transcript(session, data) {
      if (current !== session || !data || typeof data.message !== 'string' || !data.message.trim()) return;
      const role = data.role === 'user' || data.source === 'user' ? 'user' : data.role === 'agent' || data.source === 'ai' ? 'assistant' : null;
      if (!role) return;
      // Pinned SDK emits final user_transcript/agent_response here. Tentative
      // responses use onDebug, which this adapter does not subscribe to.
      const id = String(data.event_id ?? data.message);
      const key = role + ':' + id;
      if (session.transcripts.has(key)) return;
      session.transcripts.add(key);
      if (session.transcripts.size > 200) session.transcripts.delete(session.transcripts.values().next().value);
      emit(options.onTranscript, { role, text: data.message.trim(), final: true, id });
    }
    function localHost(session, cancelled) {
      const frame = session.frame = w.document.createElement('iframe');
      frame.src = FRAME;
      frame.title = 'ElevenLabs voice connection';
      frame.allow = 'microphone; autoplay';
      frame.tabIndex = -1;
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;width:1px;height:1px;bottom:0;left:0;border:0;opacity:0;pointer-events:none';
      const loaded = new Promise((resolve, reject) => {
        frame.onload = () => {
          if (current !== session) return;
          try {
            const host = frame.contentWindow?.NoteworthyVoiceHost;
            if (!host || typeof host.start !== 'function' || typeof host.stop !== 'function') throw Error('Missing host');
            session.host = host; resolve(host);
          } catch (_) { reject(publicError('The ElevenLabs call component could not load. Please try again.')); }
        };
        frame.onerror = () => reject(publicError('The ElevenLabs call component could not load. Please try again.'));
      });
      w.document.body.appendChild(frame);
      return Promise.race([loaded, cancelled]);
    }
    async function start(context) {
      if (current) return false;
      if (w?.document?.body?.dataset?.preview === 'true' || context?.preview === true) {
        notify('error', 'Live calls are disabled in this local preview.'); return false;
      }
      if (!supported) { notify('error', 'Voice calls require a secure browser with microphone support.'); return false; }
      // Capture the reader action now; token and local SDK loading are async.
      if (w.navigator.userActivation?.isActive === false) {
        notify('error', 'Choose Start call to enable your microphone.'); return false;
      }
      const page = {
        articleId: String(context?.articleId || '').slice(0, 100),
        title: String(context?.title || '').slice(0, 300),
        url: String(context?.url || '').slice(0, 300), storySlug: '',
      };
      if (!page.articleId) { notify('error', 'Open a published article before starting a story call.'); return false; }
      const session = { controller: new w.AbortController(), transcripts: new Set(), ready: false, mode: 'listening' };
      current = session;
      const cancelled = new Promise(resolve => { session.cancel = () => resolve(false); });
      session.pagehide = stop;
      w.addEventListener('pagehide', session.pagehide);
      session.timer = w.setTimeout(() => fail(session, 'The ElevenLabs call timed out. Please try again.'), 30000);
      notify('connecting', 'Preparing your ElevenLabs call…');
      const connect = async () => {
        if (current !== session) return false;
        const response = await w.fetch(ENDPOINT, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ pageContext: page }), signal: session.controller.signal,
        });
        if (current !== session) return false;
        const data = await response.json().catch(() => ({}));
        if (current !== session) return false;
        if (!response.ok) throw publicError([404, 409].includes(response.status) ? 'This article is not available for a voice call.' : response.status === 503 ? 'ElevenLabs voice calling is not configured or is temporarily unavailable.' : response.status === 429 ? 'Voice calls are busy. Please try again later.' : 'ElevenLabs voice calling is temporarily unavailable.');
        const prompt = data?.overrides?.agent?.prompt;
        if (data?.provider !== 'elevenlabs' || typeof data.conversationToken !== 'string' || !data.conversationToken ||
          typeof prompt?.prompt !== 'string' || !prompt.prompt.trim() ||
          !Array.isArray(prompt.tool_ids) || prompt.tool_ids.length ||
          !Array.isArray(prompt.knowledge_base) || prompt.knowledge_base.length) {
          throw publicError('The grounded ElevenLabs call could not be prepared.');
        }
        const host = await localHost(session, cancelled);
        if (current !== session) return false;
        notify('connecting', 'Connecting your microphone with ElevenLabs…');
        const conversation = await host.start({
          conversationToken: data.conversationToken, connectionType: 'webrtc',
          overrides: data.overrides, useWakeLock: false, clientTools: {},
          onMCPToolApprovalRequest: () => false,
          onUnhandledClientToolCall: () => fail(session, 'This call requested an unavailable tool. Use the story assistant for images or research.'),
          onConversationCreated(value) {
            if (current !== session) { quiet(() => value.endSession()); return; }
            session.conversation = value;
            value.setMicMuted(muted);
          },
          onMessage: data => transcript(session, data),
          onModeChange(data) { if (current === session && ['speaking', 'listening'].includes(data?.mode)) { session.mode = data.mode; announce(session); } },
          onDisconnect(data) {
            if (current !== session) return;
            if (data?.reason === 'agent' || data?.reason === 'user') finish(session, 'ended', 'Call ended.');
            else fail(session, 'The ElevenLabs connection ended. Please start a new call.');
          },
          onError(message, detail) { if (current === session) fail(session, errorMessage(detail)); },
        });
        if (current !== session) { quiet(() => conversation.endSession()); return false; }
        session.conversation = conversation;
        conversation.setMicMuted(muted);
        session.ready = true;
        w.clearTimeout(session.timer);
        announce(session);
        return true;
      };
      const attempt = connect().catch(error => { if (current === session) fail(session, errorMessage(error)); return false; });
      return Promise.race([attempt, cancelled]);
    }
    return { supported, start, stop, setMuted };
  }
  return { createCall };
});
