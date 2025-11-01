// Shadow DOM web component for Noteworthy Chat widget (JavaScript version)
// Professional dark mode design with state-of-the-art AI aesthetic

class NoteworthyChat extends HTMLElement {
  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.pos = { x: 24, y: 24 };
    this.size = { w: 420, h: 520 };
    this.dragging = false;
    this.resizing = false;
    this.start = null;
    this.startPos = null;
    this.startSize = null;
  }

  connectedCallback() {
    const endpoint = this.getAttribute('data-endpoint') || '/api/noteworthy';
    const openOnLoad = this.getAttribute('data-open') === 'true';

    this.root.innerHTML = `
      <style>
        :host { all: initial; display: block; }
        *, *::before, *::after { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; }
        
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
        
        .image-generation-toggle {
          padding: 10px 14px;
          border-top: 1px solid rgba(74, 144, 226, 0.1);
          background: rgba(30, 41, 59, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
          gap: 8px;
        }
        
        .image-generation-toggle:hover {
          background: rgba(74, 144, 226, 0.15);
          color: rgba(255, 255, 255, 0.9);
        }
        
        .image-generation-toggle.active {
          background: rgba(74, 144, 226, 0.2);
          color: rgba(255, 255, 255, 0.95);
          font-weight: 600;
        }
        
        .image-generation-toggle .icon {
          font-size: 16px;
        }
        
        .image-generation-section {
          display: none;
          padding: 12px 16px;
          background: rgba(74, 144, 226, 0.08);
          border-top: 1px solid rgba(74, 144, 226, 0.2);
          border-bottom: 1px solid rgba(74, 144, 226, 0.2);
        }
        
        .image-generation-section.open {
          display: block;
        }
        
        .image-generation-section .info {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 10px;
        }
        
        .image-generation-section input {
          width: 100%;
          padding: 10px 14px;
          border: 1.5px solid rgba(74, 144, 226, 0.3);
          border-radius: 8px;
          margin-bottom: 10px;
          font-size: 14px;
          background: rgba(30, 41, 59, 0.7);
          color: rgba(255, 255, 255, 0.9);
          outline: none;
        }
        
        .image-generation-section input:focus {
          border-color: rgba(74, 144, 226, 0.6);
          background: rgba(30, 41, 59, 0.9);
        }
        
        .image-generation-section button {
          width: 100%;
          padding: 10px 16px;
          border: 2px solid rgba(74, 144, 226, 0.4);
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.9) 0%, rgba(58, 112, 192, 0.9) 100%);
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }
        
        .image-generation-section button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(74, 144, 226, 0.4);
        }
        
        .image-generation-section button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .image-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          gap: 12px;
          color: rgba(255, 255, 255, 0.6);
        }
        
        .image-loading .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(74, 144, 226, 0.2);
          border-top-color: rgba(74, 144, 226, 0.8);
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
        }
        
        .input input { 
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
        .input input:focus {
          border-color: rgba(74, 144, 226, 0.5);
          background: rgba(30, 41, 59, 0.8);
          box-shadow: 
            0 0 0 4px rgba(74, 144, 226, 0.15),
            0 0 12px rgba(74, 144, 226, 0.2);
          color: #fff;
        }
        .input input::placeholder {
          color: rgba(255, 255, 255, 0.4);
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
        
        .thinking {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
        }
        
        .spinner {
          display: inline-block;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 3px solid rgba(74, 144, 226, 0.2);
          border-bottom-color: rgba(74, 144, 226, 0.8);
          animation: spin .8s linear infinite;
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
        
        @media (max-width: 768px) {
          .wrap {
            width: 90vw !important;
            max-width: 400px !important;
            height: 60vh !important;
            max-height: 500px !important;
            min-height: 400px !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            border-radius: 16px !important;
            min-width: 320px !important;
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
            width: 85vw !important;
            max-width: 360px !important;
            height: 55vh !important;
            max-height: 450px !important;
            min-height: 350px !important;
            transform: translate(-50%, -50%) !important;
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
      </style>
      
      <button class="launcher" aria-label="Open Noteworthy AI">
        <span class="launcher-icon"><img src="/IMG_5794.PNG" alt="Noteworthy News" /></span>
        Noteworthy AI
      </button>
      
      <div class="wrap${openOnLoad ? ' open' : ''}" role="dialog" aria-label="Noteworthy AI" aria-modal="true">
        <div class="head">
          <div class="head-left">
            <div class="logo" aria-hidden="true">
              <img src="/IMG_5794.PNG" alt="Noteworthy News" />
            </div>
            <div class="title-group">
              <div class="title">Noteworthy AI</div>
              <div class="sub">Fast • Factual • Truth-Seeking</div>
            </div>
          </div>
          <div class="head-right">
            <button class="audio-toggle" aria-label="Toggle audio" id="audioToggle" title="Audio On/Off">🔊</button>
            <button class="voice-input-toggle" aria-label="Toggle voice input" id="voiceInputToggle" title="Voice Input">🎤</button>
            <button class="close" aria-label="Close chat">×</button>
          </div>
        </div>
        
        <div class="body">
          <p class="tip">Ask about headlines, context, or fact-checks. I'm here to help you stay informed!</p>
        </div>
        
        <div class="input">
          <input type="text" placeholder="Ask about a story or topic…" aria-label="Your question" id="chatInput" />
          <button type="button">Send</button>
        </div>
        
        <div class="image-generation-section" id="imageGenerationSection">
          <div class="info">Enter a description of the image you'd like to generate:</div>
          <input type="text" id="imagePromptInput" placeholder="e.g., a futuristic cityscape at sunset" />
          <button type="button" id="generateImageBtn">🎨 Generate Image</button>
        </div>
        
        <div class="image-generation-toggle" id="imageGenerationToggle">
          <span class="icon">🎨</span>
          <span>Generate Image</span>
        </div>
        
        <div class="resize-handle" aria-label="Resize chat" title="Drag to resize"></div>
      </div>
    `;

    const wrap = this.root.querySelector('.wrap');
    const launcher = this.root.querySelector('.launcher');
    const closeBtn = this.root.querySelector('.close');
    const input = this.root.querySelector('.input input');
    const send = this.root.querySelector('.input button');
    const body = this.root.querySelector('.body');
    const head = this.root.querySelector('.head');
    const resizeHandle = this.root.querySelector('.resize-handle');
    const tip = this.root.querySelector('.tip');
    const imageGenerationToggle = this.root.querySelector('#imageGenerationToggle');
    const imageGenerationSection = this.root.querySelector('#imageGenerationSection');
    const imagePromptInput = this.root.querySelector('#imagePromptInput');
    const generateImageBtn = this.root.querySelector('#generateImageBtn');
    const audioToggle = this.root.querySelector('#audioToggle');
    const voiceInputToggle = this.root.querySelector('#voiceInputToggle');
    
    // Audio settings
    let audioEnabled = localStorage.getItem('noteworthy-ai-audio') === 'true';
    let voiceInputEnabled = false;
    let recognition = null;
    let currentSpeech = null;
    
    // Initialize audio toggle state
    if (audioToggle) {
      audioToggle.textContent = audioEnabled ? '🔊' : '🔇';
      if (audioEnabled) audioToggle.classList.add('active');
      
      audioToggle.addEventListener('click', () => {
        audioEnabled = !audioEnabled;
        localStorage.setItem('noteworthy-ai-audio', audioEnabled.toString());
        audioToggle.textContent = audioEnabled ? '🔊' : '🔇';
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
      if (!audioEnabled) return;
      
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
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
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
        // Visual feedback that audio is playing
        if (audioToggle) {
          audioToggle.style.opacity = '0.7';
        }
      };
      
      utterance.onend = () => {
        currentSpeech = null;
        if (audioToggle) {
          audioToggle.style.opacity = '1';
        }
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
      if (window.speechSynthesis.getVoices().length === 0) {
        // Voices not loaded yet, wait for them
        window.speechSynthesis.addEventListener('voiceschanged', function onVoicesChanged() {
          window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
          const voice = selectBestVoice();
          if (voice) {
            utterance.voice = voice;
          }
          window.speechSynthesis.speak(utterance);
        }, { once: true });
      } else {
        window.speechSynthesis.speak(utterance);
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
    
    // Toggle image generation section
    if (imageGenerationToggle && imageGenerationSection) {
      imageGenerationToggle.addEventListener('click', () => {
        const isOpen = imageGenerationSection.classList.contains('open');
        if (isOpen) {
          imageGenerationSection.classList.remove('open');
          imageGenerationToggle.classList.remove('active');
        } else {
          imageGenerationSection.classList.add('open');
          imageGenerationToggle.classList.add('active');
          imagePromptInput.focus();
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
    };

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && wrap.classList.contains('open')) {
        wrap.classList.remove('open');
        launcher.setAttribute('aria-expanded', 'false');
      }
    });

    // Generate image function
    async function generateImage() {
      const prompt = imagePromptInput.value.trim();
      if (!prompt) return;
      imagePromptInput.value = '';
      generateImageBtn.disabled = true;

      // Remove tip
      if (tip && tip.parentNode) {
        tip.style.display = 'none';
      }

      // Show user message with avatar
      const userGroup = document.createElement('div');
      userGroup.className = 'message-group user-msg-group';
      userGroup.innerHTML = `
        <div class="message-avatar">You</div>
        <div class="message-content">
          <div class="user-msg">🎨 Generate image: ${prompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
      `;
      body.appendChild(userGroup);
      body.scrollTop = body.scrollHeight;

      // Show thinking indicator
      const thinking = document.createElement('div');
      thinking.className = 'message-group ai-msg-group';
      thinking.innerHTML = `
          <div class="message-avatar">
          <img src="/IMG_5794.PNG" alt="Noteworthy News" />
        </div>
        <div class="message-content">
          <div class="thinking">
            <span class="spinner"></span>Generating image…
          </div>
        </div>
      `;
      body.appendChild(thinking);
      body.scrollTop = body.scrollHeight;

      try {
        // Generate image using DALL-E
        let imageEndpoint = '/.netlify/functions/generate-image';
        // Handle local development
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalhost) {
          imageEndpoint = 'http://localhost:8888/.netlify/functions/generate-image';
        }
        
        const imageRes = await fetch(imageEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: prompt,
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
          <div class="message-avatar">
            <img src="/IMG_5794.PNG" alt="Noteworthy News" />
          </div>
          <div class="message-content"></div>
        `;
        aiGroup.querySelector('.message-content').appendChild(replyContent);
        body.appendChild(aiGroup);

        body.scrollTop = body.scrollHeight;
        
        // Close the image generation section after successful generation
        if (imageGenerationSection) {
          imageGenerationSection.classList.remove('open');
          imageGenerationToggle.classList.remove('active');
        }
      } catch (e) {
        thinking.remove();
        const aiGroup = document.createElement('div');
        aiGroup.className = 'message-group ai-msg-group';
        const err = document.createElement('div');
        err.className = 'error';
        err.textContent = e?.message || 'Network error. Please try again.';
        
        aiGroup.innerHTML = `
          <div class="message-avatar">
            <img src="/IMG_5794.PNG" alt="Noteworthy News" />
          </div>
          <div class="message-content"></div>
        `;
        aiGroup.querySelector('.message-content').appendChild(err);
        body.appendChild(aiGroup);
        body.scrollTop = body.scrollHeight;
      } finally {
        generateImageBtn.disabled = false;
      }
    }

    // Generate image button handler
    if (generateImageBtn) {
      generateImageBtn.addEventListener('click', generateImage);
    }
    
    if (imagePromptInput) {
      imagePromptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !generateImageBtn.disabled) {
          generateImage();
        }
      });
    }

    async function ask() {
      const message = input.value.trim();
      if (!message) return;
      input.value = '';
      send.disabled = true;

      // Remove tip
      if (tip && tip.parentNode) {
        tip.style.display = 'none';
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
        <div class="message-avatar">
          <img src="/IMG_5794.PNG" alt="Noteworthy News" />
        </div>
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
        // Handle localhost vs production endpoint
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // For localhost, try the function directly first, then fallback to redirect
        let apiEndpoint = endpoint;
        if (isLocalhost && endpoint === '/api/noteworthy') {
          // Try direct function call for localhost
          apiEndpoint = 'http://localhost:8888/.netlify/functions/noteworthy-chat';
        }

        console.log('Calling API:', { endpoint: apiEndpoint, method: 'POST', message: message.substring(0, 50) + '...' });

        const res = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ message }),
        });

        if (!res.ok) {
          let errorText;
          let isRateLimit = false;
          let resetIn = null;
          
          try {
            const errorData = await res.json();
            errorText = errorData.error || errorData.message || `Server error (${res.status})`;
            
            // Check if it's a rate limit error
            if (res.status === 429) {
              isRateLimit = true;
              resetIn = errorData.resetIn;
              errorText = errorData.message || `Rate limit exceeded. Please try again in ${resetIn || 'a few'} minute(s).`;
            }
            
            console.error('API Error:', { status: res.status, error: errorData });
          } catch {
            errorText = await res.text().catch(() => `Server error (${res.status})`);
            console.error('API Error (non-JSON):', { status: res.status, text: errorText });
            
            if (res.status === 429) {
              isRateLimit = true;
              errorText = 'Rate limit exceeded. You\'ve reached the limit of 10 messages per 30 minutes. Please wait before trying again.';
            }
          }
          
          const error = new Error(errorText);
          if (isRateLimit) {
            error.isRateLimit = true;
            error.resetIn = resetIn;
          }
          throw error;
        }

        const data = await res.json();
        console.log('API Success:', { reply: data.reply?.substring(0, 50) + '...' });
        thinking.remove();

        // Show reply with NW logo
        const aiGroup = document.createElement('div');
        aiGroup.className = 'message-group ai-msg-group';
        const text = data.reply || 'No response.';
        const replyContent = document.createElement('div');
        replyContent.className = 'reply';
        replyContent.innerHTML = text.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('');

        aiGroup.innerHTML = `
          <div class="message-avatar">
            <img src="/IMG_5794.PNG" alt="Noteworthy News" />
          </div>
          <div class="message-content"></div>
        `;
        aiGroup.querySelector('.message-content').appendChild(replyContent);
        body.appendChild(aiGroup);

        body.scrollTop = body.scrollHeight;
        
        // Text-to-speech for AI response
        if (audioEnabled) {
          speakText(text);
        }
      } catch (e) {
        thinking.remove();
        const aiGroup = document.createElement('div');
        aiGroup.className = 'message-group ai-msg-group';
        const err = document.createElement('div');
        
        // Special styling for rate limit errors
        if (e?.isRateLimit) {
          err.className = 'error rate-limit-error';
          const message = e.message || 'Rate limit exceeded';
          const resetInfo = e.resetIn ? ` Try again in ${e.resetIn} minute(s).` : '';
          err.innerHTML = `
            <strong>⚠️ Rate Limit Reached</strong>
            <p>${message}${resetInfo}</p>
            <p style="font-size: 12px; opacity: 0.8; margin-top: 8px;">
              Limit: 10 messages per 30 minutes
            </p>
          `;
        } else {
          err.className = 'error';
          err.textContent = e?.message || 'Network error. Please try again.';
        }
        
        aiGroup.innerHTML = `
          <div class="message-avatar">
            <img src="/IMG_5794.PNG" alt="Noteworthy News" />
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

    send.onclick = ask;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !send.disabled) {
        ask();
      }
    });

    // Initial position and size
    setPos(this.pos.x, this.pos.y);
    setSize(this.size.w, this.size.h);
  }

  disconnectedCallback() {
    // Cleanup if needed
  }
}

customElements.define('noteworthy-chat-widget', NoteworthyChat);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NoteworthyChat;
}
