/**
 * EmptyState Component - No posts found message
 */

export interface EmptyStateOptions {
  message?: string;
  retryAction?: () => void;
}

/**
 * Render empty state
 */
export function renderEmptyState(options: EmptyStateOptions = {}): string {
  const { message = 'No posts found.', retryAction } = options;
  
  return `
    <div 
      class="feed-empty-state"
      style="
        padding: 4rem 2rem;
        text-align: center;
        color: rgba(255, 255, 255, 0.7);
      "
    >
      <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
      <h3 style="color: rgba(255, 255, 255, 0.9); margin-bottom: 0.5rem; font-size: 1.25rem;">${escapeHtml(message)}</h3>
      ${retryAction ? `
        <button
          onclick="${retryAction.toString().replace(/"/g, '&quot;')}();"
          style="
            margin-top: 1rem;
            padding: 0.75rem 1.5rem;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            color: #fff;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          "
          onmouseover="this.style.background='rgba(255, 255, 255, 0.15)'"
          onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'"
        >Try Again</button>
      ` : ''}
    </div>
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

