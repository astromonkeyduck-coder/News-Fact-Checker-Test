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
          display: none;
        }
        
        .file-upload-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.9);
          width: 40px;
          height: 40px;
          border-radius: 12px;
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
        
        .file-upload-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
          border-color: rgba(74, 144, 226, 0.4);
        }
        
        .file-upload-btn:active {
          transform: scale(0.95);
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
            min-height: 400px !important;
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
          overflow-y: auto;
          overflow-x: hidden;
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
          position: sticky;
          top: 0;
          z-index: 10;
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
        
        .tutorial-header h2::before {
          content: '✨';
          font-size: 28px;
          -webkit-text-fill-color: initial;
          filter: drop-shadow(0 2px 4px rgba(74, 144, 226, 0.3));
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
            transparent 0%,
            rgba(15, 23, 42, 0.5) 100%);
          gap: 20px;
          position: sticky;
          bottom: 0;
          border-radius: 0 0 24px 24px;
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
        
        <div class="drag-drop-overlay">
          <div class="drag-drop-overlay-icon">📎</div>
          <div class="drag-drop-overlay-text">Drag and Drop</div>
          <div class="drag-drop-overlay-subtext">Drop your files here to upload</div>
        </div>
        
        <div class="body">
          <p class="tip">Ask about headlines, context, or fact-checks. Upload images or documents for analysis. I'm here to help you stay informed!</p>
        </div>
        
        <div class="input">
          <input type="file" id="fileInput" accept="image/*,application/pdf,.txt,.doc,.docx" multiple aria-label="Upload file" />
          <button type="button" class="file-upload-btn" id="fileUploadBtn" aria-label="Upload file" title="Upload file">📎</button>
          <input type="text" placeholder="Ask a question or describe an image to generate…" aria-label="Your question" id="chatInput" />
          <button type="button" id="sendButton">Send</button>
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
              <p>Your intelligent assistant for fact-checking, media literacy, and staying informed. Get instant answers, verify information, and explore news with AI-powered insights.</p>
            </div>
            
            <div class="tutorial-steps">
              <div class="tutorial-step">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon">💬</div>
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
                  <div class="tutorial-icon">🎨</div>
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
                  <div class="tutorial-icon">📎</div>
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
                  <div class="tutorial-icon">🔊</div>
                  <h3>Audio Responses</h3>
                </div>
                <p>Toggle the audio button (🔊) in the header to hear AI responses read aloud. Perfect for multitasking or accessibility needs.</p>
              </div>
              
              <div class="tutorial-step">
                <div class="tutorial-step-header">
                  <div class="tutorial-icon">🎤</div>
                  <h3>Voice Input</h3>
                </div>
                <p>Click the microphone button (🎤) to speak your questions instead of typing. Great for hands-free use and faster interactions!</p>
              </div>
            </div>
            
            <div class="tutorial-tips">
              <h4>💡 Pro Tips</h4>
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

    const wrap = this.root.querySelector('.wrap');
    const launcher = this.root.querySelector('.launcher');
    const closeBtn = this.root.querySelector('.close');
    const input = this.root.querySelector('#chatInput');
    const fileInput = this.root.querySelector('#fileInput');
    const fileUploadBtn = this.root.querySelector('#fileUploadBtn');
    const send = this.root.querySelector('#sendButton');
    const body = this.root.querySelector('.body');
    const head = this.root.querySelector('.head');
    const resizeHandle = this.root.querySelector('.resize-handle');
    const tip = this.root.querySelector('.tip');
    
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

    // Image generation is now fully handled by the backend
    // The generateImage() function has been removed - all messages go through ask()

    // Helper function to show error messages
    function showError(message) {
      const errorGroup = document.createElement('div');
      errorGroup.className = 'message-group ai-msg-group';
      const err = document.createElement('div');
      err.className = 'error';
      err.innerHTML = `<strong>⚠️ Error</strong><p>${message}</p>`;
      errorGroup.innerHTML = `
        <div class="message-avatar">
          <img src="/IMG_5794.PNG" alt="Noteworthy News" />
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
      const previewContainer = rootRef.querySelector('.file-preview-container');
      if (previewContainer) {
        previewContainer.remove();
      }

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
        
        // Prepare request body with files
        let requestBody;
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
          
          const fileData = await Promise.all(filePromises);
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
        
        console.log('API Success:', { reply: data.reply?.substring(0, 50) + '...', hasImage: !!(data.image && data.image.imageUrl), fullData: data });
        
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

        // If image was generated, add it to the response
        if (data.image && data.image.imageUrl) {
          console.log('Adding generated image to response:', data.image.imageUrl.substring(0, 50) + '...');
          console.log('Full image data:', data.image);
          
          // Create image container
          const imageContainer = document.createElement('div');
          imageContainer.style.cssText = 'margin: 12px 0; width: 100%;';
          
          const imageEl = document.createElement('img');
          imageEl.src = data.image.imageUrl;
          imageEl.alt = data.image.revisedPrompt || data.image.prompt || 'Generated image';
          imageEl.loading = 'lazy';
          imageEl.style.cssText = 'max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,.3); display: block; background: rgba(0,0,0,0.2);';
          
          // Add loading state
          imageEl.style.opacity = '0.7';
          imageEl.style.transition = 'opacity 0.3s ease';
          
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
            <img src="/IMG_5794.PNG" alt="Noteworthy News" />
          </div>
          <div class="message-content"></div>
        `;
        aiGroup.querySelector('.message-content').appendChild(replyContent);
        body.appendChild(aiGroup);

        body.scrollTop = body.scrollHeight;
        
        // Update chat history with user message and AI response (only on success)
        chatHistory.push({
          role: 'user',
          content: message || (filesToSend.length > 0 ? `[Uploaded ${filesToSend.length} file(s)]` : '')
        });
        chatHistory.push({
          role: 'assistant',
          content: text
        });
        
        // Keep only last 20 messages (10 exchanges) to avoid token limits
        if (chatHistory.length > 20) {
          chatHistory = chatHistory.slice(-20);
        }
        
        // Text-to-speech for AI response
        if (audioEnabled) {
          speakText(text);
        }
      } catch (e) {
        console.error('Ask function error:', e);
        
        // Don't add to chat history on error
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
        const inputContainer = rootRef.querySelector('.input');
        if (inputContainer) {
          // Check if file preview container exists
          let previewContainer = rootRef.querySelector('.file-preview-container');
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
      const previewContainer = rootRef.querySelector('.file-preview-container');
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
