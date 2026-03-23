// Shadow DOM web component for Noteworthy Chat widget (JavaScript version)
// Professional dark mode design with state-of-the-art AI aesthetic

class NoteworthyChat extends HTMLElement {
  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.pos = { x: 24, y: 24 };
    this.size = { w: 420, h: 680 };
    this.dragging = false;
    this.resizing = false;
    this.start = null;
    this.startPos = null;
    this.startSize = null;
  }

  connectedCallback() {
    const endpoint = this.getAttribute('data-endpoint') || '/.netlify/functions/noteworthy-chat';
    const openOnLoad = this.getAttribute('data-open') === 'true';
    const initialAudioState = localStorage.getItem('noteworthy-ai-audio') === 'true';
    const brandTitle = (this.getAttribute('data-brand-title') || 'Noteworthy News AI').trim();
    const brandTitleAttr = brandTitle.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const brandTitleHtml = brandTitle
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Compute base path for assets - handles both file:// and http(s):// protocols
    const basePath = (() => {
      // Get the document's base URL
      const baseUrl = document.baseURI || window.location.href;
      // Extract the directory path (everything before the last /)
      const lastSlash = baseUrl.lastIndexOf('/');
      return lastSlash > 0 ? baseUrl.substring(0, lastSlash + 1) : '';
    })();
    const logoAttr = this.getAttribute('data-logo');
    const logoPath =
      logoAttr && logoAttr.trim()
        ? logoAttr.trim()
        : window.location.protocol === 'file:'
          ? basePath + 'IMG_5794.PNG'
          : '/IMG_5794.PNG';
    
    // Feature flag: Enable/disable ElevenLabs voices in UI
    // Set to true to show ElevenLabs voice options, false to hide them
    // Backend code remains functional regardless of this setting
    const ENABLE_ELEVENLABS_VOICES = false;
    const audioIconHTML = initialAudioState
      ? '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: currentColor;"><path d="M4 8v8h4l5 5V3L8 8H4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.12"/><path d="M15 10c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M17 6c3.3 0 6 2.7 6 6s-2.7 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M17 3c5 0 9 4 9 9s-4 9-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.7"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: rgba(255,255,255,0.5);"><path d="M4 8v8h4l5 5V3L8 8H4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.08" opacity="0.6"/><path d="M15 10c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.25"/><path d="M17 6c3.3 0 6 2.7 6 6s-2.7 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.25"/><path d="M17 3c5 0 9 4 9 9s-4 9-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.2"/><path d="M2 2l20 20" stroke="#ff4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="1"/><path d="M3 3l18 18" stroke="#ff6666" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/></svg>';

    // Declare voice-related variables early to avoid temporal dead zone errors
    // These are used in event handlers that are set up before the variables were previously declared
    let voiceModeActive = false;
    let currentVoice = 'alloy';
    let websocket = null;
    let audioContext = null;
    let voicePlaybackManager = null; // VoicePlaybackManager instance (legacy, being replaced)
    let voiceAudioEngine = null; // VoiceAudioEngine singleton - THE ONLY audio output engine
    let mediaStream = null;
    let voiceModeSpeechCheckInterval = null; // Interval to periodically cancel text-to-speech during voice mode
    let audioWorkletNode = null;
    let isRecording = false;
    let isMuted = false; // Track mute state
    // OLD: let audioQueue = []; // REMOVED - using voiceManager singleton only
    let musicStateBeforeCall = null; // Store music state when voice call starts
    let authRetryCount = 0; // Track authentication retry attempts
    const MAX_AUTH_RETRIES = 3; // Maximum authentication retries before giving up
    let connectionAttempts = []; // Track connection attempts for diagnostics
    const displayedTranscripts = new Set();
    let hasActiveResponse = false; // Track if there's an active response in progress
    let currentAudioGeneration = null; // Track current audio generation for streaming chunks (legacy)
    let activeResponseId = null; // Current response ID from response.created
    let activeGen = 0; // Current generation counter (increments on each new response)
    let voiceCallStartTime = null; // Track when voice call started
    let voiceCallTranscripts = []; // Track conversation transcripts during call
    const DEBUG_VOICE = typeof window !== 'undefined' && window.DEBUG_VOICE !== undefined 
      ? window.DEBUG_VOICE 
      : true; // Default to true for debugging

    this.root.innerHTML = `
      <style>
        :host { all: initial; display: block; }
        *, *::before, *::after { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; }
        
        .wrap { 
          position: fixed; 
          left: 24px; 
          top: 24px; 
          width: 420px; 
          min-width: 360px;
          height: 680px; 
          min-height: 600px;
          max-height: 90vh;
          max-width: 95vw; 
          max-height: 90vh;
          border-radius: 16px; 
          overflow: hidden; 
          z-index: 2147483000;
          background: linear-gradient(135deg, 
            rgba(18, 24, 38, 0.98) 0%, 
            rgba(15, 23, 42, 0.96) 50%,
            rgba(12, 19, 35, 0.98) 100%);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(74, 144, 226, 0.15);
          box-shadow: 
            0 24px 64px rgba(0, 0, 0, 0.4),
            0 8px 24px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 0 0 1px rgba(74, 144, 226, 0.1);
          display: none; 
          flex-direction: column;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
        }
        .wrap.open { 
          display: flex; 
          animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes slideUp {
          from { transform: translateY(20px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        
        .head { 
          cursor: grab; 
          user-select: none; 
          padding: 16px 20px;
          background: linear-gradient(135deg, 
            rgba(30, 41, 59, 0.95) 0%, 
            rgba(15, 23, 42, 0.98) 50%,
            rgba(30, 41, 59, 0.95) 100%);
          color: #fff;
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          gap: 12px;
          box-shadow: 
            0 2px 8px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 0 0 1px rgba(74, 144, 226, 0.2);
          border-bottom: 1px solid rgba(74, 144, 226, 0.1);
          position: relative;
        }
        .head::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, 
            transparent 0%, 
            rgba(74, 144, 226, 0.4) 50%, 
            transparent 100%);
        }
        .head:active { cursor: grabbing; }
        
        .head-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        
        .head-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .audio-toggle, .voice-input-toggle {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          transition: all 0.2s;
          padding: 0;
          line-height: 1;
        }
        
        .audio-toggle:hover, .voice-input-toggle:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
        }
        
        .audio-toggle.active {
          background: rgba(212, 160, 23, 0.3);
          border-color: #D4A017;
        }
        
        .voice-input-toggle.active {
          background: rgba(74, 144, 226, 0.3);
          border-color: #4A90E2;
          animation: pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .logo { 
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(30, 41, 59, 0.8);
          display: grid;
          place-items: center;
          flex-shrink: 0;
          box-shadow: 
            0 4px 12px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 0 0 1px rgba(74, 144, 226, 0.2);
          overflow: hidden;
          border: 1px solid rgba(74, 144, 226, 0.15);
        }
        .logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 4px;
        }
        
        .title-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .title { 
          font-size: 16px; 
          font-weight: 700; 
          line-height: 1.3; 
          margin: 0;
          color: #ffffff;
          letter-spacing: -0.3px;
          background: linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.9) 100%);
          -webkit-background-clip: text;
          background-clip: text;
        }
        
        .sub { 
          font-size: 11px; 
          opacity: 0.7; 
          line-height: 1.4;
          margin: 0;
          color: rgba(255, 255, 255, 0.7);
          pointer-events: none;
          user-select: none;
          letter-spacing: 0.2px;
          text-transform: uppercase;
          font-weight: 600;
        }
        
        .close { 
          border: none;
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.8);
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          margin: 0;
          border-radius: 8px;
          transition: all 0.2s;
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.05);
          text-align: center;
        }
        .close:hover { 
          background: rgba(255, 255, 255, 0.1); 
          transform: scale(1.1);
          color: #fff;
          border-color: rgba(74, 144, 226, 0.3);
        }
        .close:focus { outline: 2px solid rgba(74, 144, 226, 0.5); outline-offset: 2px; }
        
        .body { 
          flex: 1; 
          overflow-y: auto; 
          overflow-x: hidden;
          padding: 20px; 
          color: rgba(255, 255, 255, 0.9); 
          font-size: 14px; 
          line-height: 1.65; 
          background: transparent;
          scroll-behavior: smooth;
          position: relative;
        }
        
        .body.drag-over {
          background: rgba(74, 144, 226, 0.1);
        }
        
        .drag-drop-overlay {
          display: none;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(74, 144, 226, 0.15);
          backdrop-filter: blur(4px);
          border: 3px dashed rgba(74, 144, 226, 0.6);
          border-radius: 12px;
          z-index: 1000;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 16px;
          pointer-events: none;
        }
        
        .wrap.drag-over .drag-drop-overlay {
          display: flex;
        }
        
        .drag-drop-overlay-icon {
          font-size: 64px;
          animation: bounce 1s ease-in-out infinite;
        }
        
        .drag-drop-overlay-text {
          font-size: 24px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        
        .drag-drop-overlay-subtext {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .body::-webkit-scrollbar {
          width: 6px;
        }
        .body::-webkit-scrollbar-track {
          background: transparent;
        }
        .body::-webkit-scrollbar-thumb {
          background: rgba(74, 144, 226, 0.2);
          border-radius: 3px;
        }
        .body::-webkit-scrollbar-thumb:hover {
          background: rgba(74, 144, 226, 0.35);
        }
        
        .tip { 
          color: rgba(255, 255, 255, 0.6); 
          margin: 0;
          font-size: 13px;
          padding: 14px 16px;
          background: rgba(74, 144, 226, 0.08);
          border-radius: 12px;
          border-left: 3px solid rgba(74, 144, 226, 0.5);
          border: 1px solid rgba(74, 144, 226, 0.15);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .message-group {
          display: flex;
          gap: 12px;
          margin: 16px 0;
          align-items: flex-start;
        }
        
        .message-avatar {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 12px;
          overflow: hidden;
        }
        
        .user-msg-group .message-avatar {
          background: rgba(30, 41, 59, 0.8);
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
          border: 1px solid rgba(74, 144, 226, 0.2);
        }
        
        .ai-msg-group .message-avatar {
          background: rgba(30, 41, 59, 0.9);
          box-shadow: 
            0 2px 8px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(74, 144, 226, 0.2);
          border: 1px solid rgba(74, 144, 226, 0.2);
        }
        .ai-msg-group .message-avatar img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 4px;
        }
        
        .message-content {
          flex: 1;
          min-width: 0;
        }
        
        .user-msg {
          padding: 12px 16px;
          display: block;
          color: rgba(255, 255, 255, 0.95);
          font-size: 14px;
          line-height: 1.65;
          background: rgba(30, 41, 59, 0.6);
          border-radius: 12px 12px 12px 4px;
          color: rgba(255, 255, 255, 0.95);
          font-size: 14px;
          line-height: 1.65;
          border: 1px solid rgba(74, 144, 226, 0.2);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .reply { 
          padding: 14px 16px;
          background: rgba(30, 41, 59, 0.7);
          border-left: 3px solid rgba(74, 144, 226, 0.6);
          border-radius: 4px 12px 12px 12px;
          margin: 0;
          border: 1px solid rgba(74, 144, 226, 0.2);
          box-shadow: 
            0 2px 8px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(74, 144, 226, 0.1);
        }
        .reply p {
          margin: 0 0 12px 0;
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          line-height: 1.7;
        }
        .reply p:last-child {
          margin-bottom: 0;
        }
        
        .reply img {
          max-width: 100%;
          height: auto;
          border-radius: 12px;
          margin: 12px 0;
          box-shadow: 0 4px 12px rgba(0,0,0,.3);
          display: block;
        }
        
        .input { 
          padding: 16px 20px; 
          border-top: 1px solid rgba(74, 144, 226, 0.1); 
          background: linear-gradient(180deg, 
            rgba(15, 23, 42, 0.95) 0%,
            rgba(12, 19, 35, 0.98) 100%);
          backdrop-filter: blur(10px);
          display: flex; 
          gap: 12px; 
          box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.2);
          position: relative;
          transition: all 0.3s ease;
        }
        
        
        .input input[type="text"] { 
          flex: 1; 
          padding: 12px 16px; 
          border: 1.5px solid rgba(74, 144, 226, 0.2); 
          border-radius: 12px; 
          outline: none; 
          font-size: 14px;
          font-family: inherit;
          background: rgba(30, 41, 59, 0.6);
          color: rgba(255, 255, 255, 0.9);
          transition: all 0.2s;
        }
        .input input[type="text"]:focus {
          border-color: rgba(74, 144, 226, 0.5);
          background: rgba(30, 41, 59, 0.8);
          box-shadow: 
            0 0 0 4px rgba(74, 144, 226, 0.15),
            0 0 12px rgba(74, 144, 226, 0.2);
          color: #fff;
        }
        .input input[type="text"]::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        
        .input input[type="file"] {
          display: none !important;
        }
        
        .file-upload-btn {
          background: rgba(255, 255, 255, 0.15) !important;
          border: 1.5px solid rgba(255, 255, 255, 0.4) !important;
          color: rgba(255, 255, 255, 1) !important;
          width: 40px !important;
          height: 40px !important;
          border-radius: 12px;
          cursor: pointer;
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.2s;
          padding: 0;
          line-height: 1;
          flex-shrink: 0;
          position: relative;
          z-index: 10;
        }
        
        .file-upload-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
          border-color: rgba(74, 144, 226, 0.4);
        }
        
        .file-upload-btn:active {
          transform: scale(0.95);
        }
        
        .file-upload-btn svg {
          width: 20px !important;
          height: 20px !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: none;
          flex-shrink: 0;
        }
        
        .file-upload-btn svg path {
          stroke: #FFFFFF !important;
          stroke-width: 2 !important;
          fill: none !important;
        }
        
        .voice-mode-toggle {
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.25) 0%, rgba(74, 144, 226, 0.15) 100%) !important;
          border: 1.5px solid rgba(74, 144, 226, 0.6) !important;
          color: #4A90E2 !important;
          width: 40px !important;
          height: 40px !important;
          border-radius: 12px;
          cursor: pointer;
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.2s;
          padding: 0;
          line-height: 1;
          flex-shrink: 0;
          position: relative;
          z-index: 10;
        }
        
        .voice-mode-toggle:hover {
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.25) 0%, rgba(74, 144, 226, 0.15) 100%);
          transform: scale(1.1);
          border-color: #4A90E2;
          box-shadow: 0 4px 12px rgba(74, 144, 226, 0.4);
        }
        
        .voice-mode-toggle.active {
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.4) 0%, rgba(74, 144, 226, 0.3) 100%);
          border-color: #4A90E2;
          color: #4A90E2;
          animation: pulse 2s infinite;
          box-shadow: 0 0 0 4px rgba(74, 144, 226, 0.3);
        }
        
        .voice-mode-toggle svg {
          width: 20px !important;
          height: 20px !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: none;
          flex-shrink: 0;
        }
        
        .voice-mode-toggle svg path {
          stroke: #4A90E2 !important;
          stroke-width: 2 !important;
        }
        
        .voice-mode-toggle svg path[fill] {
          fill: #4A90E2 !important;
          fill-opacity: 0.2 !important;
        }
        
        /* Expanded chat for voice mode */
        .wrap.voice-mode-active {
          min-height: 600px !important;
          height: auto !important;
        }
        
        .wrap.voice-mode-active .input {
          flex-wrap: wrap;
          gap: 8px;
          padding: 16px 20px;
        }
        
        
        .wrap.voice-mode-active #chatInput {
          flex: 1 1 200px;
          min-width: 200px;
        }
        
        .wrap.voice-mode-active #sendButton {
          flex: 0 0 auto;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        /* Integrated Voice Control - Scrollable & Seamless */
        .voice-control-integrated {
          border-top: 1px solid rgba(74, 144, 226, 0.15);
          background: linear-gradient(180deg, 
            rgba(15, 23, 42, 0.6) 0%,
            rgba(12, 19, 35, 0.8) 100%);
          backdrop-filter: blur(10px);
          overflow: hidden;
          transition: all 0.3s ease;
          max-height: 0;
          opacity: 0;
        }
        
        .voice-control-integrated.expanded {
          max-height: 450px;
          opacity: 1;
        }
        
        .voice-control-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          cursor: pointer;
          user-select: none;
          transition: background 0.2s;
        }
        
        .voice-control-header:hover {
          background: rgba(74, 144, 226, 0.08);
        }
        
        .voice-control-title {
          display: flex;
          align-items: center;
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          letter-spacing: -0.01em;
        }
        
        .voice-control-toggle {
          width: 24px;
          height: 24px;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s, color 0.2s;
          border-radius: 6px;
        }
        
        .voice-control-toggle:hover {
          color: rgba(255, 255, 255, 0.9);
          background: rgba(255, 255, 255, 0.1);
        }
        
        .voice-control-integrated.expanded .voice-control-toggle {
          transform: rotate(180deg);
        }
        
        .voice-control-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease;
        }
        
        .voice-control-integrated.expanded .voice-control-content {
          max-height: 400px;
        }
        
        .voice-list-container {
          max-height: 220px;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 8px 0;
        }
        
        .voice-list-container::-webkit-scrollbar {
          width: 6px;
        }
        
        .voice-list-container::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        
        .voice-list-container::-webkit-scrollbar-thumb {
          background: rgba(74, 144, 226, 0.4);
          border-radius: 3px;
        }
        
        .voice-list-container::-webkit-scrollbar-thumb:hover {
          background: rgba(74, 144, 226, 0.6);
        }
        
        .voice-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 0 20px;
        }
        
        .voice-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
          border: 1px solid transparent;
          position: relative;
        }
        
        .voice-option:hover {
          background: rgba(74, 144, 226, 0.1);
          border-color: rgba(74, 144, 226, 0.2);
          transform: translateX(4px);
        }
        
        .voice-option.active {
          background: rgba(74, 144, 226, 0.15);
          border-color: rgba(74, 144, 226, 0.4);
        }
        
        .voice-option.active .voice-check {
          opacity: 1;
          color: #4A90E2;
        }
        
        .voice-name {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          flex: 1;
        }
        
        .voice-desc {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          margin-left: 12px;
          flex: 1;
        }
        
        .voice-check {
          width: 18px;
          height: 18px;
          opacity: 0;
          transition: opacity 0.2s;
          color: #4A90E2;
          flex-shrink: 0;
        }
        .voice-option.voice-elevenlabs {
          position: relative;
          border-left: 3px solid #FF6B35;
        }
        .voice-option.voice-elevenlabs.hidden {
          display: none !important;
        }
        .voice-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
          color: white;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .voice-label-integrated {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0 20px 8px 20px;
          margin-top: 8px;
        }
        
        .voice-status-integrated {
          padding: 12px 20px;
          border-top: 1px solid rgba(74, 144, 226, 0.15);
          border-bottom: 1px solid rgba(74, 144, 226, 0.15);
          margin: 8px 0;
        }
        
        .voice-status-indicator-integrated {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
        }
        
        .status-dot-integrated {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.5);
          animation: blink 1.5s infinite;
        }
        
        .voice-status-integrated.recording .status-dot-integrated {
          background: #4A90E2;
          box-shadow: 0 0 8px rgba(74, 144, 226, 0.6);
        }
        
        .voice-status-integrated.error .status-dot-integrated {
          background: #b00020;
          box-shadow: 0 0 8px rgba(176, 0, 32, 0.6);
        }
        
        .voice-actions-integrated {
          display: flex !important;
          flex-direction: column;
          gap: 8px;
          padding: 12px 20px;
          visibility: visible !important;
          opacity: 1 !important;
          min-height: 60px;
        }
        
        /* Ensure button is always visible when panel is expanded */
        .voice-control-integrated.expanded .voice-actions-integrated {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        .voice-action-hint {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
          text-align: center;
          font-weight: 500;
          margin-bottom: 4px;
        }
        
        .voice-action-integrated {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          outline: none;
        }
        
        .voice-action-integrated svg {
          width: 16px;
          height: 16px;
        }
        
        .voice-action-start {
          background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
          color: white;
          box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);
          font-weight: 700;
          font-size: 14px;
          padding: 12px 20px;
        }
        
        .voice-action-start:hover {
          background: linear-gradient(135deg, #5BA0F2 0%, #4A90E2 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(74, 144, 226, 0.5);
        }
        
        .voice-action-start:active {
          transform: translateY(0);
        }
        
        .voice-action-stop {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
          border: 1.5px solid rgba(255, 255, 255, 0.2);
        }
        
        .voice-action-stop:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
        }
        
        /* Premium Secure Briefing UI - Intel Dashboard Aesthetic */
        .voice-call-panel {
          position: fixed;
          right: 24px;
          top: 50%;
          transform: translateY(-50%);
          width: 380px;
          min-height: 480px;
          background: linear-gradient(135deg, 
            rgba(8, 12, 22, 0.95) 0%, 
            rgba(5, 9, 18, 0.98) 50%,
            rgba(8, 12, 22, 0.95) 100%);
          backdrop-filter: blur(32px) saturate(180%);
          -webkit-backdrop-filter: blur(32px) saturate(180%);
          border: 1px solid rgba(74, 144, 226, 0.15);
          border-radius: 28px;
          box-shadow: 
            0 32px 80px rgba(0, 0, 0, 0.6),
            0 12px 32px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            inset 0 -1px 0 rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(74, 144, 226, 0.1);
          z-index: 2147482999;
          display: none;
          flex-direction: column;
          padding: 36px 32px;
          gap: 32px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          opacity: 0;
          transform: translateY(-50%) translateX(20px) scale(0.95);
          cursor: default;
        }
        
        .voice-call-panel.dragging {
          transition: none;
          cursor: grabbing;
        }
        
        .voice-call-header {
          cursor: grab;
          user-select: none;
        }
        
        .voice-call-header:active {
          cursor: grabbing;
        }
        
        .voice-call-panel.show {
          display: flex !important;
          opacity: 1 !important;
          transform: translateY(-50%) translateX(0) scale(1);
        }
        
        /* Header with title and status chip */
        .voice-call-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .voice-call-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }
        
        .voice-call-title {
          font-size: 18px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          letter-spacing: -0.03em;
          margin: 0;
        }
        
        .voice-status-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.7);
          transition: all 0.3s ease;
        }
        
        .voice-status-chip.listening {
          background: rgba(74, 144, 226, 0.15);
          border-color: rgba(74, 144, 226, 0.3);
          color: rgba(147, 197, 253, 0.9);
        }
        
        .voice-status-chip.speaking {
          background: rgba(212, 160, 23, 0.15);
          border-color: rgba(212, 160, 23, 0.3);
          color: rgba(252, 211, 77, 0.9);
        }
        
        .voice-status-chip.processing {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.8);
        }
        
        .voice-status-chip.error {
          background: rgba(220, 38, 38, 0.15);
          border-color: rgba(220, 38, 38, 0.3);
          color: rgba(248, 113, 113, 0.9);
        }
        
        .status-chip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: statusPulse 2s ease-in-out infinite;
        }
        
        @keyframes statusPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.9); }
        }
        
        .status-chip-text {
          font-size: 10px;
        }
        
        /* Orb/Core Container */
        .voice-orb-container {
          position: relative;
          width: 320px;
          height: 320px;
          margin: 0 auto 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        /* Outer ring with gradient */
        .orb-outer-ring {
          position: absolute;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          border: 2px solid transparent;
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.2), rgba(212, 160, 23, 0.2)) padding-box,
                      linear-gradient(135deg, rgba(74, 144, 226, 0.4), rgba(212, 160, 23, 0.4)) border-box;
          opacity: 0.6;
          transition: all 0.4s ease;
        }
        
        .voice-orb-container.listening .orb-outer-ring {
          animation: orbRingPulse 2.5s ease-in-out infinite;
          box-shadow: 0 0 24px rgba(74, 144, 226, 0.3);
        }
        
        .voice-orb-container.speaking .orb-outer-ring {
          box-shadow: 0 0 32px rgba(212, 160, 23, 0.4);
        }
        
        @keyframes orbRingPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        
        /* Waveform rings for speaking state */
        .voice-waveform-rings {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 480px;
          height: 480px;
          z-index: 1;
          pointer-events: none;
        }
        
        .waveform-ring {
          transform-origin: center;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        
        /* Processing spinner ring */
        .orb-processing-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 270px;
          height: 270px;
          border-radius: 50%;
          border: 2px dashed rgba(255, 255, 255, 0.3);
          border-top-color: rgba(212, 160, 23, 0.6);
          animation: processingRotate 2s linear infinite;
          z-index: 1;
        }
        
        @keyframes processingRotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        
        /* Inner core with NW logo */
        .orb-core {
          position: relative;
          width: 280px;
          height: 280px;
          border-radius: 50%;
          background: linear-gradient(135deg, 
            rgba(212, 160, 23, 0.2) 0%, 
            rgba(212, 160, 23, 0.1) 100%);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 2px solid rgba(212, 160, 23, 0.3);
          box-shadow: 
            0 8px 24px rgba(0, 0, 0, 0.4),
            inset 0 2px 8px rgba(255, 255, 255, 0.1),
            inset 0 -2px 8px rgba(0, 0, 0, 0.2),
            0 0 0 1px rgba(212, 160, 23, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .voice-orb-container.listening .orb-core {
          animation: orbBreathing 2.5s ease-in-out infinite;
          box-shadow: 
            0 8px 24px rgba(0, 0, 0, 0.4),
            0 0 0 4px rgba(74, 144, 226, 0.3),
            0 0 32px rgba(74, 144, 226, 0.4),
            inset 0 2px 8px rgba(255, 255, 255, 0.1),
            inset 0 -2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .voice-orb-container.speaking .orb-core {
          box-shadow: 
            0 8px 24px rgba(0, 0, 0, 0.4),
            0 0 0 4px rgba(212, 160, 23, 0.4),
            0 0 40px rgba(212, 160, 23, 0.5),
            inset 0 2px 8px rgba(255, 255, 255, 0.15),
            inset 0 -2px 8px rgba(0, 0, 0, 0.2);
        }
        
        @keyframes orbBreathing {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        
        .orb-logo {
          width: 320px;
          height: 320px;
          object-fit: contain;
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
          z-index: 3;
          position: relative;
        }
        
        .orb-inner-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: radial-gradient(circle at center, rgba(212, 160, 23, 0.2) 0%, transparent 70%);
          z-index: 1;
        }
        
        /* Listening halo */
        .orb-listening-halo {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(74, 144, 226, 0.15) 0%, transparent 70%);
          animation: haloRipple 3s ease-in-out infinite;
          z-index: 0;
        }
        
        @keyframes haloRipple {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.3; }
        }
        
        /* Status text group */
        .voice-status-text-group {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .voice-status-primary {
          font-size: 17px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          letter-spacing: -0.02em;
          transition: color 0.3s ease;
        }
        
        .voice-status-primary.listening {
          color: rgba(147, 197, 253, 1);
        }
        
        .voice-status-primary.speaking {
          color: rgba(252, 211, 77, 1);
        }
        
        .voice-status-primary.processing {
          color: rgba(255, 255, 255, 0.9);
        }
        
        .voice-status-secondary {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          letter-spacing: 0.02em;
        }
        
        /* Controls */
        .voice-controls {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: center;
          margin-top: auto;
        }
        
        .voice-control-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.8);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 44px;
        }
        
        .voice-control-btn svg {
          width: 18px;
          height: 18px;
        }
        
        .voice-control-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }
        
        .voice-control-btn:active {
          transform: translateY(0) scale(0.98);
        }
        
        .voice-control-btn:focus {
          outline: 2px solid rgba(74, 144, 226, 0.5);
          outline-offset: 2px;
        }
        
        .voice-control-end {
          background: rgba(220, 38, 38, 0.15);
          border-color: rgba(220, 38, 38, 0.3);
          color: rgba(248, 113, 113, 0.9);
        }
        
        .voice-control-end:hover {
          background: rgba(220, 38, 38, 0.25);
          border-color: rgba(220, 38, 38, 0.5);
          color: rgba(248, 113, 113, 1);
        }
        
        /* CRITICAL: Ensure End Call button is ALWAYS visible when panel is shown */
        .voice-call-panel.show #voiceCallEndBtn,
        .voice-call-panel.show #voiceControlMute {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        /* Always show mute button when voice panel is active */
        #voiceControlMute {
          display: flex !important;
        }
        
        .voice-control-mute.muted {
          background: rgba(255, 100, 100, 0.2);
          border-color: rgba(255, 100, 100, 0.4);
        }
        
        .voice-control-mute.muted .mute-icon {
          display: none;
        }
        
        .voice-control-mute.muted .unmute-icon {
          display: block;
        }
        
        .voice-control-mute:not(.muted) .mute-icon {
          display: block;
        }
        
        .voice-control-mute:not(.muted) .unmute-icon {
          display: none;
        }
        
        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .orb-outer-ring,
          .orb-core,
          .orb-listening-halo,
          .orb-processing-ring,
          .status-chip-dot {
            animation: none !important;
          }
          
          .voice-orb-container.listening .orb-core,
          .voice-orb-container.speaking .orb-core {
            animation: none !important;
          }
        }
        
        @media (max-width: 768px) {
          .voice-call-panel {
            right: 12px;
            width: calc(100vw - 24px);
            max-width: 360px;
            min-height: 420px;
            padding: 28px 24px;
            gap: 28px;
          }
          
          .voice-orb-container {
            width: 140px;
            height: 140px;
            margin-bottom: 28px;
          }
          
          .orb-core {
            width: 100px;
            height: 100px;
          }
          
          .voice-orb-container {
            width: 200px;
            height: 200px;
          }
          
          .orb-outer-ring {
            width: 260px;
            height: 260px;
          }
          
          .orb-core {
            width: 240px;
            height: 240px;
          }
          
          .orb-logo {
            width: 260px;
            height: 260px;
          }
          
          .voice-orb-container {
            width: 260px;
            height: 260px;
          }
          
          .voice-waveform-rings {
            width: 400px;
            height: 400px;
          }
          
          .orb-processing-ring {
            width: 225px;
            height: 225px;
          }
          
          .orb-listening-halo {
            width: 250px;
            height: 250px;
          }
          
          .voice-controls {
            flex-direction: column;
            gap: 10px;
          }
          
          .voice-control-btn {
            width: 100%;
          }
        }
        
        .voice-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.15) 0%, rgba(74, 144, 226, 0.05) 100%);
          border-bottom: 1px solid rgba(74, 144, 226, 0.2);
        }
        
        .voice-panel-title {
          display: flex;
          align-items: center;
          font-size: 16px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
          letter-spacing: -0.02em;
        }
        
        .voice-panel-close {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .voice-panel-close:hover {
          background: rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 1);
          transform: scale(1.1);
        }
        
        .voice-panel-content {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .voice-selector-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .voice-selector-label {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .voice-selector-label > span:first-child {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          letter-spacing: -0.01em;
        }
        
        .voice-selector-subtitle {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 400;
        }
        
        .voice-select-wrapper {
          position: relative;
        }
        
        .voice-select {
          width: 100%;
          padding: 12px 40px 12px 16px;
          border: 1.5px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          font-size: 14px;
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.95);
          cursor: pointer;
          outline: none;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .voice-select:hover {
          border-color: rgba(74, 144, 226, 0.4);
          background: rgba(255, 255, 255, 0.08);
        }
        
        .voice-select:focus {
          border-color: #4A90E2;
          background: rgba(255, 255, 255, 0.1);
          box-shadow: 0 0 0 4px rgba(74, 144, 226, 0.15);
        }
        
        .voice-select-arrow {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          color: rgba(255, 255, 255, 0.6);
          pointer-events: none;
          transition: transform 0.2s;
        }
        
        .voice-select-wrapper:hover .voice-select-arrow {
          color: rgba(255, 255, 255, 0.9);
        }
        
        .voice-status-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 16px;
          background: rgba(74, 144, 226, 0.08);
          border: 1px solid rgba(74, 144, 226, 0.2);
          border-radius: 12px;
        }
        
        .voice-status-header {
          display: flex;
          align-items: center;
          margin-bottom: 4px;
        }
        
        .voice-status-label {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .voice-status {
          display: flex;
          align-items: center;
        }
        
        .voice-status-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
        }
        
        .voice-status.recording .voice-status-indicator {
          color: #4A90E2;
        }
        
        .voice-status.error .voice-status-indicator {
          color: #b00020;
        }
        
        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: currentColor;
          animation: blink 1.5s infinite;
          box-shadow: 0 0 8px currentColor;
        }
        
        .voice-status.recording .status-dot {
          background: #4A90E2;
          box-shadow: 0 0 12px rgba(74, 144, 226, 0.6);
        }
        
        .voice-status.error .status-dot {
          background: #b00020;
          box-shadow: 0 0 12px rgba(176, 0, 32, 0.6);
        }
        
        .voice-panel-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 4px;
        }
        
        .voice-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          outline: none;
        }
        
        .voice-action-btn svg {
          width: 18px;
          height: 18px;
        }
        
        .voice-action-primary {
          background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
        }
        
        .voice-action-primary:hover {
          background: linear-gradient(135deg, #5BA0F2 0%, #4A90E2 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(74, 144, 226, 0.4);
        }
        
        .voice-action-primary:active {
          transform: translateY(0);
        }
        
        .voice-action-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
          border: 1.5px solid rgba(255, 255, 255, 0.2);
        }
        
        .voice-action-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }
        
        .voice-action-secondary:active {
          transform: translateY(0);
        }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        
        .input button { 
          padding: 12px 20px; 
          border-radius: 12px; 
          font-weight: 700; 
          border: none; 
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.9) 0%, rgba(42, 96, 176, 0.9) 100%);
          color: #fff; 
          box-shadow: 
            0 4px 12px rgba(74, 144, 226, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
          cursor: pointer;
          font-size: 14px;
          font-family: inherit;
          transition: all 0.2s;
          white-space: nowrap;
          border: 1px solid rgba(74, 144, 226, 0.3);
        }
        .input button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 
            0 6px 16px rgba(74, 144, 226, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.25);
          background: linear-gradient(135deg, rgba(91, 160, 242, 0.95) 0%, rgba(58, 112, 192, 0.95) 100%);
        }
        .input button:active:not(:disabled) {
          transform: translateY(0);
        }
        .input button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }
        .input button:focus {
          outline: 2px solid rgba(74, 144, 226, 0.5);
          outline-offset: 2px;
        }
        
        .file-preview {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(74, 144, 226, 0.1);
          border: 1px solid rgba(74, 144, 226, 0.3);
          border-radius: 8px;
          margin-bottom: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.9);
        }
        
        .file-preview img {
          width: 40px;
          height: 40px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid rgba(74, 144, 226, 0.3);
        }
        
        .file-preview .file-info {
          flex: 1;
          min-width: 0;
        }
        
        .file-preview .file-name {
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .file-preview .file-size {
          font-size: 11px;
          opacity: 0.7;
        }
        
        .file-preview .remove-file {
          background: rgba(255, 107, 107, 0.2);
          border: 1px solid rgba(255, 107, 107, 0.4);
          color: #ff6b6b;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          transition: all 0.2s;
          padding: 0;
          line-height: 1;
        }
        
        .file-preview .remove-file:hover {
          background: rgba(255, 107, 107, 0.3);
          transform: scale(1.1);
        }
        
        .user-msg .uploaded-image {
          max-width: 100%;
          max-height: 300px;
          border-radius: 8px;
          margin: 8px 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          display: block;
        }
        
        .resize-handle {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 24px;
          height: 24px;
          cursor: nwse-resize;
          z-index: 10;
          background: linear-gradient(135deg, transparent 40%, rgba(74, 144, 226, 0.2) 40%, rgba(74, 144, 226, 0.2) 45%, transparent 45%, transparent 55%, rgba(74, 144, 226, 0.2) 55%, rgba(74, 144, 226, 0.2) 60%, transparent 60%);
          border-radius: 8px 0 0 0;
        }
        .resize-handle:hover {
          background: linear-gradient(135deg, transparent 40%, rgba(74, 144, 226, 0.4) 40%, rgba(74, 144, 226, 0.4) 45%, transparent 45%, transparent 55%, rgba(74, 144, 226, 0.4) 55%, rgba(74, 144, 226, 0.4) 60%, transparent 60%);
        }
        
        .launcher { 
          position: fixed; 
          right: 24px; 
          bottom: 24px; 
          z-index: 2147482999;
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%);
          color: #fff;
          border: 1.5px solid rgba(74, 144, 226, 0.3);
          border-radius: 14px;
          padding: 16px 24px;
          font-weight: 700;
          font-size: 15px;
          box-shadow: 
            0 12px 32px rgba(0, 0, 0, 0.4),
            0 4px 16px rgba(0, 0, 0, 0.3),
            0 0 0 0 rgba(74, 144, 226, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          cursor: pointer;
          font-family: inherit;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          gap: 12px;
          animation: pulse-glow 3s ease-in-out infinite;
        }
        @keyframes pulse-glow {
          0%, 100% { 
            box-shadow: 
              0 12px 32px rgba(0, 0, 0, 0.4),
              0 4px 16px rgba(0, 0, 0, 0.3),
              0 0 0 0 rgba(74, 144, 226, 0.4),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
          }
          50% { 
            box-shadow: 
              0 12px 32px rgba(0, 0, 0, 0.5),
              0 4px 16px rgba(0, 0, 0, 0.4),
              0 0 0 8px rgba(74, 144, 226, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.15);
            border-color: rgba(74, 144, 226, 0.5);
          }
        }
        .launcher:hover {
          transform: translateY(-4px) scale(1.03);
          box-shadow: 
            0 16px 40px rgba(0, 0, 0, 0.5),
            0 6px 20px rgba(0, 0, 0, 0.4),
            0 0 0 4px rgba(74, 144, 226, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
          background: linear-gradient(135deg, rgba(37, 51, 70, 0.98) 0%, rgba(20, 30, 48, 1) 100%);
          border-color: rgba(74, 144, 226, 0.5);
        }
        .launcher:active {
          transform: translateY(-2px) scale(1.01);
        }
        .launcher:focus {
          outline: 3px solid rgba(74, 144, 226, 0.4);
          outline-offset: 4px;
        }
        .launcher-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.9;
        }
        .launcher-icon img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        
        .thinking.searching {
          background: rgba(212, 160, 23, 0.15);
          border-color: rgba(212, 160, 23, 0.3);
          animation: searchPulse 2s ease-in-out infinite;
        }
        
        @keyframes searchPulse {
          0%, 100% { 
            box-shadow: 0 0 0 0 rgba(212, 160, 23, 0.4);
          }
          50% { 
            box-shadow: 0 0 20px 4px rgba(212, 160, 23, 0.6);
          }
        }
        
        .search-icon {
          font-size: 20px;
          animation: searchRotate 2s linear infinite;
        }
        
        @keyframes searchRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .search-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(212, 160, 23, 0.3);
          border-top-color: rgba(212, 160, 23, 0.9);
          border-radius: 50%;
          animation: searchRotate 1s linear infinite;
          margin-right: 8px;
          vertical-align: middle;
        }
        
        .search-indicator-group {
          animation: slideInSearch 0.3s ease-out;
        }
        
        @keyframes slideInSearch {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: rgba(74, 144, 226, 0.1);
          border: 1px solid rgba(74, 144, 226, 0.3);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 2px 8px rgba(74, 144, 226, 0.2);
        }
        
        .thinking.generating-image {
          background: rgba(74, 144, 226, 0.15);
          border-color: rgba(74, 144, 226, 0.4);
          color: rgba(255, 255, 255, 0.95);
          box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);
        }
        
        .thinking.generating-image .spinner {
          border-color: rgba(74, 144, 226, 0.2);
          border-bottom-color: rgba(74, 144, 226, 0.9);
        }
        
        .spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 3px solid rgba(74, 144, 226, 0.2);
          border-bottom-color: rgba(74, 144, 226, 0.9);
          animation: spin .8s linear infinite;
          flex-shrink: 0;
        }
        
        .thinking-icon {
          font-size: 18px;
          flex-shrink: 0;
          pointer-events: none;
          user-select: none;
          cursor: default;
        }
        
        .error {
          color: #ff6b6b;
          background: rgba(255, 107, 107, 0.1);
          border-left: 3px solid rgba(255, 107, 107, 0.5);
          padding: 12px 16px;
          border-radius: 12px;
          margin: 12px 0;
          font-size: 14px;
          line-height: 1.6;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 107, 107, 0.2);
        }
        
        .rate-limit-error {
          background: rgba(255, 152, 0, 0.15);
          border-left-color: #ff9800;
          border-color: rgba(255, 152, 0, 0.3);
          color: #e65100;
        }
        
        .rate-limit-error strong {
          display: block;
          margin-bottom: 6px;
          font-size: 15px;
          font-weight: 700;
        }
        
        .rate-limit-error p {
          margin: 4px 0;
          font-size: 13px;
          line-height: 1.5;
        }
        
        
        @keyframes spin { 
          to { transform: rotate(360deg); } 
        }
        
        @keyframes image-pulse-glow {
          0%, 100% { 
            box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);
          }
          50% { 
            box-shadow: 0 2px 12px rgba(74, 144, 226, 0.5), 0 0 8px rgba(74, 144, 226, 0.4);
          }
        }
        
        .thinking.generating-image {
          animation: image-pulse-glow 2s ease-in-out infinite;
        }
        
        @media (max-width: 768px) {
          .wrap {
            width: calc(100vw - 32px) !important;
            max-width: calc(100vw - 32px) !important;
            height: 70vh !important;
            max-height: 70vh !important;
            min-height: 600px !important;
            left: 16px !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            border-radius: 20px !important;
            min-width: calc(100vw - 32px) !important;
          }
          
          .wrap.open {
            transform: translateY(-50%) !important;
          }
          
          .launcher {
            right: 12px;
            bottom: 12px;
            padding: 14px 20px;
            font-size: 14px;
          }
          
          .resize-handle {
            display: none;
          }
          
          .head {
            padding: 14px 16px;
          }
          
          .body {
            padding: 16px;
          }
          
          .input {
            padding: 14px 16px;
          }
          
          .message-group {
            gap: 10px;
          }
          
          .message-avatar {
            width: 32px;
            height: 32px;
            font-size: 11px;
          }
        }
        
        @media (max-width: 480px) {
          .wrap {
            width: calc(100vw - 24px) !important;
            max-width: calc(100vw - 24px) !important;
            height: 70vh !important;
            max-height: 70vh !important;
            min-height: 350px !important;
            left: 12px !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
          }
          
          .wrap.open {
            transform: translateY(-50%) !important;
          }
          
          .head {
            padding: 12px 14px;
          }
          
          .body {
            padding: 14px;
            font-size: 13px;
          }
          
          .input {
            padding: 12px 14px;
          }
          
          .input input {
            padding: 10px 14px;
            font-size: 13px;
          }
          
          .input button {
            padding: 10px 16px;
            font-size: 13px;
          }
        }
        
        @media (min-width: 769px) and (max-width: 1024px) {
          .wrap {
            max-width: 90vw;
            max-height: 85vh;
          }
        }
        
        /* Tutorial Modal Styles */
        .tutorial-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 2147483001;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .tutorial-overlay.show {
          display: flex;
        }
        
        .tutorial-modal {
          background: linear-gradient(135deg, 
            rgba(18, 24, 38, 0.98) 0%, 
            rgba(15, 23, 42, 0.96) 50%,
            rgba(12, 19, 35, 0.98) 100%);
          border: 1.5px solid rgba(74, 144, 226, 0.3);
          border-radius: 24px;
          max-width: 680px;
          width: 100%;
          max-height: 90vh;
          height: auto;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 
            0 24px 64px rgba(0, 0, 0, 0.5),
            0 8px 24px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 0 0 1px rgba(74, 144, 226, 0.1);
          animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }
        
        .tutorial-modal::-webkit-scrollbar {
          width: 8px;
        }
        
        .tutorial-modal::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .tutorial-modal::-webkit-scrollbar-thumb {
          background: rgba(74, 144, 226, 0.3);
          border-radius: 4px;
        }
        
        .tutorial-modal::-webkit-scrollbar-thumb:hover {
          background: rgba(74, 144, 226, 0.5);
        }
        
        .tutorial-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 28px 32px;
          border-bottom: 1px solid rgba(74, 144, 226, 0.15);
          background: linear-gradient(135deg, 
            rgba(30, 41, 59, 0.95) 0%, 
            rgba(15, 23, 42, 0.98) 50%,
            rgba(30, 41, 59, 0.95) 100%);
          flex-shrink: 0;
          border-radius: 24px 24px 0 0;
        }
        
        .tutorial-header h2 {
          margin: 0;
          color: #fff;
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #ffffff 0%, rgba(74, 144, 226, 0.9) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .tutorial-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
        }
        
        .tutorial-header-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: rgba(212,160,23,.2);
          border: 1px solid rgba(212,160,23,.4);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #F4C430;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .tutorial-skip {
          background: transparent;
          border: 1px solid rgba(255,255,255,.3);
          color: rgba(255,255,255,.9);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 8px;
          transition: all 0.2s;
          flex-shrink: 0;
          margin-right: 8px;
        }
        
        .tutorial-skip:hover {
          background: rgba(255,255,255,.15);
          border-color: rgba(255,255,255,.5);
        }
        
        .tutorial-close {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          transition: all 0.2s ease;
        }
        
        .tutorial-close:hover {
          background: rgba(255, 107, 107, 0.2);
          border-color: rgba(255, 107, 107, 0.4);
          color: #ff6b6b;
          transform: rotate(90deg) scale(1.1);
        }
        
        .tutorial-close:active {
          transform: rotate(90deg) scale(0.95);
        }
        
        .tutorial-content {
          padding: 32px;
          padding-bottom: 32px; /* Reduced padding to eliminate dead space */
          overflow-y: auto;
          flex: 1 1 auto;
          min-height: 0;
          max-height: 100%;
        }
        
        .tutorial-intro {
          margin-bottom: 32px;
          padding: 20px 24px;
          background: linear-gradient(135deg, 
            rgba(74, 144, 226, 0.12) 0%, 
            rgba(74, 144, 226, 0.08) 100%);
          border: 1px solid rgba(74, 144, 226, 0.2);
          border-radius: 16px;
          border-left: 4px solid rgba(74, 144, 226, 0.6);
        }
        
        .tutorial-intro p {
          margin: 0;
          color: rgba(255, 255, 255, 0.9);
          font-size: 15px;
          line-height: 1.7;
        }
        
        .tutorial-steps {
          display: grid;
          gap: 20px;
        }
        
        .tutorial-step {
          padding: 24px;
          background: linear-gradient(135deg, 
            rgba(74, 144, 226, 0.08) 0%, 
            rgba(74, 144, 226, 0.05) 100%);
          border: 1px solid rgba(74, 144, 226, 0.2);
          border-radius: 16px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        
        .tutorial-step::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, 
            transparent 0%, 
            rgba(74, 144, 226, 0.6) 50%, 
            transparent 100%);
          transform: scaleX(0);
          transition: transform 0.3s ease;
        }
        
        .tutorial-step:hover {
          background: linear-gradient(135deg, 
            rgba(74, 144, 226, 0.15) 0%, 
            rgba(74, 144, 226, 0.1) 100%);
          border-color: rgba(74, 144, 226, 0.4);
          transform: translateY(-3px);
          box-shadow: 
            0 8px 24px rgba(74, 144, 226, 0.2),
            0 0 0 1px rgba(74, 144, 226, 0.1);
        }
        
        .tutorial-step:hover::before {
          transform: scaleX(1);
        }
        
        .tutorial-step-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 14px;
          cursor: pointer;
        }
        
        .tutorial-step-toggle {
          background: transparent;
          border: none;
          color: rgba(255,255,255,.6);
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
          margin-left: auto;
        }
        
        .tutorial-step.expanded .tutorial-step-toggle {
          transform: rotate(180deg);
        }
        
        .tutorial-step-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .tutorial-step.expanded .tutorial-step-content {
          max-height: 500px;
        }
        
        .tutorial-specs {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 20px;
        }
        
        .tutorial-spec {
          padding: 10px 12px;
          background: rgba(74, 144, 226, 0.08);
          border-radius: 10px;
          border: 1px solid rgba(74, 144, 226, 0.15);
        }
        
        .tutorial-spec-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,.6);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        
        .tutorial-spec-value {
          font-size: 14px;
          font-weight: 700;
          color: rgba(255,255,255,.95);
          font-family: 'Monaco', 'Menlo', monospace;
        }
        
        .tutorial-shortcuts {
          margin-top: 16px;
          padding: 14px;
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.12) 0%, rgba(46, 204, 113, 0.08) 100%);
          border-radius: 12px;
          border: 1px solid rgba(74, 144, 226, 0.2);
        }
        
        .tutorial-shortcuts h4 {
          margin: 0 0 10px 0;
          font-size: 13px;
          font-weight: 700;
          color: rgba(74, 144, 226, 1);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .tutorial-shortcuts-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        
        .tutorial-shortcut {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 6px;
          font-size: 12px;
          color: rgba(255,255,255,.85);
        }
        
        .tutorial-shortcut-key {
          font-family: 'Monaco', 'Menlo', monospace;
          background: rgba(74, 144, 226, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          color: rgba(74, 144, 226, 1);
        }
        
        .tutorial-icon {
          font-size: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, 
            rgba(74, 144, 226, 0.2) 0%, 
            rgba(74, 144, 226, 0.1) 100%);
          border-radius: 14px;
          border: 1px solid rgba(74, 144, 226, 0.3);
          flex-shrink: 0;
          filter: drop-shadow(0 2px 8px rgba(74, 144, 226, 0.2));
        }
        
        .tutorial-step h3 {
          margin: 0;
          color: #fff;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.3px;
        }
        
        .tutorial-step p {
          margin: 0 0 16px 0;
          color: rgba(255, 255, 255, 0.85);
          font-size: 15px;
          line-height: 1.7;
        }
        
        .tutorial-step p:last-child {
          margin-bottom: 0;
        }
        
        .tutorial-example {
          background: linear-gradient(135deg, 
            rgba(46, 204, 113, 0.15) 0%, 
            rgba(46, 204, 113, 0.08) 100%);
          border-left: 4px solid rgba(46, 204, 113, 0.6);
          border: 1px solid rgba(46, 204, 113, 0.2);
          padding: 16px 20px;
          border-radius: 10px;
          margin-top: 14px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.95);
          line-height: 1.7;
        }
        
        .tutorial-example strong {
          color: rgba(46, 204, 113, 1);
          font-weight: 700;
          display: block;
          margin-bottom: 10px;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .tutorial-example code {
          display: block;
          background: rgba(0, 0, 0, 0.25);
          padding: 8px 12px;
          border-radius: 6px;
          font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
          font-size: 12.5px;
          color: rgba(46, 204, 113, 0.95);
          margin: 6px 0;
          border: 1px solid rgba(46, 204, 113, 0.2);
          white-space: pre-wrap;
          word-break: break-word;
        }
        
        .tutorial-example code:first-of-type {
          margin-top: 0;
        }
        
        .tutorial-example code:last-of-type {
          margin-bottom: 0;
        }
        
        .tutorial-tips {
          margin-top: 28px;
          margin-bottom: 32px;
          padding: 20px 24px;
          background: linear-gradient(135deg, 
            rgba(74, 144, 226, 0.12) 0%, 
            rgba(74, 144, 226, 0.08) 100%);
          border: 1px solid rgba(74, 144, 226, 0.25);
          border-radius: 16px;
          border-left: 4px solid rgba(74, 144, 226, 0.6);
        }
        
        .tutorial-tips h4 {
          margin: 0 0 12px 0;
          color: rgba(74, 144, 226, 1);
          font-size: 16px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .tutorial-tips ul {
          margin: 0;
          padding-left: 20px;
          color: rgba(255, 255, 255, 0.85);
          font-size: 14px;
          line-height: 1.8;
        }
        
        .tutorial-tips li {
          margin-bottom: 8px;
        }
        
        .tutorial-tips li:last-child {
          margin-bottom: 0;
        }
        
        .tutorial-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 32px;
          border-top: 1px solid rgba(74, 144, 226, 0.15);
          background: linear-gradient(180deg, 
            rgba(15, 23, 42, 0.98) 0%,
            rgba(12, 19, 35, 0.98) 100%);
          gap: 20px;
          flex-shrink: 0;
          border-radius: 0 0 24px 24px;
          position: relative;
          z-index: 10;
        }
        
        .tutorial-checkbox {
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(255, 255, 255, 0.75);
          font-size: 14px;
          cursor: pointer;
          user-select: none;
          transition: color 0.2s ease;
        }
        
        .tutorial-checkbox:hover {
          color: rgba(255, 255, 255, 0.9);
        }
        
        .tutorial-checkbox input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
          accent-color: rgba(74, 144, 226, 0.8);
          flex-shrink: 0;
        }
        
        .tutorial-btn-primary {
          background: linear-gradient(135deg, 
            rgba(74, 144, 226, 0.95) 0%, 
            rgba(46, 204, 113, 0.9) 100%);
          border: 1px solid rgba(74, 144, 226, 0.3);
          color: #fff;
          padding: 14px 32px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 
            0 4px 12px rgba(74, 144, 226, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
          letter-spacing: 0.3px;
        }
        
        .tutorial-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 
            0 6px 20px rgba(74, 144, 226, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.25);
          background: linear-gradient(135deg, 
            rgba(91, 160, 242, 1) 0%, 
            rgba(56, 214, 126, 0.95) 100%);
        }
        
        .tutorial-btn-primary:active {
          transform: translateY(0);
        }
        
        .tutorial-btn-primary:focus {
          outline: 2px solid rgba(74, 144, 226, 0.5);
          outline-offset: 3px;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes stepFadeIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .tutorial-step {
          animation: stepFadeIn 0.4s ease backwards;
        }
        
        .tutorial-step:nth-child(1) { animation-delay: 0.1s; }
        .tutorial-step:nth-child(2) { animation-delay: 0.2s; }
        .tutorial-step:nth-child(3) { animation-delay: 0.3s; }
        .tutorial-step:nth-child(4) { animation-delay: 0.4s; }
        .tutorial-step:nth-child(5) { animation-delay: 0.5s; }
        .tutorial-step:nth-child(6) { animation-delay: 0.6s; }
        
        @media (max-width: 768px) {
          .tutorial-overlay {
            padding: 16px;
          }
          
          .tutorial-modal {
            max-width: 100%;
            width: 100%;
            border-radius: 20px;
            max-height: 92vh;
            margin: 0;
          }
          
          .tutorial-header {
            padding: 20px 24px;
          }
          
          .tutorial-header h2 {
            font-size: 22px;
          }
          
          .tutorial-header h2::before {
            font-size: 24px;
          }
          
          .tutorial-content {
            padding: 24px;
            padding-bottom: 24px; /* Reduced padding to eliminate dead space */
            overflow-y: auto;
            flex: 1;
            min-height: 0;
          }
          
          .tutorial-intro {
            padding: 16px 20px;
            margin-bottom: 24px;
          }
          
          .tutorial-steps {
            gap: 16px;
          }
          
          .tutorial-step {
            padding: 20px;
          }
          
          .tutorial-step-header {
            gap: 12px;
          }
          
          .tutorial-icon {
            width: 48px;
            height: 48px;
            font-size: 32px;
          }
          
          .tutorial-step h3 {
            font-size: 18px;
          }
          
          .tutorial-step p {
            font-size: 14px;
          }
          
          .tutorial-footer {
            flex-direction: column;
            align-items: stretch;
            padding: 20px 24px;
            gap: 16px;
          }
          
          .tutorial-btn-primary {
            width: 100%;
            padding: 14px 24px;
          }
        }
        
        @media (max-width: 480px) {
          .tutorial-overlay {
            padding: 12px;
          }
          
          .tutorial-modal {
            max-height: 90vh;
            border-radius: 16px;
          }
          
          .tutorial-header {
            padding: 18px 20px;
          }
          
          .tutorial-header h2 {
            font-size: 20px;
          }
          
          .tutorial-content {
            padding: 20px;
            padding-bottom: 20px; /* Reduced padding to eliminate dead space */
            overflow-y: auto;
            flex: 1;
            min-height: 0;
          }
          
          .tutorial-intro {
            padding: 14px 18px;
            margin-bottom: 20px;
          }
          
          .tutorial-steps {
            gap: 14px;
          }
          
          .tutorial-step {
            padding: 16px;
          }
          
          .tutorial-step-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          
          .tutorial-icon {
            width: 44px;
            height: 44px;
            font-size: 28px;
          }
          
          .tutorial-step h3 {
            font-size: 17px;
          }
          
          .tutorial-step p {
            font-size: 13px;
          }
          
          .tutorial-footer {
            padding: 16px 20px;
          }
        }
        
        /* Voice Call Sidebar - Shows images and essays during calls */
        .voice-call-sidebar {
          position: fixed;
          right: 24px;
          top: 24px;
          width: 400px;
          max-width: calc(100vw - 48px);
          max-height: calc(100vh - 48px);
          background: linear-gradient(135deg, 
            rgba(18, 24, 38, 0.98) 0%, 
            rgba(15, 23, 42, 0.96) 50%,
            rgba(12, 19, 35, 0.98) 100%);
          border: 1.5px solid rgba(74, 144, 226, 0.3);
          border-radius: 16px;
          box-shadow: 
            0 24px 64px rgba(0, 0, 0, 0.5),
            0 8px 24px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          z-index: 2147482999;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transition: none; /* Disable transition during drag */
        }
        
        /* When sidebar is being dragged, use left/top positioning */
        .voice-call-sidebar.dragging {
          transition: none;
        }
        
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .voice-sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(74, 144, 226, 0.15);
          background: linear-gradient(135deg, 
            rgba(30, 41, 59, 0.95) 0%, 
            rgba(15, 23, 42, 0.98) 50%,
            rgba(30, 41, 59, 0.95) 100%);
          cursor: grab;
          user-select: none;
        }
        
        .voice-sidebar-header:active {
          cursor: grabbing;
        }
        
        .voice-sidebar-title {
          display: flex;
          align-items: center;
          color: #fff;
          font-weight: 600;
          font-size: 16px;
        }
        
        .voice-sidebar-close {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          line-height: 1;
          transition: all 0.2s;
        }
        
        .voice-sidebar-close:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
        }
        
        .voice-sidebar-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          min-height: 200px;
        }
        
        .voice-sidebar-content::-webkit-scrollbar {
          width: 8px;
        }
        
        .voice-sidebar-content::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .voice-sidebar-content::-webkit-scrollbar-thumb {
          background: rgba(74, 144, 226, 0.3);
          border-radius: 4px;
        }
        
        .voice-sidebar-content::-webkit-scrollbar-thumb:hover {
          background: rgba(74, 144, 226, 0.5);
        }
        
        .voice-sidebar-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
          padding: 40px 20px;
          min-height: 200px;
        }
        
        .voice-sidebar-empty p {
          margin: 0;
          font-size: 14px;
        }
        
        .voice-sidebar-item {
          margin-bottom: 20px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(74, 144, 226, 0.2);
          border-radius: 12px;
          animation: fadeIn 0.3s ease;
        }
        
        .voice-sidebar-item-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          color: #fff;
          font-weight: 600;
          font-size: 14px;
        }
        
        .voice-sidebar-item img {
          width: 100%;
          border-radius: 8px;
          margin-top: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        
        .voice-sidebar-item-text {
          color: rgba(255, 255, 255, 0.9);
          line-height: 1.6;
          white-space: pre-wrap;
          word-wrap: break-word;
          max-height: 400px;
          overflow-y: auto;
          padding: 12px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          font-size: 14px;
        }
        
        .voice-sidebar-item-text::-webkit-scrollbar {
          width: 6px;
        }
        
        .voice-sidebar-item-text::-webkit-scrollbar-thumb {
          background: rgba(74, 144, 226, 0.3);
          border-radius: 3px;
        }
        
        @media (max-width: 768px) {
          .voice-call-sidebar {
            right: 12px;
            top: 12px;
            width: calc(100vw - 24px);
            max-width: calc(100vw - 24px);
            max-height: calc(100vh - 24px);
          }
        }
      </style>
      
      <button class="launcher" aria-label="Open ${brandTitleAttr}">
        <span class="launcher-icon"><img src="${logoPath}" alt="Noteworthy News" /></span>
        ${brandTitleHtml}
      </button>
      
      <div class="wrap${openOnLoad ? ' open' : ''}" role="dialog" aria-label="${brandTitleAttr}" aria-modal="true">
        <div class="head">
          <div class="head-left">
            <div class="logo" aria-hidden="true">
              <img src="${logoPath}" alt="Noteworthy News" />
            </div>
            <div class="title-group">
              <div class="title">${brandTitleHtml}</div>
              <div class="sub">Fast • Factual • Truth-Seeking</div>
            </div>
          </div>
          <div class="head-right">
            <button class="audio-toggle ${initialAudioState ? 'active' : ''}" aria-label="Toggle audio" id="audioToggle" title="Audio On/Off">${audioIconHTML}</button>
            <button class="voice-input-toggle" aria-label="Toggle voice input" id="voiceInputToggle" title="Voice Input"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: currentColor;"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></button>
            <button class="close" aria-label="Close chat">×</button>
          </div>
        </div>
        
        <div class="drag-drop-overlay">
          <div class="drag-drop-overlay-icon"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 4em; height: 4em; color: currentColor;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></div>
          <div class="drag-drop-overlay-text">Drag and Drop</div>
          <div class="drag-drop-overlay-subtext">Drop your files here to upload</div>
        </div>
        
        <div class="body">
          <p class="tip">Ask about headlines, context, or fact-checks. Upload images or documents for analysis. I'm here to help you stay informed!</p>
        </div>
        
        <!-- Integrated Voice Control Panel - Scrollable & Seamless -->
        <div class="voice-control-integrated" id="voiceControlIntegrated">
          <div class="voice-control-header" id="voiceControlHeader">
            <div class="voice-control-title">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px; margin-right: 8px;">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              </svg>
              <span>Voice Settings</span>
            </div>
            <button class="voice-control-toggle" id="voiceControlToggle" aria-label="Toggle voice settings">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px;">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="voice-control-content" id="voiceControlContent">
            <div class="voice-selector-integrated">
              <label for="voiceSelect" class="voice-label-integrated">Choose Voice</label>
              <div class="voice-list-container">
                <div class="voice-list" id="voiceList">
                  <div class="voice-option" data-value="alloy">
                    <span class="voice-name">Alloy</span>
                    <span class="voice-desc">Balanced & Clear</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option" data-value="echo">
                    <span class="voice-name">Echo</span>
                    <span class="voice-desc">Warm & Friendly</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option" data-value="coral">
                    <span class="voice-name">Coral</span>
                    <span class="voice-desc">Bright & Energetic</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option" data-value="echo">
                    <span class="voice-name">Echo</span>
                    <span class="voice-desc">Clear & Direct</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option" data-value="marin">
                    <span class="voice-name">Marin</span>
                    <span class="voice-desc">Natural & Expressive</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option" data-value="cedar">
                    <span class="voice-name">Cedar</span>
                    <span class="voice-desc">Natural & Clear</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option" data-value="shimmer">
                    <span class="voice-name">Shimmer</span>
                    <span class="voice-desc">Soft & Gentle</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option active" data-value="alloy" data-selected="true">
                    <span class="voice-name">Alloy</span>
                    <span class="voice-desc">Balanced & Versatile</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option" data-value="ash">
                    <span class="voice-name">Ash</span>
                    <span class="voice-desc">Neutral & Versatile</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option" data-value="ballad">
                    <span class="voice-name">Ballad</span>
                    <span class="voice-desc">Melodic & Smooth</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option" data-value="sage">
                    <span class="voice-name">Sage</span>
                    <span class="voice-desc">Wise & Thoughtful</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option" data-value="verse">
                    <span class="voice-name">Verse</span>
                    <span class="voice-desc">Poetic & Refined</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <!-- ElevenLabs Voices -->
                  <div class="voice-option voice-elevenlabs" data-value="elevenlabs:21m00Tcm4TlvDq8ikWAM" data-voice-id="21m00Tcm4TlvDq8ikWAM">
                    <span class="voice-name">Rachel (ElevenLabs)</span>
                    <span class="voice-desc">Professional & Clear</span>
                    <span class="voice-badge">Premium</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option voice-elevenlabs" data-value="elevenlabs:AZnzlk1XvdvUeBnXmlld" data-voice-id="AZnzlk1XvdvUeBnXmlld">
                    <span class="voice-name">Domi (ElevenLabs)</span>
                    <span class="voice-desc">Warm & Friendly</span>
                    <span class="voice-badge">Premium</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option voice-elevenlabs" data-value="elevenlabs:EXAVITQu4vr4xnSDxMaL" data-voice-id="EXAVITQu4vr4xnSDxMaL">
                    <span class="voice-name">Bella (ElevenLabs)</span>
                    <span class="voice-desc">Energetic & Expressive</span>
                    <span class="voice-badge">Premium</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option voice-elevenlabs" data-value="elevenlabs:ErXwobaYiN019PkySvjV" data-voice-id="ErXwobaYiN019PkySvjV">
                    <span class="voice-name">Antoni (ElevenLabs)</span>
                    <span class="voice-desc">Deep & Authoritative</span>
                    <span class="voice-badge">Premium</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option voice-elevenlabs" data-value="elevenlabs:MF3mGyEYCl7XYWbV9V6O" data-voice-id="MF3mGyEYCl7XYWbV9V6O">
                    <span class="voice-name">Elli (ElevenLabs)</span>
                    <span class="voice-desc">Soft & Gentle</span>
                    <span class="voice-badge">Premium</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option voice-elevenlabs" data-value="elevenlabs:TxGEqnHWrfWFTfGW9XjX" data-voice-id="TxGEqnHWrfWFTfGW9XjX">
                    <span class="voice-name">Josh (ElevenLabs)</span>
                    <span class="voice-desc">Casual & Friendly</span>
                    <span class="voice-badge">Premium</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option voice-elevenlabs" data-value="elevenlabs:VR6AewLTigWG4xSOukaG" data-voice-id="VR6AewLTigWG4xSOukaG">
                    <span class="voice-name">Arnold (ElevenLabs)</span>
                    <span class="voice-desc">Strong & Confident</span>
                    <span class="voice-badge">Premium</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option voice-elevenlabs" data-value="elevenlabs:pNInz6obpgDQGcFmaJgB" data-voice-id="pNInz6obpgDQGcFmaJgB">
                    <span class="voice-name">Adam (ElevenLabs)</span>
                    <span class="voice-desc">Professional Male</span>
                    <span class="voice-badge">Premium</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option voice-elevenlabs" data-value="elevenlabs:yoZ06aMxZJJ28mfd3POQ" data-voice-id="yoZ06aMxZJJ28mfd3POQ">
                    <span class="voice-name">Sam (ElevenLabs)</span>
                    <span class="voice-desc">Clear & Articulate</span>
                    <span class="voice-badge">Premium</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option voice-elevenlabs" data-value="elevenlabs:piTKgcLEGmPE4e6mEKli" data-voice-id="piTKgcLEGmPE4e6mEKli">
                    <span class="voice-name">Nicole (ElevenLabs)</span>
                    <span class="voice-desc">Professional Female</span>
                    <span class="voice-badge">Premium</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="voice-option voice-elevenlabs" data-value="elevenlabs:z9fAnlkpzviPz146aGWa" data-voice-id="z9fAnlkpzviPz146aGWa">
                    <span class="voice-name">Glinda (ElevenLabs)</span>
                    <span class="voice-desc">Elegant & Sophisticated</span>
                    <span class="voice-badge">Premium</span>
                    <svg class="voice-check" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div class="voice-status-integrated" id="voiceStatusIntegrated" style="display: none;">
              <div class="voice-status-indicator-integrated">
                <span class="status-dot-integrated" id="statusDotIntegrated"></span>
                <span id="voiceStatusTextIntegrated">Ready</span>
              </div>
            </div>
            <div class="voice-actions-integrated" id="voiceActionsIntegrated">
              <div class="voice-action-hint">Ready to start voice call</div>
              <button class="voice-action-integrated voice-action-start" id="voiceStartBtnIntegrated" title="Click to start a voice conversation with AI">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.2"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
                <span>Start Voice Call</span>
              </button>
              <button class="voice-action-integrated voice-action-stop" id="voiceStopBtnIntegrated" style="display: none;" title="Click to end the voice call">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                  <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.2"/>
                </svg>
                <span>End Call</span>
              </button>
            </div>
          </div>
        </div>
        
        <div class="input">
          <input type="file" id="fileInput" accept="image/*,application/pdf,.txt,.doc,.docx" multiple aria-label="Upload file" style="display: none;" />
          <button type="button" class="file-upload-btn" id="fileUploadBtn" aria-label="Upload file" title="Upload file or image for analysis">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
          <button type="button" class="voice-mode-toggle" id="voiceModeToggle" aria-label="Start voice conversation" title="Click to start voice conversation with AI">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="#4A90E2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="#4A90E2" fill-opacity="0.2"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="#4A90E2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
          <input type="text" placeholder="Ask a question or describe an image to generate…" aria-label="Your question" id="chatInput" />
          <button type="button" id="sendButton">Send</button>
        </div>
        
        <div class="resize-handle" aria-label="Resize chat" title="Drag to resize"></div>
      </div>
      
      <!-- Premium Secure Briefing Panel - Intel Dashboard Aesthetic -->
      <div class="voice-call-panel" id="voiceCallPanel" role="dialog" aria-label="Secure Briefing" aria-modal="true">
        <div class="voice-call-header">
          <div class="voice-call-title-group">
            <h2 class="voice-call-title">Secure Briefing</h2>
            <div class="voice-status-chip" id="voiceStatusChip" aria-live="polite">
              <span class="status-chip-dot"></span>
              <span class="status-chip-text">IDLE</span>
            </div>
          </div>
        </div>
        
        <div class="voice-orb-container" id="voiceOrbContainer">
          <!-- Outer ring with gradient -->
          <div class="orb-outer-ring" id="orbOuterRing"></div>
          <!-- Waveform rings for speaking state -->
          <svg class="voice-waveform-rings" id="voiceWaveformRings" style="display: none;" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <circle class="waveform-ring" cx="100" cy="100" r="70" fill="none" stroke="rgba(212, 160, 23, 0.4)" stroke-width="1.5" opacity="0"/>
            <circle class="waveform-ring" cx="100" cy="100" r="85" fill="none" stroke="rgba(212, 160, 23, 0.35)" stroke-width="1.5" opacity="0"/>
            <circle class="waveform-ring" cx="100" cy="100" r="100" fill="none" stroke="rgba(212, 160, 23, 0.3)" stroke-width="1.5" opacity="0"/>
            <circle class="waveform-ring" cx="100" cy="100" r="115" fill="none" stroke="rgba(212, 160, 23, 0.25)" stroke-width="1.5" opacity="0"/>
          </svg>
          <!-- Processing spinner ring -->
          <div class="orb-processing-ring" id="orbProcessingRing" style="display: none;"></div>
          <!-- Inner core with NW logo -->
          <div class="orb-core" id="orbCore">
            <img src="${logoPath}" alt="Noteworthy News" class="orb-logo" id="orbLogo" />
            <div class="orb-inner-glow"></div>
          </div>
          <!-- Listening halo -->
          <div class="orb-listening-halo" id="orbListeningHalo" style="display: none;"></div>
        </div>
        
        <div class="voice-status-text-group">
          <div class="voice-status-primary" id="voiceStatusPrimary">Ready</div>
          <div class="voice-status-secondary" id="voiceStatusSecondary">Secure link established</div>
        </div>
        
        <div class="voice-controls">
          <button class="voice-control-btn voice-control-mute" id="voiceControlMute" aria-label="Mute" title="Mute microphone">
            <svg class="mute-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
            <svg class="unmute-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: none;">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <path d="M2 2l20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
            </svg>
          </button>
          <button class="voice-control-btn voice-control-end" id="voiceCallEndBtn" aria-label="End call">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 8l-8 8M8 8l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>End Call</span>
          </button>
        </div>
      </div>
      
      <!-- Voice Call Sidebar - Shows images and essays during voice calls -->
      <div class="voice-call-sidebar" id="voiceCallSidebar" style="display: none;">
        <div class="voice-sidebar-header">
          <div class="voice-sidebar-title">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px; margin-right: 8px;">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
            <span>Call Results</span>
          </div>
          <button class="voice-sidebar-close" id="voiceSidebarClose" aria-label="Close sidebar">×</button>
        </div>
        <div class="voice-sidebar-content" id="voiceSidebarContent">
          <div class="voice-sidebar-empty">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 48px; height: 48px; opacity: 0.3; margin-bottom: 12px;">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
            <p>Generated content will appear here during your call</p>
          </div>
        </div>
      </div>
      
      <!-- Voice Control Panel - REMOVED (now integrated) -->
      <div class="voice-control-panel" id="voiceControlPanel" style="display: none !important;">
        <div class="voice-panel-header">
          <div class="voice-panel-title">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px; color: currentColor; margin-right: 8px;">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
            <span>Voice Settings</span>
          </div>
          <button class="voice-panel-close" id="voicePanelClose" aria-label="Close voice panel">×</button>
        </div>
        
        <div class="voice-panel-content">
          <div class="voice-selector-group">
            <label for="voiceSelect" class="voice-selector-label">
              <span>Choose Voice</span>
              <span class="voice-selector-subtitle">Select your preferred AI voice</span>
            </label>
            <div class="voice-select-wrapper">
              <select id="voiceSelect" class="voice-select">
                <option value="alloy" selected>Alloy - Balanced & Versatile</option>
                <option value="ash">Ash - Calm & Composed</option>
                <option value="ballad">Ballad - Warm & Expressive</option>
                <option value="coral">Coral - Bright & Energetic</option>
                <option value="echo">Echo - Clear & Direct</option>
                <option value="sage">Sage - Wise & Thoughtful</option>
                <option value="shimmer">Shimmer - Smooth & Polished</option>
                <option value="verse">Verse - Poetic & Melodic</option>
                <option value="marin">Marin - Natural & Expressive</option>
                <option value="cedar">Cedar - Natural & Clear</option>
              </select>
              <svg class="voice-select-arrow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
          
          <div class="voice-status-group" id="voiceStatusGroup" style="display: none;">
            <div class="voice-status-header">
              <span class="voice-status-label">Connection Status</span>
            </div>
            <div class="voice-status" id="voiceStatus">
              <div class="voice-status-indicator">
                <span class="status-dot" id="statusDot"></span>
                <span id="voiceStatusText">Ready</span>
              </div>
            </div>
          </div>
          
          <div class="voice-panel-actions">
            <button class="voice-action-btn voice-action-primary" id="voiceStartBtn">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              </svg>
              <span>Start Voice Call</span>
            </button>
            <button class="voice-action-btn voice-action-secondary" id="voiceStopBtn" style="display: none;">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
              </svg>
              <span>End Call</span>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Tutorial Card -->
      <div class="tutorial-overlay" id="tutorialOverlay" role="dialog" aria-label="Tutorial" aria-modal="true">
        <div class="tutorial-modal">
          <div class="tutorial-header">
            <div class="tutorial-header-left">
              <h2>${brandTitleHtml}</h2>
              <span class="tutorial-header-badge">GPT-5</span>
            </div>
            <button class="tutorial-skip" id="tutorialSkip">Skip</button>
            <button class="tutorial-close" aria-label="Close tutorial">×</button>
          </div>
          <div class="tutorial-content">
            <div class="tutorial-intro">
              <p>Your intelligent assistant for fact-checking, media literacy, and staying informed. Get instant answers, verify information, and explore news with AI-powered insights.</p>
            </div>
            
            <div class="tutorial-steps">
              <div class="tutorial-step">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: currentColor;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M8 10h8M8 14h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg></div>
                  <h3>Ask Questions & Get Answers</h3>
                </div>
                <p>Ask about breaking news, headlines, or request fact-checks. The AI provides instant, accurate responses to help you stay informed.</p>
                <div class="tutorial-example">
                  <strong>Example prompts:</strong>
                  <code>"What's the latest on [breaking news topic]?"</code>
                  <code>"Can you fact-check this headline?"</code>
                  <code>"Explain the context behind this news story"</code>
                </div>
              </div>
              
              <div class="tutorial-step">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: currentColor;"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="12" cy="7" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="17" r="1.5" fill="currentColor"/></svg></div>
                  <h3>Generate Images Instantly</h3>
                </div>
                <p>Simply describe what you want to see! The AI automatically detects image requests and generates visuals for you.</p>
                <div class="tutorial-example">
                  <strong>Example prompts:</strong>
                  <code>"Generate an image of a futuristic cityscape at sunset"</code>
                  <code>"Create a picture of a news anchor in a modern studio"</code>
                  <code>"Show me an illustration of breaking news"</code>
                </div>
              </div>
              
              <div class="tutorial-step">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: currentColor;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></div>
                  <h3>Upload & Analyze Files</h3>
                </div>
                <p>Upload images, PDFs, or documents for AI analysis. Click the paperclip button or drag and drop files directly into the chat. Perfect for verifying screenshots, analyzing documents, or understanding complex content.</p>
                <div class="tutorial-example">
                  <strong>Try this:</strong>
                  <code>Upload a news screenshot and ask "Is this headline accurate?"</code>
                  <code>Upload a document and ask "What are the key points?"</code>
                </div>
              </div>
              
              <div class="tutorial-step">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: currentColor;"><path d="M4 8v8h4l5 5V3L8 8H4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.12"/><path d="M15 10c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M17 6c3.3 0 6 2.7 6 6s-2.7 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M17 3c5 0 9 4 9 9s-4 9-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.7"/></svg></div>
                  <h3>Audio Responses</h3>
                </div>
                <p>Toggle the audio button in the header to hear AI responses read aloud. Perfect for multitasking or accessibility needs.</p>
              </div>
              
              <div class="tutorial-step">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: currentColor;"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></div>
                  <h3>Voice Input</h3>
                </div>
                <p>Click the microphone button to speak your questions instead of typing. Great for hands-free use and faster interactions!</p>
              </div>
            </div>
            
            <div class="tutorial-tips">
              <h4><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: currentColor; display: inline-block; vertical-align: middle; margin-right: 0.5rem;"><path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/><path d="M9 21h6M10 18h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Pro Tips</h4>
              <ul>
                <li><strong>Resize the window:</strong> Drag the bottom-right corner to adjust the chat size</li>
                <li><strong>Drag to move:</strong> Click and drag the header to reposition the chat window</li>
                <li><strong>Keyboard shortcuts:</strong> Press <code>Escape</code> to close the chat or tutorial</li>
                <li><strong>Multiple files:</strong> You can upload multiple files at once for comprehensive analysis</li>
                <li><strong>Context matters:</strong> The AI remembers your conversation, so you can ask follow-up questions</li>
              </ul>
            </div>
          </div>
          <div class="tutorial-footer">
            <label class="tutorial-checkbox">
              <input type="checkbox" id="dontShowAgain" />
              <span>Don't show this tutorial again</span>
            </label>
            <button class="tutorial-btn-primary" id="tutorialGotIt">Start Chatting!</button>
          </div>
        </div>
      </div>
    `;

    // Hide ElevenLabs voices if feature is disabled
    // Set ENABLE_ELEVENLABS_VOICES to true at the top of connectedCallback to show them
    if (!ENABLE_ELEVENLABS_VOICES) {
      // Hide all ElevenLabs voice options in the UI
      setTimeout(() => {
        const voiceList = this.root.querySelector('#voiceList');
        if (voiceList) {
          const elevenLabsVoices = voiceList.querySelectorAll('.voice-option.voice-elevenlabs');
          elevenLabsVoices.forEach(voice => {
            voice.classList.add('hidden');
          });
        }
      }, 0);
    }

    // Capture root for use in nested functions
    const root = this.root;
    
    const wrap = root.querySelector('.wrap');
    const launcher = root.querySelector('.launcher');
    const closeBtn = root.querySelector('.close');
    const input = root.querySelector('#chatInput');
    const fileInput = root.querySelector('#fileInput');
    const fileUploadBtn = root.querySelector('#fileUploadBtn');
    const voiceModeToggle = root.querySelector('#voiceModeToggle');
    const voiceControlIntegrated = root.querySelector('#voiceControlIntegrated');
    const voiceControlToggle = root.querySelector('#voiceControlToggle');
    const voiceControlHeader = root.querySelector('#voiceControlHeader');
    const voiceList = root.querySelector('#voiceList');
    const voiceStatusIntegrated = root.querySelector('#voiceStatusIntegrated');
    const voiceStatusTextIntegrated = root.querySelector('#voiceStatusTextIntegrated');
    const statusDotIntegrated = root.querySelector('#statusDotIntegrated');
    const voiceStartBtnIntegrated = root.querySelector('#voiceStartBtnIntegrated');
    const voiceStopBtnIntegrated = root.querySelector('#voiceStopBtnIntegrated');
    
    // Legacy popup elements (hidden)
    const voiceControlPanel = root.querySelector('#voiceControlPanel');
    const voicePanelClose = root.querySelector('#voicePanelClose');
    const voiceSelect = root.querySelector('#voiceSelect');
    const voiceStatusGroup = root.querySelector('#voiceStatusGroup');
    const voiceStatus = root.querySelector('#voiceStatus');
    const voiceStatusText = root.querySelector('#voiceStatusText');
    const statusDot = root.querySelector('#statusDot');
    const voiceStartBtn = root.querySelector('#voiceStartBtn');
    const voiceStopBtn = root.querySelector('#voiceStopBtn');
    const send = root.querySelector('#sendButton');
    const body = root.querySelector('.body');
    const head = root.querySelector('.head');
    const resizeHandle = root.querySelector('.resize-handle');
    
    // Voice sidebar elements - declared early to avoid temporal dead zone
    const voiceCallSidebar = root.querySelector('#voiceCallSidebar');
    const voiceSidebarContent = root.querySelector('#voiceSidebarContent');
    const voiceSidebarClose = root.querySelector('#voiceSidebarClose');
    
    // Capture endpoint for use in voice mode (this.getAttribute won't work in nested functions)
    // Note: endpoint is already declared at the top of connectedCallback, so we reference it
    
    // Function to position voice panel next to chatbox
    const positionVoicePanel = () => {
      if (!voiceControlPanel || !wrap) return;
      
      const wrapRect = wrap.getBoundingClientRect();
      const panelWidth = 320;
      const gap = 16;
      
      // Position to the right of chatbox, or left if not enough space
      const spaceOnRight = window.innerWidth - wrapRect.right;
      const spaceOnLeft = wrapRect.left;
      
      if (spaceOnRight >= panelWidth + gap) {
        // Position to the right
        voiceControlPanel.style.left = (wrapRect.right + gap) + 'px';
        voiceControlPanel.style.top = wrapRect.top + 'px';
        voiceControlPanel.style.transform = 'translateX(0) scale(1)';
      } else if (spaceOnLeft >= panelWidth + gap) {
        // Position to the left
        voiceControlPanel.style.left = (wrapRect.left - panelWidth - gap) + 'px';
        voiceControlPanel.style.top = wrapRect.top + 'px';
        voiceControlPanel.style.transform = 'translateX(0) scale(1)';
      } else {
        // Center it below or above
        voiceControlPanel.style.left = wrapRect.left + 'px';
        if (spaceOnRight < spaceOnLeft) {
          voiceControlPanel.style.top = (wrapRect.bottom + gap) + 'px';
        } else {
          voiceControlPanel.style.top = (wrapRect.top - 280 - gap) + 'px';
        }
      }
    };
    
    // Show voice panel
    const showVoicePanel = () => {
      if (!voiceControlPanel) {
        console.error('Voice control panel not found!');
        return;
      }
      console.log('Showing voice panel...');
      positionVoicePanel();
      voiceControlPanel.classList.add('show');
      voiceControlPanel.style.display = 'block';
      voiceControlPanel.style.visibility = 'visible';
      voiceControlPanel.style.opacity = '1';
      
      // Update position on window resize
      const updatePosition = () => {
        if (voiceControlPanel.classList.contains('show')) {
          positionVoicePanel();
        }
      };
      window.addEventListener('resize', updatePosition);
      voiceControlPanel._resizeHandler = updatePosition;
    };
    
    // Hide voice panel
    const hideVoicePanel = () => {
      if (!voiceControlPanel) return;
      console.log('Hiding voice panel...');
      voiceControlPanel.classList.remove('show');
      voiceControlPanel.style.opacity = '0';
      if (voiceControlPanel._resizeHandler) {
        window.removeEventListener('resize', voiceControlPanel._resizeHandler);
      }
    };
    
    // Voice mode toggle - toggle integrated panel or start call
    if (voiceModeToggle) {
      voiceModeToggle.addEventListener('click', () => {
        if (voiceModeActive) {
          // If already in voice mode, stop it
          stopVoiceMode();
        } else if (voiceControlIntegrated && voiceControlIntegrated.classList.contains('expanded')) {
          // If panel is already expanded, start the call
          startVoiceMode();
        } else {
          // Otherwise, expand the panel
          if (voiceControlIntegrated) {
            voiceControlIntegrated.classList.add('expanded');
          }
        }
      });
    }
    
    // Voice control header toggle
    if (voiceControlHeader) {
      voiceControlHeader.addEventListener('click', () => {
        if (voiceControlIntegrated) {
          voiceControlIntegrated.classList.toggle('expanded');
        }
      });
    }
    
    // Voice option selection
    const voiceActionsIntegrated = root.querySelector('#voiceActionsIntegrated');
    
    // Show button on initial load since Cove is default active
    if (voiceActionsIntegrated) {
      voiceActionsIntegrated.style.display = 'flex';
      voiceActionsIntegrated.style.visibility = 'visible';
      voiceActionsIntegrated.style.opacity = '1';
      console.log('✅ Start Voice Call button shown on load (Alloy is default)');
    } else {
      console.error('❌ voiceActionsIntegrated element not found!');
    }
    
    if (voiceList) {
      // Supported voices for OpenAI Realtime API
      const SUPPORTED_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
      
      // Helper function to check if voice is ElevenLabs
      const isElevenLabsVoice = (voiceValue) => {
        return voiceValue && voiceValue.startsWith('elevenlabs:');
      };
      
      // Helper function to extract OpenAI voice from ElevenLabs voice string
      const getOpenAIVoice = (voiceValue) => {
        if (isElevenLabsVoice(voiceValue)) {
          // For ElevenLabs voices, use a default OpenAI voice for the session
          // The actual audio will come from ElevenLabs
          return 'alloy'; // Default fallback
        }
        return voiceValue;
      };
      
      // Initialize: Ensure a valid voice is active
      const voiceOptions = voiceList.querySelectorAll('.voice-option');
      let hasValidActive = false;
      
      voiceOptions.forEach(option => {
        const voiceValue = option.dataset.value;
        
        // Check if this is a valid active voice (OpenAI or ElevenLabs)
        if (option.classList.contains('active')) {
          if (SUPPORTED_VOICES.includes(voiceValue) || isElevenLabsVoice(voiceValue)) {
            hasValidActive = true;
            currentVoice = voiceValue;
          }
        }
      });
      
      // If no valid active voice, set alloy as default
      if (!hasValidActive) {
        const alloyOption = voiceList.querySelector('.voice-option[data-value="alloy"]');
        if (alloyOption) {
          alloyOption.classList.add('active');
          currentVoice = 'alloy';
        }
      }
      
      // Add click handlers to all voice options
      const allVoiceOptions = voiceList.querySelectorAll('.voice-option');
      allVoiceOptions.forEach(option => {
        option.addEventListener('click', () => {
          const selectedVoice = option.dataset.value;
          
          // Validate voice is supported (OpenAI or ElevenLabs)
          if (!SUPPORTED_VOICES.includes(selectedVoice) && !isElevenLabsVoice(selectedVoice)) {
            console.warn(`[Voice Mode] Attempted to select unsupported voice: ${selectedVoice}`);
            return;
          }
          
          // Remove active from all
          allVoiceOptions.forEach(opt => opt.classList.remove('active'));
          // Add active to clicked
          option.classList.add('active');
          // Update current voice
          currentVoice = selectedVoice;
          
          // Show the "Start Voice Call" button when a voice is selected
          if (voiceActionsIntegrated) {
            voiceActionsIntegrated.style.display = 'flex';
            voiceActionsIntegrated.style.visibility = 'visible';
            voiceActionsIntegrated.style.opacity = '1';
            console.log('✅ Showing Start Voice Call button after voice selection');
          } else {
            console.error('❌ voiceActionsIntegrated element not found!');
          }
          
          // If voice mode is active, restart with new voice
          if (voiceModeActive) {
            stopVoiceMode();
            setTimeout(() => startVoiceMode(), 500);
          }
        });
      });
    }
    
    // Voice start/stop buttons (integrated)
    if (voiceStartBtnIntegrated) {
      voiceStartBtnIntegrated.addEventListener('click', () => {
        startVoiceMode();
      });
    }
    
    // DEBUG: Verify button exists
    console.log('[Voice Mode] 🔍 Setting up end call button handlers...');
    console.log('[Voice Mode] 🔍 voiceStopBtnIntegrated found:', !!voiceStopBtnIntegrated);
    console.log('[Voice Mode] 🔍 voiceStopBtn found:', !!voiceStopBtn);
    
    // Use event delegation on root to catch clicks even if button is recreated
    root.addEventListener('click', (e) => {
      const target = e.target.closest('#voiceStopBtnIntegrated, #voiceStopBtn, #voiceCallEndBtn');
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Voice Mode] 🛑 End call button clicked via event delegation - CALLING stopVoiceMode');
        console.log('[Voice Mode] 🔍 Button ID:', target.id);
        try {
          stopVoiceMode();
          console.log('[Voice Mode] ✅ stopVoiceMode() completed');
        } catch (error) {
          console.error('[Voice Mode] ❌ ERROR in stopVoiceMode():', error);
          console.error('[Voice Mode] Error stack:', error.stack);
        }
        return false;
      }
    });
    
    // Also attach direct handlers as backup
    if (voiceStopBtnIntegrated) {
      console.log('[Voice Mode] ✅ Attaching direct click handler to voiceStopBtnIntegrated');
      voiceStopBtnIntegrated.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Voice Mode] 🛑 End call button clicked (direct handler) - CALLING stopVoiceMode');
        try {
        stopVoiceMode();
          console.log('[Voice Mode] ✅ stopVoiceMode() completed');
        } catch (error) {
          console.error('[Voice Mode] ❌ ERROR in stopVoiceMode():', error);
          console.error('[Voice Mode] Error stack:', error.stack);
        }
      });
      console.log('[Voice Mode] ✅ Direct handler attached to voiceStopBtnIntegrated');
    } else {
      console.error('[Voice Mode] ❌ voiceStopBtnIntegrated NOT FOUND! Button may not exist in DOM');
    }
    
    // Legacy stop button (fallback)
    if (voiceStopBtn) {
      console.log('[Voice Mode] ✅ Attaching direct click handler to legacy voiceStopBtn');
      voiceStopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Voice Mode] 🛑 Legacy end call button clicked - CALLING stopVoiceMode');
        try {
          stopVoiceMode();
          console.log('[Voice Mode] ✅ stopVoiceMode() completed');
        } catch (error) {
          console.error('[Voice Mode] ❌ ERROR in stopVoiceMode():', error);
          console.error('[Voice Mode] Error stack:', error.stack);
        }
      });
    } else {
      console.log('[Voice Mode] ℹ️ Legacy voiceStopBtn not found (this is OK if using integrated version)');
    }
    
    const tip = root.querySelector('.tip');
    
    // Track uploaded files
    let uploadedFiles = [];
    
    // Track chat history for context
    let chatHistory = [];
    
    // Debug: Log if elements are found
    console.log('Noteworthy Chat initialized:', {
      wrap: !!wrap,
      launcher: !!launcher,
      input: !!input,
      send: !!send,
      body: !!body,
      fileUploadBtn: !!fileUploadBtn,
      voiceModeToggle: !!voiceModeToggle,
      voiceControlPanel: !!voiceControlPanel,
      voiceStartBtn: !!voiceStartBtn,
      voiceStopBtn: !!voiceStopBtn,
      endpoint: endpoint
    });
    
    // Verify integrated voice control exists
    if (!voiceControlIntegrated) {
      console.error('❌ Integrated voice control NOT FOUND!');
    } else {
      console.log('✅ Integrated voice control found');
    }
    
    // Ensure buttons are visible - force them to show
    if (fileUploadBtn) {
      fileUploadBtn.style.display = 'flex';
      fileUploadBtn.style.visibility = 'visible';
      fileUploadBtn.style.opacity = '1';
      fileUploadBtn.style.alignItems = 'center';
      fileUploadBtn.style.justifyContent = 'center';
      fileUploadBtn.removeAttribute('hidden');
      
      // Force SVG to be visible with explicit styles
      const fileSvg = fileUploadBtn.querySelector('svg');
      if (fileSvg) {
        fileSvg.setAttribute('width', '20');
        fileSvg.setAttribute('height', '20');
        fileSvg.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; width: 20px !important; height: 20px !important;';
        const path = fileSvg.querySelector('path');
        if (path) {
          path.setAttribute('stroke', '#FFFFFF');
          path.setAttribute('stroke-width', '2');
          path.style.cssText = 'stroke: #FFFFFF !important; stroke-width: 2 !important;';
        }
      }
      
      console.log('✅ File upload button found', {
        button: !!fileUploadBtn,
        svg: !!fileSvg,
        path: fileSvg ? !!fileSvg.querySelector('path') : false
      });
    } else {
      console.error('❌ File upload button NOT FOUND in DOM!');
    }
    
    if (voiceModeToggle) {
      voiceModeToggle.style.display = 'flex';
      voiceModeToggle.style.visibility = 'visible';
      voiceModeToggle.style.opacity = '1';
      voiceModeToggle.style.alignItems = 'center';
      voiceModeToggle.style.justifyContent = 'center';
      voiceModeToggle.removeAttribute('hidden');
      
      // Force SVG to be visible with explicit styles
      const voiceSvg = voiceModeToggle.querySelector('svg');
      if (voiceSvg) {
        voiceSvg.setAttribute('width', '20');
        voiceSvg.setAttribute('height', '20');
        voiceSvg.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; width: 20px !important; height: 20px !important;';
        const paths = voiceSvg.querySelectorAll('path');
        paths.forEach(path => {
          path.setAttribute('stroke', '#4A90E2');
          path.setAttribute('stroke-width', '2');
          path.style.cssText = 'stroke: #4A90E2 !important; stroke-width: 2 !important;';
          if (path.hasAttribute('fill')) {
            path.setAttribute('fill', '#4A90E2');
            path.setAttribute('fill-opacity', '0.2');
          }
        });
      }
      
      console.log('✅ Voice mode toggle found', {
        button: !!voiceModeToggle,
        svg: !!voiceSvg,
        paths: voiceSvg ? voiceSvg.querySelectorAll('path').length : 0
      });
    } else {
      console.error('❌ Voice mode toggle NOT FOUND in DOM!');
    }
    
    // Double-check after a short delay and force SVG visibility
    setTimeout(() => {
      if (fileUploadBtn) {
        const fileSvg = fileUploadBtn.querySelector('svg');
        if (fileSvg) {
          fileSvg.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; width: 20px !important; height: 20px !important;';
          const path = fileSvg.querySelector('path');
          if (path) {
            path.setAttribute('stroke', '#FFFFFF');
            path.setAttribute('stroke-width', '2');
            path.style.cssText = 'stroke: #FFFFFF !important; stroke-width: 2 !important; fill: none !important;';
          }
        }
      }
      if (voiceModeToggle) {
        const voiceSvg = voiceModeToggle.querySelector('svg');
        if (voiceSvg) {
          voiceSvg.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; width: 20px !important; height: 20px !important;';
          const paths = voiceSvg.querySelectorAll('path');
          paths.forEach(path => {
            path.setAttribute('stroke', '#4A90E2');
            path.setAttribute('stroke-width', '2');
            path.style.cssText = 'stroke: #4A90E2 !important; stroke-width: 2 !important;';
            if (path.hasAttribute('fill')) {
              path.setAttribute('fill', '#4A90E2');
              path.setAttribute('fill-opacity', '0.2');
            }
          });
        }
      }
      console.log('✅ SVG visibility forced:', {
        fileUpload: fileUploadBtn ? {
          svgExists: !!fileUploadBtn.querySelector('svg'),
          pathExists: !!fileUploadBtn.querySelector('svg path'),
          svgDisplay: fileUploadBtn.querySelector('svg') ? getComputedStyle(fileUploadBtn.querySelector('svg')).display : 'none'
        } : 'null',
        voiceToggle: voiceModeToggle ? {
          svgExists: !!voiceModeToggle.querySelector('svg'),
          pathsCount: voiceModeToggle.querySelector('svg') ? voiceModeToggle.querySelectorAll('svg path').length : 0,
          svgDisplay: voiceModeToggle.querySelector('svg') ? getComputedStyle(voiceModeToggle.querySelector('svg')).display : 'none'
        } : 'null'
      });
    }, 100);
    
    // Ensure all critical elements exist
    if (!input || !send || !body) {
      console.error('Noteworthy Chat: Missing critical elements!', {
        input: !!input,
        send: !!send,
        body: !!body,
        wrap: !!wrap
      });
      // Don't return - try to continue anyway
      console.warn('Continuing despite missing elements...');
    }
    
    // Store reference to root for use in nested functions
    const audioToggle = root.querySelector('#audioToggle');
    const voiceInputToggle = root.querySelector('#voiceInputToggle');
    
    // Audio settings
    let audioEnabled = localStorage.getItem('noteworthy-ai-audio') === 'true';
    let voiceInputEnabled = false;
    let recognition = null;
    let currentSpeech = null;
    
    // Voice conversation state variables are declared at the top of connectedCallback
    // to avoid temporal dead zone errors when used in event handlers
    
    // Initialize audio toggle state (already set in template, but ensure it's correct)
    if (audioToggle) {
      // The icon is already set in the template via audioIconHTML, but we ensure state is correct
      if (audioEnabled) {
        audioToggle.classList.add('active');
      } else {
        audioToggle.classList.remove('active');
      }
      
      audioToggle.addEventListener('click', () => {
        audioEnabled = !audioEnabled;
        localStorage.setItem('noteworthy-ai-audio', audioEnabled.toString());
        audioToggle.innerHTML = audioEnabled 
        ? '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: currentColor;"><path d="M4 8v8h4l5 5V3L8 8H4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.12"/><path d="M15 10c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M17 6c3.3 0 6 2.7 6 6s-2.7 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M17 3c5 0 9 4 9 9s-4 9-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.7"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: rgba(255,255,255,0.5);"><path d="M4 8v8h4l5 5V3L8 8H4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.08" opacity="0.6"/><path d="M15 10c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.25"/><path d="M17 6c3.3 0 6 2.7 6 6s-2.7 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.25"/><path d="M17 3c5 0 9 4 9 9s-4 9-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.2"/><path d="M2 2l20 20" stroke="#ff4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="1"/><path d="M3 3l18 18" stroke="#ff6666" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/></svg>';
        audioToggle.classList.toggle('active');
        if (!audioEnabled && currentSpeech) {
          window.speechSynthesis.cancel();
          currentSpeech = null;
        }
      });
    }
    
    // Initialize voice input
    if (voiceInputToggle && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        input.value = transcript;
        voiceInputToggle.classList.remove('active');
        voiceInputEnabled = false;
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        voiceInputToggle.classList.remove('active');
        voiceInputEnabled = false;
      };
      
      recognition.onend = () => {
        voiceInputToggle.classList.remove('active');
        voiceInputEnabled = false;
        if (input) input.placeholder = 'Ask about a story or topic…';
      };
      
      voiceInputToggle.addEventListener('click', () => {
        if (voiceInputEnabled) {
          recognition.stop();
          voiceInputEnabled = false;
        } else {
          try {
            recognition.start();
            voiceInputToggle.classList.add('active');
            voiceInputEnabled = true;
            input.placeholder = 'Listening...';
          } catch (e) {
            console.error('Failed to start voice recognition:', e);
          }
        }
      });
    } else {
      // Hide voice input if not supported
      if (voiceInputToggle) {
        voiceInputToggle.style.display = 'none';
      }
    }
    
    // Text-to-speech function with enhanced AI voice
    function speakText(text) {
      // CRITICAL: Cancel text-to-speech if voice mode is active (we only want GPT's voice)
      // Check this FIRST before anything else - check both the variable and the global flag
      // Cancel IMMEDIATELY, before any checks
      window.speechSynthesis.cancel();
      if (voiceModeActive || window._voiceModeActive) {
        console.log('[Voice Mode] 🔇 BLOCKING text-to-speech - voice mode is active (entry check)');
        window.speechSynthesis.cancel();
        window.speechSynthesis.cancel();
        window.speechSynthesis.cancel(); // Triple cancel
        if (currentSpeech) {
          currentSpeech = null;
        }
        return;
      }
      
      // Also check if speech is already speaking and cancel it - check both flags
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        if (voiceModeActive || window._voiceModeActive) {
          console.log('[Voice Mode] 🔇🔇 Canceling ongoing speech - voice mode is active');
          window.speechSynthesis.cancel();
          window.speechSynthesis.cancel(); // Double cancel
          if (currentSpeech) {
            currentSpeech = null;
          }
          return;
        }
      }
      
      if (!audioEnabled) return;
      
      // Double-check voice mode is still not active before speaking
      if (voiceModeActive) {
        console.log('[Voice Mode] 🔇 Blocking text-to-speech - voice mode is active (double-check)');
        window.speechSynthesis.cancel();
        return;
      }
      
      // CRITICAL: Cancel any ongoing speech if voice mode becomes active
      if (currentSpeech && voiceModeActive) {
        window.speechSynthesis.cancel();
        currentSpeech = null;
        return;
      }
      
      // Clean text (remove HTML tags, URLs, etc.)
      let cleanText = text.replace(/<[^>]+>/g, '').replace(/\n+/g, ' ').trim();
      // Remove URLs
      cleanText = cleanText.replace(/https?:\/\/[^\s]+/gi, '');
      // Clean up multiple spaces
      cleanText = cleanText.replace(/\s+/g, ' ').trim();
      
      if (!cleanText) return;
      
      // Cancel any ongoing speech
      if (currentSpeech) {
        window.speechSynthesis.cancel();
      }
      
      // FINAL CHECK: Make absolutely sure voice mode is not active - check both flags
      if (voiceModeActive || window._voiceModeActive) {
        console.log('[Voice Mode] 🔇🔇 BLOCKING text-to-speech - voice mode is active (final check)');
        window.speechSynthesis.cancel();
        window.speechSynthesis.cancel(); // Double cancel
        if (currentSpeech) {
          currentSpeech = null;
        }
        return;
      }
      
      // FINAL CHECK before creating utterance - check both flags
      if (voiceModeActive || window._voiceModeActive) {
        console.log('[Voice Mode] 🔇🔇 BLOCKING text-to-speech - voice mode is active (pre-utterance check)');
        window.speechSynthesis.cancel();
        window.speechSynthesis.cancel(); // Double cancel
        if (currentSpeech) {
          currentSpeech = null;
        }
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      currentSpeech = utterance; // Store reference to cancel if needed
      window.currentSpeech = utterance; // Also store globally for override function
      
      // Enhanced AI voice settings
      utterance.rate = 1.05; // Slightly faster for more natural AI feel
      utterance.pitch = 0.95; // Slightly lower pitch for professional AI tone
      utterance.volume = 0.9;
      
      // Get available voices and select the best AI-like voice
      function selectBestVoice() {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return null;
        
        // Priority order for AI-like voices (modern, clear, professional)
        const voicePreferences = [
          // Premium/Enhanced voices (if available)
          v => v.name.includes('Enhanced') || v.name.includes('Premium'),
          // Natural female voices
          v => v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Karen'),
          // Natural male voices
          v => v.name.includes('Alex') || v.name.includes('Daniel') || v.name.includes('Tom'),
          // Neural/Neural voices (more natural)
          v => v.name.includes('Neural') || v.name.includes('neural'),
          // Compact voices (usually good quality)
          v => v.name.includes('Compact'),
          // Any local English voice
          v => v.lang.startsWith('en') && v.localService,
          // Any English voice
          v => v.lang.startsWith('en-US') || v.lang.startsWith('en-GB'),
        ];
        
        for (const preference of voicePreferences) {
          const voice = voices.find(preference);
          if (voice) {
            return voice;
          }
        }
        
        // Fallback to first English voice
        return voices.find(v => v.lang.startsWith('en')) || voices[0];
      }
      
      const selectedVoice = selectBestVoice();
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      utterance.onstart = () => {
        // CRITICAL: Cancel if voice mode becomes active - check both flags
        if (voiceModeActive || window._voiceModeActive) {
          console.log('[Voice Mode] 🔇🔇🔇 CANCELING text-to-speech mid-speech - voice mode activated');
          window.speechSynthesis.cancel();
          window.speechSynthesis.cancel(); // Double cancel
          currentSpeech = null;
          return;
        }
        // Visual feedback that audio is playing
        if (audioToggle) {
          audioToggle.style.opacity = '0.7';
        }
      };
      
      // Add error handler to catch any issues
      utterance.onerror = (event) => {
        console.log('[TTS] Speech synthesis error:', event.error);
        currentSpeech = null;
      };
      
      utterance.onend = () => {
        currentSpeech = null;
        if (audioToggle) {
          audioToggle.style.opacity = '1';
        }
      };
      
      // Add error handler to catch any issues
      utterance.onerror = (event) => {
        console.log('[TTS] Speech synthesis error:', event.error);
        currentSpeech = null;
      };
      
      utterance.onerror = (e) => {
        console.error('Speech synthesis error:', e);
        currentSpeech = null;
        if (audioToggle) {
          audioToggle.style.opacity = '1';
        }
      };
      
      currentSpeech = utterance;
      
      // Wait for voices to load if needed
      // FINAL FINAL CHECK: Cancel if voice mode is active right before speaking - check both flags
      if (voiceModeActive || window._voiceModeActive) {
        console.log('[Voice Mode] 🔇🔇🔇 BLOCKING text-to-speech - voice mode is active (pre-speak check)');
        window.speechSynthesis.cancel();
        window.speechSynthesis.cancel(); // Double cancel
        currentSpeech = null;
        return;
      }
      
      if (window.speechSynthesis.getVoices().length === 0) {
        // Voices not loaded yet, wait for them
        window.speechSynthesis.addEventListener('voiceschanged', function onVoicesChanged() {
          window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
          
          // Check again before speaking - check both flags
          if (voiceModeActive || window._voiceModeActive) {
            console.log('[Voice Mode] 🔇🔇 BLOCKING text-to-speech - voice mode is active (voices loaded check)');
            window.speechSynthesis.cancel();
            window.speechSynthesis.cancel(); // Double cancel
            currentSpeech = null;
            return;
          }
          
          const voice = selectBestVoice();
          if (voice) {
            utterance.voice = voice;
          }
          
          // One more check - check both flags
          if (!voiceModeActive && !window._voiceModeActive) {
          window.speechSynthesis.speak(utterance);
          } else {
            console.log('[Voice Mode] 🔇 BLOCKING text-to-speech - voice mode is active (final pre-speak)');
            window.speechSynthesis.cancel();
            window.speechSynthesis.cancel(); // Double cancel
            currentSpeech = null;
          }
        }, { once: true });
      } else {
        // Final check before speaking - check both flags
        if (!voiceModeActive && !window._voiceModeActive) {
        window.speechSynthesis.speak(utterance);
        } else {
          console.log('[Voice Mode] 🔇 BLOCKING text-to-speech - voice mode is active (immediate pre-speak)');
          window.speechSynthesis.cancel();
          window.speechSynthesis.cancel(); // Double cancel
          currentSpeech = null;
        }
      }
    }
    
    // Preload voices for better voice selection
    if ('speechSynthesis' in window) {
      // Force voices to load by creating a dummy utterance
      if (speechSynthesis.getVoices().length === 0) {
        const dummy = new SpeechSynthesisUtterance('');
        speechSynthesis.speak(dummy);
        speechSynthesis.cancel();
      }
      
      // Log available voices for debugging (remove in production)
      speechSynthesis.addEventListener('voiceschanged', () => {
        const voices = speechSynthesis.getVoices();
        console.log('Available voices:', voices.filter(v => v.lang.startsWith('en')).map(v => v.name));
      }, { once: true });
    }
    
    // Image generation is now fully handled by the backend
    // The backend auto-detects image requests and generates images alongside GPT responses
    // All messages go through the unified ask() function

    const setPos = (x, y) => {
      this.pos = { x, y };
      wrap.style.left = x + 'px';
      wrap.style.top = y + 'px';
    };

    const setSize = (w, h) => {
      // Minimum sizes to ensure all buttons and UI elements remain visible
      const MIN_WIDTH = 360;  // Enough for mode toggle + input + send button + padding
      const MIN_HEIGHT = 600; // Enough for header + body + voice panel + input area + padding
      
      this.size = { 
        w: Math.max(MIN_WIDTH, Math.min(w, window.innerWidth - 48)), 
        h: Math.max(MIN_HEIGHT, Math.min(h, window.innerHeight - 48)) 
      };
      wrap.style.width = this.size.w + 'px';
      wrap.style.height = this.size.h + 'px';
    };

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    // Position dragging
    const startDrag = (clientX, clientY) => {
      this.dragging = true;
      this.start = { x: clientX, y: clientY };
      this.startPos = { ...this.pos };
      head.style.cursor = 'grabbing';
    };

    const onMove = (clientX, clientY) => {
      if (!this.dragging || !this.start || !this.startPos) return;
      const nx = this.startPos.x + (clientX - this.start.x);
      const ny = this.startPos.y + (clientY - this.start.y);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const wrapWidth = wrap.offsetWidth;
      const wrapHeight = wrap.offsetHeight;
      setPos(
        clamp(nx, 12, w - 12 - wrapWidth),
        clamp(ny, 12, h - 12 - wrapHeight)
      );
    };

    const stopDrag = () => {
      this.dragging = false;
      head.style.cursor = 'grab';
    };

    // Resize functionality
    const startResize = (clientX, clientY) => {
      this.resizing = true;
      this.start = { x: clientX, y: clientY };
      this.startSize = { ...this.size };
      this.startPos = { ...this.pos };
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';
    };

    const onResize = (clientX, clientY) => {
      if (!this.resizing || !this.start || !this.startSize || !this.startPos) return;
      const deltaX = clientX - this.start.x;
      const deltaY = clientY - this.start.y;
      const newW = this.startSize.w + deltaX;
      const newH = this.startSize.h + deltaY;
      
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      // Calculate maximum sizes based on window and position
      const maxW = w - this.pos.x - 12;
      const maxH = h - this.pos.y - 12;
      
      // Enforce minimum sizes (setSize will also enforce, but we do it here for clarity)
      const MIN_WIDTH = 360;
      const MIN_HEIGHT = 450;
      
      const constrainedW = Math.max(MIN_WIDTH, Math.min(newW, maxW));
      const constrainedH = Math.max(MIN_HEIGHT, Math.min(newH, maxH));
      
      setSize(constrainedW, constrainedH);
      
      // Adjust position if needed to keep widget on screen
      if (this.pos.x + this.size.w > w - 12) {
        setPos(w - 12 - this.size.w, this.pos.y);
      }
      if (this.pos.y + this.size.h > h - 12) {
        setPos(this.pos.x, h - 12 - this.size.h);
      }
    };

    const stopResize = () => {
      this.resizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    // Drag handlers - check target to avoid dragging on button clicks
    head.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON' || this.resizing) return;
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    });
    
    window.addEventListener('mousemove', (e) => {
      if (this.resizing) {
        onResize(e.clientX, e.clientY);
      } else {
        onMove(e.clientX, e.clientY);
      }
    });
    window.addEventListener('mouseup', () => {
      stopDrag();
      stopResize();
    });

    head.addEventListener('touchstart', (e) => {
      if (e.target.tagName === 'BUTTON' || this.resizing) return;
      const t = e.touches[0];
      if (t) {
        e.preventDefault();
        startDrag(t.clientX, t.clientY);
      }
    }, { passive: false });
    
    window.addEventListener('touchmove', (e) => {
      if (this.dragging) {
        e.preventDefault();
      }
      const t = e.touches[0];
      if (t) {
        if (this.resizing) {
          onResize(t.clientX, t.clientY);
        } else {
          onMove(t.clientX, t.clientY);
        }
      }
    }, { passive: false });
    
    window.addEventListener('touchend', () => {
      stopDrag();
      stopResize();
    });

    // Resize handlers
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startResize(e.clientX, e.clientY);
    });

    resizeHandle.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const t = e.touches[0];
      if (t) startResize(t.clientX, t.clientY);
    }, { passive: false });

    // Tutorial functionality
    const tutorialOverlay = root.querySelector('#tutorialOverlay');
    const tutorialClose = root.querySelector('.tutorial-close');
    const tutorialGotIt = root.querySelector('#tutorialGotIt');
    const dontShowAgain = root.querySelector('#dontShowAgain');
    const helpBtn = document.createElement('button');
    
    // Check if tutorial should be shown
    const shouldShowTutorial = () => {
      const dontShow = localStorage.getItem('noteworthy-ai-tutorial-dismissed') === 'true';
      return !dontShow;
    };
    
    // Show tutorial
    const showTutorial = () => {
      if (tutorialOverlay) {
        document.body.style.overflow = 'hidden';
        tutorialOverlay.classList.add('show');
        
        // Auto-expand first step
        const steps = root.querySelectorAll('.tutorial-step');
        if (steps.length > 0) {
          steps[0].classList.add('expanded');
        }
      }
    };
    
    // Hide tutorial
    const hideTutorial = (savePreference = false) => {
      if (tutorialOverlay) {
        tutorialOverlay.classList.remove('show');
        document.body.style.overflow = ''; // Restore scrolling
        
        if (savePreference && dontShowAgain && dontShowAgain.checked) {
          localStorage.setItem('noteworthy-ai-tutorial-dismissed', 'true');
        }
      }
    };
    
    // Add help button to header
    helpBtn.className = 'help-btn';
    helpBtn.innerHTML = '❓';
    helpBtn.setAttribute('aria-label', 'Show tutorial');
    helpBtn.title = `How to use ${brandTitle}`;
    helpBtn.style.cssText = `
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.7);
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      transition: all 0.2s ease;
      margin-right: 8px;
    `;
    helpBtn.onmouseenter = () => {
      helpBtn.style.background = 'rgba(74, 144, 226, 0.2)';
      helpBtn.style.color = 'rgba(74, 144, 226, 0.9)';
      helpBtn.style.transform = 'scale(1.1)';
    };
    helpBtn.onmouseleave = () => {
      helpBtn.style.background = 'transparent';
      helpBtn.style.color = 'rgba(255, 255, 255, 0.7)';
      helpBtn.style.transform = 'scale(1)';
    };
    helpBtn.onclick = (e) => {
      e.stopPropagation();
      showTutorial();
    };
    
    // Insert help button before close button
    const headRight = root.querySelector('.head-right');
    if (headRight && closeBtn) {
      headRight.insertBefore(helpBtn, closeBtn);
    }
    
    // Tutorial event handlers
    const tutorialSkip = root.querySelector('#tutorialSkip');
    const tutorialModal = tutorialOverlay?.querySelector('.tutorial-modal');
    const tutorialSteps = root.querySelectorAll('.tutorial-step');
    
    // Toggle step expansion
    tutorialSteps.forEach(step => {
      const toggle = step.querySelector('.tutorial-step-toggle');
      if (toggle) {
        toggle.onclick = (e) => {
          e.stopPropagation();
          step.classList.toggle('expanded');
        };
      }
      
      // Also toggle on step click (but not on toggle button)
      step.onclick = (e) => {
        if (e.target !== step.querySelector('.tutorial-step-toggle')) {
          step.classList.toggle('expanded');
        }
      };
    });
    
    if (tutorialClose) {
      tutorialClose.onclick = (e) => {
        e.stopPropagation();
        hideTutorial(false);
      };
    }
    
    if (tutorialSkip) {
      tutorialSkip.onclick = (e) => {
        e.stopPropagation();
        hideTutorial(false);
      };
    }
    
    if (tutorialGotIt) {
      tutorialGotIt.onclick = (e) => {
        e.stopPropagation();
        hideTutorial(true);
      };
    }
    
    // Close tutorial on overlay click (but not on modal click)
    if (tutorialOverlay && tutorialModal) {
      tutorialOverlay.onclick = (e) => {
        if (e.target === tutorialOverlay) {
          hideTutorial(false);
        }
      };
      
      // Prevent modal clicks from closing
      tutorialModal.onclick = (e) => {
        e.stopPropagation();
      };
    }
    
    // Close tutorial on Escape key (updated handler)
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        if (tutorialOverlay && tutorialOverlay.classList.contains('show')) {
          hideTutorial(false);
          return;
        }
        if (wrap.classList.contains('open')) {
          wrap.classList.remove('open');
          launcher.setAttribute('aria-expanded', 'false');
        }
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Toggle open/close
    launcher.onclick = () => {
      wrap.classList.toggle('open');
      if (wrap.classList.contains('open')) {
        launcher.setAttribute('aria-expanded', 'true');
        input.focus();
        
        // Show tutorial on first open if not dismissed
        if (shouldShowTutorial()) {
          // Small delay to let the chat open first
          setTimeout(() => {
            showTutorial();
          }, 300);
        }
      } else {
        launcher.setAttribute('aria-expanded', 'false');
      }
    };

    closeBtn.onclick = () => {
      wrap.classList.remove('open');
      launcher.setAttribute('aria-expanded', 'false');
    };

    // Image generation is now fully handled by the backend
    // The generateImage() function has been removed - all messages go through ask()

    /**
     * Play sound effect for call start/end
     */
    function playCallSound(type) {
      try {
        // Create audio context for sound effects
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        if (type === 'start') {
          // Start call: ascending tone (more positive/energetic)
          oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.15);
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.15);
        } else if (type === 'end') {
          // End call: descending tone (more final/complete)
          oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.2);
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.2);
        }
      } catch (error) {
        console.warn('[Voice Mode] Could not play sound effect:', error);
        // Silently fail - sound effects are nice-to-have
      }
    }

    /**
     * Open image in popup/lightbox
     * Also expose globally for onclick handlers
     */
    function openImagePopup(imageUrl, altText = 'Generated image') {
      // Remove existing popup if any
      const existingPopup = document.querySelector('#image-popup-overlay');
      if (existingPopup) {
        existingPopup.remove();
      }
      
      // Create overlay
      const overlay = document.createElement('div');
      overlay.id = 'image-popup-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.95);
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        animation: fadeIn 0.2s ease;
      `;
      
      // Create popup container
      const popup = document.createElement('div');
      popup.style.cssText = `
        position: relative;
        max-width: 90vw;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      `;
      
      // Create image
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = altText;
      img.style.cssText = `
        max-width: 100%;
        max-height: 80vh;
        object-fit: contain;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        cursor: default;
      `;
      
      // Create close button
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        border: 2px solid rgba(255, 255, 255, 0.3);
        color: white;
        font-size: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        z-index: 100001;
      `;
      closeBtn.onmouseenter = function() {
        this.style.background = 'rgba(255, 255, 255, 0.3)';
        this.style.transform = 'scale(1.1)';
      };
      closeBtn.onmouseleave = function() {
        this.style.background = 'rgba(255, 255, 255, 0.2)';
        this.style.transform = 'scale(1)';
      };
      
      // Create prompt text if available
      if (altText && altText !== 'Generated image') {
        const promptText = document.createElement('div');
        promptText.textContent = altText;
        promptText.style.cssText = `
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          text-align: center;
          max-width: 80%;
          padding: 12px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        `;
        popup.appendChild(promptText);
      }
      
      // Close handlers
      const closePopup = () => {
        overlay.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => overlay.remove(), 200);
      };
      
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closePopup();
      };
      
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          closePopup();
        }
      };
      
      // Close on Escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          closePopup();
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
      
      // Assemble popup
      popup.appendChild(img);
      overlay.appendChild(closeBtn);
      overlay.appendChild(popup);
      
      // Append to document body (outside shadow DOM)
      document.body.appendChild(overlay);
      
      // Add fade-in animation styles if not already present
      if (!document.head.querySelector('#image-popup-styles')) {
        const style = document.createElement('style');
        style.id = 'image-popup-styles';
        style.textContent = `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }
    }
    
    // Expose openImagePopup globally for onclick handlers
    window.openImagePopup = openImagePopup;

    // Helper function to show error messages
    function showError(message) {
      const errorGroup = document.createElement('div');
      errorGroup.className = 'message-group ai-msg-group';
      const err = document.createElement('div');
      err.className = 'error';
      err.innerHTML = `<strong><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: currentColor; display: inline-block; vertical-align: middle; margin-right: 0.25rem;"><path d="M12 2L2 22h20L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Error</strong><p>${message}</p>`;
      errorGroup.innerHTML = `
        <div class="message-avatar">
          <img src="${logoPath}" alt="Noteworthy News" />
        </div>
        <div class="message-content"></div>
      `;
      errorGroup.querySelector('.message-content').appendChild(err);
      body.appendChild(errorGroup);
      body.scrollTop = body.scrollHeight;
    }

    async function ask() {
      const message = input.value.trim();
      const hasFiles = uploadedFiles.length > 0;
      
      // Input validation
      if (message) {
        // Validate message length and content
        if (message.length > 2000) {
          showError('Message is too long. Please keep it under 2000 characters.');
          return;
        }
        
        // Check for potentially harmful content
        const blockedPatterns = [
          /<script/i,
          /javascript:/i,
          /on\w+\s*=/i,
        ];
        for (const pattern of blockedPatterns) {
          if (pattern.test(message)) {
            showError('Invalid characters in message. Please remove any script tags or event handlers.');
            return;
          }
        }
      }
      
      // Allow sending if there's a message OR files
      if (!message && !hasFiles) {
        return;
      }
      
      input.value = '';
      send.disabled = true;

      // Remove tip
      if (tip && tip.parentNode) {
        tip.style.display = 'none';
      }

      // Note: Image generation is now handled by the backend GPT chat function
      // The backend auto-detects image requests and generates images alongside GPT responses
      // So we just send all messages to the unified chat endpoint

      // Show user message with avatar
      const userGroup = document.createElement('div');
      userGroup.className = 'message-group user-msg-group';
      const userMsgContent = document.createElement('div');
      userMsgContent.className = 'user-msg';
      
      // Add uploaded images/files to message
      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach(file => {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const img = document.createElement('img');
              img.src = e.target.result;
              img.className = 'uploaded-image';
              img.alt = file.name;
              userMsgContent.appendChild(img);
            };
            reader.readAsDataURL(file);
          }
        });
      }
      
      // Add text message
      if (message) {
        const textNode = document.createElement('div');
        textNode.textContent = message;
        userMsgContent.appendChild(textNode);
      }
      
      userGroup.innerHTML = `
        <div class="message-avatar">You</div>
        <div class="message-content"></div>
      `;
      userGroup.querySelector('.message-content').appendChild(userMsgContent);
      body.appendChild(userGroup);
      body.scrollTop = body.scrollHeight;
      
      // Store files for sending
      const filesToSend = [...uploadedFiles];
      
      // Clear uploaded files after displaying
      uploadedFiles = [];
      const previewContainer = root.querySelector('.file-preview-container');
      if (previewContainer) {
        previewContainer.remove();
      }

      // Update header to show thinking mode
      const subText = root.querySelector('.sub');
      let originalSub = null;
      if (subText) {
        originalSub = subText.textContent;
        subText.textContent = '💭 Thinking…';
        subText.style.color = 'rgba(74, 144, 226, 0.9)';
        subText.style.fontWeight = '700';
      }
      
      // Show thinking indicator with NW logo - distinctive styling for chat
      const thinking = document.createElement('div');
      
      // Store original subtitle for restoration
      if (originalSub) {
        thinking._originalSub = originalSub;
      }
      thinking.className = 'message-group ai-msg-group';
      thinking.innerHTML = `
        <div class="message-avatar">
          <img src="${logoPath}" alt="Noteworthy News" />
        </div>
        <div class="message-content">
          <div class="thinking">
            <span class="thinking-icon">💭</span>
            <span class="spinner"></span>
            <span><strong>Thinking…</strong> Processing your question</span>
          </div>
        </div>
      `;
      body.appendChild(thinking);
      body.scrollTop = body.scrollHeight;
      
      // Set a timeout to show search indicator if request takes longer than 2 seconds
      // (this likely means a web search is happening)
      let searchTimeout = null;
      let searchIndicatorShown = false;
      
      // Function to show deep dive search indicator
      const showSearchIndicator = (query) => {
        if (searchIndicatorShown) return; // Don't show multiple times
        searchIndicatorShown = true;
        
        // Play search sound effect
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          // Create a "search" sound (two quick beeps)
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);
          
          // Second beep
          setTimeout(() => {
            const oscillator2 = audioContext.createOscillator();
            const gainNode2 = audioContext.createGain();
            oscillator2.connect(gainNode2);
            gainNode2.connect(audioContext.destination);
            oscillator2.frequency.setValueAtTime(1000, audioContext.currentTime);
            oscillator2.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
            gainNode2.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator2.start(audioContext.currentTime);
            oscillator2.stop(audioContext.currentTime + 0.1);
          }, 120);
        } catch (error) {
          console.warn('[Chat] Could not play search sound effect:', error);
        }
        
        // Create a separate search indicator message group for better visibility
        const searchGroup = document.createElement('div');
        searchGroup.className = 'message-group ai-msg-group search-indicator-group';
        searchGroup.innerHTML = `
          <div class="message-avatar">
            <img src="${logoPath}" alt="Noteworthy News" />
          </div>
          <div class="message-content">
            <div class="thinking searching">
              <span class="search-icon">🔍</span>
              <span class="search-spinner"></span>
              <span><strong>Deep Dive Research…</strong> Searching the web for: "${query || 'current information'}"</span>
            </div>
          </div>
        `;
        
        // Insert search indicator before the thinking message
        if (thinking && thinking.parentNode) {
          thinking.parentNode.insertBefore(searchGroup, thinking);
        } else {
          body.appendChild(searchGroup);
        }
        body.scrollTop = body.scrollHeight;
        
        // Update thinking indicator to show search as well
        const thinkingContent = thinking.querySelector('.thinking');
        if (thinkingContent) {
          thinkingContent.innerHTML = `
            <span class="search-icon">🔍</span>
            <span class="search-spinner"></span>
            <span><strong>Deep Dive Research…</strong> Searching the web for: "${query || 'current information'}"</span>
          `;
          thinkingContent.classList.add('searching');
        }
        
        // Update header subtitle
        if (subText) {
          subText.textContent = '🔍 Deep Research…';
          subText.style.color = 'rgba(74, 144, 226, 0.9)';
          subText.style.fontWeight = '700';
        }
      };

      try {
        // Regular chat response
        // Handle localhost vs production endpoint
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // Determine the correct endpoint
        let apiEndpoint = endpoint;
        if (endpoint === '/api/noteworthy' || !endpoint) {
          if (isLocalhost) {
            // Use direct function path for localhost
            apiEndpoint = 'http://localhost:8888/.netlify/functions/noteworthy-chat';
          } else {
            // In production, use direct function path (more reliable than redirect for POST)
            apiEndpoint = '/.netlify/functions/noteworthy-chat';
          }
        }

        console.log('Calling API:', { 
          endpoint: apiEndpoint, 
          method: 'POST', 
          message: message.substring(0, 50) + '...',
          isLocalhost: isLocalhost,
          hostname: window.location.hostname
        });
        
        // Set timeout to show search indicator if request takes longer than 2 seconds
        searchTimeout = setTimeout(() => {
          if (!searchIndicatorShown) {
            showSearchIndicator('current information');
          }
        }, 2000);

        let res;
        let lastError = null;
        
        // Prepare request body with files
        let requestBody;
        let fileData = null; // Store fileData for chat history
        let headers = { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };
        
        if (filesToSend.length > 0) {
          // Convert files to base64 for JSON
          const filePromises = filesToSend.map(file => {
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                const base64 = e.target.result.split(',')[1];
                resolve({
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  data: base64
                });
              };
              reader.readAsDataURL(file);
            });
          });
          
          fileData = await Promise.all(filePromises);
          requestBody = JSON.stringify({ 
            message: message || '',
            files: fileData,
            chatHistory: chatHistory
          });
        } else {
          // Regular JSON request with chat history
          requestBody = JSON.stringify({ 
            message: message,
            chatHistory: chatHistory
          });
        }
        
        // Try primary endpoint
        try {
          res = await fetch(apiEndpoint, {
            method: 'POST',
            headers: headers,
            body: requestBody,
          });
          console.log('Fetch response:', { ok: res.ok, status: res.status, statusText: res.statusText });
        } catch (fetchError) {
          // Clear search timeout on error
          if (searchTimeout) {
            clearTimeout(searchTimeout);
            searchTimeout = null;
          }
          console.error('Fetch error:', fetchError);
          lastError = fetchError;
          
          // If we tried direct function path and it failed, try redirect path as fallback
          if (!isLocalhost && apiEndpoint === '/.netlify/functions/noteworthy-chat') {
            console.warn('Direct function path failed, trying redirect path:', fetchError);
            apiEndpoint = '/api/noteworthy';
            try {
              res = await fetch(apiEndpoint, {
                method: 'POST',
                headers: headers,
                body: requestBody,
              });
              console.log('Redirect path response:', { ok: res.ok, status: res.status });
            } catch (redirectError) {
              console.error('Redirect path also failed:', redirectError);
              throw new Error(`Failed to connect to API. Network error: ${fetchError.message || fetchError}`);
            }
          } else if (isLocalhost && apiEndpoint.includes('localhost:8888')) {
            // If localhost fails, try the redirect path as fallback
            console.warn('Localhost direct path failed, trying redirect:', fetchError);
            apiEndpoint = '/api/noteworthy';
            try {
              res = await fetch(apiEndpoint, {
                method: 'POST',
                headers: headers,
                body: requestBody,
              });
              console.log('Redirect path response:', { ok: res.ok, status: res.status });
            } catch (redirectError) {
              console.error('Redirect path also failed:', redirectError);
              throw new Error(`Failed to connect to API. Make sure Netlify Dev is running. Error: ${fetchError.message || fetchError}`);
            }
          } else {
            throw new Error(`Failed to connect to API: ${fetchError.message || fetchError}`);
          }
        }

        // Clear search timeout once we get a response
        if (searchTimeout) {
          clearTimeout(searchTimeout);
          searchTimeout = null;
        }
        
        if (!res.ok) {
          let errorText;
          let isRateLimit = false;
          let resetIn = null;
          
          // Read response as text first to avoid body consumption issues
          try {
            const responseText = await res.text();
            console.error('API Error Response:', { status: res.status, text: responseText.substring(0, 200) });
            
            // Check for 501 error (Netlify Dev not running)
            if (res.status === 501 && isLocalhost) {
              throw new Error('Netlify Dev is not running. Please run "netlify dev" in your terminal to start the local development server.');
            }
            
            try {
              const errorData = JSON.parse(responseText);
              errorText = errorData.error || errorData.message || `Server error (${res.status})`;
              
              // Check if it's a rate limit error
              if (res.status === 429) {
                isRateLimit = true;
                resetIn = errorData.resetIn;
                errorText = errorData.message || `Rate limit exceeded. Please try again in ${resetIn || 'a few'} minute(s).`;
              }
            } catch (parseError) {
              // Not JSON, use raw text
              errorText = responseText || `Server error (${res.status})`;
              if (res.status === 429) {
                isRateLimit = true;
                errorText = 'Rate limit exceeded. You\'ve reached the limit of 10 messages per 30 minutes. Please wait before trying again.';
              } else if (res.status === 501 && isLocalhost) {
                errorText = 'Netlify Dev is not running. Please run "netlify dev" in your terminal to start the local development server.';
              }
            }
          } catch (readError) {
            console.error('Failed to read error response:', readError);
            if (readError.message && readError.message.includes('Netlify Dev')) {
              throw readError; // Re-throw the helpful error
            }
            errorText = `Server error (${res.status}). Unable to read error details.`;
          }
          
          const error = new Error(errorText);
          if (isRateLimit) {
            error.isRateLimit = true;
            error.resetIn = resetIn;
          }
          throw error;
        }

        let data;
        try {
          const responseText = await res.text();
          console.log('API Response text:', responseText.substring(0, 200));
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse API response:', parseError);
          throw new Error('Invalid response from server. Please try again.');
        }
        
        // Clear search timeout
        if (searchTimeout) {
          clearTimeout(searchTimeout);
          searchTimeout = null;
        }
        
        console.log('API Success:', { reply: data.reply?.substring(0, 50) + '...', hasImage: !!(data.image && data.image.imageUrl), searching: data.searching, searchQuery: data.searchQuery, fullData: data });
        
        // Check if search was performed (even if completed) - show indicator BEFORE removing thinking
        if (data.searchQuery || data.searching) {
          if (!searchIndicatorShown) {
            showSearchIndicator(data.searchQuery || 'current information');
          }
          // Keep thinking visible for a moment to show the search animation (longer if still searching)
          const delay = data.searching ? 3000 : 1500;
          setTimeout(() => {
            // Remove search indicator group if it exists
            const searchGroup = body.querySelector('.search-indicator-group');
            if (searchGroup && searchGroup.parentNode) {
              searchGroup.remove();
            }
            if (thinking && thinking.parentNode) {
              thinking.remove();
            }
          }, delay);
        } else {
          // Remove search indicator if it exists even if no search
          const searchGroup = body.querySelector('.search-indicator-group');
          if (searchGroup && searchGroup.parentNode) {
            searchGroup.remove();
          }
          thinking.remove();
        }
        
        if (!data || !data.reply) {
          console.error('API response missing reply field:', data);
          throw new Error('Server did not return a valid response. Please try again.');
        }
        
        // Restore header subtitle
        const subText = root.querySelector('.sub');
        if (subText && thinking._originalSub) {
          subText.textContent = thinking._originalSub;
          subText.style.color = '';
          subText.style.fontWeight = '';
        }

        // Show reply with NW logo
        const aiGroup = document.createElement('div');
        aiGroup.className = 'message-group ai-msg-group';
        const text = data.reply || 'No response.';
        const replyContent = document.createElement('div');
        replyContent.className = 'reply';
        replyContent.innerHTML = text.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('');

        // If image was generated, add it to the response
        if (data.image && data.image.imageUrl) {
          console.log('Adding generated image to response:', data.image.imageUrl.substring(0, 50) + '...');
          console.log('Full image data:', data.image);
          
          // Create image container
          const imageContainer = document.createElement('div');
          imageContainer.style.cssText = 'margin: 12px 0; width: 100%;';
          
          // Add custom name/title if available
          if (data.image.customName) {
            const nameTitle = document.createElement('p');
            nameTitle.style.cssText = 'font-size: 14px; color: rgba(255,255,255,0.9); margin: 0 0 8px 0; font-weight: 600;';
            nameTitle.textContent = data.image.customName;
            imageContainer.appendChild(nameTitle);
          }
          
          const imageEl = document.createElement('img');
          imageEl.src = data.image.imageUrl;
          imageEl.alt = data.image.customName || data.image.revisedPrompt || data.image.prompt || 'Generated image';
          imageEl.loading = 'lazy';
          imageEl.style.cssText = 'max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,.3); display: block; background: rgba(0,0,0,0.2); cursor: pointer; transition: transform 0.2s ease;';
          
          // Add hover effect
          imageEl.onmouseenter = function() {
            this.style.transform = 'scale(1.02)';
          };
          imageEl.onmouseleave = function() {
            this.style.transform = 'scale(1)';
          };
          
          // Add click handler to open image in popup
          imageEl.onclick = function(e) {
            e.stopPropagation();
            openImagePopup(this.src, data.image.customName || data.image.revisedPrompt || data.image.prompt || 'Generated image');
          };
          
          // Add loading state
          imageEl.style.opacity = '0.7';
          imageEl.style.transition = 'opacity 0.3s ease, transform 0.2s ease';
          
          imageEl.onload = function() {
            console.log('Image loaded successfully');
            this.style.opacity = '1';
          };
          
          imageEl.onerror = function() {
            console.error('Image failed to load:', this.src);
            this.style.display = 'none';
            const errorMsg = document.createElement('p');
            errorMsg.textContent = 'Failed to load image. The image URL may have expired. Please try generating again.';
            errorMsg.style.cssText = 'color: rgba(255, 100, 100, 0.9); padding: 12px; background: rgba(255, 100, 100, 0.1); border-radius: 8px; margin: 12px 0;';
            imageContainer.appendChild(errorMsg);
          };
          
          imageContainer.appendChild(imageEl);
          
          // Add prompt info below image
          if (data.image.revisedPrompt || data.image.prompt) {
            const promptText = document.createElement('p');
            promptText.style.cssText = 'font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 8px; font-style: italic;';
            promptText.innerHTML = `<strong>Prompt:</strong> ${(data.image.revisedPrompt || data.image.prompt).replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
            imageContainer.appendChild(promptText);
          }
          
          // Insert image container before the text content
          replyContent.insertBefore(imageContainer, replyContent.firstChild);
          
          console.log('Image element added to DOM');
        } else {
          console.log('No image data in response:', { hasImage: !!data.image, hasImageUrl: !!(data.image && data.image.imageUrl) });
        }

        aiGroup.innerHTML = `
          <div class="message-avatar">
            <img src="${logoPath}" alt="Noteworthy News" />
          </div>
          <div class="message-content"></div>
        `;
        aiGroup.querySelector('.message-content').appendChild(replyContent);
        
        // Check if email confirmation is needed (text chat mode)
        if (data.emailConfirmation) {
          console.log('[Text Chat] 📧 Email confirmation needed:', data.emailConfirmation);
          
          // Store email data for confirmation
          window._pendingEmail = {
            recipient_email: data.emailConfirmation.recipient_email,
            subject: data.emailConfirmation.subject,
            message: data.emailConfirmation.message,
            call_id: null, // Not used in text chat mode
            image_url: null,
            image_prompt: null
          };
          
          // If there's a generated image, include it
          if (data.image && data.image.imageUrl) {
            window._pendingEmail.image_url = data.image.imageUrl;
            window._pendingEmail.image_prompt = data.image.revisedPrompt || data.image.prompt || 'Generated image';
          }
          
          // Show confirmation UI
          showEmailConfirmationUI(
            data.emailConfirmation.recipient_email,
            data.emailConfirmation.subject,
            data.emailConfirmation.message,
            window._pendingEmail.image_url,
            window._pendingEmail.image_prompt
          );
        }
        
        body.appendChild(aiGroup);
        body.scrollTop = body.scrollHeight;
        
        // Update chat history with user message and AI response (only on success)
        // Store images in OpenAI format so they can be remembered and edited later
        if (fileData && fileData.length > 0) {
          // Build content array with text and images (matching OpenAI format)
          const userContent = [];
          
          // Add text message if provided
          if (message && message.trim()) {
            userContent.push({
              type: "text",
              text: message
            });
          }
          
          // Add images in OpenAI format using already-converted fileData
          fileData.forEach(file => {
            if (file.type && file.type.startsWith("image/") && file.data) {
              userContent.push({
                type: "image_url",
                image_url: {
                  url: `data:${file.type};base64,${file.data}`
                }
              });
            }
          });
          
          // Add user message with images to history
          chatHistory.push({
            role: 'user',
            content: userContent.length > 0 ? userContent : [{ type: "text", text: `[Uploaded ${fileData.length} file(s)]` }]
          });
        } else {
          // Regular text message - simple format
          chatHistory.push({
            role: 'user',
            content: message
          });
        }
        
        // Add assistant response
        chatHistory.push({
          role: 'assistant',
          content: text
        });
        
        // Keep only last 20 messages (10 exchanges) to avoid token limits
        if (chatHistory.length > 20) {
          chatHistory = chatHistory.slice(-20);
        }
        
        // CRITICAL: Text-to-speech for AI response (ONLY if NOT in voice mode - voice mode uses GPT's voice)
        // Cancel any existing TTS first, then check voice mode
        if (voiceModeActive) {
          window.speechSynthesis.cancel();
          if (currentSpeech) {
            currentSpeech = null;
          }
          console.log('[Voice Mode] 🔇 Blocked TTS in ask() function - voice mode is active');
        } else if (audioEnabled) {
          // Double-check voice mode didn't activate between check and call
          if (!voiceModeActive) {
          speakText(text);
          } else {
            console.log('[Voice Mode] 🔇 Blocked TTS - voice mode activated during check');
            window.speechSynthesis.cancel();
          }
        }
      } catch (e) {
        console.error('Ask function error:', e);
        
        // Don't add to chat history on error
        thinking.remove();
        
        // Restore header subtitle on error
        const subText = root.querySelector('.sub');
        if (subText && thinking && thinking._originalSub) {
          subText.textContent = thinking._originalSub;
          subText.style.color = '';
          subText.style.fontWeight = '';
        }
        
        const aiGroup = document.createElement('div');
        aiGroup.className = 'message-group ai-msg-group';
        const err = document.createElement('div');
        
        // Special styling for rate limit errors
        if (e?.isRateLimit) {
          err.className = 'error rate-limit-error';
          const message = e.message || 'Rate limit exceeded';
          const resetInfo = e.resetIn ? ` Try again in ${e.resetIn} minute(s).` : '';
          err.innerHTML = `
            <strong><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: currentColor; display: inline-block; vertical-align: middle; margin-right: 0.25rem;"><path d="M12 2L2 22h20L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Rate Limit Reached</strong>
            <p>${message}${resetInfo}</p>
            <p style="font-size: 12px; opacity: 0.8; margin-top: 8px;">
              Limit: 10 messages per 30 minutes
            </p>
          `;
        } else {
          err.className = 'error';
          // Show more detailed error message for debugging
          const errorMessage = e?.message || e?.toString() || 'Network error. Please try again.';
          console.error('Error details:', { message: errorMessage, error: e });
          
          // Check for Netlify Dev error
          if (errorMessage.includes('Netlify Dev is not running')) {
            err.innerHTML = `
              <strong>🚫 Development Server Required</strong>
              <p>${errorMessage}</p>
              <p style="font-size: 13px; opacity: 0.9; margin-top: 12px; line-height: 1.6;">
                <strong>To fix this:</strong><br>
                1. Install Netlify CLI: <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">npm install -g netlify-cli</code><br>
                2. Run: <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">netlify dev</code><br>
                3. Or deploy to production to test the live version
              </p>
            `;
          } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
            err.innerHTML = `
              <strong>Connection Error</strong>
              <p>Unable to connect to the server. Please check your internet connection and try again.</p>
              <p style="font-size: 12px; opacity: 0.8; margin-top: 8px;">
                Error: ${errorMessage}
              </p>
            `;
          } else if (errorMessage.includes('501') || errorMessage.includes('Unsupported method')) {
            err.innerHTML = `
              <strong>🚫 Development Server Required</strong>
              <p>The local server doesn't support serverless functions. You need to run Netlify Dev.</p>
              <p style="font-size: 13px; opacity: 0.9; margin-top: 12px; line-height: 1.6;">
                <strong>To fix this:</strong><br>
                1. Install Netlify CLI: <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">npm install -g netlify-cli</code><br>
                2. Run: <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">netlify dev</code><br>
                3. Open the URL shown by Netlify Dev (usually http://localhost:8888)
              </p>
            `;
          } else {
            err.textContent = errorMessage;
          }
        }
        
        aiGroup.innerHTML = `
          <div class="message-avatar">
            <img src="${logoPath}" alt="Noteworthy News" />
          </div>
          <div class="message-content"></div>
        `;
        aiGroup.querySelector('.message-content').appendChild(err);
        body.appendChild(aiGroup);
        body.scrollTop = body.scrollHeight;
      } finally {
        send.disabled = false;
      }
    }

    // Function to handle file processing (used by both file input and drag & drop)
    const handleFiles = (files) => {
      if (!files || files.length === 0) return;
      
      Array.from(files).forEach(file => {
        // Check file size (max 20MB)
        if (file.size > 20 * 1024 * 1024) {
          alert(`File "${file.name}" is too large. Maximum size is 20MB.`);
          return;
        }
        
        uploadedFiles.push(file);
        
        // Create file preview
        const preview = document.createElement('div');
        preview.className = 'file-preview';
        preview.dataset.fileName = file.name;
        
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            preview.appendChild(img);
          };
          reader.readAsDataURL(file);
        } else {
          const icon = document.createElement('span');
          icon.textContent = '📄';
          icon.style.fontSize = '24px';
          preview.appendChild(icon);
        }
        
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = file.name;
        const fileSize = document.createElement('div');
        fileSize.className = 'file-size';
        fileSize.textContent = formatFileSize(file.size);
        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileSize);
        preview.appendChild(fileInfo);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file';
        removeBtn.textContent = '×';
        removeBtn.setAttribute('aria-label', 'Remove file');
        removeBtn.onclick = () => {
          uploadedFiles = uploadedFiles.filter(f => f !== file);
          preview.remove();
          updateFilePreviewContainer();
        };
        preview.appendChild(removeBtn);
        
        // Insert preview before input area
        const inputContainer = root.querySelector('.input');
        if (inputContainer) {
          // Check if file preview container exists
          let previewContainer = root.querySelector('.file-preview-container');
          if (!previewContainer) {
            previewContainer = document.createElement('div');
            previewContainer.className = 'file-preview-container';
            previewContainer.style.cssText = 'padding: 0 20px 8px 20px; max-height: 200px; overflow-y: auto;';
            inputContainer.parentNode.insertBefore(previewContainer, inputContainer);
          }
          previewContainer.appendChild(preview);
          updateFilePreviewContainer();
        }
      });
    };
    
    // File upload handling
    if (fileUploadBtn && fileInput) {
      fileUploadBtn.addEventListener('click', () => {
        fileInput.click();
      });
      
      fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        // Reset file input
        fileInput.value = '';
      });
    }
    
    // Handle paste events for images - works on input and entire chat container
    // Use a flag to prevent duplicate processing when event bubbles
    let isProcessingPaste = false;
    
    const handlePaste = async (e) => {
      // Prevent duplicate processing if event bubbles from input to wrap
      if (isProcessingPaste) {
        return;
      }
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      const imageFiles = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Check if the item is an image
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            // Convert blob to File object with a name
            const fileName = `pasted-image-${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
            const file = new File([blob], fileName, { type: blob.type });
            imageFiles.push(file);
          }
        }
      }
      
      if (imageFiles.length > 0) {
        isProcessingPaste = true; // Set flag to prevent duplicate
        e.preventDefault(); // Prevent default paste behavior
        e.stopPropagation(); // Stop event from bubbling to parent
        
        // Create a FileList-like object
        const dataTransfer = new DataTransfer();
        imageFiles.forEach(file => dataTransfer.items.add(file));
        
        // Process the pasted images
        handleFiles(dataTransfer.files);
        
        // Show a brief visual feedback
        if (input) {
          const originalPlaceholder = input.placeholder;
          input.placeholder = `✓ ${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''} pasted!`;
          setTimeout(() => {
            input.placeholder = originalPlaceholder;
          }, 2000);
        }
        
        // Reset flag after a short delay
        setTimeout(() => {
          isProcessingPaste = false;
        }, 100);
      }
    };
    
    // Add paste listener to input field (with capture phase to catch it first)
    if (input) {
      input.addEventListener('paste', handlePaste, true);
    }
    
    // Add paste listener to the entire chat container (so it works even when input isn't focused)
    // Use capture: false so input handler processes first
    if (wrap) {
      wrap.addEventListener('paste', handlePaste, false);
      // Make the chat container focusable for paste events
      if (!wrap.hasAttribute('tabindex')) {
        wrap.setAttribute('tabindex', '-1');
      }
    }
    
    // Connectivity self-test function
    async function testConnectivity() {
      console.log('[Voice Mode] 🔍 Running connectivity self-test...');
      const results = {
        https: window.location.protocol === 'https:',
        websocketSupport: typeof WebSocket !== 'undefined',
        audioContextSupport: typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined',
        mediaDevicesSupport: navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
      };
      
      // Test API endpoint
      try {
        const healthCheck = await fetch('/.netlify/functions/realtime-voice', {
          method: 'OPTIONS'
        });
        results.apiEndpointReachable = healthCheck.status < 500;
      } catch (e) {
        results.apiEndpointReachable = false;
        results.apiError = e.message;
      }
      
      console.log('[Voice Mode] Connectivity test results:', results);
      
      if (!results.https) {
        console.warn('[Voice Mode] ⚠️ Page is not HTTPS - some features may not work');
      }
      if (!results.websocketSupport) {
        console.error('[Voice Mode] ❌ WebSocket not supported in this browser');
      }
      if (!results.audioContextSupport) {
        console.error('[Voice Mode] ❌ AudioContext not supported in this browser');
      }
      if (!results.mediaDevicesSupport) {
        console.error('[Voice Mode] ❌ MediaDevices API not supported in this browser');
      }
      if (!results.apiEndpointReachable) {
        console.error('[Voice Mode] ❌ API endpoint not reachable:', results.apiError);
      }
      
      return results;
    }
    
    // Voice mode functionality - Full Realtime API implementation
    // Premium Call UI State Management
    let audioWaveAnimationId = null;
    let currentUIState = 'idle'; // 'idle' | 'connecting' | 'listening' | 'speaking'
    
    function updateVoiceUIState(state) {
      const orbContainer = root.querySelector('#voiceOrbContainer');
      const statusChip = root.querySelector('#voiceStatusChip');
      const statusChipText = root.querySelector('.status-chip-text');
      const statusPrimary = root.querySelector('#voiceStatusPrimary');
      const statusSecondary = root.querySelector('#voiceStatusSecondary');
      const waveformRings = root.querySelector('#voiceWaveformRings');
      const processingRing = root.querySelector('#orbProcessingRing');
      const listeningHalo = root.querySelector('#orbListeningHalo');
      const voiceCallEndBtn = root.querySelector('#voiceCallEndBtn');
      
      if (!orbContainer || !statusPrimary) {
        if (DEBUG_VOICE) {
          console.warn('[Voice Mode] ⚠️ Premium call UI elements not found');
        }
        return;
      }
      
      // CRITICAL: Always ensure End Call and Mute buttons are visible during active states
      const voiceCallPanel = root.querySelector('#voiceCallPanel');
      const isPanelShown = voiceCallPanel && voiceCallPanel.classList.contains('show');
      const voiceMuteBtn = root.querySelector('#voiceControlMute');
      
      if (voiceCallEndBtn && (isPanelShown || state === 'connecting' || state === 'listening' || state === 'speaking' || state === 'processing')) {
        voiceCallEndBtn.style.display = 'flex';
        voiceCallEndBtn.style.visibility = 'visible';
        voiceCallEndBtn.style.opacity = '1';
      }
      
      // Show mute button when voice mode is active (not idle)
      if (voiceMuteBtn && (isPanelShown || state === 'connecting' || state === 'listening' || state === 'speaking' || state === 'processing')) {
        voiceMuteBtn.style.display = 'flex';
        voiceMuteBtn.style.visibility = 'visible';
        voiceMuteBtn.style.opacity = '1';
      }
      
      // Remove all state classes
      orbContainer.classList.remove('idle', 'connecting', 'listening', 'speaking', 'processing', 'error');
      if (statusChip) statusChip.classList.remove('listening', 'speaking', 'processing', 'error');
      if (statusPrimary) statusPrimary.classList.remove('listening', 'speaking', 'processing');
      
      currentUIState = state;
      
      switch (state) {
        case 'connecting':
          orbContainer.classList.add('connecting');
          if (statusChip) {
            statusChip.classList.add('processing');
            if (statusChipText) statusChipText.textContent = 'CONNECTING';
          }
          if (statusPrimary) {
            statusPrimary.classList.add('processing');
            statusPrimary.textContent = 'Establishing secure link...';
          }
          if (statusSecondary) statusSecondary.textContent = 'Initializing connection';
          if (processingRing) processingRing.style.display = 'block';
          if (listeningHalo) listeningHalo.style.display = 'none';
          if (waveformRings) waveformRings.style.display = 'none';
          stopAudioWaveAnimation();
          break;
          
        case 'listening':
          orbContainer.classList.add('listening');
          if (statusChip) {
            statusChip.classList.add('listening');
            if (statusChipText) statusChipText.textContent = 'LISTENING';
          }
          if (statusPrimary) {
            statusPrimary.classList.add('listening');
            statusPrimary.textContent = 'Listening...';
          }
          if (statusSecondary) statusSecondary.textContent = 'Awaiting input';
          if (processingRing) processingRing.style.display = 'none';
          if (listeningHalo) listeningHalo.style.display = 'block';
          if (waveformRings) waveformRings.style.display = 'none';
          stopAudioWaveAnimation();
          break;
          
        case 'processing':
          orbContainer.classList.add('processing');
          if (statusChip) {
            statusChip.classList.add('processing');
            if (statusChipText) statusChipText.textContent = 'PROCESSING';
          }
          if (statusPrimary) {
            statusPrimary.classList.add('processing');
            statusPrimary.textContent = 'Analyst processing...';
          }
          if (statusSecondary) statusSecondary.textContent = 'Analyzing request';
          if (processingRing) processingRing.style.display = 'block';
          if (listeningHalo) listeningHalo.style.display = 'none';
          if (waveformRings) waveformRings.style.display = 'none';
          stopAudioWaveAnimation();
          break;
          
        case 'speaking':
          orbContainer.classList.add('speaking');
          if (statusChip) {
            statusChip.classList.add('speaking');
            if (statusChipText) statusChipText.textContent = 'SPEAKING';
          }
          if (statusPrimary) {
            statusPrimary.classList.add('speaking');
            statusPrimary.textContent = 'Analyst speaking...';
          }
          if (statusSecondary) statusSecondary.textContent = 'Briefing in progress';
          if (processingRing) processingRing.style.display = 'none';
          if (listeningHalo) listeningHalo.style.display = 'none';
          if (waveformRings) waveformRings.style.display = 'block';
          startAudioWaveAnimation();
          break;
          
        case 'error':
          orbContainer.classList.add('error');
          if (statusChip) {
            statusChip.classList.add('error');
            if (statusChipText) statusChipText.textContent = 'ERROR';
          }
          if (statusPrimary) {
            statusPrimary.textContent = 'Connection error';
          }
          if (statusSecondary) statusSecondary.textContent = 'Reconnecting...';
          if (processingRing) processingRing.style.display = 'none';
          if (listeningHalo) listeningHalo.style.display = 'none';
          if (waveformRings) waveformRings.style.display = 'none';
          stopAudioWaveAnimation();
          break;
          
        case 'idle':
        default:
          orbContainer.classList.add('idle');
          if (statusChip) {
            if (statusChipText) statusChipText.textContent = 'IDLE';
          }
          if (statusPrimary) statusPrimary.textContent = 'Ready';
          if (statusSecondary) statusSecondary.textContent = 'Secure link established';
          if (processingRing) processingRing.style.display = 'none';
          if (listeningHalo) listeningHalo.style.display = 'none';
          if (waveformRings) waveformRings.style.display = 'none';
          stopAudioWaveAnimation();
          break;
      }
      
      if (DEBUG_VOICE) {
        console.log(`[Voice Mode] 🎨 UI State updated: ${state}`);
      }
    }
    
    // Audio wave animation with amplitude smoothing
    let smoothedAmplitude = 0;
    const amplitudeSmoothingFactor = 0.15; // Lower = smoother, higher = more reactive
    
    function startAudioWaveAnimation() {
      if (audioWaveAnimationId) return; // Already running
      
      const waveformRings = root.querySelector('#voiceWaveformRings');
      if (!waveformRings) return;
      
      const waveRings = waveformRings.querySelectorAll('.waveform-ring');
      if (waveRings.length === 0) return;
      
      // Check for reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      function animateWaves() {
        if (currentUIState !== 'speaking') {
          stopAudioWaveAnimation();
          return;
        }
        
        // Get real-time amplitude from VoiceAudioEngine if available
        let rawAmplitude = 0;
        if (voiceAudioEngine && typeof voiceAudioEngine.getAmplitude === 'function') {
          rawAmplitude = voiceAudioEngine.getAmplitude();
        } else {
          // Simulate gentle oscillation if amplitude not available
          rawAmplitude = 0.4 + Math.sin(Date.now() / 500) * 0.3;
        }
        
        // Smooth amplitude to prevent jittery animations
        smoothedAmplitude = smoothedAmplitude * (1 - amplitudeSmoothingFactor) + rawAmplitude * amplitudeSmoothingFactor;
        
        // Map amplitude (0-1) to wave intensity
        const baseIntensity = Math.max(0.2, Math.min(1, smoothedAmplitude * 1.2));
        
        // Scale the logo based on amplitude (grow with the waves)
        const orbLogo = root.querySelector('.orb-logo');
        if (orbLogo && !prefersReducedMotion) {
          // Logo scales from 1.0 to 1.15 based on amplitude
          const logoScale = 1.0 + (smoothedAmplitude * 0.15);
          orbLogo.style.transform = `scale(${logoScale})`;
          orbLogo.style.transition = 'transform 0.1s ease-out';
        }
        
        if (prefersReducedMotion) {
          // Static state for reduced motion
          waveRings.forEach((ring, index) => {
            const staticOpacity = 0.3 + (index * 0.1);
            ring.setAttribute('opacity', staticOpacity);
            ring.setAttribute('stroke-opacity', staticOpacity);
          });
          // Reset logo scale for reduced motion
          if (orbLogo) {
            orbLogo.style.transform = 'scale(1)';
          }
        } else {
          // Animated waveform rings
          waveRings.forEach((ring, index) => {
            const delay = index * 0.25;
            const time = Date.now() / 1000;
            const phase = (time + delay) % 1.8;
            const ringIntensity = baseIntensity * (1 - phase / 1.8) * (1 - index * 0.15);
            const opacity = Math.max(0.1, Math.min(0.8, ringIntensity));
            const scale = 1 + (ringIntensity * 0.1);
            
            ring.setAttribute('opacity', opacity);
            ring.setAttribute('stroke-opacity', opacity);
            ring.setAttribute('transform', `translate(100, 100) scale(${scale}) translate(-100, -100)`);
          });
        }
        
        audioWaveAnimationId = requestAnimationFrame(animateWaves);
      }
      
      animateWaves();
      
      if (DEBUG_VOICE) {
        console.log('[Voice Mode] 🌊 Audio wave animation started');
      }
    }
    
    function stopAudioWaveAnimation() {
      if (audioWaveAnimationId) {
        cancelAnimationFrame(audioWaveAnimationId);
        audioWaveAnimationId = null;
        smoothedAmplitude = 0;
        
        // Reset wave rings
        const waveformRings = root.querySelector('#voiceWaveformRings');
        if (waveformRings) {
          const waveRings = waveformRings.querySelectorAll('.waveform-ring');
          waveRings.forEach(ring => {
            ring.setAttribute('opacity', '0');
            ring.setAttribute('stroke-opacity', '0');
            ring.setAttribute('transform', 'translate(100, 100) scale(1) translate(-100, -100)');
          });
        }
        
        // Reset logo scale
        const orbLogo = root.querySelector('.orb-logo');
        if (orbLogo) {
          orbLogo.style.transform = 'scale(1)';
          orbLogo.style.transition = 'transform 0.3s ease-out';
        }
        
        if (DEBUG_VOICE) {
          console.log('[Voice Mode] 🌊 Audio wave animation stopped');
        }
      }
    }
    
    // ElevenLabs Text-to-Speech helper function
    // Note: Uses endpoint captured at top of connectedCallback to avoid 'this' context issues
    async function convertTextToElevenLabsAudio(text, voiceId) {
      if (!text || !text.trim()) {
        console.warn('[ElevenLabs] No text provided for conversion');
        return null;
      }
      
      try {
        // Use endpoint captured at top of connectedCallback (line 18)
        // This avoids 'this' context issues when function is called from nested scopes
        const elevenlabsEndpoint = endpoint.replace('/noteworthy-chat', '/elevenlabs-tts');
        
        console.log(`[ElevenLabs] Converting ${text.length} characters to audio with voice ${voiceId}`);
        
        const response = await fetch(elevenlabsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text,
            voice_id: voiceId
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `ElevenLabs API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Decode base64 audio
        const audioData = atob(data.audio);
        const audioBytes = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioBytes[i] = audioData.charCodeAt(i);
        }
        
        // Create audio blob
        const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        
        console.log(`[ElevenLabs] ✅ Audio generated successfully (${data.character_count} characters)`);
        
        return {
          audioUrl: audioUrl,
          blob: blob,
          characterCount: data.character_count,
          voiceId: voiceId
        };
      } catch (error) {
        console.error('[ElevenLabs] ❌ Error converting text to audio:', error);
        return null;
      }
    }
    
    // Helper to check if current voice is ElevenLabs
    function isElevenLabsVoiceSelected() {
      return currentVoice && currentVoice.startsWith('elevenlabs:');
    }
    
    // Helper to get ElevenLabs voice ID from current voice
    function getElevenLabsVoiceId() {
      if (!isElevenLabsVoiceSelected()) return null;
      // Extract voice ID from format "elevenlabs:VOICE_ID"
      const parts = currentVoice.split(':');
      return parts.length > 1 ? parts[1] : null;
    }
    
    async function startVoiceMode() {
      if (voiceModeActive) {
        stopVoiceMode();
        return;
      }
      
      // Reset retry counter on new attempt
      authRetryCount = 0;
      
      // DIAGNOSTIC: Log start of voice mode for tracking
      const attemptId = Date.now();
      connectionAttempts.push({
        id: attemptId,
        timestamp: new Date().toISOString(),
        voice: currentVoice,
        retryCount: authRetryCount
      });
      // Keep only last 10 attempts
      if (connectionAttempts.length > 10) {
        connectionAttempts.shift();
      }
      
      console.log('[Voice Mode] 🚀 Starting voice mode...');
      console.log('[Voice Mode] Attempt ID:', attemptId);
      console.log('[Voice Mode] Retry count:', authRetryCount);
      console.log('[Voice Mode] Current voice:', currentVoice);
      console.log('[Voice Mode] Timestamp:', new Date().toISOString());
      console.log('[Voice Mode] Total attempts this session:', connectionAttempts.length);
      
      try {
        // Pause all background music when voice call starts
        // This ensures the call audio is clear and not competing with background music
        musicStateBeforeCall = null; // Reset state
        if (typeof window.pauseAllMusicTracks === 'function') {
          try {
            musicStateBeforeCall = window.pauseAllMusicTracks();
            console.log('[Voice Mode] 🎵 Paused background music for voice call');
            if (musicStateBeforeCall && musicStateBeforeCall.wasPlaying) {
              console.log('[Voice Mode] Music was playing, will restore after call ends');
            }
          } catch (err) {
            console.warn('[Voice Mode] Could not pause background music:', err);
          }
        } else {
          // Fallback: manually pause ALL music elements (not just the first one)
          // This ensures NO background music plays during the voice call
          const backgroundMusic = document.getElementById('backgroundMusic');
          const backgroundMusicSecond = document.getElementById('backgroundMusicSecond');
          const backgroundMusicThird = document.getElementById('backgroundMusicThird');
          const backgroundMusicLoop = document.getElementById('backgroundMusicLoop');
          
          // Pause ALL playing music tracks - don't use else if, pause everything
          let anyMusicWasPlaying = false;
          
          if (backgroundMusic && !backgroundMusic.paused) {
            musicStateBeforeCall = { wasPlaying: true, currentTrack: backgroundMusic, currentTime: backgroundMusic.currentTime };
            backgroundMusic.pause();
            anyMusicWasPlaying = true;
            console.log('[Voice Mode] 🎵 Paused backgroundMusic');
          }
          
          if (backgroundMusicSecond && !backgroundMusicSecond.paused) {
            if (!musicStateBeforeCall) {
              musicStateBeforeCall = { wasPlaying: true, currentTrack: backgroundMusicSecond, currentTime: backgroundMusicSecond.currentTime };
            }
            backgroundMusicSecond.pause();
            anyMusicWasPlaying = true;
            console.log('[Voice Mode] 🎵 Paused backgroundMusicSecond');
          }
          
          if (backgroundMusicThird && !backgroundMusicThird.paused) {
            if (!musicStateBeforeCall) {
              musicStateBeforeCall = { wasPlaying: true, currentTrack: backgroundMusicThird, currentTime: backgroundMusicThird.currentTime };
            }
            backgroundMusicThird.pause();
            anyMusicWasPlaying = true;
            console.log('[Voice Mode] 🎵 Paused backgroundMusicThird');
          }
          
          if (backgroundMusicLoop && !backgroundMusicLoop.paused) {
            if (!musicStateBeforeCall) {
              musicStateBeforeCall = { wasPlaying: true, currentTrack: backgroundMusicLoop, currentTime: backgroundMusicLoop.currentTime };
            }
            backgroundMusicLoop.pause();
            anyMusicWasPlaying = true;
            console.log('[Voice Mode] 🎵 Paused backgroundMusicLoop');
          }
          
          if (anyMusicWasPlaying) {
            console.log('[Voice Mode] 🎵 ✅ ALL background music paused for voice call - you will ONLY hear the AI');
          } else {
            console.log('[Voice Mode] 🎵 No background music was playing');
          }
        }
        
        // Music state is already stored in module-level variable (musicStateBeforeCall)
        // It will be restored in stopVoiceMode() when the call ends
        
        // CRITICAL: Set flags FIRST before anything else - BEFORE connectivity test
        voiceModeActive = true;
        window._voiceModeActive = true; // Set global flag FIRST
        
        // Update UI to connecting state
        updateVoiceUIState('connecting');
        
        // Show premium call panel
        const voiceCallPanel = root.querySelector('#voiceCallPanel');
        const voiceCallEndBtn = root.querySelector('#voiceCallEndBtn');
        if (voiceCallPanel) {
          voiceCallPanel.classList.add('show');
          // Force display with inline style as backup
          voiceCallPanel.style.display = 'flex';
          voiceCallPanel.style.visibility = 'visible';
          voiceCallPanel.style.opacity = '1';
          if (DEBUG_VOICE) {
            console.log('[Voice Mode] ✅ Premium call panel shown');
          }
        }
        // CRITICAL: Ensure End Call button is always visible during voice calls
        if (voiceCallEndBtn) {
          voiceCallEndBtn.style.display = 'flex';
          voiceCallEndBtn.style.visibility = 'visible';
          voiceCallEndBtn.style.opacity = '1';
          voiceCallEndBtn.style.position = 'relative';
          voiceCallEndBtn.style.zIndex = '1000';
          if (DEBUG_VOICE) {
            console.log('[Voice Mode] ✅ End Call button made visible');
          }
        } else {
          console.error('[Voice Mode] ❌ CRITICAL: voiceCallEndBtn NOT FOUND!');
        }
        
        // Track call start time and reset transcripts
        voiceCallStartTime = Date.now();
        voiceCallTranscripts = [];
        console.log('[Voice Mode] 📞 Call started, tracking transcripts for summary');
        
        // CRITICAL: VoicePlaybackManager is now the single source of truth for audio playback
        // No need for global overrides - VoicePlaybackManager handles all playback and prevents overlap
        // Old queue guards removed - VoicePlaybackManager's state machine and generation IDs ensure single playback
        
        // CRITICAL: Override speechSynthesis.speak to completely block TTS during voice mode
        // Do this IMMEDIATELY, before anything else
        if (!window._originalSpeak) {
          window._originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
        }
        // Make override ALWAYS block if voice mode is active - no exceptions
        // This override will catch ALL calls to speechSynthesis.speak() from anywhere
        window.speechSynthesis.speak = function(utterance) {
          // ALWAYS cancel first, no matter what - be extremely aggressive
          window.speechSynthesis.cancel();
          window.speechSynthesis.cancel();
          
          // Check if voice mode is active - if so, ALWAYS block
          if (window._voiceModeActive || voiceModeActive) {
            console.log('[Voice Mode] 🔇🔇🔇 OVERRIDE: Blocking speechSynthesis.speak() call - voice mode active');
            window.speechSynthesis.cancel();
            window.speechSynthesis.cancel();
            window.speechSynthesis.cancel(); // Triple cancel
            // Also clear any current speech reference
            if (window.currentSpeech) {
              window.currentSpeech = null;
            }
            return; // NEVER call original speak if voice mode is active
          }
          
          // Even if flags aren't set, cancel once more to be safe
          window.speechSynthesis.cancel();
          return window._originalSpeak(utterance);
        };
        
        // CRITICAL: Override AudioBufferSourceNode.start() to enforce manager-only playback
        if (!window._originalBufferSourceStart) {
          // Save the original method (don't bind - we'll use apply with correct 'this')
          window._originalBufferSourceStart = AudioBufferSourceNode.prototype.start;
        }
        
        // Global guard: Only allow audio playback through voiceManager singleton
        AudioBufferSourceNode.prototype.start = function(...args) {
          // Check if this is from the voiceManager (it will set a flag)
          if (!window._allowAudioPlayback) {
            if (DEBUG_VOICE) {
              console.error('[Voice Mode] 🚫🚫🚫 BLOCKED AudioBufferSourceNode.start() - not from voiceManager!');
              console.trace('[Voice Mode] Blocked audio call - call stack:');
            }
            return; // Block completely
          }
          
          // Temporarily clear flag (only one call allowed per flag set)
          window._allowAudioPlayback = false;
          
          // Allow this playback - call original with correct 'this' context
          // 'this' here refers to the AudioBufferSourceNode instance
          return window._originalBufferSourceStart.apply(this, args);
        };
        
        if (DEBUG_VOICE) {
          console.log('[Voice Mode] 🔒✅ Overrode AudioBufferSourceNode.start() globally - only voiceManager can play audio');
        }
        
        // CRITICAL: Cancel any text-to-speech immediately when voice mode starts
        // Cancel multiple times to ensure it's stopped - be VERY aggressive
        console.log('[Voice Mode] 🔇🔇🔇 FORCE-CANCELING ALL TEXT-TO-SPEECH');
        window.speechSynthesis.cancel();
        window.speechSynthesis.cancel();
        window.speechSynthesis.cancel();
        window.speechSynthesis.cancel(); // Quadruple cancel
        if (currentSpeech) {
          currentSpeech = null;
        }
        
        // Run connectivity test AFTER blocking TTS
        await testConnectivity();
        
        // Clear displayed transcripts for new call
        displayedTranscripts.clear();
        // Reset audio playback state (VoiceAudioEngine handles this)
        if (voiceAudioEngine) {
          voiceAudioEngine.hardStop('voice mode restart');
        }
        // Legacy cleanup
        if (voicePlaybackManager) {
          voicePlaybackManager.stop();
        }
        currentAudioGeneration = null;
        activeGen = 0;
        activeResponseId = null;
        
        // Clear any pending utterances and stop all speech
        try {
          // Force stop all speech synthesis - clear the queue
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
          }
          if (window.speechSynthesis.pending) {
            window.speechSynthesis.cancel();
          }
          // Clear any queued utterances
          window.speechSynthesis.cancel();
        } catch (e) {
          console.warn('[Voice Mode] Error canceling speech:', e);
        }
        
        // Set up periodic check to ensure text-to-speech stays canceled
        if (voiceModeSpeechCheckInterval) {
          clearInterval(voiceModeSpeechCheckInterval);
        }
        voiceModeSpeechCheckInterval = setInterval(() => {
          if (voiceModeActive || window._voiceModeActive) {
            // EXTREMELY aggressively cancel any speech synthesis activity
            // Cancel ALWAYS, even if not speaking - be paranoid
            window.speechSynthesis.cancel();
            window.speechSynthesis.cancel();
            window.speechSynthesis.cancel();
            window.speechSynthesis.cancel(); // Quadruple cancel every check
            
            // Cancel if speaking or pending
            if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
              console.log('[Voice Mode] 🔇🔇🔇 FORCE-CANCELING text-to-speech (periodic check)');
              window.speechSynthesis.cancel();
              window.speechSynthesis.cancel();
              window.speechSynthesis.cancel();
              window.speechSynthesis.cancel(); // Quadruple cancel
              currentSpeech = null;
            }
            // Also cancel if there's any utterance queued
            if (currentSpeech) {
              console.log('[Voice Mode] 🔇 Clearing current speech reference (periodic check)');
              window.speechSynthesis.cancel();
              window.speechSynthesis.cancel();
              window.speechSynthesis.cancel();
              window.speechSynthesis.cancel(); // Quadruple cancel
              currentSpeech = null;
            }
          }
        }, 10); // Check every 10ms for EXTREMELY aggressive blocking (reduced from 25ms)
        if (voiceModeToggle) voiceModeToggle.classList.add('active');
        if (voiceStatusIntegrated) {
          voiceStatusIntegrated.style.display = 'block';
          voiceStatusIntegrated.classList.remove('error');
          voiceStatusIntegrated.classList.add('recording');
        }
        if (voiceStatusTextIntegrated) voiceStatusTextIntegrated.textContent = 'Connecting...';
        if (statusDotIntegrated) statusDotIntegrated.style.background = '#4A90E2';
        if (voiceStartBtnIntegrated) voiceStartBtnIntegrated.style.display = 'none';
        if (voiceStopBtnIntegrated) {
          voiceStopBtnIntegrated.style.display = 'flex';
          console.log('[Voice Mode] ✅ End call button should now be visible');
          // Verify button is actually visible and clickable
          setTimeout(() => {
            const rect = voiceStopBtnIntegrated.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const computedStyle = window.getComputedStyle(voiceStopBtnIntegrated);
            console.log('[Voice Mode] 🔍 End call button visibility check:', {
              display: computedStyle.display,
              visibility: computedStyle.visibility,
              opacity: computedStyle.opacity,
              pointerEvents: computedStyle.pointerEvents,
              rect: { width: rect.width, height: rect.height },
              isVisible: isVisible,
              hasClickHandler: voiceStopBtnIntegrated.onclick !== null || true // Event listeners don't show as onclick
            });
          }, 100);
        }
        
        // Show actions panel when starting call
        if (voiceActionsIntegrated) {
          voiceActionsIntegrated.style.display = 'flex';
        }
        
        // Ensure integrated panel is expanded
        if (voiceControlIntegrated && !voiceControlIntegrated.classList.contains('expanded')) {
          voiceControlIntegrated.classList.add('expanded');
        }
        
        // Get selected voice from integrated panel
        // Supported voices for OpenAI Realtime API
        const SUPPORTED_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
        
        if (voiceList) {
          const activeOption = voiceList.querySelector('.voice-option.active');
          if (activeOption) {
            const selectedVoice = activeOption.dataset.value;
            // Validate voice is supported
            if (SUPPORTED_VOICES.includes(selectedVoice)) {
              currentVoice = selectedVoice;
            } else {
              console.warn(`[Voice Mode] Unsupported voice "${selectedVoice}" selected, using default "alloy"`);
              currentVoice = 'alloy';
              // Update the active option to alloy
              activeOption.classList.remove('active');
              const alloyOption = voiceList.querySelector('.voice-option[data-value="alloy"]');
              if (alloyOption) {
                alloyOption.classList.add('active');
              }
            }
          }
        }
        // Fallback to default
        if (!currentVoice || !SUPPORTED_VOICES.includes(currentVoice)) {
          currentVoice = 'alloy';
        }
        
        // Run connectivity test first
        await testConnectivity();
        
        // Request microphone permission
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (permissionError) {
          console.error('[Voice Mode] ❌ Microphone permission denied:', permissionError);
          throw new Error(`Microphone access denied: ${permissionError.message}. Please allow microphone access and try again.`);
        }
        
        // Create audio context (only if one doesn't already exist)
        if (audioContext && audioContext.state !== 'closed') {
          console.warn('[Voice Mode] ⚠️ AudioContext already exists, closing old one');
          try {
            audioContext.close();
          } catch (e) {
            console.warn('[Voice Mode] Error closing old AudioContext:', e);
          }
        }
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 24000, // OpenAI Realtime API uses 24kHz
        });
        console.log('[Voice Mode] ✅ Created new AudioContext, state:', audioContext.state);
        
        // CRITICAL: Initialize SINGLETON VoiceAudioEngine
        // This is THE ONLY audio output engine - enforces single pipeline with proper scheduling
        if (typeof window !== 'undefined' && window.voiceAudioEngine) {
          // Initialize singleton with AudioContext
          window.voiceAudioEngine.initialize(audioContext);
          voiceAudioEngine = window.voiceAudioEngine; // Use singleton
          
          // Wire up state callbacks for UI updates
          voiceAudioEngine.onListeningStateChange = (isListening) => {
            if (isListening) {
              updateVoiceUIState('listening');
            }
          };
          
          voiceAudioEngine.onSpeakingStateChange = (isSpeaking) => {
            if (isSpeaking) {
              updateVoiceUIState('speaking');
            } else {
              // Only switch to listening if we're not connecting
              if (currentUIState !== 'connecting') {
                updateVoiceUIState('listening');
              }
            }
          };
          
          if (DEBUG_VOICE) {
            console.log('[Voice Mode] ✅ Using SINGLETON VoiceAudioEngine (only ONE instance globally)');
            console.log('[Voice Mode] 📊 Engine ID:', voiceAudioEngine.engineId);
          }
        } else if (typeof window !== 'undefined' && !window.voiceAudioEngine) {
          console.error('[Voice Mode] ❌ CRITICAL: voiceAudioEngine singleton not available!');
          console.error('[Voice Mode] Make sure voice-audio-engine.js is loaded BEFORE noteworthy-chat.js');
          console.error('[Voice Mode] Check index.html script order');
        } else {
          console.error('[Voice Mode] ❌ VoiceAudioEngine not loaded! Make sure voice-audio-engine.js is included.');
        }
        
        // Legacy: Keep voicePlaybackManager reference for backwards compatibility (will be removed)
        if (typeof window !== 'undefined' && window.voiceManager) {
          voicePlaybackManager = window.voiceManager;
        }
        
        // CRITICAL: Resume AudioContext if suspended (browsers suspend until user interaction)
        // This ensures audio can play when we receive audio chunks
        if (audioContext.state === 'suspended') {
          console.log('[Voice Mode] 🔊 AudioContext is suspended, attempting to resume...');
          audioContext.resume().then(() => {
            console.log('[Voice Mode] ✅ AudioContext resumed successfully, state:', audioContext.state);
          }).catch(err => {
            console.error('[Voice Mode] ❌ Failed to resume AudioContext:', err);
          });
        }
        
        // Create session with backend (use captured endpoint from outer scope)
        // Handle both '/.netlify/functions/noteworthy-chat' and '/api/noteworthy' endpoints
        let realtimeEndpoint;
        if (endpoint.includes('/noteworthy-chat')) {
          realtimeEndpoint = endpoint.replace('/noteworthy-chat', '/realtime-voice');
        } else if (endpoint.includes('/noteworthy')) {
          realtimeEndpoint = endpoint.replace('/noteworthy', '/realtime-voice');
        } else {
          // Fallback to direct path
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          realtimeEndpoint = isLocalhost 
            ? 'http://localhost:8888/.netlify/functions/realtime-voice'
            : '/.netlify/functions/realtime-voice';
        }
        
        console.log('[Voice Mode] Requesting session from:', realtimeEndpoint, 'with voice:', currentVoice);
        
        // Retry logic for fetching ephemeral token (handles intermittent failures)
        const MAX_RETRIES = 3;
        const RETRY_DELAYS = [500, 1000, 2000]; // Exponential backoff: 500ms, 1s, 2s
        let sessionData;
        let lastError;
        
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            if (attempt > 0) {
              const delay = RETRY_DELAYS[attempt - 1];
              console.log(`[Voice Mode] Retrying token fetch (attempt ${attempt + 1}/${MAX_RETRIES}) after ${delay}ms...`);
              if (voiceStatusTextIntegrated) {
                voiceStatusTextIntegrated.textContent = `Retrying connection (${attempt + 1}/${MAX_RETRIES})...`;
              }
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            const sessionRes = await fetch(realtimeEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ voice: currentVoice }),
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!sessionRes.ok) {
              let errorData;
              try {
                const text = await sessionRes.text();
                errorData = text ? JSON.parse(text) : { error: 'Unknown error' };
              } catch (e) {
                errorData = { error: `HTTP ${sessionRes.status}: ${sessionRes.statusText}` };
              }
              
              // Don't retry on 4xx errors (client errors)
              if (sessionRes.status >= 400 && sessionRes.status < 500) {
                console.error('[Voice Mode] Client error (not retrying):', {
                  status: sessionRes.status,
                  statusText: sessionRes.statusText,
                  error: errorData,
                  endpoint: realtimeEndpoint
                });
                
                if (voiceStatusTextIntegrated) {
                  voiceStatusTextIntegrated.textContent = `Error: ${errorData.error || errorData.message || 'Failed to connect'}`;
                }
                if (voiceStatusIntegrated) {
                  voiceStatusIntegrated.classList.add('error');
                  voiceStatusIntegrated.classList.remove('recording');
                }
                
                throw new Error(errorData.error || errorData.message || `Failed to create voice session: ${sessionRes.status} ${sessionRes.statusText}`);
              }
              
              // Retry on 5xx errors (server errors)
              lastError = new Error(errorData.error || errorData.message || `Server error: ${sessionRes.status} ${sessionRes.statusText}`);
              console.warn(`[Voice Mode] Server error (will retry):`, {
                attempt: attempt + 1,
                status: sessionRes.status,
                error: errorData
              });
              continue; // Retry
            }
            
            // Parse response
            const text = await sessionRes.text();
            sessionData = text ? JSON.parse(text) : {};
            
            // Support both ephemeralToken and ephemeral_token for compatibility
            const receivedToken = sessionData.ephemeralToken || sessionData.ephemeral_token;
            const tokenPreview = receivedToken ? receivedToken.substring(0, 8) + '...' : 'none';
            
            console.log('[Voice Mode] Session response received:', {
              attempt: attempt + 1,
              hasSessionId: !!sessionData.session_id,
              hasEphemeralToken: !!receivedToken,
              allKeys: Object.keys(sessionData),
              tokenLength: receivedToken ? receivedToken.length : 0,
              tokenPreview: tokenPreview,
              tokenStartsWithEk: receivedToken ? receivedToken.startsWith('ek_') : false
            });
            
            // CRITICAL VALIDATION: Check token format immediately upon receipt
            if (receivedToken && !receivedToken.startsWith('ek_')) {
              console.error('[Voice Mode] ❌ CRITICAL: Received token does not start with "ek_"!');
              console.error('[Voice Mode] Token from server (redacted):', tokenPreview);
              console.error('[Voice Mode] This token format is INVALID and will cause authentication failure!');
              console.error('[Voice Mode] Backend should return token starting with "ek_" from client_secret.value');
              lastError = new Error('Invalid token format received from server');
              continue; // Retry
            }
            
            // Check if token exists
            if (!receivedToken) {
              console.error(`[Voice Mode] ❌ No ephemeral token in response (attempt ${attempt + 1}/${MAX_RETRIES})`);
              console.error('[Voice Mode] Session data received:', {
                hasSessionId: !!sessionData.session_id,
                hasWebsocketUrl: !!sessionData.websocket_url,
                hasEphemeralToken: !!sessionData.ephemeralToken || !!sessionData.ephemeral_token,
                allKeys: Object.keys(sessionData)
              });
              lastError = new Error('No ephemeral token received from server');
              continue; // Retry
            }
            
            // Success! Token received and validated
            console.log(`[Voice Mode] ✅ Token received successfully on attempt ${attempt + 1}`);
            break; // Exit retry loop
            
          } catch (error) {
            // Handle abort (timeout)
            if (error.name === 'AbortError') {
              lastError = new Error('Request timeout - server took too long to respond');
              console.warn(`[Voice Mode] Request timeout (attempt ${attempt + 1}/${MAX_RETRIES})`);
              if (attempt < MAX_RETRIES - 1) {
                continue; // Retry
              }
            } else if (error.message.includes('Invalid token format') || error.message.includes('No ephemeral token')) {
              // These are retryable errors
              lastError = error;
              if (attempt < MAX_RETRIES - 1) {
                continue; // Retry
              }
            } else {
              // Non-retryable error (client errors, network errors, etc.)
              throw error;
            }
          }
        }
        
        // Check if we have valid session data after all retries
        if (!sessionData || (!sessionData.ephemeralToken && !sessionData.ephemeral_token)) {
          console.error('[Voice Mode] ❌ CRITICAL: No ephemeral token received after all retries!');
          console.error('[Voice Mode] Last error:', lastError);
          console.error('[Voice Mode] Final session data:', sessionData);
          
          if (voiceStatusTextIntegrated) {
            voiceStatusTextIntegrated.textContent = 'Connection failed - please try again';
          }
          if (voiceStatusIntegrated) {
            voiceStatusIntegrated.classList.add('error');
            voiceStatusIntegrated.classList.remove('recording');
          }
          
          throw new Error(lastError?.message || 'No ephemeral token received from server after multiple attempts');
        }
        
        // CRITICAL FIX: OpenAI Realtime API authenticates via WebSocket SUBPROTOCOLS, not URL parameters
        // Browser WebSockets cannot send headers, so we use subprotocols array
        // Format: ["realtime", "openai-insecure-api-key.{ephemeralToken}"]
        
        // Get token (support both ephemeralToken and ephemeral_token for compatibility)
        // Store in module scope so error handlers can access it
        const ephemeralToken = sessionData.ephemeralToken || sessionData.ephemeral_token;
        
        // Validate token format
        if (!ephemeralToken.startsWith('ek_')) {
          console.error('[Voice Mode] ❌ CRITICAL: Token does not start with "ek_" - INVALID FORMAT!');
          console.error('[Voice Mode] Token preview:', ephemeralToken.substring(0, 8) + '...');
          throw new Error('Invalid token format - token must start with "ek_"');
        }
        
        // Redact token in logs (show only first 8 chars)
        const tokenPreview = ephemeralToken.substring(0, 8) + '...';
        console.log('[Voice Mode] ✅ Ephemeral token received (redacted):', tokenPreview);
        console.log('[Voice Mode] Token format validated: starts with "ek_"');
        console.log('[Voice Mode] Token length:', ephemeralToken.length, 'characters');
        
        // Construct WebSocket URL - ONLY model parameter, NO token or session_id in URL
        // CRITICAL: Use 'gpt-realtime' for GA API (backend returns this, but fallback must match)
        const model = sessionData.model || 'gpt-realtime';
        const wsUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
        
        // CRITICAL: Use WebSocket subprotocols for authentication
        // Format: ["realtime", "openai-insecure-api-key.{ephemeralToken}"]
        const protocols = [
          "realtime",
          `openai-insecure-api-key.${ephemeralToken}`
        ];
        
        // Store token in module scope for error handlers (before creating websocket)
        // We'll attach it to websocket after creation
        
        console.log('[Voice Mode] 🔌 Creating WebSocket with subprotocol authentication...');
        console.log('[Voice Mode] URL:', wsUrl);
        console.log('[Voice Mode] Protocols:', ['realtime', `openai-insecure-api-key.${tokenPreview}`]);
        console.log('[Voice Mode] Session ID (for logging only):', sessionData.session_id || 'not provided');
        
        // Prevent multiple parallel connections
        if (websocket && (websocket.readyState === WebSocket.CONNECTING || websocket.readyState === WebSocket.OPEN)) {
          console.warn('[Voice Mode] Closing existing WebSocket before creating new one');
          websocket.close();
          websocket = null;
        }
        
        // Message queue for messages sent before connection is ready
        const messageQueue = [];
        let connectionStartTime = Date.now();
        
        // Create WebSocket with subprotocols (this is the correct authentication method)
        websocket = new WebSocket(wsUrl, protocols);
        
        // Store token on websocket for error handlers
        websocket._ephemeralToken = ephemeralToken;
        // Initialize speaking state flag
        websocket._isSpeaking = false;
        
        websocket.onopen = (event) => {
          const connectTime = Date.now() - connectionStartTime;
          console.log('[Voice Mode] ✅ WebSocket opened successfully');
          console.log('[Voice Mode] Connection time:', connectTime + 'ms');
          console.log('[Voice Mode] ReadyState:', websocket.readyState, '(OPEN = 1)');
          console.log('[Voice Mode] Protocol:', websocket.protocol || 'none');
          console.log('[Voice Mode] Extensions:', websocket.extensions || 'none');
          
          // SUCCESS: Connection opened = authentication succeeded via subprotocols
          // If we get here, the WebSocket handshake completed with subprotocol authentication
          console.log('[Voice Mode] ✅ SUCCESS: WebSocket handshake completed - subprotocol authentication successful!');
          console.log('[Voice Mode] 📊 Connection stats:', {
            attemptId: connectionAttempts.length > 0 ? connectionAttempts[connectionAttempts.length - 1].id : 'unknown',
            connectionTime: connectTime + 'ms',
            retryCount: authRetryCount,
            protocol: websocket.protocol || 'none',
            url: wsUrl,
            authenticationMethod: 'WebSocket subprotocols'
          });
          
          // Authentication happens via subprotocols during WebSocket handshake
          // No auth message needed - connection is already authenticated when onopen fires
          
          // Send queued messages
          while (messageQueue.length > 0) {
            const queuedMsg = messageQueue.shift();
            try {
              websocket.send(queuedMsg);
              console.log('[Voice Mode] Sent queued message');
            } catch (e) {
              console.error('[Voice Mode] Error sending queued message:', e);
            }
          }
          
          // Authentication happens via WebSocket subprotocols during handshake
          // Token is in subprotocol: "openai-insecure-api-key.{ephemeralToken}"
          // No auth message needed - connection is already authenticated when onopen fires
          console.log('[Voice Mode] ✅ WebSocket connected and authenticated (subprotocol auth)');
          
          // Set a flag to track authentication
          // Some implementations may send auth.success, but it's not required with subprotocol auth
          websocket._authenticated = true;
          
          // Start audio capture immediately - authentication is complete
          // If OpenAI sends auth.success message, we'll handle it but don't need to wait
          console.log('[Voice Mode] 🎤 Starting audio capture (authenticated connection)');
          
          // Update UI to listening state
          updateVoiceUIState('listening');
          
          // Legacy status updates (for compatibility)
          if (voiceStatusTextIntegrated) voiceStatusTextIntegrated.textContent = 'Connected - Speak now!';
          if (voiceStatusIntegrated) {
            voiceStatusIntegrated.classList.remove('error');
            voiceStatusIntegrated.classList.add('recording');
          }
          if (statusDotIntegrated) statusDotIntegrated.style.background = '#4A90E2';
          isRecording = true;
          startAudioCapture();
          
          // Hide ALL voice settings/controls since call is active
          const voiceControlContent = root.querySelector('#voiceControlContent');
          const voiceSelectorIntegrated = root.querySelector('.voice-selector-integrated');
          const voiceControlIntegrated = root.querySelector('#voiceControlIntegrated');
          const voiceControlHeader = root.querySelector('#voiceControlHeader');
          
          if (voiceControlContent) {
            voiceControlContent.style.display = 'none';
            console.log('[Voice Mode] 🔇 Hiding voice control content (call active)');
          }
          if (voiceSelectorIntegrated) {
            voiceSelectorIntegrated.style.display = 'none';
          }
          if (voiceControlIntegrated) {
            voiceControlIntegrated.style.display = 'none';
            console.log('[Voice Mode] 🔇 Hiding voice control integrated panel (call active)');
          }
          if (voiceControlHeader) {
            voiceControlHeader.style.display = 'none';
          }
          
          // Ensure End Call button stays visible during the call
          if (voiceStopBtnIntegrated) {
            voiceStopBtnIntegrated.style.display = 'flex';
            console.log('[Voice Mode] ✅ End call button visible during call');
          }
          
          // Play start call sound effect
          playCallSound('start');
          
          // Show sidebar for voice call results
          showVoiceSidebar();
          
          // Trigger AI to speak first with greeting
          // Wait a brief moment for connection to be fully ready, then trigger response
          setTimeout(() => {
            if (websocket && websocket.readyState === WebSocket.OPEN) {
              console.log('[Voice Mode] 👋 Triggering AI to speak first...');
              try {
                // Send response.create to trigger AI to generate and speak the greeting
                // The instructions in the session already tell it to greet with "Hey, It's Noteworthy News AI"
                hasActiveResponse = true; // Mark as active before sending
                websocket.send(JSON.stringify({
                  type: 'response.create'
                }));
                console.log('[Voice Mode] ✅ Sent response.create to trigger initial greeting');
              } catch (error) {
                console.error('[Voice Mode] ❌ Error sending initial greeting:', error);
              }
            } else {
              console.warn('[Voice Mode] ⚠️ WebSocket not ready for initial greeting, state:', websocket?.readyState);
            }
          }, 500); // Small delay to ensure connection is fully ready
        };
        
        // CRITICAL: Ensure only ONE message handler (prevent duplicate listeners)
        // Use global guard to prevent multiple handlers across reconnections
        if (window.__NW_VOICE_WS_BOUND__) {
          if (DEBUG_VOICE) {
            console.warn('[Voice Mode] ⚠️ WebSocket handler already bound globally, cleaning up old connection');
          }
          // Clean up old handler if it exists
          if (websocket._messageHandlerBound) {
            try {
              websocket.removeEventListener('message', websocket._messageHandlerBound);
            } catch (e) {
              // Ignore errors if handler was already removed
            }
          }
          // Reset global guard for this new connection
          window.__NW_VOICE_WS_BOUND__ = false;
        }
        
        // Create handler function
        const messageHandler = (event) => {
          handleWebSocketMessage(event);
        };
        
        // Mark as bound to prevent duplicates (both on websocket and globally)
        websocket._messageHandlerBound = messageHandler;
        window.__NW_VOICE_WS_BOUND__ = true;
        websocket.onmessage = messageHandler; // Use onmessage (not addEventListener) to ensure single handler
        
        if (DEBUG_VOICE) {
          console.log('[Voice Mode] ✅ WebSocket message handler bound (single handler guaranteed)');
          console.log('[Voice Mode] 📊 Handler ID:', websocket._messageHandlerBound ? 'bound' : 'not bound');
          console.log('[Voice Mode] 📊 Global guard:', window.__NW_VOICE_WS_BOUND__);
        }
        
        websocket.onerror = (error) => {
          const errorTime = Date.now() - connectionStartTime;
          console.error('[Voice Mode] ❌ WebSocket error event');
          
          // Properly serialize error details
          const errorDetails = {
            type: error.type || 'unknown',
            time: errorTime + 'ms after connection attempt',
            readyState: websocket?.readyState,
            readyStateText: websocket?.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
                           websocket?.readyState === WebSocket.OPEN ? 'OPEN' :
                           websocket?.readyState === WebSocket.CLOSING ? 'CLOSING' :
                           websocket?.readyState === WebSocket.CLOSED ? 'CLOSED' : 'UNKNOWN',
            url: logUrl,
            hasEphemeralToken: !!sessionData.ephemeral_token,
            sessionId: sessionData.session_id ? 'present' : 'missing',
            errorEvent: {
              type: error.type,
              target: error.target ? {
                readyState: error.target.readyState,
                url: error.target.url ? error.target.url.substring(0, 100) + '...' : 'no url'
              } : 'no target',
              error: error.error || 'No error object',
              message: error.message || 'No message'
            }
          };
          
          console.error('[Voice Mode] Error details:', errorDetails);
          console.error('[Voice Mode] Full error event:', error);
          
          // Try to get more error info from the error event
          if (error.target && error.target.readyState === WebSocket.CLOSED) {
            console.error('[Voice Mode] WebSocket closed unexpectedly during connection');
          }
          
          // Check if this is a connection-level error (before auth)
          if (errorTime < 5000 && !sessionData.ephemeral_token) {
            console.error('[Voice Mode] ⚠️ Connection error before authentication - token may be missing!');
          }
          
          if (voiceStatusTextIntegrated) {
            voiceStatusTextIntegrated.textContent = `Connection error (check console)`;
          }
          if (voiceStatusIntegrated) {
            voiceStatusIntegrated.classList.remove('recording');
            voiceStatusIntegrated.classList.add('error');
          }
          if (statusDotIntegrated) statusDotIntegrated.style.background = '#b00020';
        };
        
        websocket.onclose = (event) => {
          const closeTime = Date.now() - connectionStartTime;
          const closeCode = event.code || 'unknown';
          const closeReason = event.reason || 'No reason provided';
          const wasClean = event.wasClean !== undefined ? event.wasClean : false;
          
          console.log('[Voice Mode] 🔌 WebSocket closed');
          console.log('[Voice Mode] Close details:', {
            code: closeCode,
            reason: closeReason,
            wasClean: wasClean,
            duration: closeTime + 'ms',
            readyState: websocket?.readyState
          });
          
          // Diagnostic: Explain close codes
          const closeCodeMeanings = {
            1000: 'Normal closure',
            1001: 'Going away',
            1002: 'Protocol error',
            1003: 'Unsupported data',
            1006: 'Abnormal closure (no close frame)',
            1007: 'Invalid frame payload data',
            1008: 'Policy violation',
            1009: 'Message too big',
            1010: 'Extension error',
            1011: 'Internal server error',
            1012: 'Service restart',
            1013: 'Try again later',
            1014: 'Bad gateway',
            1015: 'TLS handshake failure'
          };
          
          if (closeCodeMeanings[closeCode]) {
            console.log('[Voice Mode] Close code meaning:', closeCodeMeanings[closeCode]);
          }
          
          if (voiceStatusTextIntegrated) {
            if (closeCode === 1006) {
              voiceStatusTextIntegrated.textContent = 'Connection lost (abnormal closure)';
            } else if (!wasClean) {
              voiceStatusTextIntegrated.textContent = `Disconnected (code ${closeCode})`;
            } else {
              voiceStatusTextIntegrated.textContent = 'Disconnected';
            }
          }
          if (voiceStatusIntegrated) {
            voiceStatusIntegrated.classList.remove('recording');
            voiceStatusIntegrated.classList.remove('error');
          }
          if (statusDotIntegrated) statusDotIntegrated.style.background = 'rgba(255, 255, 255, 0.5)';
          
          // Exponential backoff reconnection (max 3 retries)
          if (voiceModeActive && websocket) {
            const retryCount = (websocket._retryCount || 0) + 1;
            websocket._retryCount = retryCount;
            
            if (retryCount <= 3) {
              const backoffDelay = Math.min(2000 * Math.pow(2, retryCount - 1), 10000); // 2s, 4s, 8s, max 10s
              const jitter = Math.random() * 1000; // Add up to 1s jitter
              const delay = backoffDelay + jitter;
              
              console.log(`[Voice Mode] 🔄 Retrying connection in ${Math.round(delay)}ms (attempt ${retryCount}/3)`);
              if (voiceStatusTextIntegrated) {
                voiceStatusTextIntegrated.textContent = `Reconnecting in ${Math.round(delay/1000)}s...`;
              }
              
              setTimeout(() => {
                if (voiceModeActive && websocket?.readyState === WebSocket.CLOSED) {
                  console.log('[Voice Mode] 🔄 Attempting reconnection...');
                  startVoiceMode();
                }
              }, delay);
            } else {
              console.error('[Voice Mode] ❌ Max retries reached, stopping reconnection attempts');
              if (voiceStatusTextIntegrated) {
                voiceStatusTextIntegrated.textContent = 'Connection failed - please try again';
              }
              voiceModeActive = false;
              if (voiceModeToggle) voiceModeToggle.classList.remove('active');
            }
          }
        };
        
      } catch (error) {
        console.error('Error starting voice mode:', error);
        if (voiceStatusTextIntegrated) voiceStatusTextIntegrated.textContent = `Error: ${error.message}`;
        if (voiceStatusIntegrated) {
          voiceStatusIntegrated.classList.remove('recording');
          voiceStatusIntegrated.classList.add('error');
        }
        if (statusDotIntegrated) statusDotIntegrated.style.background = '#b00020';
        voiceModeActive = false;
        if (voiceModeToggle) voiceModeToggle.classList.remove('active');
        if (voiceStartBtnIntegrated) voiceStartBtnIntegrated.style.display = 'flex';
        if (voiceStopBtnIntegrated) voiceStopBtnIntegrated.style.display = 'none';
        // Keep actions visible on error so user can try again
        if (voiceActionsIntegrated) {
          voiceActionsIntegrated.style.display = 'flex';
        }
        alert(`Failed to start voice mode: ${error.message}`);
      }
    }
    
    // Voice sidebar functions (variables declared earlier to avoid temporal dead zone)
    function showVoiceSidebar() {
      if (voiceCallSidebar) {
        voiceCallSidebar.style.display = 'flex';
        console.log('[Voice Mode] 📋 Showing voice call sidebar');
      }
    }
    
    function hideVoiceSidebar() {
      if (voiceCallSidebar) {
        voiceCallSidebar.style.display = 'none';
        console.log('[Voice Mode] 📋 Hiding voice call sidebar');
      }
    }
    
    // Show email confirmation UI
    function showEmailConfirmationUI(recipientEmail, subject, message, imageUrl = null, imagePrompt = null) {
      // Remove any existing email confirmation UI (search in document.body, not shadow DOM)
      const existing = document.body.querySelector('#email-confirmation-ui');
      if (existing) existing.remove();
      
      // Create confirmation UI with dark theme matching other modules
      const confirmationDiv = document.createElement('div');
      confirmationDiv.id = 'email-confirmation-ui';
      confirmationDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, 
          rgba(18, 24, 38, 0.98) 0%, 
          rgba(15, 23, 42, 0.96) 50%,
          rgba(12, 19, 35, 0.98) 100%);
        border-radius: 16px;
        box-shadow: 
          0 24px 64px rgba(0, 0, 0, 0.5),
          0 8px 24px rgba(0, 0, 0, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.05);
        padding: 24px;
        max-width: 600px;
        width: 90%;
        max-height: 85vh;
        overflow-y: auto;
        z-index: 2147483100;
        border: 1.5px solid rgba(74, 144, 226, 0.3);
      `;
      
      confirmationDiv.innerHTML = `
        <h3 style="margin: 0 0 20px 0; color: #fff; font-size: 20px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
          <span>📧</span>
          <span>Confirm Email</span>
        </h3>
        <div style="margin-bottom: 16px;">
          <label style="display: block; color: rgba(255, 255, 255, 0.9); font-weight: 600; margin-bottom: 8px; font-size: 14px;">To:</label>
          <input type="email" id="email-to-input" value="${recipientEmail}" style="
            width: 100%;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.05);
            border: 1.5px solid rgba(74, 144, 226, 0.3);
            border-radius: 8px;
            color: #fff;
            font-size: 14px;
            font-family: inherit;
            box-sizing: border-box;
            transition: all 0.2s;
          " />
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; color: rgba(255, 255, 255, 0.9); font-weight: 600; margin-bottom: 8px; font-size: 14px;">Subject:</label>
          <input type="text" id="email-subject-input" value="${subject}" style="
            width: 100%;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.05);
            border: 1.5px solid rgba(74, 144, 226, 0.3);
            border-radius: 8px;
            color: #fff;
            font-size: 14px;
            font-family: inherit;
            box-sizing: border-box;
            transition: all 0.2s;
          " />
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; color: rgba(255, 255, 255, 0.9); font-weight: 600; margin-bottom: 8px; font-size: 14px;">Message:</label>
          <textarea id="email-message-input" rows="6" style="
            width: 100%;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.05);
            border: 1.5px solid rgba(74, 144, 226, 0.3);
            border-radius: 8px;
            color: #fff;
            font-size: 14px;
            font-family: inherit;
            resize: vertical;
            box-sizing: border-box;
            white-space: pre-wrap;
            transition: all 0.2s;
          ">${message}</textarea>
        </div>
        ${imageUrl ? `
          <div style="margin-bottom: 16px;">
            <label style="display: block; color: rgba(255, 255, 255, 0.9); font-weight: 600; margin-bottom: 8px; font-size: 14px;">Image:</label>
            <div style="margin-top: 8px;">
              <img src="${imageUrl}" alt="${imagePrompt || 'Generated image'}" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);" />
              ${imagePrompt ? `<p style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin-top: 8px; font-style: italic;">"${imagePrompt}"</p>` : ''}
            </div>
          </div>
        ` : ''}
        <div style="margin-bottom: 20px; padding-top: 16px; border-top: 1px solid rgba(74, 144, 226, 0.2);">
          <label style="display: block; color: rgba(255, 255, 255, 0.9); font-weight: 600; margin-bottom: 8px; font-size: 14px;">🔒 Admin Password (Required):</label>
          <input type="password" id="email-admin-password" placeholder="Enter admin password to send" style="
            width: 100%;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.05);
            border: 1.5px solid rgba(74, 144, 226, 0.3);
            border-radius: 8px;
            color: #fff;
            font-size: 14px;
            font-family: inherit;
            box-sizing: border-box;
            transition: all 0.2s;
          " />
          <p id="email-password-error" style="color: #f44336; margin-top: 8px; font-size: 12px; display: none;"></p>
        </div>
        <div style="display: flex; gap: 12px; margin-top: 24px;">
          <button id="email-confirm-send" style="
            flex: 1;
            background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
          ">✅ Send Email</button>
          <button id="email-confirm-cancel" style="
            flex: 1;
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.9);
            border: 1.5px solid rgba(255, 255, 255, 0.2);
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          ">❌ Cancel</button>
        </div>
      `;
      
      document.body.appendChild(confirmationDiv);
      
      // Add hover effects
      const sendBtn = confirmationDiv.querySelector('#email-confirm-send');
      const cancelBtn = confirmationDiv.querySelector('#email-confirm-cancel');
      
      sendBtn.addEventListener('mouseenter', () => {
        sendBtn.style.transform = 'translateY(-2px)';
        sendBtn.style.boxShadow = '0 6px 16px rgba(74, 144, 226, 0.4)';
      });
      sendBtn.addEventListener('mouseleave', () => {
        sendBtn.style.transform = 'translateY(0)';
        sendBtn.style.boxShadow = '0 4px 12px rgba(74, 144, 226, 0.3)';
      });
      
      cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = 'rgba(255, 255, 255, 0.15)';
      });
      cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      });
      
      // Handle send button with admin password verification
      sendBtn.addEventListener('click', async () => {
        const toInput = confirmationDiv.querySelector('#email-to-input');
        const subjectInput = confirmationDiv.querySelector('#email-subject-input');
        const messageInput = confirmationDiv.querySelector('#email-message-input');
        const passwordInput = confirmationDiv.querySelector('#email-admin-password');
        const errorEl = confirmationDiv.querySelector('#email-password-error');
        
        const adminPassword = passwordInput.value.trim();
        const updatedEmail = toInput.value.trim();
        const updatedSubject = subjectInput.value.trim();
        const updatedMessage = messageInput.value.trim();
        
        // Validate fields
        if (!updatedEmail || !updatedEmail.includes('@')) {
          errorEl.textContent = 'Please enter a valid email address';
          errorEl.style.display = 'block';
          return;
        }
        
        if (!updatedSubject) {
          errorEl.textContent = 'Please enter a subject';
          errorEl.style.display = 'block';
          return;
        }
        
        if (!updatedMessage) {
          errorEl.textContent = 'Please enter a message';
          errorEl.style.display = 'block';
          return;
        }
        
        if (!adminPassword) {
          errorEl.textContent = 'Admin password is required to send emails';
          errorEl.style.display = 'block';
          return;
        }
        
        // Verify admin password by making a test API call
        errorEl.style.display = 'none';
        sendBtn.disabled = true;
        sendBtn.textContent = 'Verifying...';
        
        try {
          // Test admin password by calling a protected endpoint
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const baseUrl = isLocalhost ? 'http://localhost:8888' : window.location.origin;
          const testUrl = `/.netlify/functions/newsletter-templates?token=${encodeURIComponent(adminPassword)}`;
          const testResponse = await fetch(testUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (!testResponse.ok && testResponse.status !== 200) {
            errorEl.textContent = 'Invalid admin password';
            errorEl.style.display = 'block';
            sendBtn.disabled = false;
            sendBtn.textContent = '✅ Send Email';
            return;
          }
          
          // Password verified - update pending email with edited values and password
          if (window._pendingEmail) {
            window._pendingEmail.recipient_email = updatedEmail;
            window._pendingEmail.subject = updatedSubject;
            window._pendingEmail.message = updatedMessage;
            window._pendingEmail.admin_password = adminPassword;
          }
          
          // Send email
          await sendPendingEmail(imageUrl, imagePrompt);
          confirmationDiv.remove();
        } catch (error) {
          console.error('Password verification error:', error);
          errorEl.textContent = 'Failed to verify password. Please try again.';
          errorEl.style.display = 'block';
          sendBtn.disabled = false;
          sendBtn.textContent = '✅ Send Email';
        }
      });
      
      // Handle cancel button
      cancelBtn.addEventListener('click', () => {
        // Store call_id before clearing _pendingEmail
        const callId = window._pendingEmail?.call_id;
        window._pendingEmail = null;
        confirmationDiv.remove();
        // Tell AI that email was cancelled (if we have a call_id)
        if (websocket && websocket.readyState === WebSocket.OPEN && callId) {
          websocket.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify({ cancelled: true, message: 'User cancelled email sending' })
            }
          }));
          
          // Trigger response so AI can acknowledge cancellation
          const waitForResponse = () => {
            if (hasActiveResponse) {
              setTimeout(waitForResponse, 100);
              return;
            }
            hasActiveResponse = true;
            if (websocket && websocket.readyState === WebSocket.OPEN) {
              websocket.send(JSON.stringify({ type: 'response.create' }));
            } else {
              hasActiveResponse = false;
            }
          };
          waitForResponse();
        }
      });
      
      // Add focus styles to all inputs
      const inputs = confirmationDiv.querySelectorAll('input, textarea');
      inputs.forEach(input => {
        input.addEventListener('focus', () => {
          input.style.borderColor = 'rgba(74, 144, 226, 0.6)';
          input.style.boxShadow = '0 0 0 3px rgba(74, 144, 226, 0.2)';
          input.style.background = 'rgba(255, 255, 255, 0.08)';
        });
        input.addEventListener('blur', () => {
          input.style.borderColor = 'rgba(74, 144, 226, 0.3)';
          input.style.boxShadow = 'none';
          input.style.background = 'rgba(255, 255, 255, 0.05)';
        });
      });
      
      // Allow Enter key to submit (but not in textarea)
      const passwordInput = confirmationDiv.querySelector('#email-admin-password');
      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendBtn.click();
        }
      });
    }
    
    // Send pending email (works for both voice and text chat modes)
    async function sendPendingEmail(imageUrl = null, imagePrompt = null) {
      if (!window._pendingEmail) {
        console.error('[Email] ❌ No pending email to send');
        return;
      }
      
      const emailData = window._pendingEmail;
      const isVoiceMode = !!emailData.call_id; // Voice mode has call_id
      console.log(`[${isVoiceMode ? 'Voice Mode' : 'Text Chat'}] 📧 Sending email:`, emailData);
      
      // Update pending email with image if provided
      if (imageUrl) {
        emailData.image_url = imageUrl;
        emailData.image_prompt = imagePrompt;
      } else if (window._lastGeneratedImage && window._lastGeneratedImage.image_url) {
        // If no image provided but there's a recently generated image, use it
        emailData.image_url = window._lastGeneratedImage.image_url;
        emailData.image_prompt = window._lastGeneratedImage.image_prompt || 'Generated image';
      }
      
      // Determine base URL
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isLocalhost ? 'http://localhost:8888' : window.location.origin;
      
      try {
        // Admin password is required
        if (!emailData.admin_password) {
          console.error('[Email] ❌ Admin password required');
          throw new Error('Admin password is required to send emails');
        }
        
        const response = await fetch(`${baseUrl}/.netlify/functions/send-custom-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_email: emailData.recipient_email,
            subject: emailData.subject,
            message: emailData.message,
            image_url: emailData.image_url || null,
            image_prompt: emailData.image_prompt || null,
            admin_password: emailData.admin_password
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          console.log(`[${isVoiceMode ? 'Voice Mode' : 'Text Chat'}] ✅ Email sent successfully:`, result.emailId);
          
          if (isVoiceMode) {
            // Voice mode: Update status and send result to AI
            if (voiceStatusTextIntegrated) voiceStatusTextIntegrated.textContent = '✅ Email sent!';
            
            // Send success result to AI
            if (websocket && websocket.readyState === WebSocket.OPEN && emailData.call_id) {
              websocket.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: emailData.call_id,
                  output: JSON.stringify({ 
                    success: true, 
                    message: 'Email sent successfully',
                    emailId: result.emailId
                  })
                }
              }));
              
              // Trigger response
              const waitForResponse = () => {
                if (hasActiveResponse) {
                  setTimeout(waitForResponse, 100);
                  return;
                }
                hasActiveResponse = true;
                if (websocket && websocket.readyState === WebSocket.OPEN) {
                  websocket.send(JSON.stringify({ type: 'response.create' }));
                } else {
                  hasActiveResponse = false;
                }
              };
              waitForResponse();
            }
          } else {
            // Text chat mode: Show success message in chat
            const successGroup = document.createElement('div');
            successGroup.className = 'message-group ai-msg-group';
            successGroup.innerHTML = `
              <div class="message-avatar">
                <img src="${logoPath}" alt="Noteworthy News" />
              </div>
              <div class="message-content">
                <div class="reply">
                  <p>✅ Email sent successfully to ${emailData.recipient_email}!</p>
                </div>
              </div>
            `;
            body.appendChild(successGroup);
            body.scrollTop = body.scrollHeight;
          }
        } else {
          console.error(`[${isVoiceMode ? 'Voice Mode' : 'Text Chat'}] ❌ Email sending failed:`, result.error);
          
          if (isVoiceMode) {
            if (voiceStatusTextIntegrated) voiceStatusTextIntegrated.textContent = '❌ Email failed';
            
            // Send error result to AI
            if (websocket && websocket.readyState === WebSocket.OPEN && emailData.call_id) {
              websocket.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: emailData.call_id,
                  output: JSON.stringify({ 
                    success: false, 
                    error: result.error || 'Failed to send email'
                  })
                }
              }));
              
              const waitForResponse = () => {
                if (hasActiveResponse) {
                  setTimeout(waitForResponse, 100);
                  return;
                }
                hasActiveResponse = true;
                if (websocket && websocket.readyState === WebSocket.OPEN) {
                  websocket.send(JSON.stringify({ type: 'response.create' }));
                } else {
                  hasActiveResponse = false;
                }
              };
              waitForResponse();
            }
          } else {
            // Text chat mode: Show error message
            showError(`Failed to send email: ${result.error || 'Unknown error'}`);
          }
        }
      } catch (error) {
        console.error(`[${isVoiceMode ? 'Voice Mode' : 'Text Chat'}] ❌ Email sending error:`, error);
        
        if (isVoiceMode) {
          if (voiceStatusTextIntegrated) voiceStatusTextIntegrated.textContent = '❌ Email error';
        } else {
          showError(`Email error: ${error.message || 'Failed to send email'}`);
        }
      } finally {
        window._pendingEmail = null;
      }
    }
    
    function showInVoiceSidebar(type, data) {
      if (!voiceModeActive || !voiceSidebarContent) return;
      
      showVoiceSidebar();
      
      // Remove empty state
      const emptyState = voiceSidebarContent.querySelector('.voice-sidebar-empty');
      if (emptyState) emptyState.remove();
      
      const item = document.createElement('div');
      item.className = 'voice-sidebar-item';
      
      if (type === 'image') {
        item.innerHTML = `
          <div class="voice-sidebar-item-header">
            <span>🎨</span>
            <span>Generated Image</span>
          </div>
          <img src="${data.image_url}" alt="${data.prompt || 'Generated image'}" />
          ${data.prompt ? `<p style="margin-top: 12px; color: rgba(255,255,255,0.7); font-size: 12px;">${data.prompt}</p>` : ''}
        `;
      } else if (type === 'text' || type === 'essay') {
        item.innerHTML = `
          <div class="voice-sidebar-item-header">
            <span>📝</span>
            <span>${type === 'essay' ? 'Essay' : 'Text Response'}</span>
          </div>
          <div class="voice-sidebar-item-text">${data.text || data.content || ''}</div>
        `;
      }
      
      voiceSidebarContent.appendChild(item);
      // Scroll to bottom
      voiceSidebarContent.scrollTop = voiceSidebarContent.scrollHeight;
      
      console.log('[Voice Mode] 📋 Added', type, 'to sidebar');
    }
    
    // Close sidebar button
    if (voiceSidebarClose) {
      voiceSidebarClose.addEventListener('click', () => {
        hideVoiceSidebar();
      });
    }
    
    // Make voice-call-sidebar draggable
    if (voiceCallSidebar) {
      const sidebarHeader = voiceCallSidebar.querySelector('.voice-sidebar-header');
      if (sidebarHeader) {
        let sidebarDragging = false;
        let sidebarStart = null;
        let sidebarStartPos = { x: 0, y: 0 };
        
        // Get initial position from computed styles
        const getSidebarPos = () => {
          const rect = voiceCallSidebar.getBoundingClientRect();
          return { x: rect.left, y: rect.top };
        };
        
        // Set sidebar position
        const setSidebarPos = (x, y) => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          const sidebarWidth = voiceCallSidebar.offsetWidth;
          const sidebarHeight = voiceCallSidebar.offsetHeight;
          
          // Clamp position to keep sidebar on screen
          const clampedX = Math.max(0, Math.min(x, w - sidebarWidth));
          const clampedY = Math.max(0, Math.min(y, h - sidebarHeight));
          
          voiceCallSidebar.style.left = clampedX + 'px';
          voiceCallSidebar.style.top = clampedY + 'px';
          voiceCallSidebar.style.right = 'auto';
        };
        
        // Initialize position
        const initPos = getSidebarPos();
        sidebarStartPos = { x: initPos.x, y: initPos.y };
        
        // Start drag
        const startSidebarDrag = (clientX, clientY) => {
          sidebarDragging = true;
          sidebarStart = { x: clientX, y: clientY };
          sidebarStartPos = getSidebarPos();
          sidebarHeader.style.cursor = 'grabbing';
          voiceCallSidebar.classList.add('dragging');
          // Switch from right positioning to left/top positioning
          voiceCallSidebar.style.right = 'auto';
          if (!voiceCallSidebar.style.left) {
            voiceCallSidebar.style.left = sidebarStartPos.x + 'px';
          }
          if (!voiceCallSidebar.style.top) {
            voiceCallSidebar.style.top = sidebarStartPos.y + 'px';
          }
        };
        
        // Move during drag
        const onSidebarMove = (clientX, clientY) => {
          if (!sidebarDragging || !sidebarStart || !sidebarStartPos) return;
          const nx = sidebarStartPos.x + (clientX - sidebarStart.x);
          const ny = sidebarStartPos.y + (clientY - sidebarStart.y);
          setSidebarPos(nx, ny);
        };
        
        // Stop drag
        const stopSidebarDrag = () => {
          sidebarDragging = false;
          sidebarHeader.style.cursor = 'grab';
          voiceCallSidebar.classList.remove('dragging');
        };
        
        // Mouse drag handlers
        sidebarHeader.addEventListener('mousedown', (e) => {
          // Don't drag if clicking the close button
          if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
          e.preventDefault();
          startSidebarDrag(e.clientX, e.clientY);
        });
        
        window.addEventListener('mousemove', (e) => {
          if (sidebarDragging) {
            onSidebarMove(e.clientX, e.clientY);
          }
        });
        
        window.addEventListener('mouseup', () => {
          stopSidebarDrag();
        });
        
        // Touch drag handlers for mobile
        sidebarHeader.addEventListener('touchstart', (e) => {
          if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
          const t = e.touches[0];
          if (t) {
            e.preventDefault();
            startSidebarDrag(t.clientX, t.clientY);
          }
        }, { passive: false });
        
        window.addEventListener('touchmove', (e) => {
          if (sidebarDragging) {
            e.preventDefault();
            const t = e.touches[0];
            if (t) {
              onSidebarMove(t.clientX, t.clientY);
            }
          }
        }, { passive: false });
        
        window.addEventListener('touchend', () => {
          stopSidebarDrag();
        });
      }
    }
    
    // Make voice-call-panel draggable
    const voiceCallPanel = root.querySelector('#voiceCallPanel');
    if (voiceCallPanel) {
      const voiceCallHeader = voiceCallPanel.querySelector('.voice-call-header');
      if (voiceCallHeader) {
        let panelDragging = false;
        let panelStart = null;
        let panelStartPos = { x: 0, y: 0 };
        
        // Get initial position from computed styles
        const getPanelPos = () => {
          const rect = voiceCallPanel.getBoundingClientRect();
          return { x: rect.left, y: rect.top };
        };
        
        // Set panel position
        const setPanelPos = (x, y) => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          const panelWidth = voiceCallPanel.offsetWidth;
          const panelHeight = voiceCallPanel.offsetHeight;
          
          // Clamp position to keep panel on screen
          const clampedX = Math.max(0, Math.min(x, w - panelWidth));
          const clampedY = Math.max(0, Math.min(y, h - panelHeight));
          
          voiceCallPanel.style.left = clampedX + 'px';
          voiceCallPanel.style.top = clampedY + 'px';
          voiceCallPanel.style.right = 'auto';
          voiceCallPanel.style.transform = 'none'; // Remove translateY(-50%) when dragging
        };
        
        // Initialize position
        const initPos = getPanelPos();
        panelStartPos = { x: initPos.x, y: initPos.y };
        
        // Start drag
        const startPanelDrag = (clientX, clientY) => {
          panelDragging = true;
          panelStart = { x: clientX, y: clientY };
          panelStartPos = getPanelPos();
          voiceCallHeader.style.cursor = 'grabbing';
          voiceCallPanel.classList.add('dragging');
          // Switch from right/top positioning to left/top positioning
          voiceCallPanel.style.right = 'auto';
          if (!voiceCallPanel.style.left) {
            voiceCallPanel.style.left = panelStartPos.x + 'px';
          }
          if (!voiceCallPanel.style.top) {
            voiceCallPanel.style.top = panelStartPos.y + 'px';
          }
        };
        
        // Move during drag
        const onPanelMove = (clientX, clientY) => {
          if (!panelDragging || !panelStart || !panelStartPos) return;
          const nx = panelStartPos.x + (clientX - panelStart.x);
          const ny = panelStartPos.y + (clientY - panelStart.y);
          setPanelPos(nx, ny);
        };
        
        // Stop drag
        const stopPanelDrag = () => {
          panelDragging = false;
          voiceCallHeader.style.cursor = 'grab';
          voiceCallPanel.classList.remove('dragging');
        };
        
        // Mouse drag handlers
        voiceCallHeader.addEventListener('mousedown', (e) => {
          // Don't drag if clicking buttons or status chip
          if (e.target.tagName === 'BUTTON' || e.target.closest('button') || 
              e.target.closest('.voice-status-chip')) return;
          e.preventDefault();
          startPanelDrag(e.clientX, e.clientY);
        });
        
        window.addEventListener('mousemove', (e) => {
          if (panelDragging) {
            onPanelMove(e.clientX, e.clientY);
          }
        });
        
        window.addEventListener('mouseup', () => {
          stopPanelDrag();
        });
        
        // Touch drag handlers for mobile
        voiceCallHeader.addEventListener('touchstart', (e) => {
          if (e.target.tagName === 'BUTTON' || e.target.closest('button') ||
              e.target.closest('.voice-status-chip')) return;
          const t = e.touches[0];
          if (t) {
            e.preventDefault();
            startPanelDrag(t.clientX, t.clientY);
          }
        }, { passive: false });
        
        window.addEventListener('touchmove', (e) => {
          if (panelDragging) {
            e.preventDefault();
            const t = e.touches[0];
            if (t) {
              onPanelMove(t.clientX, t.clientY);
            }
          }
        }, { passive: false });
        
        window.addEventListener('touchend', () => {
          stopPanelDrag();
        });
      }
    }
    
    // Mute button handler
    const voiceMuteBtn = root.querySelector('#voiceControlMute');
    if (voiceMuteBtn) {
      voiceMuteBtn.addEventListener('click', () => {
        if (!mediaStream) {
          console.warn('[Voice Mode] ⚠️ No media stream available to mute');
          return;
        }
        
        isMuted = !isMuted;
        
        // Toggle all audio tracks
        const audioTracks = mediaStream.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = !isMuted;
        });
        
        // Update UI
        if (isMuted) {
          voiceMuteBtn.classList.add('muted');
          voiceMuteBtn.setAttribute('aria-label', 'Unmute microphone');
          voiceMuteBtn.setAttribute('title', 'Unmute microphone');
          console.log('[Voice Mode] 🔇 Microphone muted');
        } else {
          voiceMuteBtn.classList.remove('muted');
          voiceMuteBtn.setAttribute('aria-label', 'Mute microphone');
          voiceMuteBtn.setAttribute('title', 'Mute microphone');
          console.log('[Voice Mode] 🔊 Microphone unmuted');
        }
      });
    }
    
    function stopVoiceMode() {
      console.log('[Voice Mode] 🛑 ========== STOP VOICE MODE CALLED ==========');
      console.log('[Voice Mode] 🛑 Stopping voice mode immediately...');
      console.trace('[Voice Mode] Call stack:');

      // CRITICAL: Stop everything immediately - microphone and websocket first
      voiceModeActive = false;
      window._voiceModeActive = false; // Clear global flag
      isRecording = false;
      hasActiveResponse = false; // Reset response tracking
      isMuted = false; // Reset mute state
      
      // CRITICAL: Stop VoiceAudioEngine immediately (THE ONLY audio output engine)
      if (voiceAudioEngine) {
        voiceAudioEngine.hardStop('voice mode stopped');
        console.log('[Voice Mode] 🧹 VoiceAudioEngine stopped');
      }
      
      // Legacy: Stop VoicePlaybackManager (being phased out)
      if (voicePlaybackManager) {
        voicePlaybackManager.stop();
        console.log('[Voice Mode] 🧹 VoicePlaybackManager stopped (legacy)');
      }
      currentAudioGeneration = null;
      activeGen = 0;
      activeResponseId = null;
      
      // Restore original speechSynthesis.speak function
      if (window._originalSpeak) {
        window.speechSynthesis.speak = window._originalSpeak;
        window._originalSpeak = null;
        console.log('[Voice Mode] ✅ Restored original speechSynthesis.speak');
      }
      
      // Restore original AudioBufferSourceNode.start() function
      if (window._originalBufferSourceStart) {
        AudioBufferSourceNode.prototype.start = window._originalBufferSourceStart;
        window._originalBufferSourceStart = null;
        console.log('[Voice Mode] ✅ Restored original AudioBufferSourceNode.start');
      }
      
      // Clear global audio guard flag
      if (typeof window !== 'undefined') {
        window._allowAudioPlayback = false;
      }
      
      // Clear displayed transcripts to prevent duplicates on next call
      displayedTranscripts.clear();
      
      // Clear the periodic text-to-speech check
      if (voiceModeSpeechCheckInterval) {
        clearInterval(voiceModeSpeechCheckInterval);
        voiceModeSpeechCheckInterval = null;
      }
      
      // Stop microphone IMMEDIATELY
      if (mediaStream) {
        console.log('[Voice Mode] 🎤 Stopping microphone tracks...');
        mediaStream.getTracks().forEach(track => {
          track.stop();
          console.log('[Voice Mode] ✅ Stopped track:', track.kind);
        });
        mediaStream = null;
      }
      
      // Stop audio processing IMMEDIATELY
      if (audioWorkletNode) {
        console.log('[Voice Mode] 🔇 Disconnecting audio worklet...');
        try {
          audioWorkletNode.disconnect();
        } catch (e) {
          console.warn('[Voice Mode] Error disconnecting audio worklet:', e);
        }
        audioWorkletNode = null;
      }
      
      // Destroy VoicePlaybackManager first (stops all playback)
      if (voicePlaybackManager) {
        voicePlaybackManager.destroy();
        voicePlaybackManager = null;
      }
      
      // Close audio context IMMEDIATELY
      if (audioContext && audioContext.state !== 'closed') {
        console.log('[Voice Mode] 🔊 Closing audio context...');
        try {
          audioContext.close();
        } catch (e) {
          console.warn('[Voice Mode] Error closing audio context:', e);
        }
        audioContext = null;
      }
      
      // Close websocket IMMEDIATELY
      if (websocket) {
        console.log('[Voice Mode] 🔌 Closing WebSocket connection...');
        // Clear retry counter
        if (websocket._retryCount) {
          delete websocket._retryCount;
        }
        // Clear message handler binding
        if (websocket._messageHandlerBound) {
          websocket._messageHandlerBound = null;
        }
        // Reset global guard
        window.__NW_VOICE_WS_BOUND__ = false;
        // Close immediately - don't wait
        try {
          if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
            websocket.close(1000, 'User stopped voice mode'); // Normal closure
          }
        } catch (e) {
          console.warn('[Voice Mode] Error closing websocket:', e);
        }
        websocket = null;
      }
      
      // Reset retry counter
      authRetryCount = 0;
      
      // Send voice call summary email if call lasted > 30 seconds
      if (voiceCallStartTime && voiceCallTranscripts.length > 0) {
        const callDuration = (Date.now() - voiceCallStartTime) / 1000; // Duration in seconds
        
        if (callDuration >= 30) {
          console.log(`[Voice Mode] 📧 Call lasted ${Math.round(callDuration)}s, sending summary email...`);
          
          // Get user email if available (from previous logs or context)
          const userEmail = null; // Could be retrieved from user context if needed
          
          // Send summary request (non-blocking)
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const baseUrl = isLocalhost ? 'http://localhost:8888' : window.location.origin;
          
          fetch(`${baseUrl}/.netlify/functions/send-voice-call-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              duration: callDuration,
              transcripts: voiceCallTranscripts,
              userEmail: userEmail
            })
          })
          .then(res => res.json())
          .then(result => {
            if (result.success) {
              console.log('[Voice Mode] ✅ Voice call summary email sent successfully');
            } else {
              console.error('[Voice Mode] ❌ Failed to send summary email:', result.error);
            }
          })
          .catch(error => {
            console.error('[Voice Mode] ❌ Error sending summary email:', error);
          });
        } else {
          console.log(`[Voice Mode] 📞 Call lasted ${Math.round(callDuration)}s (less than 30s, no summary email)`);
        }
      }
      
      // Reset call tracking
      voiceCallStartTime = null;
      voiceCallTranscripts = [];
      
      // Hide premium call panel
      const voiceCallPanel = root.querySelector('#voiceCallPanel');
      if (voiceCallPanel) {
        voiceCallPanel.classList.remove('show');
        // Explicitly set display to none to ensure it's hidden (override any !important rules)
        voiceCallPanel.style.setProperty('display', 'none', 'important');
        voiceCallPanel.style.setProperty('opacity', '0', 'important');
        // Also hide after transition completes (if there's a transition)
        setTimeout(() => {
          if (voiceCallPanel && !voiceCallPanel.classList.contains('show')) {
            voiceCallPanel.style.setProperty('display', 'none', 'important');
            voiceCallPanel.style.setProperty('opacity', '0', 'important');
          }
        }, 500); // Wait for transition to complete
        if (DEBUG_VOICE) {
          console.log('[Voice Mode] ✅ Premium call panel hidden');
        }
      }
      
      // Update UI state to idle
      updateVoiceUIState('idle');
      
      // Reset mute button UI
      const voiceMuteBtn = root.querySelector('#voiceControlMute');
      if (voiceMuteBtn) {
        voiceMuteBtn.classList.remove('muted');
        voiceMuteBtn.setAttribute('aria-label', 'Mute microphone');
        voiceMuteBtn.setAttribute('title', 'Mute microphone');
      }
      
      // Update UI after stopping everything
      if (voiceModeToggle) voiceModeToggle.classList.remove('active');
      
      // Hide sidebar when stopping voice mode
      hideVoiceSidebar();
      
      // Show voice selector options again (call ended, can change voice for next call)
      const voiceControlContent = root.querySelector('#voiceControlContent');
      const voiceSelectorIntegrated = root.querySelector('.voice-selector-integrated');
      const voiceControlIntegrated = root.querySelector('#voiceControlIntegrated');
      const voiceControlHeader = root.querySelector('#voiceControlHeader');
      
      if (voiceControlContent) {
        voiceControlContent.style.display = '';
        console.log('[Voice Mode] 🔊 Showing voice selector (call ended)');
      }
      if (voiceSelectorIntegrated) {
        voiceSelectorIntegrated.style.display = '';
      }
      if (voiceControlIntegrated) {
        voiceControlIntegrated.style.display = '';
        console.log('[Voice Mode] 🔊 Showing voice control integrated panel (call ended)');
      }
      if (voiceControlHeader) {
        voiceControlHeader.style.display = '';
      }
      
      // Play end call sound effect
      playCallSound('end');
      
      if (voiceStatusIntegrated) {
        voiceStatusIntegrated.style.display = 'none';
        voiceStatusIntegrated.classList.remove('recording');
        voiceStatusIntegrated.classList.remove('error');
      }
      if (voiceStatusTextIntegrated) voiceStatusTextIntegrated.textContent = 'Ready';
      if (statusDotIntegrated) statusDotIntegrated.style.background = 'rgba(255, 255, 255, 0.5)';
      if (voiceStartBtnIntegrated) voiceStartBtnIntegrated.style.display = 'flex';
      if (voiceStopBtnIntegrated) voiceStopBtnIntegrated.style.display = 'none';
      // Keep actions visible after call ends (user can start again)
      if (voiceActionsIntegrated) {
        voiceActionsIntegrated.style.display = 'flex';
      }
      
      // Restore background music if it was playing before the call (async, non-blocking)
      if (musicStateBeforeCall && musicStateBeforeCall.wasPlaying) {
        console.log('[Voice Mode] 🎵 Restoring background music after voice call ended');
        
        // Try to use global music system restore function if available
        // The music system should have saved state when we paused it
        if (typeof window.toggleGlobalMusic === 'function' && typeof window.getGlobalMusicState === 'function') {
          const currentState = window.getGlobalMusicState();
          // Only restore if music is enabled (user hasn't manually muted it)
          if (currentState.enabled && !currentState.isPlaying) {
            // Music was enabled and playing before, restore it
            try {
              // toggleGlobalMusic will restore from saved state if music is enabled
              window.toggleGlobalMusic();
              console.log('[Voice Mode] ✅ Background music restored via global music system');
            } catch (err) {
              console.warn('[Voice Mode] Could not restore music via global system:', err);
              // Fallback to manual restore
              restoreMusicManually(musicStateBeforeCall);
            }
          } else if (!currentState.enabled) {
            console.log('[Voice Mode] Music is disabled by user, not restoring');
          }
        } else {
          // Fallback: manually restore music
          restoreMusicManually(musicStateBeforeCall);
        }
        
        // Clear stored music state
        musicStateBeforeCall = null;
      }
      
      console.log('[Voice Mode] ✅ Voice mode stopped completely');
    }
    
    // Helper function to manually restore background music
    function restoreMusicManually(musicState) {
      if (!musicState || !musicState.currentTrack) return;
      
      try {
        const track = musicState.currentTrack;
        if (track && track.tagName === 'AUDIO') {
          track.currentTime = musicState.currentTime || 0;
          track.play().catch(err => {
            console.warn('[Voice Mode] Could not restore music playback:', err);
          });
          console.log('[Voice Mode] ✅ Background music restored manually');
        }
      } catch (err) {
        console.warn('[Voice Mode] Error restoring music manually:', err);
      }
    }
    
    async function startAudioCapture() {
      if (!audioContext || !mediaStream) return;
      
      // Prevent multiple simultaneous audio graphs
      if (audioWorkletNode) {
        console.warn('[Voice Mode] Audio capture already active');
        return;
      }
      
      try {
        // Migrate to AudioWorkletNode (replaces deprecated ScriptProcessorNode)
        // AudioWorklet provides better performance and is the modern standard
        let useAudioWorklet = false;
        
        if (audioContext.audioWorklet && typeof audioContext.audioWorklet.addModule === 'function') {
          try {
            // Load AudioWorklet processor (modern approach)
            // Try multiple paths for the worklet file
            const workletPaths = [
              '/src/widgets/audio-worklet-processor.js',
              './src/widgets/audio-worklet-processor.js',
              'audio-worklet-processor.js'
            ];
            
            let workletLoaded = false;
            for (const workletPath of workletPaths) {
              try {
                await audioContext.audioWorklet.addModule(workletPath);
                workletLoaded = true;
                console.log('[Voice Mode] ✅ AudioWorklet loaded from:', workletPath);
                break;
              } catch (pathError) {
                console.log('[Voice Mode] Failed to load worklet from', workletPath, '- trying next path');
              }
            }
            
            if (workletLoaded) {
              useAudioWorklet = true;
              console.log('[Voice Mode] ✅ Using AudioWorkletNode (modern)');
            } else {
              throw new Error('All worklet paths failed');
            }
          } catch (workletError) {
            console.warn('[Voice Mode] ⚠️ AudioWorklet not available, falling back to ScriptProcessor:', workletError.message);
            useAudioWorklet = false;
          }
        }
        
        const source = audioContext.createMediaStreamSource(mediaStream);
        
        if (useAudioWorklet) {
          // Modern AudioWorklet approach
          try {
            audioWorkletNode = new AudioWorkletNode(audioContext, 'voice-capture-processor');
          } catch (workletError) {
            console.error('[Voice Mode] Failed to create AudioWorkletNode:', workletError);
            throw new Error(`AudioWorklet initialization failed: ${workletError.message}. Falling back to ScriptProcessor.`);
          }
          
          // Handle audio data from worklet
          let audioChunkCount = 0;
          audioWorkletNode.port.onmessage = (event) => {
            if (event.data.type === 'audioData') {
              // Debug: Log first few chunks to verify audio is being captured
              audioChunkCount++;
              if (audioChunkCount <= 3) {
                console.log('[Voice Mode] 🎤 Audio chunk captured from microphone:', {
                  chunkNumber: audioChunkCount,
                  dataLength: event.data.data?.byteLength || 0,
                  isRecording: isRecording,
                  websocketExists: !!websocket,
                  websocketState: websocket?.readyState,
                  websocketOpen: websocket?.readyState === WebSocket.OPEN
                });
              }
              
              if (isRecording && websocket && websocket.readyState === WebSocket.OPEN) {
              const pcm16Buffer = event.data.data;
              const pcm16 = new Int16Array(pcm16Buffer);
              
              // Convert to base64 efficiently
              const uint8Array = new Uint8Array(pcm16.buffer);
              let binaryString = '';
              const chunkSize = 8192;
              for (let i = 0; i < uint8Array.length; i += chunkSize) {
                const chunk = uint8Array.subarray(i, i + chunkSize);
                binaryString += String.fromCharCode.apply(null, chunk);
              }
              const base64Audio = btoa(binaryString);
              
              // Send to OpenAI Realtime API
                if (audioChunkCount <= 3) {
                  console.log('[Voice Mode] 📤 Sending audio chunk to OpenAI:', {
                    base64Length: base64Audio.length,
                    pcm16Samples: pcm16.length
                  });
                }
              websocket.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: base64Audio,
              }));
              } else {
                if (audioChunkCount <= 3) {
                  console.warn('[Voice Mode] ⚠️ Audio captured but NOT sending - conditions not met:', {
                    isRecording: isRecording,
                    websocketExists: !!websocket,
                    websocketState: websocket?.readyState
                  });
                }
              }
            }
          };
          
          source.connect(audioWorkletNode);
        } else {
          // Fallback to ScriptProcessorNode (deprecated but widely supported)
          // Only warn once to avoid console spam
          if (!window.__scriptProcessorWarned) {
            console.warn('[Voice Mode] ⚠️ Using deprecated ScriptProcessorNode. AudioWorklet not available. Consider using HTTPS for AudioWorklet support.');
            window.__scriptProcessorWarned = true;
          }
          
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          
          let scriptProcessorChunkCount = 0;
          processor.onaudioprocess = (e) => {
            scriptProcessorChunkCount++;
            
            // Debug: Log first few chunks
            if (scriptProcessorChunkCount <= 3) {
              console.log('[Voice Mode] 🎤 Audio chunk captured (ScriptProcessor):', {
                chunkNumber: scriptProcessorChunkCount,
                samples: e.inputBuffer.length,
                isRecording: isRecording,
                websocketExists: !!websocket,
                websocketState: websocket?.readyState,
                websocketOpen: websocket?.readyState === WebSocket.OPEN
              });
            }
            
            if (!isRecording || !websocket || websocket.readyState !== WebSocket.OPEN) {
              if (scriptProcessorChunkCount <= 3) {
                console.warn('[Voice Mode] ⚠️ Audio captured but NOT sending - conditions not met');
              }
              return;
            }
            
            const inputData = e.inputBuffer.getChannelData(0);
            // Convert Float32Array to Int16Array (PCM16)
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Convert to base64 for OpenAI Realtime API
            const uint8Array = new Uint8Array(pcm16.buffer);
            let binaryString = '';
            const chunkSize = 8192;
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              const chunk = uint8Array.subarray(i, i + chunkSize);
              binaryString += String.fromCharCode.apply(null, chunk);
            }
            const base64Audio = btoa(binaryString);
            
            // Send audio to WebSocket
            if (scriptProcessorChunkCount <= 3) {
              console.log('[Voice Mode] 📤 Sending audio chunk to OpenAI (ScriptProcessor):', {
                base64Length: base64Audio.length,
                pcm16Samples: pcm16.length
              });
            }
            websocket.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: base64Audio,
            }));
          };
          
          source.connect(processor);
          processor.connect(audioContext.destination);
          // Store reference for cleanup
          audioWorkletNode = processor; // Reuse variable for cleanup
        }
        
        console.log('[Voice Mode] ✅ Audio capture pipeline complete:', {
          audioContextState: audioContext.state,
          sampleRate: audioContext.sampleRate,
          usingAudioWorklet: useAudioWorklet,
          mediaStreamActive: mediaStream?.active,
          mediaStreamTracks: mediaStream?.getTracks().length,
          isRecording: isRecording,
          websocketReady: websocket?.readyState === WebSocket.OPEN
        });
        console.log('[Voice Mode] 🎤 MICROPHONE IS NOW LISTENING - Speak and you should see audio chunks being sent!');
        
      } catch (error) {
        console.error('[Voice Mode] Error starting audio capture:', error);
        if (voiceStatusTextIntegrated) {
          voiceStatusTextIntegrated.textContent = `Audio error: ${error.message}`;
        }
      }
    }
    
    function handleWebSocketMessage(event) {
      try {
        const message = JSON.parse(event.data);
        
        // Only log non-audio messages to reduce console spam
        // Note: OpenAI Realtime API uses 'response.output_audio.delta' not 'response.audio.delta'
        if (message.type && !message.type.startsWith('response.output_audio.delta')) {
          console.log('[Voice Mode] 📨 Received WebSocket message:', message.type);
          if (message.type === 'error' || message.type === 'auth.error' || message.type === 'auth.success') {
            console.log('[Voice Mode] Message details:', message);
          }
        } else if (message.type === 'response.output_audio.delta') {
          // Log first few audio deltas for debugging, then silence
          if (websocket) {
            if (!websocket._audioDeltaCount) websocket._audioDeltaCount = 0;
            websocket._audioDeltaCount++;
            if (websocket._audioDeltaCount <= 3) {
              console.log('[Voice Mode] 🔊 Audio delta received (', websocket._audioDeltaCount, '), length:', message.delta?.length || 0);
            }
          }
        }
        
        // Debug: Log message type before switch for transcript messages
        if (message.type && (
          message.type.includes('transcript') || 
          message.type.includes('input_audio_transcription') ||
          message.type === 'conversation.item.input_audio_transcription.completed'
        )) {
          console.log('[Voice Mode] 🔍 DEBUG TRANSCRIPT MESSAGE:', {
            type: message.type,
            typeLength: message.type?.length,
            hasDelta: !!message.delta,
            hasTranscript: !!message.transcript,
            hasText: !!message.text,
            fullMessage: message
          });
        }
        
        // Debug: Log message type before switch
        if (message.type === 'response.output_audio.delta') {
          console.log('[Voice Mode] 🔍 DEBUG: About to switch on message.type:', message.type, 'typeof:', typeof message.type);
        }
        
        switch (message.type) {
          case 'auth.success':
            // Authentication successful message (may be sent even when token is in URL)
            // This confirms authentication worked - log it but we may already be recording
            console.log('[Voice Mode] ✅ Received auth.success confirmation');
            if (websocket) {
              console.log('[Voice Mode] Auth success details:', {
                event_id: message.event_id,
                session_id: message.session_id,
                alreadyRecording: isRecording,
                alreadyAuthenticated: websocket._authenticated,
                connectionMethod: 'WebSocket subprotocols',
                protocol: websocket.protocol || 'none'
              });
              
              // DIAGNOSTIC: Log that authentication succeeded with subprotocol method
              console.log('[Voice Mode] ✅ Authentication confirmed: WebSocket subprotocol method works!');
              
              // Mark as authenticated (if not already)
              websocket._authenticated = true;
              
              // Clear any auth timeout if it exists
              if (websocket._authTimeout) {
                clearTimeout(websocket._authTimeout);
                websocket._authTimeout = null;
              }
            } else {
              console.warn('[Voice Mode] ⚠️ auth.success received but websocket is null');
            }
            
            // If not already recording, start now (shouldn't happen with URL auth, but handle it)
            if (!isRecording) {
              console.log('[Voice Mode] 🎤 Starting audio capture after auth.success (delayed start)');
            if (voiceStatusTextIntegrated) voiceStatusTextIntegrated.textContent = 'Connected - Speak now!';
            if (voiceStatusIntegrated) {
              voiceStatusIntegrated.classList.remove('error');
              voiceStatusIntegrated.classList.add('recording');
            }
            if (statusDotIntegrated) statusDotIntegrated.style.background = '#4A90E2';
              isRecording = true;
              startAudioCapture();
            } else {
              console.log('[Voice Mode] Already recording - auth.success is confirmation only');
            }
            break;
            
          case 'auth.error':
            // Authentication failed - DO NOT RETRY (client config issue)
            const authErrorDetails = {
              type: message.type,
              error: message.error ? {
                message: message.error.message || message.error,
                code: message.error.code,
                type: message.error.type,
                param: message.error.param
              } : message.error,
              event_id: message.event_id,
              fullMessage: message,
              connectionMethod: 'WebSocket subprotocols'
            };
            console.error('[Voice Mode] ❌ Authentication failed!');
            console.error('[Voice Mode] Auth error details:', authErrorDetails);
            console.error('[Voice Mode] Full error message:', JSON.stringify(message, null, 2));
            
            // Extract readable error message
            let authErrorMsg = 'Authentication failed';
            if (message.error) {
              if (typeof message.error === 'string') {
                authErrorMsg = message.error;
              } else if (message.error.message) {
                authErrorMsg = message.error.message;
              } else if (message.error.code) {
                authErrorMsg = `Auth error code: ${message.error.code}`;
              }
            }
            
            console.error('[Voice Mode] 🔐 Authentication failure - CLIENT CONFIG ISSUE');
            console.error('[Voice Mode] DO NOT RETRY - This indicates a problem with subprotocol authentication');
            
            // Stop immediately - don't retry auth errors
            stopVoiceMode();
            
            if (voiceStatusTextIntegrated) {
              voiceStatusTextIntegrated.textContent = 'Auth failed (client config). Fix token transport.';
            }
            if (voiceStatusIntegrated) {
              voiceStatusIntegrated.classList.add('error');
              voiceStatusIntegrated.classList.remove('recording');
            }
            if (statusDotIntegrated) statusDotIntegrated.style.background = '#b00020';
            
            // Log diagnostic info
            const diagnosticToken = websocket?._ephemeralToken || 'not available';
            console.error('[Voice Mode] Diagnostic info:', {
              tokenReceived: !!diagnosticToken && diagnosticToken !== 'not available',
              tokenFormat: diagnosticToken && diagnosticToken !== 'not available' ? (diagnosticToken.startsWith('ek_') ? 'valid' : 'invalid') : 'missing',
              tokenPreview: diagnosticToken && diagnosticToken !== 'not available' ? diagnosticToken.substring(0, 8) + '...' : 'none',
              protocol: websocket?.protocol || 'none'
            });
            break;
            
          case 'session.updated':
            // Session update confirmed
            console.log('[Voice Mode] Session updated:', message);
            break;
            
          case 'response.created':
            // CRITICAL: New response started - set generation and response_id
            // This is where we reset the audio engine and increment generation
            const responseId = message.response?.id || message.response_id || `response_${Date.now()}`;
            activeGen++;
            activeResponseId = responseId;
            hasActiveResponse = true;
            
            if (DEBUG_VOICE) {
              console.log(`[Voice Mode] 🆕 RESPONSE.CREATED: gen=${activeGen}, responseId=${responseId}`);
            }
            
            // Reset audio engine for new response
            if (voiceAudioEngine) {
              voiceAudioEngine.reset(activeGen, activeResponseId);
              if (DEBUG_VOICE) {
                console.log(`[Voice Mode] ✅ Audio engine reset for gen ${activeGen}, responseId ${activeResponseId}`);
              }
            }
            
            // Update UI to listening (AI is about to speak)
            updateVoiceUIState('listening');
            break;
            
          case 'response.audio_transcript.done':
          case 'response.output_audio_transcript.done':
            // Full transcript available (handle both old and new message types)
            console.log('[Voice Mode] ✅ CASE MATCHED: response.output_audio_transcript.done');
            console.log('[Voice Mode] 🔍 Transcript done data:', {
              transcript: message.transcript,
              text: message.text,
              fullMessage: message
            });
            const transcript = message.transcript || message.text || '';
            console.log('[Voice Mode] ✅ AI RESPONSE TRANSCRIPT:', transcript);
            
            // Check if we've already displayed this transcript
            const transcriptKey = `ai-${transcript}`;
            if (transcript && !displayedTranscripts.has(transcriptKey)) {
              displayedTranscripts.add(transcriptKey);
              
              // Add to call transcripts for summary
              if (voiceCallStartTime) {
                voiceCallTranscripts.push({
                  speaker: 'ai',
                  text: transcript,
                  timestamp: Date.now()
                });
              }
              
              // Remove any live transcript element first
              const liveMsgGroup = root.querySelector('#ai-msg-live');
              if (liveMsgGroup) liveMsgGroup.remove();
              
              const aiGroup = document.createElement('div');
              aiGroup.className = 'message-group ai-msg-group';
              aiGroup.innerHTML = `
                <div class="message-avatar">NW</div>
                <div class="message-content">
                  <div class="reply">🎤 ${transcript}</div>
                </div>
              `;
              body.appendChild(aiGroup);
              body.scrollTop = body.scrollHeight;
              // CRITICAL: Cancel TTS immediately after adding transcript (just in case)
              if (voiceModeActive || window._voiceModeActive) {
                window.speechSynthesis.cancel();
                window.speechSynthesis.cancel();
                window.speechSynthesis.cancel();
              }
              console.log('[Voice Mode] ✅ AI transcript displayed (deduplicated)');
            } else if (transcript) {
              console.log('[Voice Mode] ⏭️ Skipping duplicate AI transcript');
            } else {
              console.warn('[Voice Mode] ⚠️ AI transcript received but empty');
            }
            break;
            
          case 'response.output_audio_transcript.delta':
            // Real-time transcript updates as AI speaks
            console.log('[Voice Mode] ✅ CASE MATCHED: response.output_audio_transcript.delta');
            console.log('[Voice Mode] 🔍 Transcript delta data:', {
              delta: message.delta,
              deltaLength: message.delta?.length,
              hasDelta: !!message.delta
            });
            if (message.delta) {
              // Find or create a transcript element for this response
              let transcriptElement = root.querySelector('#ai-transcript-live');
              if (!transcriptElement) {
                // Create a new message group for live transcript
                const aiGroup = document.createElement('div');
                aiGroup.className = 'message-group ai-msg-group';
                aiGroup.id = 'ai-msg-live';
                aiGroup.innerHTML = `
                  <div class="message-avatar">NW</div>
                  <div class="message-content">
                    <div class="reply" id="ai-transcript-live">🎤 </div>
                  </div>
                `;
                body.appendChild(aiGroup);
                body.scrollTop = body.scrollHeight;
                // CRITICAL: Cancel TTS immediately after adding transcript (just in case)
                if (voiceModeActive || window._voiceModeActive) {
                  window.speechSynthesis.cancel();
                  window.speechSynthesis.cancel();
                  window.speechSynthesis.cancel();
                }
                transcriptElement = root.querySelector('#ai-transcript-live');
              }
              
              // Append the delta to the transcript
              if (transcriptElement) {
                transcriptElement.textContent += message.delta;
                body.scrollTop = body.scrollHeight;
              }
            }
            break;
            
          case 'response.function_call_arguments.done':
            // Function is being called - we need to EXECUTE it and send back the result
            console.log('[Voice Mode] 🔧 Function call received:', {
              name: message.name,
              call_id: message.call_id,
              arguments: message.arguments,
              fullMessage: message
            });
            console.log('[Voice Mode] 🔧 Function call type:', typeof message.arguments, 'isString:', typeof message.arguments === 'string');
            
            // Parse arguments (they come as a JSON string)
            let functionArgs = {};
            try {
              if (typeof message.arguments === 'string') {
                functionArgs = JSON.parse(message.arguments);
              } else {
                functionArgs = message.arguments || {};
              }
            } catch (e) {
              console.error('[Voice Mode] Failed to parse function arguments:', e);
              functionArgs = {};
            }
            
            if (message.name === 'generate_image') {
              if (voiceStatusTextIntegrated) voiceStatusTextIntegrated.textContent = '🎨 Generating image...';
              console.log('[Voice Mode] 🎨 Image generation requested via function call, prompt:', functionArgs.prompt);
              
              // Execute the function
              const prompt = functionArgs.prompt || '';
              if (prompt) {
                // Call the image generation API
                fetch('/.netlify/functions/generate-image', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ prompt })
                })
                .then(res => res.json())
                .then(data => {
                  if (data.imageUrl || data.image_url) {
                    const imageUrl = data.imageUrl || data.image_url;
                    // Prefer storedImageUrl if available (from Netlify Blobs), otherwise use original URL
                    const finalImageUrl = data.storedImageUrl || data.stored_image_url || imageUrl;
                    const revisedPrompt = data.revisedPrompt || data.revised_prompt || prompt;
                    
                    console.log('[Voice Mode] ✅ Image generated:', finalImageUrl.substring(0, 50) + '...');
                    
                    // Store the generated image globally so it can be included in emails
                    if (!window._lastGeneratedImage) {
                      window._lastGeneratedImage = {};
                    }
                    window._lastGeneratedImage.image_url = finalImageUrl;
                    window._lastGeneratedImage.image_prompt = revisedPrompt;
                    
                    // Check websocket is still valid
                    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
                      console.error('[Voice Mode] ❌ WebSocket not available for sending function result');
                      return;
                    }
                    
                    // Send function result back using conversation.item.create
                    websocket.send(JSON.stringify({
                      type: 'conversation.item.create',
                      item: {
                        type: 'function_call_output',
                        call_id: message.call_id,
                        output: JSON.stringify({
                          image_url: finalImageUrl,
                          revised_prompt: revisedPrompt
                        })
                      }
                    }));
                    
                    // Wait for any active response to finish before creating a new one
                    const waitForResponse = () => {
                      if (hasActiveResponse) {
                        console.log('[Voice Mode] ⏳ Waiting for active response to finish before creating new one...');
                        setTimeout(waitForResponse, 100);
                        return;
                      }
                      
                      // Mark as active before sending
                      hasActiveResponse = true;
                      
                      // Then trigger response.create to continue the conversation
                      if (websocket && websocket.readyState === WebSocket.OPEN) {
                        websocket.send(JSON.stringify({
                          type: 'response.create'
                        }));
                        console.log('[Voice Mode] ✅ Function result sent to AI, triggering response');
                      } else {
                        console.error('[Voice Mode] ❌ WebSocket not available for response.create');
                        hasActiveResponse = false;
                      }
                    };
                    
                    waitForResponse();
                  } else {
                    console.error('[Voice Mode] ❌ Image generation returned no URL');
                    // Send error result
                    if (websocket && websocket.readyState === WebSocket.OPEN) {
                      websocket.send(JSON.stringify({
                        type: 'conversation.item.create',
                        item: {
                          type: 'function_call_output',
                          call_id: message.call_id,
                          output: JSON.stringify({ error: 'Failed to generate image' })
                        }
                      }));
                      
                      // Wait for active response before creating new one
                      const waitForResponse = () => {
                        if (hasActiveResponse) {
                          setTimeout(waitForResponse, 100);
                          return;
                        }
                        hasActiveResponse = true;
                        if (websocket && websocket.readyState === WebSocket.OPEN) {
                          websocket.send(JSON.stringify({ type: 'response.create' }));
                        } else {
                          hasActiveResponse = false;
                        }
                      };
                      waitForResponse();
                    }
                  }
                })
                .catch(error => {
                  console.error('[Voice Mode] ❌ Image generation error:', error);
                  if (websocket && websocket.readyState === WebSocket.OPEN) {
                    websocket.send(JSON.stringify({
                      type: 'conversation.item.create',
                      item: {
                        type: 'function_call_output',
                        call_id: message.call_id,
                        output: JSON.stringify({ error: error.message || 'Failed to generate image' })
                      }
                    }));
                    
                    // Wait for active response before creating new one
                    const waitForResponse = () => {
                      if (hasActiveResponse) {
                        setTimeout(waitForResponse, 100);
                        return;
                      }
                      hasActiveResponse = true;
                      if (websocket && websocket.readyState === WebSocket.OPEN) {
                        websocket.send(JSON.stringify({ type: 'response.create' }));
                      } else {
                        hasActiveResponse = false;
                      }
                    };
                    waitForResponse();
                  } else {
                    console.error('[Voice Mode] ❌ WebSocket not available for error response');
                  }
                });
              } else {
                console.error('[Voice Mode] ❌ No prompt provided for image generation');
              }
            } else if (message.name === 'send_email') {
              console.log('[Voice Mode] 📧 Email sending requested via function call:', {
                recipient: functionArgs.recipient_email,
                subject: functionArgs.subject,
                message: functionArgs.message?.substring(0, 50) + '...'
              });
              
              // Show email confirmation UI instead of sending immediately
              // The AI will repeat back the details, and user confirms via button
              const recipientEmail = functionArgs.recipient_email || '';
              const emailSubject = functionArgs.subject || '';
              const emailMessage = functionArgs.message || '';
              
              // Store email data for confirmation
              window._pendingEmail = {
                recipient_email: recipientEmail,
                subject: emailSubject,
                message: emailMessage,
                call_id: message.call_id,
                image_url: null, // Will be set if sending with image
                image_prompt: null
              };
              
              // If there's a recently generated image, include it
              if (window._lastGeneratedImage && window._lastGeneratedImage.image_url) {
                window._pendingEmail.image_url = window._lastGeneratedImage.image_url;
                window._pendingEmail.image_prompt = window._lastGeneratedImage.image_prompt || 'Generated image';
              }
              
              // Show confirmation UI
              showEmailConfirmationUI(
                recipientEmail, 
                emailSubject, 
                emailMessage,
                window._pendingEmail.image_url,
                window._pendingEmail.image_prompt
              );
              
              // Tell AI that confirmation is needed (don't send function result yet)
              // The AI should repeat back the details
              console.log('[Voice Mode] 📧 Email confirmation UI shown, waiting for user confirmation');
              
            } else if (message.name === 'search_web') {
              if (voiceStatusTextIntegrated) voiceStatusTextIntegrated.textContent = '🔍 Searching the web...';
              console.log('[Voice Mode] 🔍 Web search requested via function call, query:', functionArgs.query);
              
              // Execute the web search
              const searchQuery = functionArgs.query || '';
              if (searchQuery) {
                // Determine the base URL (for localhost vs production)
                const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const baseUrl = isLocalhost 
                  ? 'http://localhost:8888' 
                  : window.location.origin;
                
                fetch(`${baseUrl}/.netlify/functions/search-web`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ query: searchQuery })
                })
                .then(res => res.json())
                .then(data => {
                  if (data.results && data.results.length > 0) {
                    console.log('[Voice Mode] ✅ Web search results:', data.results.length, 'results');
                    
                    // Format results for AI
                    const searchResults = data.results.map(r => ({
                      title: r.title,
                      snippet: r.snippet,
                      url: r.url
                    }));
                    
                    // Check websocket is still valid
                    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
                      console.error('[Voice Mode] ❌ WebSocket not available for sending search results');
                      return;
                    }
                    
                    // Send function result back
                    websocket.send(JSON.stringify({
                      type: 'conversation.item.create',
                      item: {
                        type: 'function_call_output',
                        call_id: message.call_id,
                        output: JSON.stringify({
                          results: searchResults,
                          query: searchQuery
                        })
                      }
                    }));
                    
                    // Wait for any active response to finish before creating a new one
                    const waitForResponse = () => {
                      if (hasActiveResponse) {
                        console.log('[Voice Mode] ⏳ Waiting for active response to finish before creating new one...');
                        setTimeout(waitForResponse, 100);
                        return;
                      }
                      
                      // Mark as active before sending
                      hasActiveResponse = true;
                      
                      // Trigger response.create to continue conversation
                      if (websocket && websocket.readyState === WebSocket.OPEN) {
                        websocket.send(JSON.stringify({
                          type: 'response.create'
                        }));
                        console.log('[Voice Mode] ✅ Web search results sent to AI');
                      } else {
                        console.error('[Voice Mode] ❌ WebSocket not available for response.create');
                        hasActiveResponse = false;
                      }
                    };
                    
                    waitForResponse();
                  } else {
                    console.warn('[Voice Mode] ⚠️ Web search returned no results');
                    if (websocket && websocket.readyState === WebSocket.OPEN) {
                      websocket.send(JSON.stringify({
                        type: 'conversation.item.create',
                        item: {
                          type: 'function_call_output',
                          call_id: message.call_id,
                          output: JSON.stringify({ 
                            results: [],
                            query: searchQuery,
                            note: 'No results found'
                          })
                        }
                      }));
                      
                      const waitForResponse = () => {
                        if (hasActiveResponse) {
                          setTimeout(waitForResponse, 100);
                          return;
                        }
                        hasActiveResponse = true;
                        if (websocket && websocket.readyState === WebSocket.OPEN) {
                          websocket.send(JSON.stringify({ type: 'response.create' }));
                        } else {
                          hasActiveResponse = false;
                        }
                      };
                      waitForResponse();
                    }
                  }
                })
                .catch(error => {
                  console.error('[Voice Mode] ❌ Web search error:', error);
                  if (websocket && websocket.readyState === WebSocket.OPEN) {
                    websocket.send(JSON.stringify({
                      type: 'conversation.item.create',
                      item: {
                        type: 'function_call_output',
                        call_id: message.call_id,
                        output: JSON.stringify({ 
                          error: error.message || 'Web search failed',
                          results: []
                        })
                      }
                    }));
                    
                    const waitForResponse = () => {
                      if (hasActiveResponse) {
                        setTimeout(waitForResponse, 100);
                        return;
                      }
                      hasActiveResponse = true;
                      if (websocket && websocket.readyState === WebSocket.OPEN) {
                        websocket.send(JSON.stringify({ type: 'response.create' }));
                      } else {
                        hasActiveResponse = false;
                      }
                    };
                    waitForResponse();
                  } else {
                    console.error('[Voice Mode] ❌ WebSocket not available for error response');
                  }
                });
              } else {
                console.error('[Voice Mode] ❌ No query provided for web search');
                if (websocket && websocket.readyState === WebSocket.OPEN) {
                  websocket.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: message.call_id,
                      output: JSON.stringify({ error: 'No search query provided' })
                    }
                  }));
                  
                  const waitForResponse = () => {
                    if (hasActiveResponse) {
                      setTimeout(waitForResponse, 100);
                      return;
                    }
                    hasActiveResponse = true;
                    if (websocket && websocket.readyState === WebSocket.OPEN) {
                      websocket.send(JSON.stringify({ type: 'response.create' }));
                    } else {
                      hasActiveResponse = false;
                    }
                  };
                  waitForResponse();
                }
              }
            }
            break;
            
          case 'response.function_call_result.done':
            // Function result received (this is when AI acknowledges the function output)
            console.log('[Voice Mode] 🔧 Function call result done:', message.name);
            // The actual image URL will be in the conversation.item.added event (handled above)
            break;
            
          case 'response.output_audio.delta':
            // CRITICAL: Use VoiceAudioEngine for single-playback guarantee with proper scheduling
            console.log('[Voice Mode] ✅ CASE MATCHED: response.output_audio.delta (VoiceAudioEngine)');
            
            // CRITICAL: Only process audio if voice mode is active
            if (!voiceModeActive && !window._voiceModeActive) {
              console.warn('[Voice Mode] ⚠️ Ignoring audio delta - voice mode not active');
              break;
            }
            
            // Skip OpenAI audio if ElevenLabs voice is selected (we'll use ElevenLabs audio instead)
            if (isElevenLabsVoiceSelected()) {
              console.log('[ElevenLabs] ⏭️ Skipping OpenAI audio delta - using ElevenLabs voice instead');
              break;
            }
            
            if (message.delta) {
              console.log('[Voice Mode] 🔊 Received audio delta, length:', message.delta?.length || 0);
              
              // CRITICAL: Cancel TTS immediately before playing GPT audio (prevent double voice)
              if (voiceModeActive || window._voiceModeActive) {
                window.speechSynthesis.cancel();
                window.speechSynthesis.cancel();
                window.speechSynthesis.cancel();
              }
              
              // Use VoiceAudioEngine for playback (THE ONLY audio output engine)
              if (voiceAudioEngine) {
                // Extract response ID from message if present, otherwise use current active
                const chunkResponseId = message.response_id || activeResponseId;
                
                // CRITICAL: If activeGen/activeResponseId aren't set yet (response.created not received),
                // initialize them now to prevent chunk discarding
                if (activeGen === 0 && !activeResponseId) {
                  activeGen = 1;
                  activeResponseId = chunkResponseId || `response_${Date.now()}`;
                  if (DEBUG_VOICE) {
                    console.log(`[Voice Mode] ⚠️ Auto-initialized gen/responseId from first audio chunk: gen=${activeGen}, responseId=${activeResponseId}`);
                  }
                  // Reset audio engine with the new gen/responseId
                  voiceAudioEngine.reset(activeGen, activeResponseId);
                }
                
                // Decode base64 to PCM Float32Array
                try {
                  const binaryString = atob(message.delta);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  
                  // Convert PCM16 to Float32
                  const pcm16 = new Int16Array(bytes.buffer);
                  const float32 = new Float32Array(pcm16.length);
                  for (let i = 0; i < pcm16.length; i++) {
                    float32[i] = pcm16[i] / 32768.0;
                  }
                  
                  // Push to audio engine (will be discarded if gen/response_id mismatch)
                  voiceAudioEngine.pushPcmChunk(float32, activeGen, chunkResponseId || activeResponseId);
                  
                  if (DEBUG_VOICE) {
                    console.log(`[Voice Mode] ✅ Chunk pushed to engine: gen=${activeGen}, responseId=${chunkResponseId || activeResponseId}, samples=${float32.length}`);
                  }
                } catch (error) {
                  console.error('[Voice Mode] ❌ Error decoding audio delta:', error);
                }
              } else {
                console.error('[Voice Mode] ❌ VoiceAudioEngine not available! Audio will not play.');
              }
            }
            break;
            
          case 'response.output_audio.done':
            // Audio output complete - all chunks received from server
            console.log('[Voice Mode] ✅ Audio output complete (all chunks received from server)');
            // Note: Playback may still be ongoing - VoiceAudioEngine will handle completion
            // Status will update when playback actually finishes (via state change callback)
            // Don't clear activeGen/activeResponseId yet - let playback finish naturally
            break;
            
          case 'response.done':
            // Response done - server finished sending response
            console.log('[Voice Mode] ✅ Response done (server finished)');
            // CRITICAL: Don't reset hasActiveResponse here - let VoicePlaybackManager finish playback
            // hasActiveResponse will be reset when playback actually finishes (in state change callback)
            // This prevents new responses from interrupting ongoing playback
            // Note: hasActiveResponse is only used to detect NEW responses, not to block playback
            
            // Response complete - check if there's text content (essay) to show in sidebar
            if (voiceModeActive && message.response && message.response.output) {
              // Check for text content in the response
              let textContent = '';
              
              // Handle different response formats
              if (message.response.output) {
                // Check if output is an array of items
                if (Array.isArray(message.response.output)) {
                  message.response.output.forEach(item => {
                    if (item.type === 'text' && item.text) {
                      textContent += item.text;
                    } else if (item.type === 'content' && item.content) {
                      textContent += item.content;
                    }
                  });
                } else if (typeof message.response.output === 'string') {
                  textContent = message.response.output;
                }
              }
              
              // If we have text content and it's substantial (likely an essay), show in sidebar
              if (textContent && textContent.length > 100) {
                console.log('[Voice Mode] 📝 Detected text response (essay), showing in sidebar');
                showInVoiceSidebar('essay', { text: textContent });
              }
            }
            
            // Reset speaking state when response is done
            if (websocket) websocket._isSpeaking = false;
            // Update UI - will switch to listening when audio queue drains
            // Don't force listening state here - let voiceAudioEngine state callback handle it
            if (voiceStatusTextIntegrated) voiceStatusTextIntegrated.textContent = 'Listening...';
            if (voiceStatusText) voiceStatusText.textContent = 'Listening...';
            if (voiceStatusIntegrated) {
              voiceStatusIntegrated.classList.remove('error');
              voiceStatusIntegrated.classList.add('recording');
            }
            if (statusDotIntegrated) statusDotIntegrated.style.background = '#4A90E2';
            if (statusDot) statusDot.style.background = '#4A90E2';
            break;
            
          case 'response.text.delta':
          case 'response.content.delta':
            // Text content is being streamed - we'll collect it and show when done
            // Store in a temporary variable for now
            if (websocket) {
              if (!websocket._textBuffer) websocket._textBuffer = '';
              const deltaText = message.delta || message.text || message.content || '';
              if (deltaText) {
                websocket._textBuffer += deltaText;
              }
            }
            break;
            
          case 'response.text.done':
          case 'response.content.done':
            // Text response complete - show in sidebar if it's substantial
            const fullText = message.text || message.content || (websocket?._textBuffer || '');
            if (voiceModeActive && fullText && fullText.length > 100) {
              console.log('[Voice Mode] 📝 Text response complete, showing in sidebar');
              showInVoiceSidebar('essay', { text: fullText });
            }
            
            // If ElevenLabs voice is selected, convert text to ElevenLabs audio
            if (voiceModeActive && isElevenLabsVoiceSelected() && fullText && fullText.trim()) {
              const elevenLabsVoiceId = getElevenLabsVoiceId();
              if (elevenLabsVoiceId) {
                console.log('[ElevenLabs] Converting text response to ElevenLabs audio...');
                
                // Cancel any OpenAI audio playback
                if (voiceAudioEngine) {
                  voiceAudioEngine.hardStop('switching to ElevenLabs audio');
                }
                
                // Convert and play ElevenLabs audio
                convertTextToElevenLabsAudio(fullText, elevenLabsVoiceId).then(audioData => {
                  if (audioData && audioData.audioUrl) {
                    // Play the audio
                    const audio = new Audio(audioData.audioUrl);
                    audio.play().catch(error => {
                      console.error('[ElevenLabs] Error playing audio:', error);
                    });
                    
                    // Clean up URL when done
                    audio.onended = () => {
                      URL.revokeObjectURL(audioData.audioUrl);
                    };
                    
                    // Update UI state
                    if (voiceStatusTextIntegrated) voiceStatusTextIntegrated.textContent = 'Speaking...';
                    if (voiceStatusText) voiceStatusText.textContent = 'Speaking...';
                    
                    console.log('[ElevenLabs] ✅ Audio playing');
                  }
                }).catch(error => {
                  console.error('[ElevenLabs] Failed to convert text to audio:', error);
                });
              }
            }
            
            // Clear buffer
            if (websocket && websocket._textBuffer) websocket._textBuffer = '';
            break;
            
          case 'conversation.item.input_audio_transcription.completed':
            // User's speech transcribed
            console.log('[Voice Mode] ✅ CASE MATCHED: conversation.item.input_audio_transcription.completed');
            console.log('[Voice Mode] 🔍 User transcript data:', {
              transcript: message.transcript,
              fullMessage: message
            });
            console.log('[Voice Mode] ✅ AI HEARD YOU! Transcript received:', message.transcript);
            
            // Check if we've already displayed this transcript
            const userTranscriptKey = `user-${message.transcript}`;
            if (message.transcript && !displayedTranscripts.has(userTranscriptKey)) {
              displayedTranscripts.add(userTranscriptKey);
              
              // Add to call transcripts for summary
              if (voiceCallStartTime) {
                voiceCallTranscripts.push({
                  speaker: 'user',
                  text: message.transcript,
                  timestamp: Date.now()
                });
              }
              
              const userGroup = document.createElement('div');
              userGroup.className = 'message-group user-msg-group';
              userGroup.innerHTML = `
                <div class="message-avatar">You</div>
                <div class="message-content">
                  <div class="user-msg">🎤 ${message.transcript}</div>
                </div>
              `;
              body.appendChild(userGroup);
              body.scrollTop = body.scrollHeight;
              console.log('[Voice Mode] ✅ Your speech displayed in chat (deduplicated)');
            } else if (message.transcript) {
              console.log('[Voice Mode] ⏭️ Skipping duplicate user transcript');
            } else {
              console.warn('[Voice Mode] ⚠️ Transcript received but empty');
            }
            break;
            
          case 'error':
            // Properly serialize error for logging
            const errorDetails = {
              type: message.type,
              error: message.error ? {
                message: message.error.message || message.error,
                code: message.error.code,
                type: message.error.type,
                param: message.error.param
              } : null,
              event_id: message.event_id,
              fullMessage: message
            };
            console.error('[Voice Mode] ❌ WebSocket error message received:', errorDetails);
            console.error('[Voice Mode] Full error object:', JSON.stringify(message, null, 2));
            
            // Extract readable error message
            let errorMsg = 'Unknown error';
            if (message.error) {
              if (typeof message.error === 'string') {
                errorMsg = message.error;
              } else if (message.error.message) {
                errorMsg = message.error.message;
              } else if (message.error.code) {
                errorMsg = `Error code: ${message.error.code}`;
              }
            } else if (message.message) {
              errorMsg = message.message;
            }
            
            // CRITICAL: Check for authentication errors - DO NOT RETRY
            // If server says "Missing bearer" or "authentication", it's a client config issue
            const isAuthError = errorMsg.toLowerCase().includes('authentication') || 
                                errorMsg.toLowerCase().includes('bearer') || 
                                errorMsg.toLowerCase().includes('missing bearer') ||
                                errorMsg.toLowerCase().includes('unauthorized') ||
                                errorMsg.toLowerCase().includes('forbidden');
            
            if (isAuthError) {
              console.error('[Voice Mode] 🔐 Authentication error detected - CLIENT CONFIG ISSUE');
              console.error('[Voice Mode] Error message:', errorMsg);
              console.error('[Voice Mode] This indicates a problem with token transport/subprotocols');
              console.error('[Voice Mode] DO NOT RETRY - This is a configuration issue, not a transient error');
              
              // Stop retrying immediately - this is a client config problem
              stopVoiceMode();
              
              if (voiceStatusTextIntegrated) {
                voiceStatusTextIntegrated.textContent = 'Auth failed (client config). Fix token transport.';
              }
              if (voiceStatusIntegrated) {
                voiceStatusIntegrated.classList.add('error');
                voiceStatusIntegrated.classList.remove('recording');
              }
              if (statusDotIntegrated) statusDotIntegrated.style.background = '#b00020';
              
              // Log diagnostic info
              const diagnosticToken = websocket?._ephemeralToken || 'not available';
              console.error('[Voice Mode] Diagnostic info:', {
                tokenReceived: !!diagnosticToken && diagnosticToken !== 'not available',
                tokenFormat: diagnosticToken && diagnosticToken !== 'not available' ? (diagnosticToken.startsWith('ek_') ? 'valid' : 'invalid') : 'missing',
                tokenPreview: diagnosticToken && diagnosticToken !== 'not available' ? diagnosticToken.substring(0, 8) + '...' : 'none',
                protocol: websocket?.protocol || 'none',
                url: websocket?.url || 'not available'
              });
              
              // Don't continue - stop here
              break;
            }
            
            // For non-auth errors, show error but don't stop (let retry logic handle if needed)
            if (voiceStatusTextIntegrated) {
              voiceStatusTextIntegrated.textContent = `Error: ${errorMsg}`;
            }
            if (voiceStatusIntegrated) {
              voiceStatusIntegrated.classList.remove('recording');
              voiceStatusIntegrated.classList.add('error');
            }
            if (statusDotIntegrated) statusDotIntegrated.style.background = '#b00020';
            break;
            
          case 'conversation.item.added':
            // Check if this is a function call output with an image
            if (message.item && message.item.type === 'function_call_output' && message.item.output) {
              try {
                const output = typeof message.item.output === 'string' 
                  ? JSON.parse(message.item.output) 
                  : message.item.output;
                
                if (output.image_url) {
                  console.log('[Voice Mode] ✅ Image from function call:', output.image_url.substring(0, 50) + '...');
                  
                  // Store the generated image globally so it can be included in emails
                  if (!window._lastGeneratedImage) {
                    window._lastGeneratedImage = {};
                  }
                  window._lastGeneratedImage.image_url = output.image_url;
                  window._lastGeneratedImage.image_prompt = output.revised_prompt || 'Generated image';
                  
                  // Show generated image in sidebar during voice call
                  if (voiceModeActive) {
                    showInVoiceSidebar('image', {
                      image_url: output.image_url,
                      prompt: output.revised_prompt || 'Generated image'
                    });
                    if (voiceStatusTextIntegrated) voiceStatusTextIntegrated.textContent = '✅ Image generated!';
                    
                    // If there's a pending email, update it with the image
                    if (window._pendingEmail) {
                      window._pendingEmail.image_url = output.image_url;
                      window._pendingEmail.image_prompt = output.revised_prompt || 'Generated image';
                      // Update the confirmation UI to show the image
                      const existingUI = document.body.querySelector('#email-confirmation-ui');
                      if (existingUI) {
                        showEmailConfirmationUI(
                          window._pendingEmail.recipient_email,
                          window._pendingEmail.subject,
                          window._pendingEmail.message,
                          output.image_url,
                          output.revised_prompt || 'Generated image'
                        );
                      }
                    }
                  } else {
                    // Show in chat if not in voice mode
                    const aiGroup = document.createElement('div');
                    aiGroup.className = 'message-group ai-msg-group';
                    const imageUrl = output.image_url;
                    const prompt = (output.revised_prompt || 'Generated image').replace(/'/g, "\\'");
                    aiGroup.innerHTML = `
                      <div class="message-avatar">
                        <img src="${logoPath}" alt="Noteworthy News" />
                      </div>
                      <div class="message-content">
                        <div class="reply">
                          <p>🎨 Generated image:</p>
                          <div style="margin: 12px 0;">
                            <img src="${imageUrl}" alt="${prompt}" style="max-width: 100%; border-radius: 8px; cursor: pointer;" onclick="window.openImagePopup && window.openImagePopup('${imageUrl}', '${prompt}')" />
                          </div>
                        </div>
                      </div>
                    `;
                    body.appendChild(aiGroup);
                    body.scrollTop = body.scrollHeight;
                  }
                }
              } catch (e) {
                console.error('[Voice Mode] Error parsing function call output:', e);
              }
            }
            
            // Check if this item contains a user transcript
            if (message.item && message.item.type === 'message' && message.item.role === 'user') {
              // Check for transcript in item content
              if (message.item.content) {
                const contentArray = Array.isArray(message.item.content) ? message.item.content : [message.item.content];
                contentArray.forEach(content => {
                  if (content.type === 'input_audio' && content.transcript) {
                    const userKey = `user-${content.transcript}`;
                    if (!displayedTranscripts.has(userKey)) {
                      displayedTranscripts.add(userKey);
                      console.log('[Voice Mode] ✅ Found user transcript in conversation.item.added:', content.transcript);
                      const userGroup = document.createElement('div');
                      userGroup.className = 'message-group user-msg-group';
                      userGroup.innerHTML = `
                        <div class="message-avatar">You</div>
                        <div class="message-content">
                          <div class="user-msg">🎤 ${content.transcript}</div>
                        </div>
                      `;
                      body.appendChild(userGroup);
                      body.scrollTop = body.scrollHeight;
                      console.log('[Voice Mode] ✅ Your speech displayed in chat (deduplicated)');
                    } else {
                      console.log('[Voice Mode] ⏭️ Skipping duplicate user transcript from conversation.item.added');
                    }
                  }
                });
              }
            }
            // Also check for AI response transcript in item
            if (message.item && message.item.type === 'message' && message.item.role === 'assistant') {
              if (message.item.content) {
                const contentArray = Array.isArray(message.item.content) ? message.item.content : [message.item.content];
                contentArray.forEach(content => {
                  if (content.type === 'output_audio' && content.transcript) {
                    const aiKey = `ai-${content.transcript}`;
                    if (!displayedTranscripts.has(aiKey)) {
                      displayedTranscripts.add(aiKey);
                      console.log('[Voice Mode] ✅ Found AI transcript in conversation.item.added:', content.transcript);
                      
                      // Remove any live transcript element first
                      const liveMsgGroup = root.querySelector('#ai-msg-live');
                      if (liveMsgGroup) liveMsgGroup.remove();
                      
                      const aiGroup = document.createElement('div');
                      aiGroup.className = 'message-group ai-msg-group';
                      aiGroup.innerHTML = `
                        <div class="message-avatar">NW</div>
                        <div class="message-content">
                          <div class="reply">🎤 ${content.transcript}</div>
                        </div>
                      `;
                      body.appendChild(aiGroup);
                      body.scrollTop = body.scrollHeight;
                      console.log('[Voice Mode] ✅ AI response displayed in chat (deduplicated)');
                    } else {
                      console.log('[Voice Mode] ⏭️ Skipping duplicate AI transcript from conversation.item.added');
                    }
                  }
                });
              }
            }
            break;
            
          default:
            // CRITICAL: Try to extract transcripts from unhandled messages as fallback
            // This catches messages that should have matched but didn't (browser cache issues, etc.)
            
            // Check for ANY transcript-related message types - be very explicit
            const messageType = message.type || '';
            const isTranscriptMessage = messageType.includes('transcript') || 
                                       messageType.includes('transcription') ||
                                       messageType === 'response.output_audio_transcript.delta' ||
                                       messageType === 'response.output_audio_transcript.done' ||
                                       messageType === 'conversation.item.input_audio_transcription.completed';
            
            if (isTranscriptMessage) {
              console.log('[Voice Mode] 🔍 TRANSCRIPT MESSAGE IN DEFAULT - extracting transcript:', messageType);
              console.log('[Voice Mode] 🔍 Message keys:', Object.keys(message));
              
              // Try to extract transcript from various possible locations
              // For delta messages, the text is in message.delta
              // For done messages, the text is in message.transcript or message.text
              let transcript = '';
              
              if (messageType.includes('delta')) {
                // Delta messages contain incremental text in message.delta
                transcript = message.delta || '';
                console.log('[Voice Mode] 🔍 Extracted delta transcript (length:', transcript.length, '):', transcript.substring(0, 100));
              } else {
                // Done messages contain full transcript
                transcript = message.transcript || message.text || '';
                console.log('[Voice Mode] 🔍 Extracted done transcript (length:', transcript.length, '):', transcript.substring(0, 100));
              }
              
              // Check nested structures as fallback
              if (!transcript && message.item && message.item.content) {
                const contentArray = Array.isArray(message.item.content) ? message.item.content : [message.item.content];
                for (const content of contentArray) {
                  if (content.transcript) transcript = content.transcript;
                  if (content.text) transcript = content.text;
                  if (content.delta) transcript = (transcript || '') + content.delta;
                }
                console.log('[Voice Mode] 🔍 Extracted from nested content (length:', transcript.length, '):', transcript.substring(0, 100));
              }
              
              console.log('[Voice Mode] 🔍 Final extracted transcript length:', transcript.length, 'hasContent:', !!transcript);
              
              if (transcript && messageType.includes('input_audio')) {
                // User transcript
                const userKey = `user-${transcript}`;
                if (!displayedTranscripts.has(userKey)) {
                  displayedTranscripts.add(userKey);
                  console.log('[Voice Mode] ✅ EXTRACTED USER TRANSCRIPT from default case:', transcript);
                  const userGroup = document.createElement('div');
                  userGroup.className = 'message-group user-msg-group';
                  userGroup.innerHTML = `
                    <div class="message-avatar">You</div>
                    <div class="message-content">
                      <div class="user-msg">🎤 ${transcript}</div>
                    </div>
                  `;
                  body.appendChild(userGroup);
                  body.scrollTop = body.scrollHeight;
                } else {
                  console.log('[Voice Mode] ⏭️ Skipping duplicate user transcript from default case');
                }
              } else if (transcript && messageType.includes('output_audio')) {
                // AI transcript
                const aiKey = `ai-${transcript}`;
                if (!displayedTranscripts.has(aiKey)) {
                  displayedTranscripts.add(aiKey);
                  console.log('[Voice Mode] ✅ EXTRACTED AI TRANSCRIPT from default case:', transcript);
                  if (messageType.includes('delta')) {
                    // Real-time update
                    let transcriptElement = root.querySelector('#ai-transcript-live');
                    if (!transcriptElement) {
                      const aiGroup = document.createElement('div');
                      aiGroup.className = 'message-group ai-msg-group';
                      aiGroup.id = 'ai-msg-live';
                      aiGroup.innerHTML = `
                        <div class="message-avatar">NW</div>
                        <div class="message-content">
                          <div class="reply" id="ai-transcript-live">🎤 </div>
                        </div>
                      `;
                      body.appendChild(aiGroup);
                      body.scrollTop = body.scrollHeight;
                      transcriptElement = root.querySelector('#ai-transcript-live');
                    }
                    if (transcriptElement) {
                      transcriptElement.textContent += transcript;
                      body.scrollTop = body.scrollHeight;
                    }
                  } else {
                    // Final transcript
                    const liveMsgGroup = root.querySelector('#ai-msg-live');
                    if (liveMsgGroup) liveMsgGroup.remove();
                    
                    const aiGroup = document.createElement('div');
                    aiGroup.className = 'message-group ai-msg-group';
                    aiGroup.innerHTML = `
                      <div class="message-avatar">NW</div>
                      <div class="message-content">
                        <div class="reply">🎤 ${transcript}</div>
                      </div>
                    `;
                    body.appendChild(aiGroup);
                    body.scrollTop = body.scrollHeight;
                  }
                } else {
                  console.log('[Voice Mode] ⏭️ Skipping duplicate AI transcript from default case');
                }
              }
            }
            
            // Log any unhandled message types for debugging (but skip transcript messages we already handled above)
            // Note: Filter should match the actual message type format (response.output_audio.delta)
            if (message.type && !message.type.startsWith('response.output_audio.delta') && !isTranscriptMessage) {
              console.log('[Voice Mode] Unhandled message type:', message.type, message);
            } else if (message.type === 'response.output_audio.delta') {
              // This shouldn't happen - if we get here, the case didn't match
              // CRITICAL: DO NOT process audio here - it's already handled in the case above
              // This prevents duplicate audio playback
              console.error('[Voice Mode] ❌ ERROR: response.output_audio.delta fell through to default case!', {
                messageType: message.type,
                messageTypeLength: message.type?.length,
                messageTypeCharCodes: message.type?.split('').map(c => c.charCodeAt(0))
              });
              console.warn('[Voice Mode] ⚠️ IGNORING audio delta in default case to prevent duplicate playback');
              // DO NOT call playAudioChunk here - it's already handled in the case statement above
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        console.error('Raw message data:', event.data);
      }
    }
    
    // ============================================================================
    // OLD QUEUE CODE REMOVED - Now using VoicePlaybackManager
    // ============================================================================
    // All audio playback is now handled by VoicePlaybackManager:
    // - Single-playback guarantee via state machine
    // - Generation ID cancellation system prevents overlap
    // - Hard-stop audio cleanup on stop/new message
    // - Sequential chunk processing with cancellation checks
    // See: src/widgets/voice-playback-manager.js
    // ============================================================================
    
    // Legacy handlers (kept for compatibility but not used)
    
    // Drag and drop handling on the main chat body and wrap
    if (body && wrap) {
      // Prevent default drag behaviors
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        body.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
        }, false);
        wrap.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
        }, false);
      });
      
      // Highlight drop zone when item is dragged over it
      const addDragOver = (e) => {
        if (e.dataTransfer.types.includes('Files')) {
          wrap.classList.add('drag-over');
          body.classList.add('drag-over');
        }
      };
      
      const removeDragOver = () => {
        wrap.classList.remove('drag-over');
        body.classList.remove('drag-over');
      };
      
      wrap.addEventListener('dragenter', addDragOver);
      body.addEventListener('dragenter', addDragOver);
      
      wrap.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('Files')) {
          wrap.classList.add('drag-over');
          body.classList.add('drag-over');
          e.dataTransfer.dropEffect = 'copy';
        }
      });
      
      body.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('Files')) {
          wrap.classList.add('drag-over');
          body.classList.add('drag-over');
          e.dataTransfer.dropEffect = 'copy';
        }
      });
      
      wrap.addEventListener('dragleave', (e) => {
        // Only remove drag-over if we're leaving the wrap
        const rect = wrap.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
          removeDragOver();
        }
      });
      
      body.addEventListener('dragleave', (e) => {
        // Only remove drag-over if we're leaving the body
        const rect = body.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
          // Check if we're still over the wrap
          const wrapRect = wrap.getBoundingClientRect();
          if (x < wrapRect.left || x > wrapRect.right || y < wrapRect.top || y > wrapRect.bottom) {
            removeDragOver();
          }
        }
      });
      
      wrap.addEventListener('drop', (e) => {
        removeDragOver();
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          handleFiles(files);
        }
      });
      
      body.addEventListener('drop', (e) => {
        removeDragOver();
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          handleFiles(files);
        }
      });
    }
    
    function formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    function updateFilePreviewContainer() {
      const previewContainer = root.querySelector('.file-preview-container');
      if (previewContainer && uploadedFiles.length === 0) {
        previewContainer.remove();
      }
    }
    
    // Attach event handlers with error checking
    if (send) {
      send.onclick = (e) => {
        console.log('Send button clicked');
        e.preventDefault();
        e.stopPropagation();
        ask().catch(err => {
          console.error('Error in ask() from send button:', err);
        });
      };
    } else {
      console.error('Send button not found!');
    }
    
    if (input) {
      input.addEventListener('keydown', (e) => {
        // Stop propagation for 'k' key to prevent keyboard shortcuts from intercepting it
        if (e.key === 'k' || e.key === 'K') {
          e.stopPropagation();
        }
        if (e.key === 'Enter' && !send.disabled) {
          console.log('Enter key pressed');
          e.preventDefault();
          ask().catch(err => {
            console.error('Error in ask() from Enter key:', err);
          });
        }
      });
    } else {
      console.error('Input field not found!');
    }

    // Initial position and size
    setPos(this.pos.x, this.pos.y);
    setSize(this.size.w, this.size.h);
  }

  disconnectedCallback() {
    // Cleanup if needed
  }
}

