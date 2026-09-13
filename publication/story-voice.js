/* Article voice transport. No microphone or network work occurs before start().
 * WebRTC contract: https://developers.openai.com/api/docs/guides/voice-webrtc
 * Keep the existing server-selected gpt-realtime session and ephemeral secret.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NoteworthyStoryVoice = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const START_TIMEOUT = 30000;
  const DISCONNECT_TIMEOUT = 5000;
  const SESSION_ENDPOINT = '/.netlify/functions/realtime-voice';
  const CALL_ENDPOINT = 'https://api.openai.com/v1/realtime/calls';

  function createCall(options) {
    options = options || {};
    const w = options.window || (typeof window !== 'undefined' ? window : null);
    const supported = Boolean(w && w.isSecureContext !== false && w.RTCPeerConnection &&
      w.navigator?.mediaDevices?.getUserMedia && w.fetch && w.AbortController && w.document);
    const emit = (fn, value) => { try { if (typeof fn === 'function') fn(value); } catch (_) {} };
    let current = null;
    let muted = false;
    const notify = (state, message) => emit(options.onState, {
      state, message, muted, active: ['listening', 'speaking', 'muted'].includes(state),
    });
    const quiet = fn => { try { fn(); } catch (_) {} };
    const stopTracks = stream => quiet(() => stream.getTracks().forEach(track => {
      track.onended = null;
      quiet(() => track.stop());
    }));

    function cleanup(session) {
      w.clearTimeout(session.timer);
      w.clearTimeout(session.disconnectTimer);
      w.removeEventListener('pagehide', session.pagehide);
      session.controller.abort();
      if (session.channel) {
        session.channel.onopen = session.channel.onmessage = session.channel.onerror = session.channel.onclose = null;
        quiet(() => session.channel.close());
      }
      if (session.pc) {
        session.pc.ontrack = session.pc.onconnectionstatechange = session.pc.oniceconnectionstatechange = null;
        quiet(() => session.pc.close());
      }
      stopTracks(session.stream);
      session.remoteStreams.forEach(stopTracks);
      if (session.audio) {
        quiet(() => session.audio.pause());
        session.audio.srcObject = null;
        quiet(() => session.audio.remove());
      }
    }

    function finish(session, state, message) {
      if (current !== session) return;
      current = null;
      cleanup(session);
      session.cancel();
      notify(state, message);
    }

    function fail(session, message) { finish(session, 'error', message); }
    function stop() { if (current) finish(current, 'ended', 'Call ended.'); }
    function listening(session) {
      if (current === session && session.ready) notify(muted ? 'muted' : 'listening', muted ? 'Microphone muted.' : 'Connected. You can speak.');
    }
    function setMuted(value) {
      muted = Boolean(value);
      if (current?.stream) current.stream.getAudioTracks().forEach(track => { track.enabled = current.ready && !muted; });
      if (current?.ready) listening(current);
      return muted;
    }

    function transcript(session, role, text, id) {
      if (typeof text !== 'string' || !text.trim()) return;
      const key = role + ':' + (id || text);
      if (session.transcripts.has(key)) return;
      session.transcripts.add(key);
      if (session.transcripts.size > 200) session.transcripts.delete(session.transcripts.values().next().value);
      emit(options.onTranscript, { role, text: text.trim(), id: id || key, final: true });
    }

    function receive(session, event) {
      if (current !== session) return;
      let data;
      try { data = JSON.parse(event.data); } catch (_) { return; }
      if (!data || typeof data !== 'object') return;
      switch (data.type) {
        case 'conversation.item.input_audio_transcription.completed':
          transcript(session, 'user', data.transcript, data.item_id); break;
        case 'response.output_audio_transcript.done':
        case 'response.audio_transcript.done':
          transcript(session, 'assistant', data.transcript, data.item_id || data.response_id); break;
        case 'response.output_text.done':
          transcript(session, 'assistant', data.text, data.item_id || data.response_id); break;
        case 'output_audio_buffer.started':
          session.speaking = true;
          if (session.ready) notify('speaking', 'AI is speaking.');
          break;
        case 'output_audio_buffer.stopped':
        case 'output_audio_buffer.cleared':
        case 'input_audio_buffer.speech_started':
          session.speaking = false; listening(session); break;
        case 'response.done':
          if (data.response?.status === 'failed') fail(session, 'The voice response failed. Please start a new call.');
          else if (!session.speaking) listening(session);
          break;
        case 'error':
          fail(session, 'The voice connection encountered an error. Please start a new call.'); break;
        case 'response.function_call_arguments.done':
          // Article sessions have no executable tools. Never perform an action
          // merely because a stale/misconfigured session advertises one.
          fail(session, 'This call requested an unavailable tool. Use the story assistant for images or research.'); break;
      }
    }

    function errorMessage(error) {
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') return 'Microphone permission was denied. Allow microphone access, then start a new call.';
      if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') return 'No microphone was found. Connect a microphone and try again.';
      if (error?.name === 'NotReadableError') return 'The microphone is unavailable or in use. Check it and try again.';
      return error?.publicMessage || 'The voice call could not connect. Please try again.';
    }
    function publicError(message) { const error = new Error('Voice connection failed'); error.publicMessage = message; return error; }
    function pageContext(raw) {
      raw = raw && typeof raw === 'object' ? raw : {};
      return {
        articleId: String(raw.articleId || '').slice(0, 100),
        url: String(raw.url || '').slice(0, 300),
        title: String(raw.title || '').slice(0, 300),
        storySlug: '',
      };
    }

    async function start(context) {
      if (current) return false;
      if (w?.document?.body?.dataset?.preview === 'true' || context?.preview === true) {
        notify('error', 'Live calls are disabled in this local preview.'); return false;
      }
      if (!supported) { notify('error', 'Voice calls require a secure browser with microphone support.'); return false; }
      if (w.navigator.userActivation?.isActive === false) {
        notify('error', 'Choose Start call to enable your microphone.'); return false;
      }
      const page = pageContext(context);
      if (!page.articleId) { notify('error', 'Open a published article before starting a story call.'); return false; }
      const session = { controller: new w.AbortController(), remoteStreams: new Set(), transcripts: new Set(), ready: false };
      current = session;
      const cancelled = new Promise(resolve => { session.cancel = () => resolve(false); });
      session.pagehide = stop;
      w.addEventListener('pagehide', session.pagehide);
      session.timer = w.setTimeout(() => fail(session, 'The voice connection timed out. Please try again.'), START_TIMEOUT);
      notify('connecting', 'Connecting your microphone…');

      const connect = async () => {
        // start() is called directly by the reader's Call button. There is no
        // permission preflight, automatic startup, or background token request.
        if (current !== session) return false;
        const stream = await w.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        if (current !== session) { stopTracks(stream); return false; }
        session.stream = stream;
        const tracks = stream.getAudioTracks();
        if (!tracks.length) throw publicError('No microphone audio track was available.');
        tracks.forEach(track => {
          // Do not transmit microphone audio until the data channel is ready.
          track.enabled = false;
          track.onended = () => fail(session, 'The microphone disconnected. Please start a new call.');
        });
        const response = await w.fetch(SESSION_ENDPOINT, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ mode: 'article', voice: 'marin', pageContext: page }), signal: session.controller.signal,
        });
        if (current !== session) return false;
        const data = await response.json().catch(() => ({}));
        if (current !== session) return false;
        if (!response.ok) throw publicError([404, 409].includes(response.status) ? 'This article is not available for a voice call.' : response.status === 429 ? 'Voice calls are busy. Please try again later.' : 'Voice calling is temporarily unavailable. Please try again.');
        if (typeof data.ephemeralToken !== 'string' || !data.ephemeralToken.startsWith('ek_')) throw publicError('The voice session could not be prepared. Please try again.');
        const pc = session.pc = new w.RTCPeerConnection();
        const audio = session.audio = w.document.createElement('audio');
        audio.autoplay = true;
        audio.hidden = true;
        audio.setAttribute('playsinline', '');
        w.document.body.appendChild(audio);
        pc.ontrack = event => {
          const remote = event.streams?.[0] || (w.MediaStream && event.track ? new w.MediaStream([event.track]) : null);
          if (!remote) return;
          if (current !== session) { stopTracks(remote); return; }
          session.remoteStreams.add(remote);
          audio.srcObject = remote;
          try {
            const playback = audio.play();
            if (playback?.catch) playback.catch(() => fail(session, 'Call audio could not play. Start a new call to enable playback.'));
          } catch (_) { fail(session, 'Call audio could not play. Start a new call to enable playback.'); }
        };
        const connectionChanged = () => {
          if (current !== session) return;
          const state = pc.connectionState || pc.iceConnectionState;
          if (state === 'failed' || state === 'closed') fail(session, 'The voice connection ended. Please start a new call.');
          else if (state === 'disconnected' && !session.disconnectTimer) session.disconnectTimer = w.setTimeout(() => fail(session, 'The voice connection was lost. Please start a new call.'), DISCONNECT_TIMEOUT);
          else if (state === 'connected' || state === 'completed') { w.clearTimeout(session.disconnectTimer); session.disconnectTimer = null; }
        };
        pc.onconnectionstatechange = pc.oniceconnectionstatechange = connectionChanged;
        tracks.forEach(track => pc.addTrack(track, stream));
        const channel = session.channel = pc.createDataChannel('oai-events');
        const opened = new Promise(resolve => { channel.onopen = () => resolve(true); });
        channel.onmessage = event => receive(session, event);
        channel.onerror = channel.onclose = () => fail(session, 'The voice connection ended. Please start a new call.');
        const offer = await pc.createOffer();
        if (current !== session) return false;
        await pc.setLocalDescription(offer);
        if (current !== session) return false;
        const answer = await w.fetch(CALL_ENDPOINT, {
          method: 'POST', headers: { Authorization: 'Bearer ' + data.ephemeralToken, 'Content-Type': 'application/sdp' },
          body: offer.sdp, signal: session.controller.signal,
        });
        if (current !== session) return false;
        if (!answer.ok) throw publicError('The voice connection could not be established. Please try again.');
        const sdp = await answer.text();
        if (current !== session) return false;
        await pc.setRemoteDescription({ type: 'answer', sdp });
        if (current !== session) return false;
        if (channel.readyState !== 'open') await Promise.race([opened, cancelled]);
        if (current !== session) return false;
        session.ready = true;
        w.clearTimeout(session.timer);
        tracks.forEach(track => { track.enabled = !muted; });
        // A greeting starts only after the reader has explicitly started a call.
        channel.send(JSON.stringify({ type: 'response.create', response: {
          instructions: 'Briefly introduce yourself as the AI story assistant and ask what the reader would like to discuss. Do not summarize or add factual claims in this greeting.',
        } }));
        listening(session);
        return true;
      };
      const attempt = connect().catch(error => {
        if (current === session) fail(session, errorMessage(error));
        return false;
      });
      return Promise.race([attempt, cancelled]);
    }
    return { supported, start, stop, setMuted };
  }
  return { createCall };
});
