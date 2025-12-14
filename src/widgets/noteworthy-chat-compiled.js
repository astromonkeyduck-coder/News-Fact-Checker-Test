// Shadow DOM web component for Noteworthy Chat widget (TypeScript version)
// Enhanced with glassy effects, resize capability, AI logo, and mobile-friendly design
class NoteworthyChat extends HTMLElement {
    constructor() {
        super();
        this.pos = { x: 24, y: 24 };
        this.size = { w: 420, h: 520 };
        this.dragging = false;
        this.resizing = false;
        this.start = null;
        this.startPos = null;
        this.startSize = null;
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
        
        /* Tutorial Modal Styles */
        .tutorial-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 2147483100;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 20px;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .tutorial-overlay.show {
          display: flex;
          opacity: 1;
        }
        
        .tutorial-modal {
          background: linear-gradient(135deg, 
            rgba(255,255,255,.98) 0%, 
            rgba(255,255,255,.95) 100%);
          backdrop-filter: blur(24px) saturate(200%);
          -webkit-backdrop-filter: blur(24px) saturate(200%);
          border-radius: 24px;
          max-width: 700px;
          max-height: 90vh;
          width: 100%;
          box-shadow: 
            0 24px 72px rgba(0,0,0,.3),
            0 0 0 1px rgba(255,255,255,.6) inset;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: modalSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        @keyframes modalSlideUp {
          from { transform: translateY(30px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        
        .tutorial-header {
          padding: 24px 28px;
          background: linear-gradient(135deg, #011F5B 0%, #143A92 100%);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,.1);
        }
        
        .tutorial-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #fff 0%, rgba(212,160,23,1) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .tutorial-close {
          background: rgba(255,255,255,.1);
          border: none;
          color: #fff;
          font-size: 28px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .tutorial-close:hover {
          background: rgba(255,255,255,.2);
          transform: scale(1.1);
        }
        
        .tutorial-content {
          flex: 1;
          overflow-y: auto;
          padding: 28px;
        }
        
        .tutorial-content::-webkit-scrollbar {
          width: 8px;
        }
        
        .tutorial-content::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .tutorial-content::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,.1);
          border-radius: 4px;
        }
        
        .tutorial-intro {
          margin-bottom: 24px;
          padding: 16px;
          background: linear-gradient(135deg, rgba(212,160,23,.08) 0%, rgba(74,144,226,.08) 100%);
          border-radius: 16px;
          border-left: 4px solid #D4A017;
        }
        
        .tutorial-intro p {
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
          color: #1a1a1a;
        }
        
        .tutorial-steps {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-bottom: 24px;
        }
        
        .tutorial-step {
          padding: 20px;
          background: linear-gradient(135deg, rgba(255,255,255,.6) 0%, rgba(248,250,252,.8) 100%);
          border-radius: 16px;
          border: 1.5px solid rgba(1,31,91,.08);
          transition: all 0.3s ease;
        }
        
        .tutorial-step:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,.1);
          border-color: rgba(212,160,23,.3);
        }
        
        .tutorial-step-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        
        .tutorial-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #D4A017 0%, #F4C430 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(212,160,23,.3);
        }
        
        .tutorial-step h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #011F5B;
        }
        
        .tutorial-step p {
          margin: 0 0 12px 0;
          font-size: 14px;
          line-height: 1.6;
          color: #4a5568;
        }
        
        .tutorial-example {
          margin-top: 12px;
          padding: 12px;
          background: rgba(1,31,91,.04);
          border-radius: 12px;
          border-left: 3px solid #4A90E2;
        }
        
        .tutorial-example strong {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          color: #011F5B;
          font-weight: 600;
        }
        
        .tutorial-example code {
          display: block;
          padding: 8px 12px;
          margin: 6px 0;
          background: rgba(255,255,255,.8);
          border-radius: 8px;
          font-size: 13px;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
          color: #2d3748;
          border: 1px solid rgba(0,0,0,.06);
        }
        
        .tutorial-tips {
          margin-top: 24px;
          padding: 20px;
          background: linear-gradient(135deg, rgba(212,160,23,.1) 0%, rgba(74,144,226,.1) 100%);
          border-radius: 16px;
          border: 1.5px solid rgba(212,160,23,.2);
        }
        
