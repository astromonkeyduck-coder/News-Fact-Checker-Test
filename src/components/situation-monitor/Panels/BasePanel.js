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

    // Container is already the body element - just set initial empty state
    // Don't create nested structure, just show empty state
    container.innerHTML = `
      <div class="sitmon-empty-state">
        <svg class="sitmon-empty-state-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
          <path d="M3 9h18M9 3v18" stroke="currentColor" stroke-width="2" opacity="0.5"/>
          <path d="M7 15l4-4 4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
        </svg>
        <p>No data yet – will refresh automatically</p>
      </div>
    `;
  }

  setLoading(loading) {
    this.loading = loading;
    const container = document.getElementById(this.containerId);
    if (!container) return;
    
    if (loading) {
      // Show loading state - replace container content
      container.innerHTML = `
        <div class="sitmon-empty-state">
          <div class="sitmon-spinner"></div>
          <p>Loading...</p>
        </div>
      `;
    }
    // Note: Loading state is cleared when render() is called
  }

  setError(error) {
    this.error = error;
    const container = document.getElementById(this.containerId);
    if (!container) return;
    
    if (error) {
      // Show error state - replace container content
      const errorMessage = typeof error === 'string' ? error : (error.message || 'An error occurred');
      container.innerHTML = `
        <div class="sitmon-empty-state">
          <svg class="sitmon-empty-state-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
            <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p class="sitmon-error-message">${this.escapeHtml(errorMessage)}</p>
          <button class="sitmon-retry-btn">Retry</button>
        </div>
      `;
      
      // Bind retry button to call this.retry() instead of reloading page
      const retryBtn = container.querySelector('.sitmon-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => this.retry());
      }
    }
    // Note: Error state is cleared when render() is called
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    // The container IS the content element (sitmon-card-body)
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.warn(`[BasePanel] Container #${this.containerId} not found`);
      return null;
    }
    // Container is already the body element, return it directly
    return container;
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
