/**
 * CommentDrawer Component - Side panel/modal for comments
 */

export interface CommentDrawerOptions {
  postId: string;
  postUrl?: string;
  isOpen: boolean;
  onClose: () => void;
  onCommentSubmit?: (postId: string, text: string) => Promise<void>;
  isAuthenticated?: boolean;
}

/**
 * Render comment drawer
 */
export function renderCommentDrawer(options: CommentDrawerOptions): string {
  const { postId, postUrl, isOpen, onClose, onCommentSubmit, isAuthenticated = false } = options;
  
  if (!isOpen) return '';
  
  return `
    <div 
      class="feed-comment-drawer-overlay"
      style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
      "
      onclick="if (event.target === this) { ${onClose.toString().replace(/"/g, '&quot;')}(); }"
    >
      <div 
        class="feed-comment-drawer"
        style="
          width: 100%;
          max-width: 420px;
          height: 100%;
          background: rgba(15, 15, 35, 0.98);
          backdrop-filter: blur(20px);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          box-shadow: -4px 0 20px rgba(0,0,0,0.5);
          animation: slideInRight 0.3s ease;
        "
        onclick="event.stopPropagation();"
      >
        <!-- Header -->
        <div 
          style="
            padding: 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: space-between;
          "
        >
          <h2 style="margin: 0; font-size: 1.25rem; color: #fff; font-weight: 700;">Comments</h2>
          <button
            onclick="${onClose.toString().replace(/"/g, '&quot;')}();"
            style="
              background: transparent;
              border: none;
              color: rgba(255, 255, 255, 0.7);
              font-size: 1.5rem;
              cursor: pointer;
              padding: 0.5rem;
              line-height: 1;
            "
            aria-label="Close comments"
          >×</button>
        </div>
        
        <!-- Comments List -->
        <div 
          id="feed-comments-list-${postId}"
          class="feed-comments-list"
          style="
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
          "
        >
          <div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 2rem;">
            Loading comments...
          </div>
        </div>
        
        <!-- Comment Form (for signed-in users) -->
        ${isAuthenticated ? `
          <div 
            style="
              padding: 1rem;
              border-top: 1px solid rgba(255, 255, 255, 0.1);
            "
          >
            <form 
              id="feed-comment-form-${postId}"
              onsubmit="event.preventDefault(); window.feedSubmitComment('${postId}', this); return false;"
            >
              <textarea
                name="comment"
                placeholder="Add a comment..."
                required
                minlength="3"
                rows="3"
                style="
                  width: 100%;
                  padding: 0.75rem;
                  background: rgba(255, 255, 255, 0.1);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  border-radius: 8px;
                  color: #fff;
                  font-size: 0.938rem;
                  resize: vertical;
                  margin-bottom: 0.75rem;
                  font-family: inherit;
                "
              ></textarea>
              <button
                type="submit"
                style="
                  width: 100%;
                  padding: 0.75rem;
                  background: #4A90E2;
                  border: none;
                  border-radius: 8px;
                  color: #fff;
                  font-weight: 600;
                  cursor: pointer;
                  transition: background 0.2s;
                "
                onmouseover="this.style.background='#3a7bc8'"
                onmouseout="this.style.background='#4A90E2'"
              >Post Comment</button>
            </form>
          </div>
        ` : `
          <div 
            style="
              padding: 1rem;
              border-top: 1px solid rgba(255, 255, 255, 0.1);
              text-align: center;
            "
          >
            <button
              onclick="if (window.auth0Login) window.auth0Login();"
              style="
                width: 100%;
                padding: 0.75rem;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                color: #fff;
                font-weight: 600;
                cursor: pointer;
              "
            >Sign In to Comment</button>
          </div>
        `}
      </div>
    </div>
    
    <style>
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
        }
        to {
          transform: translateX(0);
        }
      }
      
      @media (max-width: 768px) {
        .feed-comment-drawer {
          max-width: 100% !important;
          border-left: none !important;
        }
      }
    </style>
    
    <script>
      (function() {
        // Close on ESC key
        function handleEscape(e) {
          if (e.key === 'Escape') {
            ${onClose.toString().replace(/"/g, '&quot;')}();
          }
        }
        
        document.addEventListener('keydown', handleEscape);
        
        // Load comments
        window.feedLoadComments('${postId}');
        
        // Cleanup on close
        window.feedCommentDrawerCleanup = function() {
          document.removeEventListener('keydown', handleEscape);
        };
      })();
    </script>
  `;
}

/**
 * Load and render comments for a post
 */
export async function loadComments(postId: string): Promise<void> {
  const container = document.getElementById(`feed-comments-list-${postId}`);
  if (!container) return;
  
  try {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const endpoint = isLocalhost
      ? `http://localhost:8888/.netlify/functions/comments-api?articleId=post-${postId}`
      : `/.netlify/functions/comments-api?articleId=post-${postId}`;
    
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error('Failed to load comments');
    
    const data = await response.json();
    const comments = data.comments || [];
    
    if (comments.length === 0) {
      container.innerHTML = `
        <div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 2rem;">
          No comments yet. Be the first to comment!
        </div>
      `;
      return;
    }
    
    container.innerHTML = comments.map((comment: any) => {
      const date = new Date(comment.date || comment.createdAt || Date.now()).toLocaleDateString();
      return `
        <div 
          class="feed-comment-item"
          style="
            padding: 1rem;
            margin-bottom: 1rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
          "
        >
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <strong style="color: #fff; font-size: 0.938rem;">${escapeHtml(comment.author || 'Anonymous')}</strong>
            <span style="color: rgba(255, 255, 255, 0.6); font-size: 0.813rem;">${date}</span>
          </div>
          <div style="color: rgba(255, 255, 255, 0.9); font-size: 0.938rem; line-height: 1.5;">
            ${escapeHtml(comment.text || '')}
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('[CommentDrawer] Error loading comments:', error);
    container.innerHTML = `
      <div style="color: rgba(255, 0, 0, 0.7); text-align: center; padding: 2rem;">
        Failed to load comments. Please try again.
      </div>
    `;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

