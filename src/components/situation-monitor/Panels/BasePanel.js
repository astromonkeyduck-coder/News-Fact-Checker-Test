/**
 * Base Panel Component
 */

export class BasePanel {
  constructor(containerId, title, options = {}) {
    this.containerId = containerId;
    this.title = title;
    this.options = {
      collapsible: true,
      enabled: true,
      ...options
    };
    this.enabled = this.options.enabled;
    this.collapsed = false;
    this.loading = false;
    this.error = null;
    this._domInitialized = false; // Flag to prevent double initialization
    
    // Don't call init() here - let child classes handle initialization
    // This prevents double initialization when child classes override init()
  }

  init() {
    // Idempotent: only initialize DOM once
    if (this._domInitialized) {
      return;
    }
    
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`[BasePanel] Container #${this.containerId} not found`);
      return;
    }
    
    this._domInitialized = true;

    // New structure: panels render directly into card-body containers
    // No need to create panel wrapper - it's already in the HTML
    container.innerHTML = `
      <div class="sitmon-panel-loading" style="display: none;">
        <div class="sitmon-spinner"></div>
        <p>Loading...</p>
      </div>
      <div class="sitmon-panel-error" style="display: none;">
        <p class="sitmon-error-message"></p>
        <button class="sitmon-retry-btn">Retry</button>
      </div>
      <div class="sitmon-panel-content">
        <div class="sitmon-empty-state">
          <svg class="sitmon-empty-state-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
            <path d="M3 9h18M9 3v18" stroke="currentColor" stroke-width="2" opacity="0.5"/>
            <path d="M7 15l4-4 4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
          </svg>
          <p>No data yet – will refresh automatically</p>
        </div>
      </div>
    `;

    // Bind events
    const retryBtn = container.querySelector('.sitmon-retry-btn');

    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.retry());
    }
  }

  setLoading(loading) {
    this.loading = loading;
    const container = document.getElementById(this.containerId);
    if (!container) return;
    
    const loadingEl = container.querySelector('.sitmon-panel-loading');
    const contentEl = container.querySelector('.sitmon-panel-content');
    const errorEl = container.querySelector('.sitmon-panel-error');
    
    if (loading) {
      if (loadingEl) loadingEl.style.display = 'flex';
      if (contentEl) contentEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';
    } else {
      if (loadingEl) loadingEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'block';
    }
  }

  setError(error) {
    this.error = error;
    const container = document.getElementById(this.containerId);
    if (!container) return;
    
    const errorEl = container.querySelector('.sitmon-panel-error');
    const contentEl = container.querySelector('.sitmon-panel-content');
    const loadingEl = container.querySelector('.sitmon-panel-loading');
    const messageEl = errorEl?.querySelector('.sitmon-error-message');
    
    if (error) {
      if (errorEl) errorEl.style.display = 'block';
      if (contentEl) contentEl.style.display = 'none';
      if (loadingEl) loadingEl.style.display = 'none';
      if (messageEl) messageEl.textContent = error.message || 'An error occurred';
    } else {
      if (errorEl) errorEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'block';
    }
  }

  toggle() {
    // Toggle functionality removed - panels are always open in new design
    this.collapsed = !this.collapsed;
  }

  close() {
    // Close functionality removed - panels stay visible
    this.enabled = false;
  }

  retry() {
    this.setError(null);
    if (this.onRetry) {
      this.onRetry();
    }
  }

  getContentElement() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.warn(`[BasePanel] Container #${this.containerId} not found`);
      return null;
    }
    const contentEl = container.querySelector('.sitmon-panel-content');
    if (!contentEl) {
      console.warn(`[BasePanel] Content element not found in container #${this.containerId}`);
    }
    return contentEl;
  }
  
  showEmptyState(message = 'No data yet – will refresh automatically') {
    const contentEl = this.getContentElement();
    if (contentEl) {
      contentEl.innerHTML = `
        <div class="sitmon-empty-state">
          <svg class="sitmon-empty-state-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
            <path d="M3 9h18M9 3v18" stroke="currentColor" stroke-width="2" opacity="0.5"/>
            <path d="M7 15l4-4 4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
          </svg>
          <p>${message}</p>
        </div>
      `;
    }
  }

  render(content) {
    const contentEl = this.getContentElement();
    if (!contentEl) {
      console.error(`[BasePanel] Content element not found for container #${this.containerId}`);
      return;
    }
    if (typeof content === 'string') {
      contentEl.innerHTML = content;
    } else {
      contentEl.innerHTML = '';
      contentEl.appendChild(content);
    }
  }
}