// Prevent redeclaration - only define custom element if not already defined
if (typeof customElements !== 'undefined' && !customElements.get('noteworthy-chat-widget')) {
  customElements.define('noteworthy-chat-widget', NoteworthyChat);
} else if (typeof customElements !== 'undefined') {
  console.warn('[NoteworthyChat] Custom element already defined, skipping registration');
}

// ACCEPTANCE TESTS: Add test functions to window for debugging
if (typeof window !== 'undefined') {
  window.voiceTest = {
    spamPlay: () => {
      console.log('[Voice Test] 🧪 Spamming 5 play requests 200ms apart...');
      if (!window.voiceManager) {
        console.error('[Voice Test] ❌ voiceManager not available');
        return;
      }
      
      let count = 0;
      const interval = setInterval(() => {
        count++;
        const testChunk = btoa(String.fromCharCode(...new Array(1000).fill(0).map(() => Math.floor(Math.random() * 256))));
        console.log(`[Voice Test] 🎯 Play request ${count}/5`);
        window.voiceManager.play([testChunk]).catch(err => {
          console.error(`[Voice Test] ❌ Play ${count} failed:`, err);
        });
        
        if (count >= 5) {
          clearInterval(interval);
          console.log('[Voice Test] ✅ Spam test complete - only last should play');
        }
      }, 200);
    },
    
    stopSpam: () => {
      console.log('[Voice Test] 🛑 Stopping playback...');
      if (window.voiceManager) {
        window.voiceManager.stop();
        console.log('[Voice Test] ✅ Stop called');
      } else {
        console.error('[Voice Test] ❌ voiceManager not available');
      }
    },
    
    getState: () => {
      if (window.voiceManager) {
        const state = {
          state: window.voiceManager.getState(),
          generation: window.voiceManager.getCurrentGeneration(),
          playbackGen: window.voiceManager.playbackGeneration
        };
        console.log('[Voice Test] 📊 Manager state:', state);
        return state;
      } else {
        console.error('[Voice Test] ❌ voiceManager not available');
        return null;
      }
    },
    
    testOverlap: () => {
      console.log('[Voice Test] 🧪 Testing overlap prevention...');
      if (!window.voiceManager) {
        console.error('[Voice Test] ❌ voiceManager not available');
        return;
      }
      
      // Create test chunks
      const chunk1 = btoa(String.fromCharCode(...new Array(2000).fill(0).map(() => Math.floor(Math.random() * 256))));
      const chunk2 = btoa(String.fromCharCode(...new Array(2000).fill(0).map(() => Math.floor(Math.random() * 256))));
      
      console.log('[Voice Test] 🎯 Starting first playback...');
      window.voiceManager.play([chunk1]).catch(err => console.error('[Voice Test] ❌ Play 1 failed:', err));
      
      setTimeout(() => {
        console.log('[Voice Test] 🎯 Starting second playback (should cancel first)...');
        window.voiceManager.play([chunk2]).catch(err => console.error('[Voice Test] ❌ Play 2 failed:', err));
      }, 100);
      
      console.log('[Voice Test] ✅ Overlap test started - second should cancel first');
    }
  };
  
  console.log('[Voice Mode] ✅ Acceptance tests available: window.voiceTest.spamPlay(), window.voiceTest.stopSpam(), window.voiceTest.getState(), window.voiceTest.testOverlap()');
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NoteworthyChat;
}
