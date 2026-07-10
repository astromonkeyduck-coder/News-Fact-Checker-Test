// Shadow DOM web component for Noteworthy Chat widget (TypeScript version)
// Enhanced with glassy effects, resize capability, AI logo, and mobile-friendly design

export class NoteworthyChat extends HTMLElement {
  private root: ShadowRoot;
  private pos = { x: 24, y: 24 };
  private size = { w: 420, h: 520 };
  private dragging = false;
  private resizing = false;
  private start: { x: number; y: number } | null = null;
  private startPos: { x: number; y: number } | null = null;
  private startSize: { w: number; h: number } | null = null;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const endpoint = this.getAttribute('data-endpoint') || '/.netlify/functions/noteworthy-chat';
    const openOnLoad = this.getAttribute('data-open') === 'true';

    this.root.innerHTML = `
      <style>
        :host { all: initial; display: block; }
        *, *::before, *::after { box-sizing: border-box; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
        
        .wrap { 
          position: fixed; 
          left: 24px; 
          top: 24px; 
          width: 420px; 
          min-width: 320px;
          height: 520px; 
          min-height: 400px;
          max-width: 95vw; 
          max-height: 90vh;
          border-radius: 24px; 
          overflow: hidden; 
          z-index: 2147483000;
          background: linear-gradient(135deg, 
            rgba(255,255,255,.98) 0%, 
            rgba(255,255,255,.95) 50%,
            rgba(248,250,252,.97) 100%);
          backdrop-filter: blur(24px) saturate(200%);
          -webkit-backdrop-filter: blur(24px) saturate(200%);
          border: 1.5px solid rgba(255,255,255,.6);
          box-shadow: 
            0 24px 72px rgba(0,0,0,.18),
            0 0 0 1px rgba(255,255,255,.6) inset,
            0 12px 40px rgba(1,31,91,.12),
            0 4px 16px rgba(212,160,23,.08);
          display: none; 
          flex-direction: column;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease, box-shadow 0.3s ease;
        }
        .wrap.open { 
          display: flex; 
          animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes slideUp {
          from { transform: translateY(20px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .wrap:hover {
          box-shadow: 
            0 28px 80px rgba(0,0,0,.22),
            0 0 0 1px rgba(255,255,255,.7) inset,
            0 16px 48px rgba(1,31,91,.15),
            0 6px 20px rgba(212,160,23,.12);
        }
        
        .head { 
          cursor: grab; 
          user-select: none; 
          padding: 14px 16px;
          background: linear-gradient(135deg, #011F5B 0%, #143A92 50%, #0d2968 100%); 
          color: #fff;
          display: flex; 
          align-items: center; 
          justify-content: space-between; 
          gap: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,.1), inset 0 1px 0 rgba(255,255,255,.1);
          position: relative;
        }
        .head::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(212,160,23,.5), transparent);
          animation: shimmer 3s infinite;
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .head:active { cursor: grabbing; }
        
        .head-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .help-btn {
          background: rgba(255,255,255,.1);
          border: none;
          color: rgba(255,255,255,.8);
          font-size: 18px;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 8px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
        }
        .help-btn:hover {
          background: rgba(255,255,255,.2);
          color: #fff;
          transform: scale(1.1);
        }
        .help-btn:focus {
          outline: 2px solid rgba(255,255,255,.5);
          outline-offset: 2px;
        }
        
        .head-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .logo { 
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, #D4A017 0%, #F4C430 100%);
          color: #0f0f0f;
          font-weight: 900;
          display: grid;
          place-items: center;
          font-size: 15px;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(212,160,23,.3), inset 0 1px 0 rgba(255,255,255,.3);
        }
        
        .title-group {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        
        .title { 
          font-size: 15px; 
          font-weight: 800; 
          line-height: 1.2; 
          margin: 0;
          color: #fff;
          letter-spacing: -0.2px;
        }
        
        .sub { 
          font-size: 11px; 
          opacity: .9; 
          line-height: 1.3;
          margin: 0;
          color: rgba(255,255,255,.85);
        }
        
        .close { 
          border: none;
          background: rgba(255,255,255,.1);
          color: #fff;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          margin: 0;
          border-radius: 8px;
          transition: all 0.2s;
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .close:hover { 
          background: rgba(255,255,255,.2); 
          transform: scale(1.1);
        }
        .close:focus { outline: 2px solid rgba(255,255,255,.5); outline-offset: 2px; }
        
        .body { 
          flex: 1; 
          overflow-y: auto; 
          overflow-x: hidden;
          padding: 16px; 
          color: #1a1a1a; 
          font-size: 14px; 
          line-height: 1.6; 
          background: transparent;
          scroll-behavior: smooth;
        }
        .body::-webkit-scrollbar {
          width: 6px;
        }
        .body::-webkit-scrollbar-track {
          background: transparent;
        }
        .body::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,.1);
          border-radius: 3px;
        }
        .body::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,.2);
        }
        
        .tip { 
          color: #666; 
          margin: 0;
          font-size: 14px;
          padding: 12px;
          background: rgba(1,31,91,.04);
          border-radius: 12px;
          border-left: 3px solid #D4A017;
        }
        
        .message-group {
          display: flex;
          gap: 10px;
          margin: 12px 0;
          align-items: flex-start;
        }
        
        .message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-weight: 900;
          font-size: 13px;
        }
        
        .user-msg-group .message-avatar {
          background: linear-gradient(135deg, rgba(1,31,91,.15) 0%, rgba(1,31,91,.1) 100%);
          color: #011F5B;
        }
        
        .ai-msg-group .message-avatar {
          background: linear-gradient(135deg, #D4A017 0%, #F4C430 100%);
          color: #0f0f0f;
          box-shadow: 0 2px 8px rgba(212,160,23,.25);
        }
        
        .message-content {
          flex: 1;
          min-width: 0;
        }
        
        .user-msg {
          padding: 12px 14px;
          background: linear-gradient(135deg, rgba(1,31,91,.08) 0%, rgba(1,31,91,.05) 100%);
          border-radius: 12px 12px 12px 4px;
          color: #1a1a1a;
          font-size: 14px;
          line-height: 1.6;
          border: 1px solid rgba(1,31,91,.08);
        }
        
        .reply { 
          padding: 12px 14px;
          background: linear-gradient(135deg, 
            rgba(255,247,230,.95) 0%,
            rgba(255,252,245,.9) 100%);
          border-left: 4px solid #D4A017;
          border-radius: 4px 12px 12px 12px;
          margin: 0;
          border: 1px solid rgba(212,160,23,.15);
          box-shadow: 0 2px 8px rgba(212,160,23,.08);
        }
        .reply p {
          margin: 0 0 10px 0;
          color: #1a1a1a;
          font-size: 14px;
          line-height: 1.6;
        }
        .reply p:last-child {
          margin-bottom: 0;
        }
        
        .reply img {
          max-width: 100%;
          height: auto;
          border-radius: 12px;
          margin: 12px 0;
          box-shadow: 0 4px 12px rgba(0,0,0,.15);
          display: block;
        }
        
        .mode-toggle {
          background: rgba(255, 255, 255, 0.8);
          border: 1.5px solid rgba(0, 0, 0, 0.1);
          color: #1a1a1a;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.2s;
          padding: 0;
          line-height: 1;
          flex-shrink: 0;
        }
        
        .mode-toggle:hover {
          background: rgba(255, 255, 255, 1);
          transform: scale(1.1);
          border-color: #D4A017;
        }
        
        .mode-toggle.active {
          background: rgba(212, 160, 23, 0.2);
          border-color: #D4A017;
        }
        
        .mode-toggle #modeIcon {
          display: block;
        }
        
        .voice-mode-toggle {
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.15) 0%, rgba(74, 144, 226, 0.1) 100%);
          border: 1.5px solid rgba(74, 144, 226, 0.4);
          color: #4A90E2;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.2s;
          padding: 0;
          line-height: 1;
          flex-shrink: 0;
          position: relative;
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
          width: 20px;
          height: 20px;
          display: block;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .voice-selector {
          position: absolute;
          bottom: 60px;
          left: 16px;
          right: 16px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border: 1.5px solid rgba(0, 0, 0, 0.1);
          border-radius: 12px;
          padding: 12px;
          display: none;
          flex-direction: column;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
        }
        
        .voice-selector.show {
          display: flex;
        }
        
        .voice-selector label {
          font-size: 12px;
          font-weight: 600;
          color: #666;
          margin-bottom: 4px;
        }
        
        .voice-selector select {
          padding: 8px 12px;
          border: 1.5px solid rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          font-size: 14px;
          background: #fff;
          color: #1a1a1a;
          cursor: pointer;
          outline: none;
        }
        
        .voice-selector select:focus {
          border-color: #4A90E2;
          box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
        }
        
        .voice-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(74, 144, 226, 0.1);
          border-radius: 8px;
          font-size: 12px;
          color: #4A90E2;
        }
        
        .voice-status.recording {
          background: rgba(176, 0, 32, 0.1);
          color: #b00020;
        }
        
        .voice-status .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          animation: blink 1s infinite;
        }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        
        .input { 
          padding: 14px 16px; 
          border-top: 1px solid rgba(0,0,0,.06); 
          background: linear-gradient(180deg, 
            rgba(255,255,255,.95) 0%,
            rgba(248,250,252,.9) 100%);
          backdrop-filter: blur(10px);
          display: flex; 
          gap: 10px; 
        }
        
        .input input[type="text"] { 
          flex: 1; 
          padding: 12px 14px; 
          border: 1.5px solid rgba(0,0,0,.1); 
          border-radius: 14px; 
          outline: none; 
          font-size: 14px;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          background: rgba(255,255,255,.8);
          color: #1a1a1a;
          transition: all 0.2s;
        }
        .input input[type="text"]:focus {
          border-color: #D4A017;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(212,160,23,.1);
        }
        .input input[type="text"]::placeholder {
          color: #999;
        }
        
        .file-upload-btn {
          padding: 12px;
          border-radius: 14px;
          border: 1.5px solid rgba(0,0,0,.1);
          background: rgba(255,255,255,.8);
          color: #1a1a1a;
          cursor: pointer;
          font-size: 18px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
        }
        .file-upload-btn:hover {
          background: #fff;
          border-color: #D4A017;
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(212,160,23,.2);
        }
        .file-upload-btn svg {
          width: 20px;
          height: 20px;
          display: block;
        }
        
        .file-preview-container {
          padding: 8px 16px;
          max-height: 150px;
          overflow-y: auto;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .file-preview {
          position: relative;
          width: 80px;
          height: 80px;
          border-radius: 8px;
          overflow: hidden;
          border: 2px solid rgba(212,160,23,.3);
          background: rgba(212,160,23,.1);
        }
        
        .file-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .file-preview .remove-file {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(0,0,0,.7);
          color: #fff;
          border: none;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        
        .file-preview .remove-file:hover {
          background: rgba(176,0,32,.9);
        }
        
        .input button { 
          padding: 12px 18px; 
          border-radius: 14px; 
          font-weight: 800; 
          border: none; 
          background: linear-gradient(135deg, #D4A017 0%, #F4C430 100%);
          color: #0f0f0f; 
          box-shadow: 0 4px 12px rgba(212,160,23,.35), inset 0 1px 0 rgba(255,255,255,.3);
          cursor: pointer;
          font-size: 14px;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .input button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(212,160,23,.45), inset 0 1px 0 rgba(255,255,255,.3);
        }
        .input button:active:not(:disabled) {
          transform: translateY(0);
        }
        .input button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }
        .input button:focus {
          outline: 2px solid #D4A017;
          outline-offset: 2px;
        }
        
        .resize-handle {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 24px;
          height: 24px;
          cursor: nwse-resize;
          z-index: 10;
          background: linear-gradient(135deg, transparent 40%, rgba(0,0,0,.15) 40%, rgba(0,0,0,.15) 45%, transparent 45%, transparent 55%, rgba(0,0,0,.15) 55%, rgba(0,0,0,.15) 60%, transparent 60%);
          border-radius: 8px 0 0 0;
        }
        .resize-handle:hover {
          background: linear-gradient(135deg, transparent 40%, rgba(212,160,23,.3) 40%, rgba(212,160,23,.3) 45%, transparent 45%, transparent 55%, rgba(212,160,23,.3) 55%, rgba(212,160,23,.3) 60%, transparent 60%);
        }
        
        .launcher { 
          position: fixed; 
          right: 20px; 
          bottom: 20px; 
          z-index: 2147482999;
          background: linear-gradient(135deg, #011F5B 0%, #143A92 100%);
          color: #fff;
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 999px;
          padding: 14px 20px;
          font-weight: 700;
          box-shadow: 
            0 8px 24px rgba(0,0,0,.2),
            0 0 0 0 rgba(212,160,23,.4);
          cursor: pointer;
          font-size: 14px;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          transition: all 0.2s;
        }
        .launcher:hover {
          transform: translateY(-3px);
          box-shadow: 
            0 12px 32px rgba(0,0,0,.25),
            0 0 0 4px rgba(212,160,23,.2);
        }
        .launcher:focus {
          outline: 2px solid rgba(255,255,255,.5);
          outline-offset: 3px;
        }
        
        .thinking {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 0;
          color: #666;
          font-size: 14px;
        }
        
        .spinner {
          display: inline-block;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 3px solid rgba(212,160,23,.2);
          border-bottom-color: #D4A017;
          animation: spin .8s linear infinite;
        }
        
        .error {
          color: #b00020;
          background: linear-gradient(135deg, #FFEBEE 0%, #FFF5F7 100%);
          border-left: 4px solid #b00020;
          padding: 12px 14px;
          border-radius: 12px;
          margin: 12px 0;
          font-size: 14px;
          line-height: 1.6;
          box-shadow: 0 2px 8px rgba(176,0,32,.1);
        }
        
        @keyframes spin { 
          to { transform: rotate(360deg); } 
        }
        
        @media (max-width: 768px) {
          .wrap {
            width: calc(100vw - 32px) !important;
            height: 70vh !important;
            max-width: calc(100vw - 32px) !important;
            max-height: 70vh !important;
            left: 16px !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            border-radius: 20px !important;
            min-width: calc(100vw - 32px) !important;
            min-height: 400px !important;
          }
          
          .wrap.open {
            transform: translateY(-50%) !important;
          }
          
          .launcher {
            right: 1rem;
            bottom: 1.5rem;
            padding: 0.75rem 1rem;
            font-size: 0.813rem;
            border-radius: 24px;
          }
          
          @media (max-width: 480px) {
            .launcher {
              right: 0.75rem;
              bottom: 1rem;
              padding: 0.625rem 0.875rem;
              font-size: 0.75rem;
            }
          }
          
          .resize-handle {
            display: none;
          }
          
          .head {
            padding: 12px 14px;
          }
          
          .body {
            padding: 14px;
          }
          
          .input {
            padding: 12px 14px;
          }
          
          .message-group {
            gap: 8px;
          }
          
          .message-avatar {
            width: 28px;
            height: 28px;
            font-size: 12px;
          }
        }
        
        @media (min-width: 769px) and (max-width: 1024px) {
          .wrap {
            max-width: 90vw;
            max-height: 85vh;
          }
        }
        
        /* Tutorial Card Styles - Sleek, Non-Intrusive */
        .tutorial-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 2147483100;
          display: none;
          align-items: flex-start;
          justify-content: flex-end;
          padding: 20px;
          opacity: 0;
          transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
        }
        
        .tutorial-overlay.show {
          display: flex;
          opacity: 1;
          pointer-events: all;
        }
        
        .tutorial-modal {
          background: linear-gradient(135deg, 
            rgba(255,255,255,.99) 0%, 
            rgba(255,255,255,.97) 100%);
          backdrop-filter: blur(32px) saturate(180%);
          -webkit-backdrop-filter: blur(32px) saturate(180%);
          border-radius: 20px;
          max-width: 480px;
          width: 100%;
          max-height: calc(100vh - 40px);
          box-shadow: 
            0 20px 60px rgba(0,0,0,.25),
            0 0 0 1px rgba(255,255,255,.8) inset,
            0 8px 32px rgba(1,31,91,.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: tutorialSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), tutorialGlow 3s ease-in-out infinite;
          transform-origin: top right;
        }
        
        @keyframes tutorialSlideIn {
          from { 
            transform: translateX(20px) scale(0.96); 
            opacity: 0; 
          }
          to { 
            transform: translateX(0) scale(1); 
            opacity: 1; 
          }
        }
        
        @keyframes tutorialGlow {
          0%, 100% {
            box-shadow: 
              0 20px 60px rgba(0,0,0,.25),
              0 0 0 1px rgba(255,255,255,.8) inset,
              0 8px 32px rgba(1,31,91,.15);
          }
          50% {
            box-shadow: 
              0 20px 60px rgba(0,0,0,.25),
              0 0 0 1px rgba(255,255,255,.8) inset,
              0 8px 32px rgba(1,31,91,.15),
              0 0 40px rgba(212,160,23,.2);
          }
        }
        
        .tutorial-modal {
          animation: tutorialSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), tutorialGlow 3s ease-in-out infinite;
        }
        
        .tutorial-header {
          padding: 16px 20px;
          background: linear-gradient(135deg, #011F5B 0%, #143A92 100%);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid rgba(255,255,255,.1);
        }
        
        .tutorial-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
        }
        
        .tutorial-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.3px;
          color: #fff;
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
        
        .tutorial-close {
          background: rgba(255,255,255,.1);
          border: none;
          color: #fff;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          padding: 6px;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        
        .tutorial-close:hover {
          background: rgba(255,255,255,.2);
          transform: scale(1.1);
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
        }
        
        .tutorial-skip:hover {
          background: rgba(255,255,255,.15);
          border-color: rgba(255,255,255,.5);
        }
        
        .tutorial-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        
        .tutorial-content {
          scrollbar-width: thin;
          scrollbar-color: #D4A017 rgba(1,31,91,.08);
        }
        
        .tutorial-content::-webkit-scrollbar {
          width: 8px;
        }
        
        .tutorial-content::-webkit-scrollbar-track {
          background: rgba(1,31,91,.08);
          border-radius: 4px;
        }
        
        .tutorial-content::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #D4A017 0%, #F4C430 100%);
          border-radius: 4px;
          box-shadow: 0 0 8px rgba(212,160,23,.3);
        }
        
        .tutorial-content::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #F4C430 0%, #D4A017 100%);
          box-shadow: 0 0 12px rgba(212,160,23,.5);
        }
        
        .tutorial-intro {
          margin-bottom: 20px;
          padding: 14px;
          background: linear-gradient(135deg, rgba(212,160,23,.06) 0%, rgba(74,144,226,.06) 100%);
          border-radius: 12px;
          border-left: 3px solid #D4A017;
          animation: tutorialIntroFadeIn 0.5s ease forwards;
        }
        
        @keyframes tutorialIntroFadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .tutorial-intro p {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          color: #1a1a1a;
        }
        
        .tutorial-specs {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 20px;
        }
        
        .tutorial-spec {
          padding: 10px 12px;
          background: rgba(1,31,91,.04);
          border-radius: 10px;
          border: 1px solid rgba(1,31,91,.08);
          transition: all 0.3s ease;
        }
        
        .tutorial-spec:hover {
          transform: translateY(-2px);
          background: rgba(1,31,91,.08);
          border-color: rgba(212,160,23,.3);
          box-shadow: 0 4px 12px rgba(212,160,23,.15);
        }
        
        .tutorial-spec-label {
          font-size: 11px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        
        .tutorial-spec-value {
          font-size: 14px;
          font-weight: 700;
          color: #011F5B;
          font-family: 'SF Mono', Monaco, monospace;
        }
        
        .tutorial-steps {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }
        
        .tutorial-step {
          padding: 14px;
          background: rgba(255,255,255,.6);
          border-radius: 12px;
          border: 1px solid rgba(1,31,91,.08);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          opacity: 0;
          animation: tutorialStepFadeIn 0.5s ease forwards;
        }
        
        .tutorial-step:nth-child(1) { animation-delay: 0.1s; }
        .tutorial-step:nth-child(2) { animation-delay: 0.2s; }
        .tutorial-step:nth-child(3) { animation-delay: 0.3s; }
        .tutorial-step:nth-child(4) { animation-delay: 0.4s; }
        .tutorial-step:nth-child(5) { animation-delay: 0.5s; }
        
        @keyframes tutorialStepFadeIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .tutorial-step::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(212,160,23,.1), transparent);
          transition: left 0.5s ease;
        }
        
        .tutorial-step:hover::before {
          left: 100%;
        }
        
        .tutorial-step:hover {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 8px 24px rgba(212,160,23,.2), 0 0 0 1px rgba(212,160,23,.2);
          border-color: rgba(212,160,23,.4);
        }
        
        .tutorial-step.expanded {
          background: rgba(255,255,255,.9);
          border-color: rgba(212,160,23,.4);
          box-shadow: 0 4px 16px rgba(212,160,23,.15);
          animation: tutorialStepExpand 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        @keyframes tutorialStepExpand {
          from {
            transform: scale(0.98);
            opacity: 0.8;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .tutorial-step-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }
        
        .tutorial-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, #D4A017 0%, #F4C430 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(212,160,23,.25);
          animation: tutorialIconPulse 2s ease-in-out infinite;
          transition: all 0.3s ease;
        }
        
        @keyframes tutorialIconPulse {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 2px 8px rgba(212,160,23,.25);
          }
          50% { 
            transform: scale(1.05);
            box-shadow: 0 4px 16px rgba(212,160,23,.4);
          }
        }
        
        .tutorial-step:hover .tutorial-icon {
          animation: none;
          transform: scale(1.1);
          box-shadow: 0 4px 20px rgba(212,160,23,.5);
        }
        
        .tutorial-step h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #011F5B;
          flex: 1;
        }
        
        .tutorial-step-toggle {
          background: transparent;
          border: none;
          color: #666;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }
        
        .tutorial-step.expanded .tutorial-step-toggle {
          transform: rotate(180deg);
        }
        
        .tutorial-step-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
          opacity: 0;
        }
        
        .tutorial-step.expanded .tutorial-step-content {
          max-height: 500px;
          opacity: 1;
          animation: tutorialContentFadeIn 0.4s ease forwards;
        }
        
        @keyframes tutorialContentFadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .tutorial-step p {
          margin: 8px 0 0 0;
          font-size: 13px;
          line-height: 1.5;
          color: #4a5568;
        }
        
        .tutorial-example {
          margin-top: 10px;
          padding: 10px;
          background: rgba(1,31,91,.03);
          border-radius: 8px;
          border-left: 2px solid #4A90E2;
        }
        
        .tutorial-example strong {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          color: #011F5B;
          font-weight: 600;
        }
        
        .tutorial-example code {
          display: block;
          padding: 6px 10px;
          margin: 4px 0;
          background: rgba(255,255,255,.8);
          border-radius: 6px;
          font-size: 12px;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          color: #2d3748;
          border: 1px solid rgba(0,0,0,.05);
        }
        
        .tutorial-shortcuts {
          margin-top: 16px;
          padding: 14px;
          background: linear-gradient(135deg, rgba(212,160,23,.08) 0%, rgba(74,144,226,.08) 100%);
          border-radius: 12px;
          border: 1px solid rgba(212,160,23,.15);
        }
        
        .tutorial-shortcuts h4 {
          margin: 0 0 10px 0;
          font-size: 13px;
          font-weight: 700;
          color: #011F5B;
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
          background: rgba(255,255,255,.6);
          border-radius: 6px;
          font-size: 12px;
        }
        
        .tutorial-shortcut-key {
          font-family: 'SF Mono', Monaco, monospace;
          background: rgba(1,31,91,.1);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #011F5B;
        }
        
        .tutorial-footer {
          padding: 14px 20px;
          background: rgba(248,250,252,.6);
          border-top: 1px solid rgba(0,0,0,.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        
        .tutorial-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 12px;
          color: #4a5568;
        }
        
        .tutorial-checkbox input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
        
        .tutorial-btn-primary {
          padding: 8px 16px;
          background: linear-gradient(135deg, #D4A017 0%, #F4C430 100%);
          color: #0f0f0f;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 2px 8px rgba(212,160,23,.25);
          position: relative;
          overflow: hidden;
        }
        
        .tutorial-btn-primary::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255,255,255,.3);
          transform: translate(-50%, -50%);
          transition: width 0.6s, height 0.6s;
        }
        
        .tutorial-btn-primary:hover::before {
          width: 300px;
          height: 300px;
        }
        
        .tutorial-btn-primary:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 6px 20px rgba(212,160,23,.4), 0 0 0 4px rgba(212,160,23,.1);
        }
        
        .tutorial-btn-primary:active {
          transform: translateY(0) scale(1.02);
        }
        
        @media (max-width: 768px) {
          .tutorial-overlay {
            align-items: flex-end;
            padding: 0;
          }
          
          .tutorial-modal {
            max-width: 100vw;
            max-height: 85vh;
            border-radius: 20px 20px 0 0;
            animation: tutorialSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          
          @keyframes tutorialSlideUp {
            from { 
              transform: translateY(100%); 
              opacity: 0; 
            }
            to { 
              transform: translateY(0); 
              opacity: 1; 
            }
          }
          
          .tutorial-specs {
            grid-template-columns: 1fr;
          }
          
          .tutorial-shortcuts-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
      
      <button class="launcher" aria-label="Open Noteworthy Chat">Noteworthy Chat</button>
      
      <div class="wrap${openOnLoad ? ' open' : ''}" role="dialog" aria-label="Noteworthy Assistant" aria-modal="true">
        <div class="head">
          <div class="head-left">
            <div class="logo" aria-hidden="true">NW</div>
            <div class="title-group">
              <div class="title">Noteworthy Assistant (GPT-5)</div>
              <div class="sub">Ask about the news</div>
            </div>
          </div>
          <div class="head-right">
            <button class="help-btn" id="helpBtn" aria-label="Show tutorial" title="How to use Noteworthy AI">❓</button>
            <button class="close" aria-label="Close chat">×</button>
          </div>
        </div>
        
        <div class="body">
          <p class="tip">Ask about headlines, context, or fact-checks. Click the <strong>🎤 microphone button</strong> to start a voice conversation! I'm here to help you stay informed!</p>
        </div>
        
        <div class="input">
          <button type="button" class="mode-toggle" id="modeToggle" aria-label="Toggle between chat and image generation" title="Click to switch between chat and image generation">
            <span id="modeIcon">💬</span>
          </button>
          <button type="button" class="voice-mode-toggle" id="voiceModeToggle" aria-label="Start voice conversation" title="Click to start voice conversation with AI">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: currentColor;">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
          <input type="file" id="fileInput" accept="image/*" multiple aria-label="Upload image" style="display: none;" />
          <button type="button" class="file-upload-btn" id="fileUploadBtn" aria-label="Upload file or image" title="Upload file or image for analysis">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em; color: currentColor;">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
          <input type="text" placeholder="Ask about a story or topic…" aria-label="Your question" id="chatInput" />
          <button type="button" id="sendButton">Send</button>
        </div>
        
        <div class="voice-selector" id="voiceSelector">
          <label for="voiceSelect">Choose Voice:</label>
          <select id="voiceSelect">
            <option value="alloy">Alloy - Balanced and versatile</option>
            <option value="ash">Ash - Calm and composed</option>
            <option value="ballad">Ballad - Warm and expressive</option>
            <option value="coral">Coral - Bright and energetic</option>
            <option value="echo">Echo - Clear and direct</option>
            <option value="sage">Sage - Wise and thoughtful</option>
            <option value="shimmer">Shimmer - Smooth and polished</option>
            <option value="verse">Verse - Poetic and melodic</option>
            <option value="marin">Marin - Natural and expressive</option>
            <option value="cedar">Cedar - Natural and clear</option>
          </select>
          <div class="voice-status" id="voiceStatus" style="display: none;">
            <span class="status-dot"></span>
            <span id="voiceStatusText">Connecting...</span>
          </div>
        </div>
        
        <div class="resize-handle" aria-label="Resize chat" title="Drag to resize"></div>
      </div>
      
      <!-- Tutorial Card -->
      <div class="tutorial-overlay" id="tutorialOverlay" role="dialog" aria-label="Tutorial" aria-modal="true">
        <div class="tutorial-modal">
          <div class="tutorial-header">
            <div class="tutorial-header-left">
              <h2>Noteworthy AI</h2>
              <span class="tutorial-header-badge">GPT-4o</span>
            </div>
            <button class="tutorial-skip" id="tutorialSkip">Skip</button>
            <button class="tutorial-close" aria-label="Close tutorial">×</button>
          </div>
          <div class="tutorial-content">
            <div class="tutorial-intro">
              <p>AI assistant for fact-checking and media literacy. Real-time voice conversations, DALL-E image generation, file analysis, and live web search.</p>
            </div>
            
            <div class="tutorial-specs">
              <div class="tutorial-spec">
                <div class="tutorial-spec-label">Model</div>
                <div class="tutorial-spec-value">GPT-4o</div>
              </div>
              <div class="tutorial-spec">
                <div class="tutorial-spec-label">Voice Latency</div>
                <div class="tutorial-spec-value">~232ms</div>
              </div>
              <div class="tutorial-spec">
                <div class="tutorial-spec-label">Voices</div>
                <div class="tutorial-spec-value">11 Options</div>
              </div>
              <div class="tutorial-spec">
                <div class="tutorial-spec-label">Image API</div>
                <div class="tutorial-spec-value">DALL-E</div>
              </div>
            </div>
            
            <div class="tutorial-steps">
              <div class="tutorial-step" data-step="chat">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon">💬</div>
                  <h3>Chat & Fact-Check</h3>
                  <button class="tutorial-step-toggle">▼</button>
                </div>
                <div class="tutorial-step-content">
                  <p>Ask about breaking news, request fact-checks, or get context on stories. The AI maintains conversation context for follow-up questions.</p>
                  <div class="tutorial-example">
                    <strong>Try:</strong>
                    <code>"Fact-check this headline: [headline]"</code>
                    <code>"Explain the context behind [news story]"</code>
                    <code>"What are the key facts about [topic]?"</code>
                  </div>
                </div>
              </div>
              
              <div class="tutorial-step" data-step="voice">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon">🎤</div>
                  <h3>Real-Time Voice</h3>
                  <button class="tutorial-step-toggle">▼</button>
                </div>
                <div class="tutorial-step-content">
                  <p>Click the microphone button (🎤) to start real-time voice conversations. Choose from 11 natural voices. Works in both chat and image modes - you can generate images or search the web while speaking!</p>
                  <div class="tutorial-example">
                    <strong>Technical:</strong>
                    <code>OpenAI Realtime API → WebSocket → Audio Worklet</code>
                    <code>Streaming audio with ~232ms latency</code>
                    <code>11 voices: Alloy, Ash, Ballad, Coral, Echo, Sage, Shimmer, Verse, Marin, Cedar</code>
                  </div>
                </div>
              </div>
              
              <div class="tutorial-step" data-step="image">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon">🎨</div>
                  <h3>Image Generation</h3>
                  <button class="tutorial-step-toggle">▼</button>
                </div>
                <div class="tutorial-step-content">
                  <p>Click the mode toggle (💬→🎨) to switch to image generation mode. Generate images with DALL-E or edit existing images. Works in both text and voice modes.</p>
                  <div class="tutorial-example">
                    <strong>Try:</strong>
                    <code>"Generate a news anchor in a modern studio"</code>
                    <code>Upload image + "Make this blue" or "Change the color"</code>
                    <code>In voice: "Generate a picture of [description]"</code>
                  </div>
                </div>
              </div>
              
              <div class="tutorial-step" data-step="upload">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon">📎</div>
                  <h3>File Analysis</h3>
                  <button class="tutorial-step-toggle">▼</button>
                </div>
                <div class="tutorial-step-content">
                  <p>Upload images, PDFs, or documents for AI analysis. Click the paperclip button or drag & drop files. Perfect for verifying screenshots, analyzing documents, or fact-checking visual content.</p>
                  <div class="tutorial-example">
                    <strong>Supported formats:</strong>
                    <code>PNG, JPEG, WEBP, GIF, PDF, HEIC, TIFF, BMP, SVG</code>
                    <code>Auto-converts unsupported formats to PNG/JPEG</code>
                    <code>Multiple files supported - upload several at once</code>
                  </div>
                </div>
              </div>
              
              <div class="tutorial-step" data-step="search">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon">🔍</div>
                  <h3>Live Web Search</h3>
                  <button class="tutorial-step-toggle">▼</button>
                </div>
                <div class="tutorial-step-content">
                  <p>Real-time web search during any conversation (text or voice). Uses OpenAI's native web_search tool to find current, verified information from multiple sources. Perfect for breaking news and fact-checking.</p>
                  <div class="tutorial-example">
                    <strong>Try:</strong>
                    <code>"Research breaking news on [topic]"</code>
                    <code>"Verify if [claim] is true"</code>
                    <code>"Find the latest information on [subject]"</code>
                    <code>In voice: "Search for [query]"</code>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="tutorial-shortcuts">
              <h4>⚡ Quick Tips</h4>
              <div class="tutorial-shortcuts-grid">
                <div class="tutorial-shortcut">
                  <span>Close Chat</span>
                  <span class="tutorial-shortcut-key">Esc</span>
                </div>
                <div class="tutorial-shortcut">
                  <span>Send Message</span>
                  <span class="tutorial-shortcut-key">Enter</span>
                </div>
                <div class="tutorial-shortcut">
                  <span>Move Window</span>
                  <span class="tutorial-shortcut-key">Drag Header</span>
                </div>
                <div class="tutorial-shortcut">
                  <span>Resize</span>
                  <span class="tutorial-shortcut-key">Drag Corner</span>
                </div>
              </div>
            </div>
          </div>
          <div class="tutorial-footer">
            <label class="tutorial-checkbox">
              <input type="checkbox" id="dontShowAgain" />
              <span>Don't show again</span>
            </label>
            <button class="tutorial-btn-primary" id="tutorialGotIt">Got it</button>
          </div>
        </div>
      </div>
    `;

