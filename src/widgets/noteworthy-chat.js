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
          min-width: 360px;
          height: 520px; 
          min-height: 450px;
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
        
        .mode-toggle {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
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
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
        }
        
        .mode-toggle.active {
          background: rgba(74, 144, 226, 0.3);
          border-color: #4A90E2;
        }
        
        .mode-toggle #modeIcon {
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
            height: calc(100vh - 100px) !important;
            max-height: calc(100vh - 100px) !important;
            min-height: 400px !important;
            left: 16px !important;
            top: 80px !important;
            transform: none !important;
            border-radius: 16px !important;
            min-width: calc(100vw - 32px) !important;
          }
          
          .wrap.open {
            transform: none !important;
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
            height: calc(100vh - 80px) !important;
            max-height: calc(100vh - 80px) !important;
            min-height: 350px !important;
            left: 12px !important;
            top: 70px !important;
            transform: none !important;
          }
          
          .wrap.open {
            transform: none !important;
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
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          z-index: 2147483001;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.3s ease;
        }
        
        .tutorial-overlay.show {
          display: flex;
        }
        
        .tutorial-modal {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 2px solid rgba(74, 144, 226, 0.4);
          border-radius: 20px;
          max-width: 600px;
          width: 100%;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5),
                      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          animation: slideUp 0.3s ease;
        }
        
        .tutorial-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 28px;
          border-bottom: 1px solid rgba(74, 144, 226, 0.2);
        }
        
        .tutorial-header h2 {
          margin: 0;
          color: #fff;
          font-size: 24px;
          font-weight: 700;
        }
        
        .tutorial-close {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          font-size: 32px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: all 0.2s ease;
        }
        
        .tutorial-close:hover {
          background: rgba(255, 107, 107, 0.2);
          color: #ff6b6b;
          transform: rotate(90deg);
        }
        
        .tutorial-content {
          padding: 24px 28px;
        }
        
        .tutorial-step {
          margin-bottom: 28px;
          padding: 20px;
          background: rgba(74, 144, 226, 0.08);
          border: 1px solid rgba(74, 144, 226, 0.2);
          border-radius: 12px;
          transition: all 0.3s ease;
        }
        
        .tutorial-step:hover {
          background: rgba(74, 144, 226, 0.12);
          border-color: rgba(74, 144, 226, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(74, 144, 226, 0.2);
        }
        
        .tutorial-step:last-of-type {
          margin-bottom: 0;
        }
        
        .tutorial-icon {
          font-size: 36px;
          margin-bottom: 12px;
          display: inline-block;
        }
        
        .tutorial-step h3 {
          margin: 0 0 10px 0;
          color: #fff;
          font-size: 18px;
          font-weight: 600;
        }
        
        .tutorial-step p {
          margin: 0 0 12px 0;
          color: rgba(255, 255, 255, 0.85);
          font-size: 14px;
          line-height: 1.6;
        }
        
        .tutorial-example {
          background: rgba(46, 204, 113, 0.1);
          border-left: 3px solid rgba(46, 204, 113, 0.5);
          padding: 10px 14px;
          border-radius: 6px;
          margin-top: 10px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.9);
        }
        
        .tutorial-example strong {
          color: rgba(46, 204, 113, 0.9);
        }
        
        .tutorial-tip {
          background: rgba(74, 144, 226, 0.15);
          border: 1px solid rgba(74, 144, 226, 0.3);
          border-radius: 12px;
          padding: 16px 20px;
          margin-top: 20px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
          line-height: 1.6;
        }
        
        .tutorial-tip strong {
          color: rgba(74, 144, 226, 0.9);
        }
        
        .tutorial-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 28px;
          border-top: 1px solid rgba(74, 144, 226, 0.2);
          gap: 16px;
        }
        
        .tutorial-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
          cursor: pointer;
        }
        
        .tutorial-checkbox input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: rgba(74, 144, 226, 0.8);
        }
        
        .tutorial-btn-primary {
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.9), rgba(46, 204, 113, 0.9));
          border: none;
          color: #fff;
          padding: 12px 28px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
        }
        
        .tutorial-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(74, 144, 226, 0.4);
        }
        
        .tutorial-btn-primary:active {
          transform: translateY(0);
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @media (max-width: 768px) {
          .tutorial-overlay {
            padding: 16px;
          }
          
          .tutorial-modal {
            max-width: 100%;
            width: 100%;
            border-radius: 16px;
            max-height: 90vh;
            margin: 0;
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
          
          .tutorial-step {
            padding: 16px;
            margin-bottom: 20px;
          }
          
          .tutorial-footer {
            flex-direction: column;
            align-items: stretch;
            padding: 16px 20px;
          }
          
          .tutorial-btn-primary {
            width: 100%;
            margin-top: 8px;
          }
        }
        
        @media (max-width: 480px) {
          .tutorial-overlay {
            padding: 12px;
          }
          
          .tutorial-modal {
            max-height: 85vh;
            border-radius: 12px;
          }
          
          .tutorial-header {
            padding: 16px;
          }
          
          .tutorial-header h2 {
            font-size: 18px;
          }
          
          .tutorial-content {
            padding: 16px;
          }
          
          .tutorial-step {
            padding: 12px;
            margin-bottom: 16px;
          }
          
          .tutorial-footer {
            padding: 12px 16px;
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
          <button type="button" class="mode-toggle" id="modeToggle" aria-label="Toggle between chat and image generation" title="Click to switch between chat and image generation">
            <span id="modeIcon">💬</span>
          </button>
          <input type="text" placeholder="Ask about a story or topic…" aria-label="Your question" id="chatInput" />
          <button type="button" id="sendButton">Send</button>
        </div>
        
        <div class="resize-handle" aria-label="Resize chat" title="Drag to resize"></div>
      </div>
      
      <!-- Tutorial Modal -->
      <div class="tutorial-overlay" id="tutorialOverlay" role="dialog" aria-label="Tutorial" aria-modal="true">
        <div class="tutorial-modal">
          <div class="tutorial-header">
            <h2>🎓 Welcome to Noteworthy AI!</h2>
            <button class="tutorial-close" aria-label="Close tutorial">×</button>
          </div>
          <div class="tutorial-content">
            <div class="tutorial-step">
              <div class="tutorial-icon">💬</div>
              <h3>Chat Mode</h3>
              <p>Ask questions about news, headlines, or get fact-checks. Click the chat icon (💬) to stay in chat mode.</p>
              <div class="tutorial-example">
                <strong>Try:</strong> "What's the latest on the breaking news about..."
              </div>
            </div>
            
            <div class="tutorial-step">
              <div class="tutorial-icon">🎨</div>
              <h3>Image Generation</h3>
              <p>Click the image icon (🎨) to switch to image mode. Describe what you want to see, and AI will create it!</p>
              <div class="tutorial-example">
                <strong>Try:</strong> "A futuristic cityscape at sunset"
              </div>
            </div>
            
            <div class="tutorial-step">
              <div class="tutorial-icon">🔊</div>
              <h3>Audio Feature</h3>
              <p>Toggle audio (🔊) to hear AI responses read aloud. Click to turn audio on or off.</p>
            </div>
            
            <div class="tutorial-step">
              <div class="tutorial-icon">🎤</div>
              <h3>Voice Input</h3>
              <p>Click the microphone (🎤) to speak your questions instead of typing. Great for hands-free use!</p>
            </div>
            
            <div class="tutorial-tip">
              <strong>💡 Pro Tip:</strong> You can resize the chat window by dragging the bottom-right corner!
            </div>
          </div>
          <div class="tutorial-footer">
            <label class="tutorial-checkbox">
              <input type="checkbox" id="dontShowAgain" />
              <span>Don't show this again</span>
            </label>
            <button class="tutorial-btn-primary" id="tutorialGotIt">Got it!</button>
          </div>
        </div>
      </div>
    `;

    const wrap = this.root.querySelector('.wrap');
    const launcher = this.root.querySelector('.launcher');
    const closeBtn = this.root.querySelector('.close');
    const input = this.root.querySelector('.input input');
    const send = this.root.querySelector('#sendButton');
    const body = this.root.querySelector('.body');
    const head = this.root.querySelector('.head');
    const resizeHandle = this.root.querySelector('.resize-handle');
    const tip = this.root.querySelector('.tip');
    const modeToggle = this.root.querySelector('#modeToggle');
    const modeIcon = this.root.querySelector('#modeIcon');
    
    // Debug: Log if elements are found
    console.log('Noteworthy Chat initialized:', {
      wrap: !!wrap,
      launcher: !!launcher,
      input: !!input,
      send: !!send,
      body: !!body,
      endpoint: endpoint
    });
    
    // Ensure all critical elements exist
    if (!input || !send || !body) {
      console.error('Noteworthy Chat: Missing critical elements!', {
        input: !!input,
        send: !!send,
        body: !!body
      });
      return;
    }
    
    // Store reference to root for use in nested functions
    const rootRef = this.root;
    
    // Track current mode: 'chat' or 'image'
    let currentMode = 'chat';
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
    
    // Toggle between chat and image generation modes
    if (modeToggle && modeIcon) {
      modeToggle.addEventListener('click', () => {
        currentMode = currentMode === 'chat' ? 'image' : 'chat';
        
        if (currentMode === 'image') {
          modeIcon.textContent = '🎨';
          modeToggle.classList.add('active');
          input.placeholder = 'Describe the image you want to generate…';
          modeToggle.setAttribute('title', 'Click to switch to chat mode');
        } else {
          modeIcon.textContent = '💬';
          modeToggle.classList.remove('active');
          input.placeholder = 'Ask about a story or topic…';
          modeToggle.setAttribute('title', 'Click to switch to image generation mode');
        }
        
        input.focus();
      });
    }

    const setPos = (x, y) => {
      this.pos = { x, y };
      wrap.style.left = x + 'px';
      wrap.style.top = y + 'px';
    };

    const setSize = (w, h) => {
      // Minimum sizes to ensure all buttons and UI elements remain visible
      const MIN_WIDTH = 360;  // Enough for mode toggle + input + send button + padding
      const MIN_HEIGHT = 450; // Enough for header + body + input area + padding
      
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
    const tutorialOverlay = this.root.querySelector('#tutorialOverlay');
    const tutorialClose = this.root.querySelector('.tutorial-close');
    const tutorialGotIt = this.root.querySelector('#tutorialGotIt');
    const dontShowAgain = this.root.querySelector('#dontShowAgain');
    const helpBtn = document.createElement('button');
    
    // Check if tutorial should be shown
    const shouldShowTutorial = () => {
      const dontShow = localStorage.getItem('noteworthy-ai-tutorial-dismissed') === 'true';
      return !dontShow;
    };
    
    // Show tutorial
    const showTutorial = () => {
      if (tutorialOverlay) {
        // On mobile, close chat box if open to prevent overlap
        const isMobile = window.innerWidth <= 768;
        if (isMobile && wrap && wrap.classList.contains('open')) {
          wrap.classList.remove('open');
        }
        tutorialOverlay.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
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
    helpBtn.title = 'How to use Noteworthy AI';
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
    const headRight = this.root.querySelector('.head-right');
    if (headRight && closeBtn) {
      headRight.insertBefore(helpBtn, closeBtn);
    }
    
    // Tutorial event handlers
    if (tutorialClose) {
      tutorialClose.onclick = () => hideTutorial(false);
    }
    
    if (tutorialGotIt) {
      tutorialGotIt.onclick = () => hideTutorial(true);
    }
    
    // Close tutorial on overlay click (but not on modal click)
    if (tutorialOverlay) {
      tutorialOverlay.onclick = (e) => {
        if (e.target === tutorialOverlay) {
          hideTutorial(false);
        }
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

    // Generate image function
    async function generateImage(prompt) {
      if (!prompt || !prompt.trim()) {
        send.disabled = false;
        return;
      }

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

      // Update header to show image generation mode
      const subText = rootRef.querySelector('.sub');
      let originalSub = null;
      if (subText) {
        originalSub = subText.textContent;
        subText.textContent = '🎨 Generating Image…';
        subText.style.color = 'rgba(74, 144, 226, 0.9)';
        subText.style.fontWeight = '700';
      }
      
      // Show thinking indicator with distinctive styling for image generation
      const thinking = document.createElement('div');
      
      // Store original subtitle for restoration
      if (originalSub) {
        thinking._originalSub = originalSub;
      }
      thinking.className = 'message-group ai-msg-group';
      thinking.innerHTML = `
          <div class="message-avatar">
          <img src="/IMG_5794.PNG" alt="Noteworthy News" />
        </div>
        <div class="message-content">
          <div class="thinking generating-image">
            <span class="thinking-icon">🎨</span>
            <span class="spinner"></span>
            <span><strong>Generating Image…</strong> Creating your image with AI</span>
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
        
        // Restore header subtitle
        const subText = rootRef.querySelector('.sub');
        if (subText && thinking._originalSub) {
          subText.textContent = thinking._originalSub;
          subText.style.color = '';
          subText.style.fontWeight = '';
        }

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
      } catch (e) {
        thinking.remove();
        
        // Restore header subtitle on error
        const subText = rootRef.querySelector('.sub');
        if (subText && thinking && thinking._originalSub) {
          subText.textContent = thinking._originalSub;
          subText.style.color = '';
          subText.style.fontWeight = '';
        }
        
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
        send.disabled = false;
      }
    }

    async function ask() {
      console.log('ask() function called');
      const message = input.value.trim();
      if (!message) {
        console.log('Empty message, returning');
        return;
      }
      console.log('Processing message:', message.substring(0, 50));
      input.value = '';
      send.disabled = true;

      // Remove tip
      if (tip && tip.parentNode) {
        tip.style.display = 'none';
      }

      // Check if we're in image generation mode
      if (currentMode === 'image') {
        await generateImage(message);
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

      // Update header to show thinking mode
      const subText = rootRef.querySelector('.sub');
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
          <img src="/IMG_5794.PNG" alt="Noteworthy News" />
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

        let res;
        let lastError = null;
        
        // Try primary endpoint
        try {
          res = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ message }),
          });
          console.log('Fetch response:', { ok: res.ok, status: res.status, statusText: res.statusText });
        } catch (fetchError) {
          console.error('Fetch error:', fetchError);
          lastError = fetchError;
          
          // If we tried direct function path and it failed, try redirect path as fallback
          if (!isLocalhost && apiEndpoint === '/.netlify/functions/noteworthy-chat') {
            console.warn('Direct function path failed, trying redirect path:', fetchError);
            apiEndpoint = '/api/noteworthy';
            try {
              res = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({ message }),
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
                headers: { 
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({ message }),
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
        
        console.log('API Success:', { reply: data.reply?.substring(0, 50) + '...', fullData: data });
        
        if (!data || !data.reply) {
          console.error('API response missing reply field:', data);
          throw new Error('Server did not return a valid response. Please try again.');
        }
        
        thinking.remove();
        
        // Restore header subtitle
        const subText = rootRef.querySelector('.sub');
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
        console.error('Ask function error:', e);
        thinking.remove();
        
        // Restore header subtitle on error
        const subText = rootRef.querySelector('.sub');
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
            <strong>⚠️ Rate Limit Reached</strong>
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

customElements.define('noteworthy-chat-widget', NoteworthyChat);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NoteworthyChat;
}
