/**
 * Comment Section Component for Noteworthy News
 * Allows authenticated users to comment on articles
 */

// vNext: Use logger utility (available via window.logger)
const logger = typeof window !== 'undefined' && window.logger ? window.logger : {
  log: (...args) => console.log(...args),
  debug: (...args) => console.debug(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args)
};

class CommentSection {
  constructor(articleId) {
    this.articleId = articleId;
    this.comments = [];
    this.commentKey = `comments_${articleId}`;
    this.init();
  }
  
  async init() {
    // Check if user is authenticated
    this.user = null;
    if (window.auth0 && typeof window.auth0.isAuthenticated === 'function') {
      try {
        // Wrapper returns boolean, not a promise
        const isAuth = window.auth0.isAuthenticated();
        if (isAuth) {
          this.user = await window.auth0.getUser();
        }
      } catch (err) {
        logger.debug('[Comments] Could not check auth:', err);
      }
    }
    
    // Load existing comments from API (visible across all devices)
    await this.loadComments();
    this.render();
  }
  
  async loadComments() {
    try {
      // Determine API endpoint (handle localhost vs production)
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const endpoint = isLocalhost 
        ? `http://localhost:8888/.netlify/functions/comments-api?articleId=${encodeURIComponent(this.articleId)}`
        : `/.netlify/functions/comments-api?articleId=${encodeURIComponent(this.articleId)}`;
      
      logger.debug('[Comments] Loading comments from:', endpoint);
      const response = await fetch(endpoint);
      
      if (response.ok) {
        const data = await response.json();
        this.comments = data.comments || [];
        logger.debug('[Comments] Loaded', this.comments.length, 'comments from API');
      } else {
        // If API fails, fall back to localStorage for backward compatibility
        logger.warn('[Comments] API load failed (status:', response.status, '), trying localStorage');
        const saved = localStorage.getItem(this.commentKey);
        if (saved) {
          this.comments = JSON.parse(saved);
          logger.debug('[Comments] Loaded', this.comments.length, 'comments from localStorage');
        }
      }
    } catch (err) {
      logger.error('[Comments] Error loading comments:', err);
      // Fall back to localStorage
      try {
        const saved = localStorage.getItem(this.commentKey);
        if (saved) {
          this.comments = JSON.parse(saved);
          logger.debug('[Comments] Loaded', this.comments.length, 'comments from localStorage (fallback)');
        }
      } catch (localErr) {
        this.comments = [];
      }
    }
  }
  
  async saveComments() {
    // Comments are now saved via API, but keep this for backward compatibility
    try {
      localStorage.setItem(this.commentKey, JSON.stringify(this.comments));
    } catch (err) {
      logger.error('[Comments] Error saving to localStorage:', err);
    }
  }
  