    const root = this.root;
    const wrap = root.querySelector('.wrap') as HTMLElement;
    const launcher = root.querySelector('.launcher') as HTMLButtonElement;
    const closeBtn = root.querySelector('.close') as HTMLButtonElement;
    const input = root.querySelector('#chatInput') as HTMLInputElement;
    const send = root.querySelector('#sendButton') as HTMLButtonElement;
    const body = root.querySelector('.body') as HTMLElement;
    const head = root.querySelector('.head') as HTMLElement;
    const resizeHandle = root.querySelector('.resize-handle') as HTMLElement;
    const tip = root.querySelector('.tip') as HTMLElement;
    const modeToggle = root.querySelector('#modeToggle') as HTMLButtonElement;
    const modeIcon = root.querySelector('#modeIcon') as HTMLElement;
    const fileInput = root.querySelector('#fileInput') as HTMLInputElement;
    const fileUploadBtn = root.querySelector('#fileUploadBtn') as HTMLButtonElement;
    const voiceModeToggle = root.querySelector('#voiceModeToggle') as HTMLButtonElement;
    const voiceSelector = root.querySelector('#voiceSelector') as HTMLElement;
    const voiceSelect = root.querySelector('#voiceSelect') as HTMLSelectElement;
    const voiceStatus = root.querySelector('#voiceStatus') as HTMLElement;
    const voiceStatusText = root.querySelector('#voiceStatusText') as HTMLElement;
    
