/**
 * Keyboard Shortcuts Utility
 * Provides keyboard navigation and shortcuts throughout the app
 */

/**
 * Initialize keyboard shortcuts
 */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', handleKeyboardShortcut);
  
  // Show help modal on '?' key
  let helpModal = null;
  
  function handleKeyboardShortcut(e) {
    // #region agent log
    if (e.key === 'k' || e.key === 'K') {
      fetch('http://127.0.0.1:7242/ingest/1b084fb8-c291-4b9d-9bfc-ed7a542cc0dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'keyboard-shortcuts.js:15',message:'K key pressed in keyboard handler',data:{key:e.key,targetTagName:e.target.tagName,targetType:e.target.type,isContentEditable:e.target.isContentEditable,activeElementTag:document.activeElement?.tagName,activeElementType:document.activeElement?.type,isShadowRoot:!!e.target.getRootNode?.()?.host},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    // Don't trigger if typing in input, textarea, or contenteditable
    const target = e.target;
    const activeElement = document.activeElement;
    
    // Check if active element is an input (handles Shadow DOM inputs)
    const isActiveInput = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.isContentEditable
    );
    
    // Check if target is an input (handles regular inputs)
    const isTargetInput = (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('[contenteditable="true"]')
    );
    
    // Check if target is inside Shadow DOM and the shadow root contains an input
    let isShadowInput = false;
    try {
      const rootNode = target.getRootNode();
      if (rootNode && rootNode !== document && rootNode.host) {
        // This is a Shadow DOM, check if active element is inside it
        const shadowRoot = rootNode;
        if (shadowRoot.contains && activeElement) {
          isShadowInput = shadowRoot.contains(activeElement) && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA'
          );
        }
      }
    } catch (err) {
      // Ignore errors accessing shadow root
    }
    
    // #region agent log
    if (e.key === 'k' || e.key === 'K') {
      fetch('http://127.0.0.1:7242/ingest/1b084fb8-c291-4b9d-9bfc-ed7a542cc0dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'keyboard-shortcuts.js:18',message:'Input check before return',data:{isTargetInput,isActiveInput,isShadowInput,willReturn:isTargetInput||isActiveInput||isShadowInput},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
    }
    // #endregion
    
    if (isTargetInput || isActiveInput || isShadowInput) {
      // #region agent log
      if (e.key === 'k' || e.key === 'K') {
        fetch('http://127.0.0.1:7242/ingest/1b084fb8-c291-4b9d-9bfc-ed7a542cc0dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'keyboard-shortcuts.js:24',message:'Early return - input detected',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
      }
      // #endregion
      return;
    }

    // Don't trigger if modifier keys are pressed (except for specific shortcuts)
    if (e.ctrlKey || e.metaKey) {
      // Allow Ctrl/Cmd + K for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        focusSearch();
        return;
      }
      return;
    }

    switch (e.key) {
      case '/':
        // Focus search input
        e.preventDefault();
        focusSearch();
        break;

      case 'j':
      case 'ArrowDown':
        // Navigate to next article/item
        e.preventDefault();
        navigateNext();
        break;

      case 'k':
      case 'ArrowUp':
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1b084fb8-c291-4b9d-9bfc-ed7a542cc0dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'keyboard-shortcuts.js:52',message:'K key intercepted - preventing default',data:{targetTagName:e.target.tagName,activeElementTag:document.activeElement?.tagName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // Navigate to previous article/item
        e.preventDefault();
        navigatePrev();
        break;

      case '?':
        // Show keyboard shortcuts help
        e.preventDefault();
        showKeyboardShortcuts();
        break;

      case 'Escape':
        // Close modals, clear search
        handleEscape();
        break;

      case 'Enter':
        // Open focused article/item
        if (document.activeElement?.classList.contains('feed-post-card')) {
          e.preventDefault();
          document.activeElement.click();
        }
        break;
    }
  }

  /**
   * Focus search input
   */
  function focusSearch() {
    // Try different search input selectors
    const searchSelectors = [
      '#postSearchInput',
      '.feed-search-input',
      '.games-search-input',
      'input[type="search"]',
      'input[placeholder*="Search"]',
      'input[placeholder*="search"]'
    ];

    for (const selector of searchSelectors) {
      const input = document.querySelector(selector);
      if (input && input.offsetParent !== null) { // Check if visible
        input.focus();
        input.select();
        return;
      }
    }
  }

  /**
   * Navigate to next article/item
   */
  function navigateNext() {
    const items = document.querySelectorAll(
      '.feed-post-card, .article-card, [data-navigate="true"]'
    );
    if (items.length === 0) return;

    const currentIndex = Array.from(items).findIndex(
      item => item === document.activeElement || item.contains(document.activeElement)
    );

    const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
    items[nextIndex].focus();
    items[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Navigate to previous article/item
   */
  function navigatePrev() {
    const items = document.querySelectorAll(
      '.feed-post-card, .article-card, [data-navigate="true"]'
    );
    if (items.length === 0) return;

    const currentIndex = Array.from(items).findIndex(
      item => item === document.activeElement || item.contains(document.activeElement)
    );

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
    items[prevIndex].focus();
    items[prevIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Handle Escape key
   */
  function handleEscape() {
    // Close modals
    const modals = document.querySelectorAll('.modal, [role="dialog"]');
    modals.forEach(modal => {
      if (modal.style.display !== 'none') {
        const closeBtn = modal.querySelector('[data-close], .close, [aria-label*="close" i]');
        if (closeBtn) {
          closeBtn.click();
        }
      }
    });

    // Clear search if focused
    const searchInput = document.activeElement;
    if (searchInput && (
      searchInput.id === 'postSearchInput' ||
      searchInput.classList.contains('feed-search-input') ||
      searchInput.classList.contains('games-search-input')
    )) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.blur();
    }
  }

  /**
   * Show keyboard shortcuts help
   */
  function showKeyboardShortcuts() {
    // Remove existing modal if present
    if (helpModal) {
      helpModal.remove();
    }

    helpModal = document.createElement('div');
    helpModal.className = 'keyboard-shortcuts-modal';
    helpModal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(15, 23, 42, 0.98);
      border: 1px solid rgba(74, 144, 226, 0.3);
      border-radius: 12px;
      padding: 2rem;
      z-index: 10000;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
      color: #fff;
    `;

    helpModal.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h2 style="margin: 0; font-size: 1.5rem;">Keyboard Shortcuts</h2>
        <button 
          onclick="this.closest('.keyboard-shortcuts-modal').remove()"
          style="
            background: transparent;
            border: none;
            color: #fff;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.25rem 0.5rem;
          "
          aria-label="Close"
        >&times;</button>
      </div>
      <div style="display: grid; gap: 1rem;">
        <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
          <span><kbd style="padding: 0.25rem 0.5rem; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">/</kbd> or <kbd style="padding: 0.25rem 0.5rem; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">Ctrl+K</kbd></span>
          <span>Focus search</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
          <span><kbd style="padding: 0.25rem 0.5rem; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">J</kbd> or <kbd style="padding: 0.25rem 0.5rem; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">↓</kbd></span>
          <span>Next article</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
          <span><kbd style="padding: 0.25rem 0.5rem; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">K</kbd> or <kbd style="padding: 0.25rem 0.5rem; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">↑</kbd></span>
          <span>Previous article</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
          <span><kbd style="padding: 0.25rem 0.5rem; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">Enter</kbd></span>
          <span>Open focused article</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
          <span><kbd style="padding: 0.25rem 0.5rem; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">Esc</kbd></span>
          <span>Close modal / Clear search</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: rgba(255, 255, 255, 0.05); border-radius: 6px;">
          <span><kbd style="padding: 0.25rem 0.5rem; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">?</kbd></span>
          <span>Show this help</span>
        </div>
      </div>
      <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.1); text-align: center; font-size: 0.875rem; color: rgba(255, 255, 255, 0.7);">
        Press <kbd style="padding: 0.25rem 0.5rem; background: rgba(255, 255, 255, 0.1); border-radius: 4px;">Esc</kbd> to close
      </div>
    `;

    document.body.appendChild(helpModal);

    // Close on Escape
    const closeHandler = (e) => {
      if (e.key === 'Escape' && helpModal) {
        helpModal.remove();
        helpModal = null;
        document.removeEventListener('keydown', closeHandler);
      }
    };
    document.addEventListener('keydown', closeHandler);

    // Close on click outside
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        helpModal.remove();
        helpModal = null;
      }
    });
  }
}

// Auto-initialize on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKeyboardShortcuts);
  } else {
    initKeyboardShortcuts();
  }
}

// Export to window for global access if needed
if (typeof window !== 'undefined') {
  window.initKeyboardShortcuts = initKeyboardShortcuts;
}

