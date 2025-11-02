/**
 * Comment Section Component for Noteworthy News
 * Allows authenticated users to comment on articles
 */

class CommentSection {
  constructor(articleId) {
    this.articleId = articleId;
    this.comments = [];
    this.commentKey = `comments_${articleId}`;
    this.init();
  }
  
  async init() {
    // Load existing comments
    this.loadComments();
    
    // Check if user is authenticated
    this.user = null;
    if (window.auth0 && typeof window.auth0.isAuthenticated === 'function') {
      try {
        const isAuth = await window.auth0.isAuthenticated();
        if (isAuth) {
          this.user = await window.auth0.getUser();
        }
      } catch (err) {
        console.log('[Comments] Could not check auth:', err);
      }
    }
    
    this.render();
  }
  
  loadComments() {
    try {
      const saved = localStorage.getItem(this.commentKey);
      if (saved) {
        this.comments = JSON.parse(saved);
      }
    } catch (err) {
      console.error('[Comments] Error loading comments:', err);
      this.comments = [];
    }
  }
  
  saveComments() {
    try {
      localStorage.setItem(this.commentKey, JSON.stringify(this.comments));
    } catch (err) {
      console.error('[Comments] Error saving comments:', err);
    }
  }
  
  async addComment(text) {
    if (!this.user) {
      alert('Please sign in to comment');
      return;
    }
    
    if (!text || text.trim().length < 3) {
      alert('Comment must be at least 3 characters');
      return;
    }
    
    const comment = {
      id: Date.now().toString(),
      text: text.trim(),
      author: this.user.name || this.user.nickname || this.user.email?.split('@')[0] || 'Anonymous',
      authorEmail: this.user.email || '',
      authorId: this.user.sub || '',
      timestamp: Date.now(),
      date: new Date().toLocaleDateString()
    };
    
    this.comments.unshift(comment); // Add to beginning
    this.saveComments();
    this.render();
  }
  
  render() {
    const container = document.querySelector(`[data-article-id="${this.articleId}"] .comment-section`);
    if (!container) return;
    
    // Preserve textarea value if it exists and has focus/value to prevent losing user input
    const existingTextarea = container.querySelector('.comment-input');
    let preservedText = '';
    let hadFocus = false;
    if (existingTextarea) {
      preservedText = existingTextarea.value;
      hadFocus = document.activeElement === existingTextarea;
      // Don't re-render if user is actively typing
      if (hadFocus && preservedText.length > 0) {
        return; // Skip re-render to preserve user input
      }
    }
    
    const isAuthenticated = !!this.user;
    const userName = this.user ? (this.user.name || this.user.nickname || this.user.email?.split('@')[0]) : '';
    const userId = this.user ? (this.user.sub || this.user.email) : '';
    
    container.innerHTML = `
      <div class="comments-header">
        <h3>Comments (${this.comments.length})</h3>
        ${!isAuthenticated ? '<p class="comment-signin-prompt">Sign in to join the discussion</p>' : ''}
      </div>
      
      ${isAuthenticated ? `
        <form class="comment-form" onsubmit="event.preventDefault(); window.commentSections['${this.articleId}'].submitComment(this);">
          <textarea 
            class="comment-input" 
            placeholder="Share your thoughts..." 
            required 
            minlength="3"
            rows="3"
            data-preserve-on-render="true">${this.escapeHtml(preservedText)}</textarea>
          <button type="submit" class="comment-submit-btn">Post Comment</button>
        </form>
      ` : `
        <div class="comment-signin-cta">
          <button class="comment-signin-btn" onclick="window.auth0Login && window.auth0Login()">Sign In to Comment</button>
        </div>
      `}
      
      <div class="comments-list">
        ${this.comments.length === 0 ? '<p class="no-comments">No comments yet. Be the first to comment!</p>' : ''}
        ${this.comments.map(comment => {
          const isOwnComment = isAuthenticated && userId && (comment.authorId === userId || comment.authorEmail === this.user?.email);
          return `
          <div class="comment-item" data-comment-id="${comment.id}">
            <div class="comment-author">
              <strong>${this.escapeHtml(comment.author)}</strong>
              <span class="comment-date">${comment.date}</span>
              ${isOwnComment ? `<button class="comment-delete-btn" onclick="window.commentSections['${this.articleId}'].deleteComment('${comment.id}')" title="Delete your comment" aria-label="Delete comment">🗑️</button>` : ''}
            </div>
            <div class="comment-text">${this.escapeHtml(comment.text)}</div>
          </div>
        `;
        }).join('')}
      </div>
    `;
    
    // Restore textarea value and focus if it was preserved
    if (preservedText) {
      const newTextarea = container.querySelector('.comment-input');
      if (newTextarea) {
        newTextarea.value = preservedText;
        if (hadFocus) {
          newTextarea.focus();
          // Place cursor at end
          newTextarea.setSelectionRange(preservedText.length, preservedText.length);
        }
      }
    }
  }
  
