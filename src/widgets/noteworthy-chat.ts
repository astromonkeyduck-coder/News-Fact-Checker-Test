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
          border-radius: 20px; 
          overflow: hidden; 
          z-index: 2147483000;
          background: linear-gradient(135deg, 
            rgba(255,255,255,.95) 0%, 
            rgba(255,255,255,.90) 50%,
            rgba(248,250,252,.92) 100%);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255,255,255,.4);
          box-shadow: 
            0 20px 60px rgba(0,0,0,.15),
            0 0 0 1px rgba(255,255,255,.5) inset,
            0 8px 32px rgba(1,31,91,.08);
          display: none; 
          flex-direction: column;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }
        .wrap.open { 
          display: flex; 
          animation: slideUp 0.3s ease-out;
        }
        @keyframes slideUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
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
        }
        .head:active { cursor: grabbing; }
        
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
          padding: 6px 10px;
          margin: -6px -10px;
          border-radius: 8px;
          transition: all 0.2s;
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
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
        
        .image-generation-toggle {
          padding: 10px 14px;
          border-top: 1px solid rgba(0,0,0,.06);
          background: rgba(255,255,255,.5);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
          color: #666;
          gap: 8px;
        }
        
        .image-generation-toggle:hover {
          background: rgba(212,160,23,.08);
          color: #1a1a1a;
        }
        
        .image-generation-toggle.active {
          background: rgba(212,160,23,.15);
          color: #1a1a1a;
          font-weight: 600;
        }
        
        .image-generation-toggle .icon {
          font-size: 16px;
        }
        
        .image-generation-section {
          display: none;
          padding: 12px 16px;
          background: rgba(212,160,23,.08);
          border-top: 1px solid rgba(212,160,23,.2);
          border-bottom: 1px solid rgba(212,160,23,.2);
        }
        
        .image-generation-section.open {
          display: block;
        }
        
        .image-generation-section .info {
          font-size: 12px;
          color: #666;
          margin-bottom: 10px;
        }
        
        .image-generation-section button {
          width: 100%;
          padding: 10px 16px;
          border: 2px solid rgba(212,160,23,.4);
          border-radius: 8px;
          background: linear-gradient(135deg, #D4A017 0%, #F4C430 100%);
          color: #0f0f0f;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }
        
        .image-generation-section button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(212,160,23,.4);
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
          color: #666;
        }
        
        .image-loading .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(212,160,23,.2);
          border-top-color: #D4A017;
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
        
        .input input { 
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
        .input input:focus {
          border-color: #D4A017;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(212,160,23,.1);
        }
        .input input::placeholder {
          color: #999;
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
            width: calc(100vw - 16px) !important;
            height: calc(100vh - 80px) !important;
            max-width: calc(100vw - 16px) !important;
            max-height: calc(100vh - 80px) !important;
            left: 8px !important;
            top: 80px !important;
            border-radius: 20px 20px 0 0 !important;
            min-width: calc(100vw - 16px) !important;
            min-height: 300px !important;
          }
          
          .launcher {
            right: 12px;
            bottom: 12px;
            padding: 12px 18px;
            font-size: 13px;
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
          <button class="close" aria-label="Close chat">×</button>
        </div>
        
        <div class="body">
          <p class="tip">Ask about headlines, context, or fact-checks. I'm here to help you stay informed!</p>
        </div>
        
        <div class="image-generation-section" id="imageGenerationSection">
          <div class="info">Enter a description of the image you'd like to generate:</div>
          <input type="text" id="imagePromptInput" placeholder="e.g., a futuristic cityscape at sunset" style="width: 100%; padding: 10px 14px; border: 1.5px solid rgba(212,160,23,.3); border-radius: 8px; margin-bottom: 10px; font-size: 14px; background: rgba(255,255,255,.9); outline: none;" />
          <button type="button" id="generateImageBtn">🎨 Generate Image</button>
        </div>
        
        <div class="input">
          <input type="text" placeholder="Ask about a story or topic…" aria-label="Your question" id="chatInput" />
          <button type="button">Send</button>
        </div>
        
        <div class="image-generation-toggle" id="imageGenerationToggle">
          <span class="icon">🎨</span>
          <span>Generate Image</span>
        </div>
        
        <div class="resize-handle" aria-label="Resize chat" title="Drag to resize"></div>
      </div>
    `;

    const wrap = this.root.querySelector('.wrap') as HTMLElement;
    const launcher = this.root.querySelector('.launcher') as HTMLButtonElement;
    const closeBtn = this.root.querySelector('.close') as HTMLButtonElement;
    const input = this.root.querySelector('.input input') as HTMLInputElement;
    const send = this.root.querySelector('.input button') as HTMLButtonElement;
    const body = this.root.querySelector('.body') as HTMLElement;
    const head = this.root.querySelector('.head') as HTMLElement;
    const resizeHandle = this.root.querySelector('.resize-handle') as HTMLElement;
    const tip = this.root.querySelector('.tip') as HTMLElement;
    const imageGenerationToggle = this.root.querySelector('#imageGenerationToggle') as HTMLElement;
    const imageGenerationSection = this.root.querySelector('#imageGenerationSection') as HTMLElement;
    const imagePromptInput = this.root.querySelector('#imagePromptInput') as HTMLInputElement;
    const generateImageBtn = this.root.querySelector('#generateImageBtn') as HTMLButtonElement;
    
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
        <div class="message-avatar">NW</div>
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
        if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
          imageEndpoint = endpoint.replace('/.netlify/functions/noteworthy-chat', '/.netlify/functions/generate-image')
            .replace('/api/noteworthy', '/.netlify/functions/generate-image');
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
          <div class="message-avatar">NW</div>
          <div class="message-content"></div>
        `;
        (aiGroup.querySelector('.message-content') as HTMLElement).appendChild(replyContent);
        body.appendChild(aiGroup);

        body.scrollTop = body.scrollHeight;
        
        // Close the image generation section after successful generation
        if (imageGenerationSection) {
          imageGenerationSection.classList.remove('open');
          imageGenerationToggle.classList.remove('active');
        }
      } catch (e: any) {
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
        (aiGroup.querySelector('.message-content') as HTMLElement).appendChild(err);
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
        replyContent.innerHTML = text.split('\n').filter((l: string) => l.trim()).map((l: string) => `<p>${l}</p>`).join('');
        

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
        err.textContent = e?.message || 'Network error. Please try again.';
        
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