  async addComment(text, authorName = null) {
    if (!text || text.trim().length < 3) {
      alert('Comment must be at least 3 characters');
      return;
    }
    
    // Determine author info
    let author, authorEmail, authorId;
    
    if (this.user) {
      // Logged in user - use their account info (no anonymous option)
      author = this.user.name || this.user.nickname || this.user.email?.split('@')[0] || 'User';
      authorEmail = this.user.email || '';
      authorId = this.user.sub || this.user.email || '';
    } else {
      // Anonymous user - use provided name or default to "Anonymous"
      author = (authorName && authorName.trim()) ? authorName.trim() : 'Anonymous';
      authorEmail = '';
      authorId = 'anonymous';
    }
    
    try {
      // Determine API endpoint (handle localhost vs production)
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const endpoint = isLocalhost 
        ? 'http://localhost:8888/.netlify/functions/comments-api'
        : '/.netlify/functions/comments-api';
      
      logger.debug('[Comments] Posting comment to:', endpoint);
      
      // Save to API (visible across all devices)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleId: this.articleId,
          text: text.trim(),
          author: author,
          authorEmail: authorEmail,
          authorId: authorId,
        }),
      });
      
      logger.debug('[Comments] Response status:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        logger.debug('[Comments] Comment saved successfully:', data);
        // Add new comment to beginning of array
        this.comments.unshift(data.comment);
        // Also save to localStorage for backward compatibility
        this.saveComments();
        this.render();
      } else {
        let errorMessage = 'Failed to post comment. Please try again.';
        let errorData = null;
        try {
          errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          logger.error('[Comments] API error response:', errorData);
        } catch (parseErr) {
          const text = await response.text();
          logger.error('[Comments] API error (non-JSON):', text, 'Status:', response.status);
          errorMessage = `Error ${response.status}: ${text || response.statusText || errorMessage}`;
        }
        
        // If it's an author name validation error, show specific message
        if (errorData && errorData.field === 'author') {
          alert(errorMessage);
          // Focus back on the textarea so user can see the error
          const form = document.querySelector(`#comment-section-${this.articleId} .comment-form`);
          if (form) {
            const textarea = form.querySelector('textarea');
            if (textarea) textarea.focus();
          }
        } else {
        alert(errorMessage);
        }
      }
    } catch (err) {
      logger.error('[Comments] Network error posting comment:', err);
      logger.error('[Comments] Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      // Fallback: save to localStorage only (won't be visible on other devices)
      const comment = {
        id: Date.now().toString(),
        text: text.trim(),
        author: author,
        authorEmail: authorEmail,
        authorId: authorId,
        timestamp: Date.now(),
        date: new Date().toLocaleDateString()
      };
      this.comments.unshift(comment);
      this.saveComments();
      this.render();
      alert('Comment saved locally, but may not be visible on other devices. Check your connection and try refreshing the page.');
    }
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
    
    // vNext: Use DOM creation instead of innerHTML for security
    container.innerHTML = ''; // Clear first
    
    // Create header
    const header = document.createElement('div');
    header.className = 'comments-header';
    const headerTitle = document.createElement('h3');
    headerTitle.textContent = `Comments (${this.comments.length})`;
    header.appendChild(headerTitle);
    container.appendChild(header);
    
    // Create form
    const form = document.createElement('form');
    form.className = 'comment-form';
    form.onsubmit = (e) => {
      e.preventDefault();
      this.submitComment(form);
    };
    
    // Add name field for anonymous users (not shown if logged in)
    if (!isAuthenticated) {
      const nameWrapper = document.createElement('div');
      nameWrapper.className = 'comment-name-wrapper';
      
      const nameLabel = document.createElement('label');
      nameLabel.className = 'comment-name-label';
      nameLabel.textContent = 'Name (optional)';
      nameLabel.setAttribute('for', `comment-name-${this.articleId}`);
      nameWrapper.appendChild(nameLabel);
      
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.id = `comment-name-${this.articleId}`;
      nameInput.className = 'comment-name-input';
      nameInput.placeholder = 'Your name or leave blank for anonymous';
      nameInput.maxLength = 30;
      nameWrapper.appendChild(nameInput);
      
      form.appendChild(nameWrapper);
    }
    
    const textarea = document.createElement('textarea');
    textarea.className = 'comment-input';
    textarea.placeholder = 'Share your thoughts...';
    textarea.required = true;
    textarea.minLength = 3;
    textarea.rows = 3;
    textarea.setAttribute('data-preserve-on-render', 'true');
    if (preservedText) {
      textarea.value = preservedText;
    }
    form.appendChild(textarea);
    
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'comment-submit-btn';
    submitBtn.textContent = 'Post Comment';
    form.appendChild(submitBtn);
    container.appendChild(form);
    
    // Create comments list
    const commentsList = document.createElement('div');
    commentsList.className = 'comments-list';
    
    if (this.comments.length === 0) {
      const noComments = document.createElement('p');
      noComments.className = 'no-comments';
      noComments.textContent = 'No comments yet. Be the first to comment!';
      commentsList.appendChild(noComments);
    } else {
      this.comments.forEach(comment => {
        const isOwnComment = isAuthenticated && userId && (comment.authorId === userId || comment.authorEmail === this.user?.email);
        
        const commentItem = document.createElement('div');
        commentItem.className = 'comment-item';
        commentItem.setAttribute('data-comment-id', comment.id);
        
        const authorDiv = document.createElement('div');
        authorDiv.className = 'comment-author';
        
        const authorStrong = document.createElement('strong');
        authorStrong.textContent = this.escapeHtml(comment.author);
        authorDiv.appendChild(authorStrong);
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'comment-date';
        dateSpan.textContent = comment.date;
        authorDiv.appendChild(dateSpan);
        
        if (isOwnComment) {
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'comment-delete-btn';
          deleteBtn.title = 'Delete your comment';
          deleteBtn.setAttribute('aria-label', 'Delete comment');
          deleteBtn.textContent = '🗑️';
          deleteBtn.onclick = () => this.deleteComment(comment.id);
          authorDiv.appendChild(deleteBtn);
        }
        
        commentItem.appendChild(authorDiv);
        
        const textDiv = document.createElement('div');
        textDiv.className = 'comment-text';
        textDiv.textContent = this.escapeHtml(comment.text);
        commentItem.appendChild(textDiv);
        
        commentsList.appendChild(commentItem);
      });
    }
    
    container.appendChild(commentsList);
    
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
      // Get author name if anonymous user
      const nameInput = form.querySelector('.comment-name-input');
      const authorName = nameInput ? nameInput.value.trim() : null;
      
      this.addComment(text, authorName);
      textarea.value = '';
      if (nameInput) nameInput.value = '';
    }
  }
  
  async deleteComment(commentId) {
    // Find the comment
    const commentIndex = this.comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) return;
    
    const comment = this.comments[commentIndex];
    
    // If user is signed in, verify it's their own comment
    if (this.user) {
      const userId = this.user.sub || this.user.email;
      // Verify it's the user's own comment
      if (comment.authorId !== userId && comment.authorEmail !== this.user.email) {
        alert('You can only delete your own comments');
        return;
      }
    } else {
      // For anonymous comments, allow deletion if it's an anonymous comment
      if (comment.authorId !== 'anonymous' && comment.authorEmail) {
        alert('You can only delete your own comments');
        return;
      }
    }
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }
    
    try {
      // Delete via API
      const response = await fetch('/.netlify/functions/comments-api', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': this.user.email || '',
        },
        body: JSON.stringify({
          articleId: this.articleId,
          commentId: commentId,
          authorId: userId,
        }),
      });
      
      if (response.ok) {
        // Remove comment from array
        this.comments.splice(commentIndex, 1);
        // Save updated comments to localStorage for backward compatibility
        this.saveComments();
        // Re-render
        this.render();
        logger.debug(`[Comments] Deleted comment ${commentId}`);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete comment. Please try again.');
      }
    } catch (err) {
      logger.error('[Comments] Error deleting comment:', err);
      // Fallback: delete from local array only
      this.comments.splice(commentIndex, 1);
      this.saveComments();
      this.render();
      alert('Comment removed locally, but may still appear on other devices.');
    }
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Expose CommentSection globally
window.CommentSection = CommentSection;

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
        // Wrapper returns boolean, not a promise
        const isAuth = window.auth0.isAuthenticated();
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
                }).catch(err => logger.debug('[Comments] Could not update user:', err));
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