  submitComment(form) {
    const textarea = form.querySelector('.comment-input');
    const text = textarea.value.trim();
    if (text) {
      this.addComment(text);
      textarea.value = '';
    }
  }
  
  deleteComment(commentId) {
    if (!this.user) {
      alert('You must be signed in to delete comments');
      return;
    }
    
    // Find the comment
    const commentIndex = this.comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) return;
    
    const comment = this.comments[commentIndex];
    const userId = this.user.sub || this.user.email;
    
    // Verify it's the user's own comment
    if (comment.authorId !== userId && comment.authorEmail !== this.user.email) {
      alert('You can only delete your own comments');
      return;
    }
    
    // Confirm deletion
    if (confirm('Are you sure you want to delete this comment?')) {
      // Remove comment from array
      this.comments.splice(commentIndex, 1);
      
      // Save updated comments
      this.saveComments();
      
      // Re-render
      this.render();
      
      console.log(`[Comments] Deleted comment ${commentId}`);
    }
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize comment sections for articles
window.commentSections = {};

// Auto-initialize comment sections
document.addEventListener('DOMContentLoaded', function() {
  const articleCards = document.querySelectorAll('.article-card');
  articleCards.forEach((card, index) => {
    const articleId = card.dataset.articleId || `article-${index}`;
    card.dataset.articleId = articleId;
    
    // Add comment section container if it doesn't exist
    if (!card.querySelector('.comment-section')) {
      const commentContainer = document.createElement('div');
      commentContainer.className = 'comment-section';
      commentContainer.setAttribute('data-article-id', articleId);
      card.appendChild(commentContainer);
    }
    
    // Initialize comment section
    window.commentSections[articleId] = new CommentSection(articleId);
  });
  
  // Re-initialize when Auth0 user state changes (but avoid while user is typing)
  if (window.auth0) {
    let lastAuthState = false;
    setInterval(async () => {
      try {
        const isAuth = await window.auth0.isAuthenticated();
        // Only refresh if auth state actually changed
        if (isAuth !== lastAuthState && Object.keys(window.commentSections).length > 0) {
          lastAuthState = isAuth;
          
          // Check if any textarea is focused before refreshing
          const anyTextareaFocused = document.activeElement && 
            document.activeElement.classList.contains('comment-input');
          
          // Only refresh if user isn't actively typing
          if (!anyTextareaFocused) {
            Object.values(window.commentSections).forEach(section => {
              // Update user info without full re-render if possible
              if (isAuth && window.auth0.getUser) {
                window.auth0.getUser().then(user => {
                  section.user = user;
                  // Only render if comment section is visible
                  const container = document.querySelector(`[data-article-id="${section.articleId}"] .comment-section`);
                  if (container && container.offsetParent !== null) {
                    section.render();
                  }
                }).catch(err => console.log('[Comments] Could not update user:', err));
              }
            });
          }
        }
      } catch (err) {
        // Silently ignore auth check errors
      }
    }, 5000); // Check less frequently (5 seconds instead of 3)
  }
});