    // Track current mode: 'chat' or 'image'
    let currentMode: 'chat' | 'image' = 'chat';
    let uploadedFiles: File[] = [];
    
    // Track chat history for context
    let chatHistory: Array<{role: string, content: any}> = [];
    
    // Voice conversation state
    let voiceModeActive = false;
    let websocket: WebSocket | null = null;
    let audioContext: AudioContext | null = null;
    let mediaStream: MediaStream | null = null;
    let audioWorkletNode: AudioWorkletNode | null = null;
    let isRecording = false;
    let currentVoice = 'alloy';
    let audioQueue: Float32Array[] = [];
    let isPlayingAudio = false;
    let audioChunkQueue: string[] = []; // Queue for audio chunks (base64 strings)
    
    // Toggle between chat and image generation modes
    if (modeToggle && modeIcon) {
      modeToggle.addEventListener('click', () => {
        currentMode = currentMode === 'chat' ? 'image' : 'chat';
        
        if (currentMode === 'image') {
          modeIcon.textContent = '🎨';
          modeToggle.classList.add('active');
          input.placeholder = 'Describe the image you want to generate (or upload an image to generate based on it)…';
          modeToggle.setAttribute('title', 'Click to switch to chat mode');
        } else {
          modeIcon.textContent = '💬';
          modeToggle.classList.remove('active');
          input.placeholder = 'Ask about a story or topic…';
          modeToggle.setAttribute('title', 'Click to switch to image generation mode');
          // Clear uploaded files when switching to chat mode
          uploadedFiles = [];
          updateFilePreview();
          // Stop voice mode when switching modes
          if (voiceModeActive) {
            stopVoiceMode();
          }
        }
        
        input.focus();
      });
    }
    