        .tutorial-tips h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 700;
          color: #011F5B;
        }
        
        .tutorial-tips ul {
          margin: 0;
          padding-left: 20px;
          list-style: none;
        }
        
        .tutorial-tips li {
          margin: 10px 0;
          font-size: 14px;
          line-height: 1.6;
          color: #4a5568;
          position: relative;
          padding-left: 8px;
        }
        
        .tutorial-tips li::before {
          content: '→';
          position: absolute;
          left: -20px;
          color: #D4A017;
          font-weight: bold;
        }
        
        .tutorial-tips code {
          background: rgba(255,255,255,.6);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          font-family: 'SF Mono', Monaco, monospace;
        }
        
        .tutorial-footer {
          padding: 20px 28px;
          background: rgba(248,250,252,.8);
          border-top: 1px solid rgba(0,0,0,.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        
        .tutorial-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          color: #4a5568;
        }
        
        .tutorial-checkbox input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        
        .tutorial-btn-primary {
          padding: 12px 24px;
          background: linear-gradient(135deg, #D4A017 0%, #F4C430 100%);
          color: #0f0f0f;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(212,160,23,.3);
        }
        
        .tutorial-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(212,160,23,.4);
        }
        
        .tutorial-btn-primary:active {
          transform: translateY(0);
        }
        
        @media (max-width: 768px) {
          .tutorial-modal {
            max-width: 95vw;
            max-height: 95vh;
            border-radius: 20px;
          }
          
          .tutorial-header {
            padding: 20px;
          }
          
          .tutorial-header h2 {
            font-size: 20px;
          }
          
          .tutorial-content {
            padding: 20px;
          }
          
          .tutorial-footer {
            flex-direction: column;
            padding: 16px 20px;
          }
          
          .tutorial-btn-primary {
            width: 100%;
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
              <div class="sub">Fast • Factual • Truth-Seeking</div>
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
            <option value="spruce">Spruce - Calm and affirming</option>
            <option value="ember">Ember - Confident and optimistic</option>
            <option value="arbor">Arbor - Easygoing and versatile</option>
            <option value="breeze">Breeze - Animated and earnest</option>
            <option value="juniper">Juniper - Open and upbeat</option>
            <option value="maple">Maple - Cheerful and candid</option>
            <option value="sol">Sol - Savvy and relaxed</option>
            <option value="vale">Vale - Bright and inquisitive</option>
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
      
      <!-- Tutorial Modal -->
      <div class="tutorial-overlay" id="tutorialOverlay" role="dialog" aria-label="Tutorial" aria-modal="true">
        <div class="tutorial-modal">
          <div class="tutorial-header">
            <h2>Welcome to Noteworthy AI!</h2>
            <button class="tutorial-close" aria-label="Close tutorial">×</button>
          </div>
          <div class="tutorial-content">
            <div class="tutorial-intro">
              <p>Your elite AI assistant for fact-checking, media literacy, and staying informed. Experience cutting-edge AI capabilities including real-time voice conversations, image generation, and web search.</p>
            </div>
            
            <div class="tutorial-steps">
              <div class="tutorial-step">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon">💬</div>
                  <h3>Chat & Ask Questions</h3>
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
                  <div class="tutorial-icon">🎤</div>
                  <h3>Real-Time Voice Conversations</h3>
                </div>
                <p><strong>How to start:</strong> Click the <strong>microphone button (🎤)</strong> in the input area to begin a voice conversation! Choose from 11 different voices and experience ultra-low latency (232ms) conversations. You can even ask the AI to generate images or search the web while on the call!</p>
                <div class="tutorial-example">
                  <strong>Try this:</strong>
                  <code>Click 🎤 → Choose your voice → Start speaking!</code>
                  <code>"Generate a picture of a news anchor"</code>
                  <code>"Research breaking news on climate change"</code>
                  <code>All while speaking naturally!</code>
                </div>
              </div>
              
              <div class="tutorial-step">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon">🎨</div>
                  <h3>Generate Images Instantly</h3>
                </div>
                <p>Click the art button to switch to image generation mode. Describe what you want to see, or upload an image to generate a new one based on it!</p>
                <div class="tutorial-example">
                  <strong>Example prompts:</strong>
                  <code>"Generate an image of a futuristic cityscape at sunset"</code>
                  <code>"Create a picture of a news anchor in a modern studio"</code>
                  <code>Or upload an image and ask to generate based on it!</code>
                </div>
              </div>
              
              <div class="tutorial-step">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon">📎</div>
                  <h3>Upload & Analyze Files</h3>
                </div>
                <p>Upload images, PDFs, or documents for AI analysis. Click the paperclip button or drag and drop files directly into the chat. Perfect for verifying screenshots, analyzing documents, or understanding complex content.</p>
                <div class="tutorial-example">
                  <strong>Try this:</strong>
                  <code>Upload a news screenshot and ask "Is this headline accurate?"</code>
                  <code>Upload an image and ask "Generate a new image based on this"</code>
                </div>
              </div>
              
              <div class="tutorial-step">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon">🔍</div>
                  <h3>Real-Time Web Search</h3>
                </div>
                <p>During voice conversations, ask the AI to research breaking news or verify information. It will search the web in real-time and provide you with current, verified information from multiple sources.</p>
                <div class="tutorial-example">
                  <strong>Try this:</strong>
                  <code>"Research breaking news on [topic]"</code>
                  <code>"Verify if this claim is true"</code>
                  <code>"Find the latest information on [subject]"</code>
                </div>
              </div>
            </div>
            
            <div class="tutorial-tips">
              <h4>💡 Pro Tips</h4>
              <ul>
                <li><strong>Resize the window:</strong> Drag the bottom-right corner to adjust the chat size</li>
                <li><strong>Drag to move:</strong> Click and drag the header to reposition the chat window</li>
                <li><strong>Keyboard shortcuts:</strong> Press <code>Escape</code> to close the chat or tutorial</li>
                <li><strong>Voice mode:</strong> Choose your preferred voice from 11 options for personalized conversations</li>
                <li><strong>Image-to-image:</strong> Upload an image in image mode to generate new images based on it</li>
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
        const root = this.root;
        const wrap = root.querySelector('.wrap');
        const launcher = root.querySelector('.launcher');
        const closeBtn = root.querySelector('.close');
        const input = root.querySelector('#chatInput');
        const send = root.querySelector('#sendButton');
        const body = root.querySelector('.body');
        const head = root.querySelector('.head');
        const resizeHandle = root.querySelector('.resize-handle');
        const tip = root.querySelector('.tip');
        const modeToggle = root.querySelector('#modeToggle');
        const modeIcon = root.querySelector('#modeIcon');
        const fileInput = root.querySelector('#fileInput');
        const fileUploadBtn = root.querySelector('#fileUploadBtn');
        const voiceModeToggle = root.querySelector('#voiceModeToggle');
        const voiceSelector = root.querySelector('#voiceSelector');
        const voiceSelect = root.querySelector('#voiceSelect');
        const voiceStatus = root.querySelector('#voiceStatus');
        const voiceStatusText = root.querySelector('#voiceStatusText');
        // Track current mode: 'chat' or 'image'
        let currentMode = 'chat';
        let uploadedFiles = [];
        // Voice conversation state
        let voiceModeActive = false;
        let websocket = null;
        let audioContext = null;
        let mediaStream = null;
        let audioWorkletNode = null;
        let isRecording = false;
        let currentVoice = 'alloy';
        let audioQueue = [];
        let isPlayingAudio = false;
        // Toggle between chat and image generation modes
        if (modeToggle && modeIcon) {
            modeToggle.addEventListener('click', () => {
                currentMode = currentMode === 'chat' ? 'image' : 'chat';
                if (currentMode === 'image') {
                    modeIcon.textContent = '🎨';
                    modeToggle.classList.add('active');
                    input.placeholder = 'Describe the image you want to generate (or upload an image to generate based on it)…';
                    modeToggle.setAttribute('title', 'Click to switch to chat mode');
                }
                else {
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
                const target = e.target;
                if (target.files && target.files.length > 0) {
                    handleFiles(Array.from(target.files));
                    target.value = '';
                }
            });
        }
        function handleFiles(files) {
            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    if (file.size > 20 * 1024 * 1024) {
                        alert(`File "${file.name}" is too large. Maximum size is 20MB.`);
                        return;
                    }
                    uploadedFiles.push(file);
                }
            });
            updateFilePreview();
        }
        const updateFilePreview = () => {
            let previewContainer = root.querySelector('.file-preview-container');
            if (uploadedFiles.length === 0) {
                if (previewContainer)
                    previewContainer.remove();
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
                    img.src = e.target?.result;
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
                audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: 24000, // OpenAI Realtime API uses 24kHz
                });
                // Create session with backend
                const endpoint = this.getAttribute('data-endpoint') || '/.netlify/functions/noteworthy-chat';
                const realtimeEndpoint = endpoint.replace('/noteworthy-chat', '/realtime-voice');
                const sessionRes = await fetch(realtimeEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ voice: currentVoice }),
                });
                if (!sessionRes.ok) {
                    throw new Error('Failed to create voice session');
                }
                const sessionData = await sessionRes.json();
                // Connect directly to OpenAI WebSocket using ephemeral token
                const wsUrl = `${sessionData.websocket_url}&ephemeral_token=${sessionData.ephemeral_token}`;
                websocket = new WebSocket(wsUrl);
                websocket.onopen = () => {
                    voiceStatusText.textContent = 'Connected - Speak now!';
                    voiceStatus.classList.remove('recording');
                    isRecording = true;
                    startAudioCapture();
                };
                websocket.onmessage = (event) => {
                    handleWebSocketMessage(event);
                };
                websocket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    voiceStatusText.textContent = 'Connection error';
                    voiceStatus.classList.add('recording');
                };
                websocket.onclose = () => {
                    voiceStatusText.textContent = 'Disconnected';
                    voiceStatus.classList.add('recording');
                    if (voiceModeActive) {
                        // Try to reconnect
                        setTimeout(() => {
                            if (voiceModeActive) {
                                startVoiceMode();
                            }
                        }, 2000);
                    }
                };
            }
            catch (error) {
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
            if (!audioContext || !mediaStream)
                return;
            try {
                const source = audioContext.createMediaStreamSource(mediaStream);
                const processor = audioContext.createScriptProcessor(4096, 1, 1);
                processor.onaudioprocess = (e) => {
                    if (!isRecording || !websocket || websocket.readyState !== WebSocket.OPEN)
                        return;
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
            }
            catch (error) {
                console.error('Error starting audio capture:', error);
            }
        }
        function handleWebSocketMessage(event) {
            try {
                const message = JSON.parse(event.data);
                switch (message.type) {
                    case 'response.audio_transcript.delta':
                        // Show transcript in real-time
                        if (message.delta) {
                            // Update status or show in chat
                        }
                        break;
                    case 'response.audio_transcript.done':
                        // Full transcript available
                        if (message.transcript) {
                            const aiGroup = document.createElement('div');
                            aiGroup.className = 'message-group ai-msg-group';
                            aiGroup.innerHTML = `
                <div class="message-avatar">NW</div>
                <div class="message-content">
                  <div class="reply">🎤 ${message.transcript}</div>
                </div>
              `;
                            body.appendChild(aiGroup);
                            body.scrollTop = body.scrollHeight;
                        }
                        break;
                    case 'response.audio_transcript.delta':
                        // Partial transcript (could show in real-time if desired)
                        break;
                    case 'response.function_call_arguments.done':
                        // Function is being called
                        if (message.name === 'generate_image') {
                            voiceStatusText.textContent = 'Generating image...';
                        }
                        else if (message.name === 'search_web') {
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
                                aiGroup.querySelector('.message-content').appendChild(replyContent);
                                body.appendChild(aiGroup);
                                body.scrollTop = body.scrollHeight;
                            }
                            else if (message.name === 'search_web' && message.result.results) {
                                // Show search results
                                const aiGroup = document.createElement('div');
                                aiGroup.className = 'message-group ai-msg-group';
                                const replyContent = document.createElement('div');
                                replyContent.className = 'reply';
                                let resultsHTML = '<p>🔍 Search results:</p><ul>';
                                message.result.results.slice(0, 5).forEach((result) => {
                                    resultsHTML += `<li><a href="${result.url}" target="_blank">${result.title}</a></li>`;
                                });
                                resultsHTML += '</ul>';
                                replyContent.innerHTML = resultsHTML;
                                aiGroup.innerHTML = `
                  <div class="message-avatar">NW</div>
                  <div class="message-content"></div>
                `;
                                aiGroup.querySelector('.message-content').appendChild(replyContent);
                                body.appendChild(aiGroup);
                                body.scrollTop = body.scrollHeight;
                            }
                        }
                        voiceStatusText.textContent = 'Listening...';
                        break;
                    case 'response.audio.delta':
                        // Play audio chunks
                        if (message.delta) {
                            playAudioChunk(message.delta);
                        }
                        break;
                    case 'response.done':
                        // Response complete
                        voiceStatusText.textContent = 'Listening...';
                        voiceStatus.classList.remove('recording');
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
                        console.error('WebSocket error:', message);
                        voiceStatusText.textContent = `Error: ${message.message || 'Unknown error'}`;
                        voiceStatus.classList.add('recording');
                        break;
                    case 'session.updated':
                        // Session updated
                        break;
                }
            }
            catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        }
        async function playAudioChunk(audioBase64) {
            if (!audioContext)
                return;
            try {
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
                const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
                audioBuffer.copyToChannel(float32, 0);
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);
                source.start();
            }
            catch (error) {
                console.error('Error playing audio chunk:', error);
            }
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
        const setPos = (x, y) => {
            this.pos = { x, y };
            wrap.style.left = x + 'px';
            wrap.style.top = y + 'px';
        };
        const setSize = (w, h) => {
            this.size = {
                w: Math.max(320, Math.min(w, window.innerWidth - 48)),
                h: Math.max(400, Math.min(h, window.innerHeight - 48))
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
            if (!this.dragging || !this.start || !this.startPos)
                return;
            const nx = this.startPos.x + (clientX - this.start.x);
            const ny = this.startPos.y + (clientY - this.start.y);
            const w = window.innerWidth;
            const h = window.innerHeight;
            const wrapWidth = wrap.offsetWidth;
            const wrapHeight = wrap.offsetHeight;
            setPos(clamp(nx, 12, w - 12 - wrapWidth), clamp(ny, 12, h - 12 - wrapHeight));
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
            if (!this.resizing || !this.start || !this.startSize || !this.startPos)
                return;
            const deltaX = clientX - this.start.x;
            const deltaY = clientY - this.start.y;
            const newW = this.startSize.w + deltaX;
            const newH = this.startSize.h + deltaY;
            const w = window.innerWidth;
            const h = window.innerHeight;
            const maxW = w - this.pos.x - 12;
            const maxH = h - this.pos.y - 12;
            setSize(Math.min(newW, maxW), Math.min(newH, maxH));
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
            if (e.target.tagName === 'BUTTON' || this.resizing)
                return;
            e.preventDefault();
            startDrag(e.clientX, e.clientY);
        });
        window.addEventListener('mousemove', (e) => {
            if (this.resizing) {
                onResize(e.clientX, e.clientY);
            }
            else {
                onMove(e.clientX, e.clientY);
            }
        });
        window.addEventListener('mouseup', () => {
            stopDrag();
            stopResize();
        });
        head.addEventListener('touchstart', (e) => {
            if (e.target.tagName === 'BUTTON' || this.resizing)
                return;
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
                }
                else {
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
            if (t)
                startResize(t.clientX, t.clientY);
        }, { passive: false });
        // Toggle open/close
        launcher.onclick = () => {
            wrap.classList.toggle('open');
            if (wrap.classList.contains('open')) {
                launcher.setAttribute('aria-expanded', 'true');
                input.focus();
            }
            else {
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
        async function generateImage(prompt, imageFiles) {
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
                        img.src = e.target?.result;
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
            }
            else {
                userMsgContent.textContent = `🎨 Generate image: ${prompt}`;
            }
            userGroup.innerHTML = `
        <div class="message-avatar">You</div>
        <div class="message-content"></div>
      `;
            userGroup.querySelector('.message-content').appendChild(userMsgContent);
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
                const imageData = [];
                if (imageFiles && imageFiles.length > 0) {
                    for (const file of imageFiles) {
                        const base64 = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => {
                                const result = reader.result;
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
                imageEl.onerror = function () {
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
                aiGroup.querySelector('.message-content').appendChild(replyContent);
                body.appendChild(aiGroup);
                body.scrollTop = body.scrollHeight;
            }
            catch (e) {
                thinking.remove();
                const aiGroup = document.createElement('div');
                aiGroup.className = 'message-group ai-msg-group';
                const err = document.createElement('div');
                err.className = 'error';
                err.textContent = e?.message || 'Network error. Please try again.';
                aiGroup.innerHTML = `
          <div class="message-avatar">NW</div>
          <div class="message-content"></div>
        `;
                aiGroup.querySelector('.message-content').appendChild(err);
                body.appendChild(aiGroup);
                body.scrollTop = body.scrollHeight;
            }
            finally {
                send.disabled = false;
            }
        }
        async function ask() {
            const message = input.value.trim();
            if (!message)
                return;
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
            // Show user message with avatar
            const userGroup = document.createElement('div');
            userGroup.className = 'message-group user-msg-group';
            userGroup.innerHTML = `
        <div class="message-avatar">You</div>
        <div class="message-content">
          <div class="user-msg">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
      `;
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
                // Regular chat response
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message }),
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
                replyContent.innerHTML = text.split('\n').filter((l) => l.trim()).map((l) => `<p>${l}</p>`).join('');
                aiGroup.innerHTML = `
          <div class="message-avatar">NW</div>
          <div class="message-content"></div>
        `;
                aiGroup.querySelector('.message-content').appendChild(replyContent);
                body.appendChild(aiGroup);
                body.scrollTop = body.scrollHeight;
            }
            catch (e) {
                thinking.remove();
                const aiGroup = document.createElement('div');
                aiGroup.className = 'message-group ai-msg-group';
                const err = document.createElement('div');
                err.className = 'error';
                err.textContent = e?.message || 'Network error. Please try again.';
                aiGroup.innerHTML = `
          <div class="message-avatar">NW</div>
          <div class="message-content"></div>
        `;
                aiGroup.querySelector('.message-content').appendChild(err);
                body.appendChild(aiGroup);
                body.scrollTop = body.scrollHeight;
            }
            finally {
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
        const helpBtn = root.querySelector('#helpBtn');
        const tutorialOverlay = root.querySelector('#tutorialOverlay');
        const tutorialClose = root.querySelector('.tutorial-close');
        const tutorialGotIt = root.querySelector('#tutorialGotIt');
        const dontShowAgain = root.querySelector('#dontShowAgain');
        // Check if tutorial should be shown
        const shouldShowTutorial = () => {
            const dontShow = localStorage.getItem('noteworthy-ai-tutorial-dismissed') === 'true';
            return !dontShow;
        };
        // Show tutorial
        const showTutorial = () => {
            if (tutorialOverlay) {
                tutorialOverlay.classList.add('show');
                document.body.style.overflow = 'hidden';
            }
        };
        // Hide tutorial
        const hideTutorial = (savePreference = false) => {
            if (tutorialOverlay) {
                tutorialOverlay.classList.remove('show');
                document.body.style.overflow = '';
                if (savePreference && dontShowAgain && dontShowAgain.checked) {
                    localStorage.setItem('noteworthy-ai-tutorial-dismissed', 'true');
                }
            }
        };
        // Help button click
        if (helpBtn) {
            helpBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showTutorial();
            });
        }
        // Tutorial close handlers
        if (tutorialClose) {
            tutorialClose.addEventListener('click', () => hideTutorial(false));
        }
        if (tutorialGotIt) {
            tutorialGotIt.addEventListener('click', () => hideTutorial(true));
        }
        // Close tutorial on overlay click
        if (tutorialOverlay) {
            tutorialOverlay.addEventListener('click', (e) => {
                if (e.target === tutorialOverlay) {
                    hideTutorial(false);
                }
            });
        }
        // Close tutorial on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && tutorialOverlay && tutorialOverlay.classList.contains('show')) {
                hideTutorial(false);
            }
        });
        // Show tutorial on first open if not dismissed
        launcher.addEventListener('click', () => {
            if (wrap.classList.contains('open') && shouldShowTutorial()) {
                setTimeout(() => {
                    if (shouldShowTutorial()) {
                        showTutorial();
                    }
                }, 300);
            }
        });
    }
    disconnectedCallback() {
        // Cleanup if needed
    }
}
customElements.define('noteworthy-chat-widget', NoteworthyChat);
