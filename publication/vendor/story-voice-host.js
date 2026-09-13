/* This frame owns one ElevenLabs call. The SDK has no startup AbortSignal.
 * Track resources within this frame only; never patch the host page APIs.
 * No media or network work starts on importing this resource tracker.
 */
(function (w) {
  'use strict';
  let ended = false, conversation = null;
  const streams = new Set(), peers = new Set(), sockets = new Set(), contexts = new Set();
  const quiet = fn => { try { const result = fn(); result?.catch?.(() => {}); } catch (_) {} };
  const aborted = () => new DOMException('Call ended', 'AbortError');
  const stopStream = stream => quiet(() => stream.getTracks().forEach(track => quiet(() => track.stop())));
  const media = w.navigator?.mediaDevices;
  if (media?.getUserMedia) {
    const getUserMedia = media.getUserMedia.bind(media);
    media.getUserMedia = async constraints => {
      if (ended) throw aborted();
      const stream = await getUserMedia(constraints);
      if (ended) { stopStream(stream); throw aborted(); }
      streams.add(stream);
      return stream;
    };
  }
  function trackConstructor(name, collection) {
    const Native = w[name];
    if (!Native) return;
    w[name] = class extends Native {
      constructor(...args) { if (ended) throw aborted(); super(...args); collection.add(this); }
    };
  }
  trackConstructor('RTCPeerConnection', peers);
  trackConstructor('WebSocket', sockets);
  trackConstructor('AudioContext', contexts);
  trackConstructor('webkitAudioContext', contexts);
  function stop() {
    if (ended) return;
    ended = true;
    quiet(() => conversation?.endSession());
    streams.forEach(stopStream);
    peers.forEach(peer => quiet(() => peer.close()));
    sockets.forEach(socket => quiet(() => socket.close()));
    contexts.forEach(context => quiet(() => context.close()));
    w.document.querySelectorAll('audio,video').forEach(audio => {
      quiet(() => audio.pause());
      if (audio.srcObject) stopStream(audio.srcObject);
      audio.srcObject = null;
      audio.removeAttribute('src');
    });
    w.removeEventListener('pagehide', stop);
  }
  w.addEventListener('pagehide', stop);
  w.NoteworthyVoiceHost = {
    async start(options) {
      if (ended) throw aborted();
      if (!w.ElevenLabsStoryClient?.Conversation?.startSession) throw Error('ElevenLabs client failed to load');
      const created = options.onConversationCreated;
      const result = await w.ElevenLabsStoryClient.Conversation.startSession({
        ...options,
        onConversationCreated(value) {
          conversation = value;
          if (ended) quiet(() => value.endSession());
          else created?.(value);
        },
      });
      conversation = result;
      if (ended) { quiet(() => result.endSession()); throw aborted(); }
      return result;
    },
    stop,
  };
})(window);