    // File upload handling
    if (fileUploadBtn && fileInput) {
      fileUploadBtn.addEventListener('click', () => {
        fileInput.click();
      });
      
      fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          handleFiles(Array.from(target.files));
          target.value = '';
        }
      });
    }
    
    // Handle paste events for images - works on input and entire chat container
    // Use a flag to prevent duplicate processing when event bubbles
    let isProcessingPaste = false;
    
    const handlePaste = async (e: ClipboardEvent) => {
      // Prevent duplicate processing if event bubbles from input to wrap
      if (isProcessingPaste) {
        return;
      }
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      const imageFiles: File[] = [];
      
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
        
        // Process the pasted images
        handleFiles(imageFiles);
        
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
    
    function handleFiles(files: File[]) {
      // Files that will be automatically converted on the backend
      // (PDFs, HEIC, TIFF, BMP, SVG, etc. will be converted automatically)
      const CONVERTIBLE_FORMATS = ['application/pdf', 'image/heic', 'image/heif', 'image/tiff', 'image/tif', 'image/bmp', 'image/svg+xml', 'image/x-icon'];
      
      files.forEach(file => {
        // Check file size (max 20MB)
        if (file.size > 20 * 1024 * 1024) {
          alert(`File "${file.name}" is too large. Maximum size is 20MB.`);
          return;
        }
        
        // Allow images (will be converted if needed)
        if (file.type.startsWith('image/')) {
          uploadedFiles.push(file);
          
          // Show info message for files that will be converted
          if (CONVERTIBLE_FORMATS.includes(file.type.toLowerCase())) {
            const formatName = file.type.split('/')[1] || 'unknown';
            console.log(`[File Upload] File "${file.name}" (${formatName}) will be automatically converted to a supported format`);
          }
        } else {
          // Not an image
          alert(
            `File "${file.name}" is not a supported file type.\n\n` +
            `Supported: Images (PNG, JPEG, WEBP, GIF, HEIC, TIFF, BMP, SVG)\n\n` +
            `Note: Unsupported image formats (HEIC, TIFF, BMP, SVG) will be automatically converted.\n` +
            `PDF conversion is not yet available - please convert PDFs to images first.`
          );
        }
      });
      updateFilePreview();
    }
    
    const updateFilePreview = () => {
      let previewContainer = root.querySelector('.file-preview-container') as HTMLElement;
      
      if (uploadedFiles.length === 0) {
        if (previewContainer) previewContainer.remove();
        return;
      }
      
      if (!previewContainer) {
        previewContainer = document.createElement('div');
        previewContainer.className = 'file-preview-container';
        const inputContainer = root.querySelector('.input');
        if (inputContainer && inputContainer.parentNode) {
          inputContainer.parentNode.insertBefore(previewContainer, inputContainer);
        }
      }
      
      previewContainer.innerHTML = '';
      
      uploadedFiles.forEach((file, index) => {
        const preview = document.createElement('div');
        preview.className = 'file-preview';
        
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = document.createElement('img');
          img.src = e.target?.result as string;
          preview.appendChild(img);
        };
        reader.readAsDataURL(file);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file';
        removeBtn.textContent = '×';
        removeBtn.setAttribute('aria-label', 'Remove file');
        removeBtn.onclick = () => {
          uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
          updateFilePreview();
        };
        preview.appendChild(removeBtn);
        
        previewContainer.appendChild(preview);
      });
    };
    
    // Voice mode functionality
    async function startVoiceMode() {
      if (voiceModeActive) {
        // Stop voice mode
        stopVoiceMode();
        return;
      }
      
      try {
        voiceModeActive = true;
        voiceModeToggle.classList.add('active');
        voiceSelector.classList.add('show');
        voiceStatus.style.display = 'flex';
        voiceStatusText.textContent = 'Connecting...';
        
        // Get selected voice
        currentVoice = voiceSelect.value;
        
        // Request microphone permission
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Create audio context
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000, // OpenAI Realtime API uses 24kHz
        });
        
        // Create session with backend
        const realtimeEndpoint = endpoint.replace('/noteworthy-chat', '/realtime-voice');
        
        // Retry logic for fetching ephemeral token (handles intermittent failures)
        const MAX_RETRIES = 3;
        const RETRY_DELAYS = [500, 1000, 2000]; // Exponential backoff: 500ms, 1s, 2s
        let sessionData: any;
        let lastError: Error | null = null;
        
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            if (attempt > 0) {
              const delay = RETRY_DELAYS[attempt - 1];
              console.log(`[Voice Mode] Retrying token fetch (attempt ${attempt + 1}/${MAX_RETRIES}) after ${delay}ms...`);
              if (voiceStatusText) {
                voiceStatusText.textContent = `Retrying connection (${attempt + 1}/${MAX_RETRIES})...`;
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
              // Try to get error details from response
              let errorMessage = 'Failed to create voice session';
              try {
                const errorData = await sessionRes.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
                if (errorData.details) {
                  console.error('[Voice Mode] Error details:', errorData.details);
                }
              } catch (e) {
                // If response isn't JSON, use status text
                errorMessage = `${errorMessage}: ${sessionRes.status} ${sessionRes.statusText}`;
              }
              
              // Don't retry on 4xx errors (client errors)
              if (sessionRes.status >= 400 && sessionRes.status < 500) {
                throw new Error(errorMessage);
              }
              
              // Retry on 5xx errors (server errors)
              lastError = new Error(errorMessage);
              console.warn(`[Voice Mode] Server error (will retry):`, {
                attempt: attempt + 1,
                status: sessionRes.status,
                error: errorMessage
              });
              continue; // Retry
            }
            
            sessionData = await sessionRes.json();
            
            // CRITICAL FIX: OpenAI Realtime API authenticates via WebSocket SUBPROTOCOLS, not URL parameters
            // Browser WebSockets cannot send headers, so we use subprotocols array
            // Format: ["realtime", "openai-insecure-api-key.{ephemeralToken}"]
            
            // Get token (support both ephemeralToken and ephemeral_token for compatibility)
            const ephemeralToken = (sessionData as any).ephemeralToken || (sessionData as any).ephemeral_token;
            
            if (!ephemeralToken) {
              console.error(`[Voice Mode] ❌ No ephemeral token in response (attempt ${attempt + 1}/${MAX_RETRIES})`);
              lastError = new Error('No ephemeral token received from server');
              continue; // Retry
            }
            
            // Validate token format
            if (!ephemeralToken.startsWith('ek_')) {
              console.error('[Voice Mode] ❌ CRITICAL: Received token does not start with "ek_"!');
              lastError = new Error('Invalid token format - token must start with "ek_"');
              continue; // Retry
            }
            
            // Success! Token received and validated
            console.log(`[Voice Mode] ✅ Token received successfully on attempt ${attempt + 1}`);
            break; // Exit retry loop
            
          } catch (error: any) {
            // Handle abort (timeout)
            if (error.name === 'AbortError') {
              lastError = new Error('Request timeout - server took too long to respond');
              console.warn(`[Voice Mode] Request timeout (attempt ${attempt + 1}/${MAX_RETRIES})`);
              if (attempt < MAX_RETRIES - 1) {
                continue; // Retry
              }
            } else if (error.message?.includes('Invalid token format') || error.message?.includes('No ephemeral token')) {
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
        const ephemeralToken = sessionData ? ((sessionData as any).ephemeralToken || (sessionData as any).ephemeral_token) : null;
        if (!ephemeralToken) {
          console.error('[Voice Mode] ❌ CRITICAL: No ephemeral token received after all retries!');
          console.error('[Voice Mode] Last error:', lastError);
          console.error('[Voice Mode] Final session data:', sessionData);
          
          if (voiceStatusText) {
            voiceStatusText.textContent = 'Connection failed - please try again';
          }
          
          throw new Error(lastError?.message || 'No ephemeral token received from server after multiple attempts');
        }
        
        // Redact token in logs (show only first 8 chars)
        const tokenPreview = ephemeralToken.substring(0, 8) + '...';
        console.log('[Voice Mode] ✅ Ephemeral token received (redacted):', tokenPreview);
        
        // Construct WebSocket URL - ONLY model parameter, NO token or session_id in URL
        // CRITICAL: Use 'gpt-realtime' for GA API (backend returns this, but fallback must match)
        const model = (sessionData as any).model || 'gpt-realtime';
        const wsUrl = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
        
        // CRITICAL: Use WebSocket subprotocols for authentication
        // Format: ["realtime", "openai-insecure-api-key.{ephemeralToken}"]
        const protocols = [
          "realtime",
          `openai-insecure-api-key.${ephemeralToken}`
        ];
        
        console.log('[Voice Mode] 🔌 Creating WebSocket with subprotocol authentication...');
        console.log('[Voice Mode] URL:', wsUrl);
        console.log('[Voice Mode] Protocols:', ['realtime', `openai-insecure-api-key.${tokenPreview}`]);
        
        websocket = new WebSocket(wsUrl, protocols);
        
        // Store token on websocket for error handlers
        (websocket as any)._ephemeralToken = ephemeralToken;
        // Initialize speaking state flag
        (websocket as any)._isSpeaking = false;
        
        websocket.onopen = () => {
          console.log('[Voice Mode] ✅ WebSocket opened - subprotocol authentication successful!');
          
          // Authentication happens via subprotocols during WebSocket handshake
          // No auth message needed - connection is already authenticated when onopen fires
          voiceStatusText.textContent = 'Connected - Speak now!';
          voiceStatus.classList.remove('recording');
          isRecording = true;
          startAudioCapture();
          
          // Trigger AI to speak first with greeting
          setTimeout(() => {
            if (websocket && websocket.readyState === WebSocket.OPEN) {
              console.log('[Voice Mode] 👋 Triggering AI to speak first...');
              try {
                // Send response.create to trigger AI to generate and speak the greeting
                // The instructions in the session already tell it to greet with "Hey, It's Noteworthy AI"
                websocket.send(JSON.stringify({
                  type: 'response.create'
                }));
                console.log('[Voice Mode] ✅ Sent response.create to trigger initial greeting');
              } catch (error) {
                console.error('[Voice Mode] ❌ Error sending initial greeting:', error);
              }
            }
          }, 500);
        };
        
        websocket.onmessage = (event) => {
          handleWebSocketMessage(event);
        };
        
        websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          console.error('WebSocket URL:', wsUrl.substring(0, 100) + '...');
          console.error('WebSocket readyState:', websocket?.readyState);
          console.error('Error event details:', {
            type: error.type,
            target: error.target,
            timeStamp: error.timeStamp
          });
          voiceStatusText.textContent = 'Connection error - Check console for details';
          voiceStatus.classList.add('recording');
        };
        
        websocket.onclose = (event) => {
          const closeCode = event.code || 'unknown';
          const wasClean = event.wasClean !== undefined ? event.wasClean : false;
          
          console.log('[Voice Mode] 🔌 WebSocket closed');
          console.log('[Voice Mode] Close code:', closeCode, wasClean ? '(clean)' : '(unclean)');
          
          voiceStatusText.textContent = wasClean ? 'Disconnected' : `Disconnected (code ${closeCode})`;
          voiceStatus.classList.add('recording');
          
          // Only reconnect if it was a clean close and voice mode is still active
          // Don't reconnect on auth errors (they're handled in error handler)
          if (voiceModeActive && wasClean && closeCode === 1000) {
            console.log('[Voice Mode] Clean close - attempting reconnection...');
            setTimeout(() => {
              if (voiceModeActive) {
                startVoiceMode();
              }
            }, 2000);
          } else {
            console.log('[Voice Mode] Not reconnecting - unclean close or auth error');
          }
        };
        
      } catch (error: any) {
        console.error('Error starting voice mode:', error);
        voiceStatusText.textContent = `Error: ${error.message}`;
        voiceStatus.classList.add('recording');
        voiceModeActive = false;
        voiceModeToggle.classList.remove('active');
        alert(`Failed to start voice mode: ${error.message}`);
      }
    }
    
    function stopVoiceMode() {
      voiceModeActive = false;
      voiceModeToggle.classList.remove('active');
      voiceSelector.classList.remove('show');
      voiceStatus.style.display = 'none';
      isRecording = false;
      
      // Clear audio queue to prevent leftover chunks from playing
      audioChunkQueue = [];
      isPlayingAudio = false;
      console.log('[Voice Mode] 🧹 Cleared audio queue on stop');
      
      if (websocket) {
        websocket.close();
        websocket = null;
      }
      
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
      }
      
      if (audioWorkletNode) {
        audioWorkletNode.disconnect();
        audioWorkletNode = null;
      }
      
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
        audioContext = null;
      }
    }
    
    async function startAudioCapture() {
      if (!audioContext || !mediaStream) return;
      
      try {
        const source = audioContext.createMediaStreamSource(mediaStream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (e) => {
          if (!isRecording || !websocket || websocket.readyState !== WebSocket.OPEN) return;
          
          const inputData = e.inputBuffer.getChannelData(0);
          // Convert Float32Array to Int16Array (PCM16)
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          // Convert to base64 for OpenAI Realtime API
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
          
          // Send audio to WebSocket in OpenAI's format
          websocket.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Audio,
          }));
        };
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        
      } catch (error) {
        console.error('Error starting audio capture:', error);
      }
    }
    
    function handleWebSocketMessage(event: MessageEvent) {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'auth.success':
            // Authentication successful (confirmation - auth already happened via subprotocols)
            console.log('[Voice Mode] ✅ Received auth.success confirmation');
            if (websocket) {
              console.log('[Voice Mode] Authentication confirmed: WebSocket subprotocol method works!');
              
              // Mark as authenticated (if not already)
              (websocket as any)._authenticated = true;
              
              // Clear any auth timeout if it exists
              if ((websocket as any)._authTimeout) {
                clearTimeout((websocket as any)._authTimeout);
                (websocket as any)._authTimeout = null;
              }
            } else {
              console.warn('[Voice Mode] ⚠️ auth.success received but websocket is null');
            }
            
            // If not already recording, start now
            if (!isRecording) {
            voiceStatusText.textContent = 'Connected - Speak now!';
            voiceStatus.classList.remove('recording');
            isRecording = true;
            startAudioCapture();
            } else {
              console.log('[Voice Mode] Already recording - auth.success is confirmation only');
            }
            break;
            
          case 'auth.error':
            // Authentication failed - DO NOT RETRY (client config issue)
            console.error('[Voice Mode] ❌ Authentication failed - CLIENT CONFIG ISSUE');
            console.error('[Voice Mode] DO NOT RETRY - This indicates a problem with subprotocol authentication');
            voiceStatusText.textContent = 'Auth failed (client config). Fix token transport.';
            voiceStatus.classList.add('recording');
            stopVoiceMode();
            break;
            
          case 'response.audio_transcript.delta':
            // Partial transcript (could show in real-time if desired)
            if ((message as any).delta) {
              // Update status or show in chat if needed
            }
            break;
            
          case 'response.audio_transcript.done':
            // Full transcript available
            if ((message as any).transcript) {
              const aiGroup = document.createElement('div');
              aiGroup.className = 'message-group ai-msg-group';
              aiGroup.innerHTML = `
                <div class="message-avatar">NW</div>
                <div class="message-content">
                  <div class="reply">🎤 ${(message as any).transcript}</div>
                </div>
              `;
              body.appendChild(aiGroup);
              body.scrollTop = body.scrollHeight;
            }
            break;
            
          case 'response.function_call_arguments.done':
            // Function is being called
            if (message.name === 'generate_image') {
              voiceStatusText.textContent = 'Generating image...';
            } else if (message.name === 'search_web') {
              voiceStatusText.textContent = 'Searching the web...';
            }
            break;
            
          case 'response.function_call_result.done':
            // Function result received
            if (message.result) {
              if (message.name === 'generate_image' && message.result.image_url) {
                // Show generated image in chat
                const aiGroup = document.createElement('div');
                aiGroup.className = 'message-group ai-msg-group';
                const replyContent = document.createElement('div');
                replyContent.className = 'reply';
                
                const imageEl = document.createElement('img');
                imageEl.src = message.result.image_url;
                imageEl.alt = message.result.revised_prompt || 'Generated image';
                imageEl.style.maxWidth = '100%';
                imageEl.style.borderRadius = '12px';
                imageEl.style.marginTop = '8px';
                
                replyContent.innerHTML = '<p>🎨 Generated image:</p>';
                replyContent.appendChild(imageEl);
                
                aiGroup.innerHTML = `
                  <div class="message-avatar">NW</div>
                  <div class="message-content"></div>
                `;
                (aiGroup.querySelector('.message-content') as HTMLElement).appendChild(replyContent);
                body.appendChild(aiGroup);
                body.scrollTop = body.scrollHeight;
              } else if (message.name === 'search_web' && message.result.results) {
                // Show search results
                const aiGroup = document.createElement('div');
                aiGroup.className = 'message-group ai-msg-group';
                const replyContent = document.createElement('div');
                replyContent.className = 'reply';
                
                let resultsHTML = '<p>🔍 Search results:</p><ul>';
                message.result.results.slice(0, 5).forEach((result: any) => {
                  resultsHTML += `<li><a href="${result.url}" target="_blank">${result.title}</a></li>`;
                });
                resultsHTML += '</ul>';
                
                replyContent.innerHTML = resultsHTML;
                
                aiGroup.innerHTML = `
                  <div class="message-avatar">NW</div>
                  <div class="message-content"></div>
                `;
                (aiGroup.querySelector('.message-content') as HTMLElement).appendChild(replyContent);
                body.appendChild(aiGroup);
                body.scrollTop = body.scrollHeight;
              }
            }
            voiceStatusText.textContent = 'Listening...';
            break;
            
          case 'response.output_audio.delta':
            // Queue audio chunks from OpenAI Realtime API to prevent overlap
            if (message.delta) {
              console.log('[Voice Mode] 🔊 Received audio delta, length:', message.delta?.length || 0);
              
              // Show "Speaking..." status on first audio chunk
              if (websocket && !(websocket as any)._isSpeaking) {
                (websocket as any)._isSpeaking = true;
                voiceStatusText.textContent = 'Speaking...';
                console.log('[Voice Mode] 🗣️ Status updated to: Speaking...');
              }
              
              // Queue the audio chunk instead of playing immediately
              audioChunkQueue.push(message.delta);
              console.log('[Voice Mode] 📦 Queued audio chunk, queue length:', audioChunkQueue.length);
              
              // Start playing if not already playing
              if (!isPlayingAudio) {
                processAudioQueue();
              }
            }
            break;
            
          case 'response.output_audio.done':
            // Audio output complete - wait for queue to finish
            console.log('[Voice Mode] ✅ Audio output complete, waiting for queue to finish...');
            // Don't reset speaking status yet - wait for queue to finish
            // The queue processing will continue until all chunks are played
            break;
            
          case 'response.done':
            // Response complete - wait for audio queue to finish, then update status
            console.log('[Voice Mode] ✅ Response done, waiting for audio queue to finish...');
            // Wait a bit for queue to process, then check if still playing
            setTimeout(() => {
              // Check if queue is empty and not playing
              if (audioChunkQueue.length === 0 && !isPlayingAudio) {
                if (websocket) (websocket as any)._isSpeaking = false;
                voiceStatusText.textContent = 'Listening...';
                voiceStatus.classList.remove('recording');
                console.log('[Voice Mode] ✅ Audio queue finished, status updated to Listening');
              } else {
                // Still playing, check again in a bit
                const checkInterval = setInterval(() => {
                  if (audioChunkQueue.length === 0 && !isPlayingAudio) {
                    clearInterval(checkInterval);
                    if (websocket) (websocket as any)._isSpeaking = false;
                    voiceStatusText.textContent = 'Listening...';
                    voiceStatus.classList.remove('recording');
                    console.log('[Voice Mode] ✅ Audio queue finished (delayed), status updated to Listening');
                  }
                }, 100);
                // Clear interval after 5 seconds max
                setTimeout(() => clearInterval(checkInterval), 5000);
              }
            }, 200);
            break;
            
          case 'conversation.item.input_audio_transcription.completed':
            // User's speech transcribed
            if (message.transcript) {
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
            }
            break;
            
          case 'error':
            // CRITICAL: If type === "error", stop retrying and show UI error
            const errorMsg = (message as any).error?.message || (message as any).error || (message as any).message || 'Unknown error';
            console.error('[Voice Mode] ❌ Error message received - stopping retries');
            console.error('[Voice Mode] Error:', errorMsg);
            
            // Check for authentication errors - DO NOT RETRY
            const isAuthError = errorMsg.toLowerCase().includes('authentication') || 
                                errorMsg.toLowerCase().includes('bearer') || 
                                errorMsg.toLowerCase().includes('missing bearer') ||
                                errorMsg.toLowerCase().includes('unauthorized') ||
                                errorMsg.toLowerCase().includes('forbidden');
            
            if (isAuthError) {
              console.error('[Voice Mode] 🔐 Authentication error detected - CLIENT CONFIG ISSUE');
              console.error('[Voice Mode] DO NOT RETRY - This is a configuration issue, not a transient error');
              voiceStatusText.textContent = 'Auth failed (client config). Fix token transport.';
            } else {
              voiceStatusText.textContent = `Error: ${errorMsg}`;
            }
            
            // Stop voice mode immediately - don't retry on errors
            stopVoiceMode();
            break;
            
          case 'session.updated':
            // Session updated
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
    
    // Process audio queue sequentially to prevent overlap
    async function processAudioQueue() {
      if (isPlayingAudio || audioChunkQueue.length === 0) {
        return;
      }
      
      isPlayingAudio = true;
      
      while (audioChunkQueue.length > 0) {
        const audioBase64 = audioChunkQueue.shift();
        if (!audioBase64) continue;
        
        await playAudioChunk(audioBase64);
      }
      
      isPlayingAudio = false;
      console.log('[Voice Mode] ✅ Audio queue processed, all chunks played');
    }
    
    async function playAudioChunk(audioBase64: string): Promise<void> {
      if (!audioContext) {
        console.warn('[Voice Mode] ⚠️ Cannot play audio: AudioContext not initialized');
        return;
      }
      
      return new Promise((resolve, reject) => {
        try {
          // CRITICAL: Resume AudioContext if suspended (browsers suspend until user interaction)
          if (audioContext!.state === 'suspended') {
            console.log('[Voice Mode] 🔊 Resuming suspended AudioContext...');
            audioContext!.resume().then(() => {
              console.log('[Voice Mode] ✅ AudioContext resumed, state:', audioContext!.state);
              continuePlayback();
            }).catch(reject);
            return;
          }
          
          continuePlayback();
          
          function continuePlayback() {
            // Check if audio is enabled (check audio toggle state)
            // The audio toggle uses 'active' class when enabled, and localStorage 'noteworthy-ai-audio'
            const audioToggle = root.querySelector('#audioToggle');
            const audioEnabled = localStorage.getItem('noteworthy-ai-audio') === 'true';
            if (audioToggle && !audioEnabled) {
              console.log('[Voice Mode] 🔇 Audio is disabled (toggle is off), skipping playback');
              resolve();
              return;
            }
            
            // Decode base64 to binary
            const binaryString = atob(audioBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Convert PCM16 bytes to Float32Array
            const pcm16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
              float32[i] = pcm16[i] / 32768.0;
            }
            
            // Create audio buffer and play
            const audioBuffer = audioContext!.createBuffer(1, float32.length, 24000);
            audioBuffer.copyToChannel(float32, 0);
            
            const source = audioContext!.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext!.destination);
            
            // Wait for audio to finish before resolving
            source.onended = () => {
              console.log('[Voice Mode] ✅ Audio chunk finished playing');
              resolve();
            };
            
            source.start();
            console.log('[Voice Mode] 🔊 Playing audio chunk, length:', float32.length, 'samples');
          }
          
        } catch (error) {
          console.error('[Voice Mode] ❌ Error playing audio chunk:', error);
          reject(error);
        }
      });
    }
    
    // Voice mode toggle
    if (voiceModeToggle) {
      voiceModeToggle.addEventListener('click', () => {
        startVoiceMode();
      });
    }
    
    // Voice selection change
    if (voiceSelect) {
      voiceSelect.addEventListener('change', () => {
        currentVoice = voiceSelect.value;
        if (voiceModeActive) {
          // Restart with new voice
          stopVoiceMode();
          setTimeout(() => startVoiceMode(), 500);
        }
      });
    }

    const setPos = (x: number, y: number) => {
      this.pos = { x, y };
      wrap.style.left = x + 'px';
      wrap.style.top = y + 'px';
    };

    const setSize = (w: number, h: number) => {
      this.size = { 
        w: Math.max(320, Math.min(w, window.innerWidth - 48)), 
        h: Math.max(400, Math.min(h, window.innerHeight - 48)) 
      };
      wrap.style.width = this.size.w + 'px';
      wrap.style.height = this.size.h + 'px';
    };

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    // Position dragging
    const startDrag = (clientX: number, clientY: number) => {
      this.dragging = true;
      this.start = { x: clientX, y: clientY };
      this.startPos = { ...this.pos };
      head.style.cursor = 'grabbing';
    };

    const onMove = (clientX: number, clientY: number) => {
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
    const startResize = (clientX: number, clientY: number) => {
      this.resizing = true;
      this.start = { x: clientX, y: clientY };
      this.startSize = { ...this.size };
      this.startPos = { ...this.pos };
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';
    };

    const onResize = (clientX: number, clientY: number) => {
      if (!this.resizing || !this.start || !this.startSize || !this.startPos) return;
      const deltaX = clientX - this.start.x;
      const deltaY = clientY - this.start.y;
      const newW = this.startSize.w + deltaX;
      const newH = this.startSize.h + deltaY;
      
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      const maxW = w - this.pos.x - 12;
      const maxH = h - this.pos.y - 12;
      
      setSize(
        Math.min(newW, maxW),
        Math.min(newH, maxH)
      );
      
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

    // Drag handlers
    head.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON' || this.resizing) return;
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
      if ((e.target as HTMLElement).tagName === 'BUTTON' || this.resizing) return;
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

    // Toggle open/close
    launcher.onclick = () => {
      wrap.classList.toggle('open');
      if (wrap.classList.contains('open')) {
        launcher.setAttribute('aria-expanded', 'true');
        input.focus();
      } else {
        launcher.setAttribute('aria-expanded', 'false');
      }
    };

    closeBtn.onclick = () => {
      wrap.classList.remove('open');
      launcher.setAttribute('aria-expanded', 'false');
      // Stop voice mode when closing
      if (voiceModeActive) {
        stopVoiceMode();
      }
    };

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && wrap.classList.contains('open')) {
        wrap.classList.remove('open');
        launcher.setAttribute('aria-expanded', 'false');
        // Stop voice mode when closing
        if (voiceModeActive) {
          stopVoiceMode();
        }
      }
    });

    // Generate image function
    async function generateImage(prompt: string, imageFiles?: File[]) {
      if (!prompt || !prompt.trim()) {
        if (!imageFiles || imageFiles.length === 0) {
          send.disabled = false;
          return;
        }
      }

      // Remove tip
      if (tip && tip.parentNode) {
        tip.style.display = 'none';
      }

      // Show user message with avatar
      const userGroup = document.createElement('div');
      userGroup.className = 'message-group user-msg-group';
      
      const userMsgContent = document.createElement('div');
      userMsgContent.className = 'user-msg';
      
      if (imageFiles && imageFiles.length > 0) {
        userMsgContent.innerHTML = '🎨 Generate image based on uploaded image';
        imageFiles.forEach(file => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target?.result as string;
            img.style.maxWidth = '200px';
            img.style.maxHeight = '200px';
            img.style.marginTop = '8px';
            img.style.borderRadius = '8px';
            userMsgContent.appendChild(img);
          };
          reader.readAsDataURL(file);
        });
        if (prompt && prompt.trim()) {
          const textNode = document.createElement('div');
          textNode.textContent = `Prompt: ${prompt}`;
          textNode.style.marginTop = '8px';
          userMsgContent.appendChild(textNode);
        }
      } else {
        userMsgContent.textContent = `🎨 Generate image: ${prompt}`;
      }
      
      userGroup.innerHTML = `
        <div class="message-avatar">You</div>
        <div class="message-content"></div>
      `;
      (userGroup.querySelector('.message-content') as HTMLElement).appendChild(userMsgContent);
      body.appendChild(userGroup);
      body.scrollTop = body.scrollHeight;

      // Show thinking indicator
      const thinking = document.createElement('div');
      thinking.className = 'message-group ai-msg-group';
      thinking.innerHTML = `
        <div class="message-avatar">NW</div>
        <div class="message-content">
          <div class="thinking">
            <span class="spinner"></span>${imageFiles && imageFiles.length > 0 ? 'Analyzing image and generating…' : 'Generating image…'}
          </div>
        </div>
      `;
      body.appendChild(thinking);
      body.scrollTop = body.scrollHeight;

      try {
        // Convert image files to base64
        const imageData: string[] = [];
        if (imageFiles && imageFiles.length > 0) {
          for (const file of imageFiles) {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                // Remove data:image/...;base64, prefix
                const base64Data = result.split(',')[1];
                resolve(base64Data);
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            imageData.push(base64);
          }
        }
        
        // Generate image using DALL-E
        let imageEndpoint = '/.netlify/functions/generate-image';
        // Handle local development
        if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
          imageEndpoint = endpoint.replace('/.netlify/functions/noteworthy-chat', '/.netlify/functions/generate-image')
            .replace('/api/noteworthy', '/.netlify/functions/generate-image');
        }
        const imageRes = await fetch(imageEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: prompt || undefined,
            image: imageData.length > 0 ? imageData[0] : undefined,
            imageType: imageFiles && imageFiles.length > 0 ? imageFiles[0].type : undefined,
            size: "1024x1024",
            quality: "standard",
            style: "vivid"
          }),
        });

        if (!imageRes.ok) {
          const errorData = await imageRes.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `Server error (${imageRes.status})`);
        }

        const data = await imageRes.json();
        thinking.remove();

        // Show image with NW logo
        const aiGroup = document.createElement('div');
        aiGroup.className = 'message-group ai-msg-group';
        const replyContent = document.createElement('div');
        replyContent.className = 'reply';
        
        const imageEl = document.createElement('img');
        imageEl.src = data.imageUrl;
        imageEl.alt = data.revisedPrompt || prompt;
        imageEl.loading = 'lazy';
        imageEl.onerror = function() {
          this.style.display = 'none';
          const errorMsg = document.createElement('p');
          errorMsg.textContent = 'Failed to load image. Please try again.';
          replyContent.appendChild(errorMsg);
        };
        
        const promptText = document.createElement('p');
        promptText.innerHTML = `<strong>Prompt:</strong> ${(data.revisedPrompt || data.prompt || prompt).replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
        
        replyContent.appendChild(imageEl);
        replyContent.appendChild(promptText);

        aiGroup.innerHTML = `
          <div class="message-avatar">NW</div>
          <div class="message-content"></div>
        `;
        (aiGroup.querySelector('.message-content') as HTMLElement).appendChild(replyContent);
        body.appendChild(aiGroup);

        body.scrollTop = body.scrollHeight;
      } catch (e: any) {
        thinking.remove();
        const aiGroup = document.createElement('div');
        aiGroup.className = 'message-group ai-msg-group';
        const err = document.createElement('div');
        err.className = 'error';
        
        // Check if this is a file processing error
        const errorMessage = e?.message || 'Network error. Please try again.';
        if (errorMessage.includes('unsupported') || errorMessage.includes('Unable to process')) {
          err.innerHTML = `
            <strong>File Processing Error</strong>
            <p>${errorMessage}</p>
            <p style="font-size: 12px; opacity: 0.8; margin-top: 8px;">
              <strong>Supported formats:</strong> PNG, JPEG, WEBP, GIF, HEIC, TIFF, BMP, SVG<br>
              <strong>Note:</strong> Unsupported image formats (HEIC, TIFF, BMP, SVG) are automatically converted. PDF conversion is not yet available - please convert PDFs to images first.
            </p>
          `;
        } else {
          err.textContent = errorMessage;
        }
        
        aiGroup.innerHTML = `
          <div class="message-avatar">NW</div>
          <div class="message-content"></div>
        `;
        (aiGroup.querySelector('.message-content') as HTMLElement).appendChild(err);
        body.appendChild(aiGroup);
        body.scrollTop = body.scrollHeight;
      } finally {
        send.disabled = false;
      }
    }

    async function ask() {
      const message = input.value.trim();
      const hasFiles = uploadedFiles.length > 0;
      
      // Allow sending if there's a message OR files
      if (!message && !hasFiles) return;
      
      input.value = '';
      send.disabled = true;

      // Remove tip
      if (tip && tip.parentNode) {
        tip.style.display = 'none';
      }

      // Check if we're in image generation mode
      if (currentMode === 'image') {
        const filesToSend = [...uploadedFiles];
        uploadedFiles = [];
        updateFilePreview();
        await generateImage(message, filesToSend.length > 0 ? filesToSend : undefined);
        return;
      }

      // Store files for sending (before clearing uploadedFiles)
      const filesToSend = [...uploadedFiles];

      // Show user message with avatar
      const userGroup = document.createElement('div');
      userGroup.className = 'message-group user-msg-group';
      
      const userMsgContent = document.createElement('div');
      userMsgContent.className = 'user-msg';
      
      // Add uploaded images/files to message
      if (filesToSend.length > 0) {
        filesToSend.forEach(file => {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const img = document.createElement('img');
              img.src = e.target?.result as string;
              img.style.maxWidth = '200px';
              img.style.maxHeight = '200px';
              img.style.marginTop = '8px';
              img.style.borderRadius = '8px';
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
        if (filesToSend.length > 0) {
          textNode.style.marginTop = '8px';
        }
        userMsgContent.appendChild(textNode);
      }
      
      userGroup.innerHTML = `
        <div class="message-avatar">You</div>
        <div class="message-content"></div>
      `;
      (userGroup.querySelector('.message-content') as HTMLElement).appendChild(userMsgContent);
      body.appendChild(userGroup);
      body.scrollTop = body.scrollHeight;

      // Show thinking indicator with NW logo
      const thinking = document.createElement('div');
      thinking.className = 'message-group ai-msg-group';
      thinking.innerHTML = `
        <div class="message-avatar">NW</div>
        <div class="message-content">
          <div class="thinking">
            <span class="spinner"></span>Thinking…
          </div>
        </div>
      `;
      body.appendChild(thinking);
      body.scrollTop = body.scrollHeight;

      try {
        // Prepare request body with chat history
        let requestBody: string;
        let fileData: Array<{name: string, type: string, size: number, data: string}> | null = null;
        
        if (filesToSend.length > 0) {
          // Convert files to base64 for JSON
          const filePromises = filesToSend.map(file => {
            return new Promise<{name: string, type: string, size: number, data: string}>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                const result = e.target?.result as string;
                const base64 = result.split(',')[1];
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
          
          // Clear uploaded files after sending
          uploadedFiles = [];
          updateFilePreview();
        } else {
          // Regular JSON request with chat history
          requestBody = JSON.stringify({ 
            message: message,
            chatHistory: chatHistory
          });
        }
        
        // Regular chat response
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `Server error (${res.status})`);
        }

        const data = await res.json();
        thinking.remove();

        // Show reply with NW logo
        const aiGroup = document.createElement('div');
        aiGroup.className = 'message-group ai-msg-group';
        const text = data.reply || 'No response.';
        const replyContent = document.createElement('div');
        replyContent.className = 'reply';
        replyContent.innerHTML = text.split('\n').filter((l: string) => l.trim()).map((l: string) => `<p>${l}</p>`).join('');
        

        aiGroup.innerHTML = `
          <div class="message-avatar">NW</div>
          <div class="message-content"></div>
        `;
        (aiGroup.querySelector('.message-content') as HTMLElement).appendChild(replyContent);
        body.appendChild(aiGroup);

        body.scrollTop = body.scrollHeight;
        
        // Update chat history with user message and AI response (only on success)
        // Store images in OpenAI format so they can be remembered and edited later
        if (fileData && fileData.length > 0) {
          // Build content array with text and images (matching OpenAI format)
          const userContent: Array<{type: string, text?: string, image_url?: {url: string}}> = [];
          
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
      } catch (e: any) {
        thinking.remove();
        const aiGroup = document.createElement('div');
        aiGroup.className = 'message-group ai-msg-group';
        const err = document.createElement('div');
        err.className = 'error';
        
        // Check if this is an unsupported image format error
        const errorMessage = e?.message || 'Network error. Please try again.';
        if (errorMessage.includes('unsupported image') || errorMessage.includes('unsupported') || errorMessage.includes('Unable to process')) {
          err.innerHTML = `
            <strong>File Processing Error</strong>
            <p>${errorMessage}</p>
            <p style="font-size: 12px; opacity: 0.8; margin-top: 8px;">
              <strong>Supported formats:</strong> PNG, JPEG, WEBP, GIF, PDF, HEIC, TIFF, BMP, SVG<br>
              <strong>Note:</strong> PDFs and unsupported image formats are automatically converted to PNG/JPEG. If conversion fails, please try a different file.
            </p>
          `;
        } else {
          err.textContent = errorMessage;
        }
        
        aiGroup.innerHTML = `
          <div class="message-avatar">NW</div>
          <div class="message-content"></div>
        `;
        (aiGroup.querySelector('.message-content') as HTMLElement).appendChild(err);
        body.appendChild(aiGroup);
        body.scrollTop = body.scrollHeight;
      } finally {
        send.disabled = false;
      }
    }

    send.onclick = ask;
    input.addEventListener('keydown', (e) => {
      // Stop propagation for 'k' key to prevent keyboard shortcuts from intercepting it
      if (e.key === 'k' || e.key === 'K') {
        e.stopPropagation();
      }
      if (e.key === 'Enter' && !send.disabled) {
        ask();
      }
    });

    // Initial position and size
    setPos(this.pos.x, this.pos.y);
    setSize(this.size.w, this.size.h);
    
    // Tutorial functionality
    const helpBtn = root.querySelector('#helpBtn') as HTMLButtonElement;
    const tutorialOverlay = root.querySelector('#tutorialOverlay') as HTMLElement;
    const tutorialModal = tutorialOverlay?.querySelector('.tutorial-modal') as HTMLElement;
    const tutorialClose = root.querySelector('.tutorial-close') as HTMLButtonElement;
    const tutorialSkip = root.querySelector('#tutorialSkip') as HTMLButtonElement;
    const tutorialGotIt = root.querySelector('#tutorialGotIt') as HTMLButtonElement;
    const dontShowAgain = root.querySelector('#dontShowAgain') as HTMLInputElement;
    const tutorialSteps = root.querySelectorAll('.tutorial-step') as NodeListOf<HTMLElement>;
    
    // Check if tutorial should be shown
    const shouldShowTutorial = () => {
      const dontShow = localStorage.getItem('noteworthy-ai-tutorial-dismissed') === 'true';
      return !dontShow;
    };
    
    // Show tutorial with smooth animation
    const showTutorial = () => {
      if (tutorialOverlay) {
        // Prevent body scroll but allow overlay interaction
        document.body.style.overflow = 'hidden';
        tutorialOverlay.classList.add('show');
        
        // Auto-expand first step
        if (tutorialSteps.length > 0) {
          tutorialSteps[0].classList.add('expanded');
        }
      }
    };
    
    // Hide tutorial with smooth animation
    const hideTutorial = (savePreference = false) => {
      if (tutorialOverlay) {
        tutorialOverlay.classList.remove('show');
        document.body.style.overflow = '';
        
        if (savePreference && dontShowAgain && dontShowAgain.checked) {
          localStorage.setItem('noteworthy-ai-tutorial-dismissed', 'true');
        }
        
        // Collapse all steps
        tutorialSteps.forEach(step => step.classList.remove('expanded'));
      }
    };
    
    // Toggle step expansion
    tutorialSteps.forEach(step => {
      const toggle = step.querySelector('.tutorial-step-toggle') as HTMLButtonElement;
      if (toggle) {
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          step.classList.toggle('expanded');
        });
      }
      
      // Also toggle on step click (but not on toggle button)
      step.addEventListener('click', (e) => {
        if (e.target !== step.querySelector('.tutorial-step-toggle')) {
          step.classList.toggle('expanded');
        }
      });
    });
    
    // Help button click
    if (helpBtn) {
      helpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showTutorial();
      });
    }
    
    // Tutorial close handlers
    if (tutorialClose) {
      tutorialClose.addEventListener('click', (e) => {
        e.stopPropagation();
        hideTutorial(false);
      });
    }
    
    if (tutorialSkip) {
      tutorialSkip.addEventListener('click', (e) => {
        e.stopPropagation();
        hideTutorial(false);
      });
    }
    
    if (tutorialGotIt) {
      tutorialGotIt.addEventListener('click', (e) => {
        e.stopPropagation();
        hideTutorial(true);
      });
    }
    
    // Close tutorial on overlay click (but not on modal click)
    if (tutorialOverlay && tutorialModal) {
      tutorialOverlay.addEventListener('click', (e) => {
        if (e.target === tutorialOverlay) {
          hideTutorial(false);
        }
      });
      
      // Prevent modal clicks from closing
      tutorialModal.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
    
    // Close tutorial on Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && tutorialOverlay && tutorialOverlay.classList.contains('show')) {
        hideTutorial(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Show tutorial on first open if not dismissed (with delay for smooth UX)
    let tutorialShown = false;
    launcher.addEventListener('click', () => {
      if (wrap.classList.contains('open') && shouldShowTutorial() && !tutorialShown) {
        setTimeout(() => {
          if (shouldShowTutorial() && !tutorialShown) {
            tutorialShown = true;
            showTutorial();
          }
        }, 500); // Slight delay so chat opens first
      }
    });
  }

  disconnectedCallback() {
    // Cleanup if needed
  }
}

customElements.define('noteworthy-chat-widget', NoteworthyChat);
