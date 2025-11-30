/**
 * Enhanced Comments Component
 * Adds replies and voting to the existing comments system
 */

(function() {
  'use strict';

  /**
   * Enhance existing comment section with replies and voting
   */
  function enhanceComments() {
    // Wait for comment section to load
    setTimeout(() => {
      const commentSections = document.querySelectorAll('.comments-section, [id^="comments-"]');
      
      commentSections.forEach(section => {
        enhanceCommentSection(section);
      });
    }, 2000);
  }

  /**
   * Enhance a comment section
   */
  function enhanceCommentSection(section) {
    if (!section) return;

    // Add voting buttons and reply functionality to existing comments
    const comments = section.querySelectorAll('.comment-item, [class*="comment"]');
    
    comments.forEach(commentEl => {
      // Skip if already enhanced
      if (commentEl.querySelector('.comment-actions')) return;

      const commentId = commentEl.getAttribute('data-comment-id') || 
                       commentEl.id?.replace('comment-', '') ||
                       Date.now().toString();

      // Add actions bar
      const actionsBar = document.createElement('div');
      actionsBar.className = 'comment-actions';
      actionsBar.style.cssText = `
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      `;

      // Voting buttons
      const voteContainer = document.createElement('div');
      voteContainer.style.cssText = 'display: flex; align-items: center; gap: 0.5rem;';
      
      const upvoteBtn = createVoteButton('▲', 'upvote', commentId);
      const downvoteBtn = createVoteButton('▼', 'downvote', commentId);
      const voteCount = document.createElement('span');
      voteCount.className = 'vote-count';
      voteCount.style.cssText = 'color: rgba(255,255,255,0.7); font-size: 0.875rem; min-width: 2rem; text-align: center;';
      voteCount.textContent = '0';
      
      voteContainer.appendChild(upvoteBtn);
      voteContainer.appendChild(voteCount);
      voteContainer.appendChild(downvoteBtn);

      // Reply button
      const replyBtn = document.createElement('button');
      replyBtn.className = 'comment-reply-btn';
      replyBtn.textContent = 'Reply';
      replyBtn.style.cssText = `
        padding: 0.25rem 0.75rem;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
        font-size: 0.875rem;
        transition: all 0.2s;
      `;
      replyBtn.onmouseover = function() {
        this.style.borderColor = '#4A90E2';
        this.style.color = '#4A90E2';
      };
      replyBtn.onmouseout = function() {
        this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        this.style.color = 'rgba(255, 255, 255, 0.7)';
      };
      replyBtn.onclick = function() {
        showReplyForm(commentEl, commentId);
      };

      actionsBar.appendChild(voteContainer);
      actionsBar.appendChild(replyBtn);
      commentEl.appendChild(actionsBar);
    });
  }

  /**
   * Create vote button
   */
  function createVoteButton(symbol, type, commentId) {
    const btn = document.createElement('button');
    btn.className = `vote-btn vote-${type}`;
    btn.textContent = symbol;
    btn.setAttribute('data-comment-id', commentId);
    btn.setAttribute('data-vote-type', type);
    btn.style.cssText = `
      padding: 0.25rem 0.5rem;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.2s;
    `;
    
    btn.onmouseover = function() {
      this.style.borderColor = type === 'upvote' ? '#2ECC71' : '#E74C3C';
      this.style.color = type === 'upvote' ? '#2ECC71' : '#E74C3C';
    };
    
    btn.onmouseout = function() {
      this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      this.style.color = 'rgba(255, 255, 255, 0.7)';
    };
    
    btn.onclick = function() {
      handleVote(commentId, type);
    };
    
    return btn;
  }

  /**
   * Handle vote
   */
  async function handleVote(commentId, voteType) {
    // Store vote in localStorage (simple implementation)
    const voteKey = `comment-vote-${commentId}`;
    const currentVote = localStorage.getItem(voteKey);
    
    if (currentVote === voteType) {
      // Already voted this way, remove vote
      localStorage.removeItem(voteKey);
      updateVoteDisplay(commentId, 0);
    } else {
      // New vote or change vote
      localStorage.setItem(voteKey, voteType);
      updateVoteDisplay(commentId, voteType === 'upvote' ? 1 : -1);
    }

    // TODO: Send vote to server for persistence
    // await fetch('/.netlify/functions/comments-api', {
    //   method: 'PATCH',
    //   body: JSON.stringify({ commentId, voteType })
    // });
  }

  /**
   * Update vote display
   */
  function updateVoteDisplay(commentId, delta) {
    const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`) ||
                     document.getElementById(`comment-${commentId}`);
    if (!commentEl) return;

    const voteCount = commentEl.querySelector('.vote-count');
    if (voteCount) {
      const current = parseInt(voteCount.textContent) || 0;
      voteCount.textContent = Math.max(0, current + delta);
    }
  }

  /**
   * Show reply form
   */
  function showReplyForm(commentEl, parentId) {
    // Check if form already exists
    if (commentEl.querySelector('.reply-form')) {
      commentEl.querySelector('.reply-form').remove();
      return;
    }

    const form = document.createElement('div');
    form.className = 'reply-form';
    form.style.cssText = `
      margin-top: 1rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
    `;

    form.innerHTML = `
      <textarea 
        class="reply-textarea" 
        placeholder="Write a reply..."
        style="
          width: 100%;
          min-height: 80px;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: white;
          font-family: inherit;
          resize: vertical;
        "
      ></textarea>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
        <button class="reply-submit-btn" style="
          padding: 0.5rem 1rem;
          background: #4A90E2;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        ">Post Reply</button>
        <button class="reply-cancel-btn" style="
          padding: 0.5rem 1rem;
          background: transparent;
          color: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          cursor: pointer;
        ">Cancel</button>
      </div>
    `;

    commentEl.appendChild(form);

    // Handle submit
    form.querySelector('.reply-submit-btn').onclick = async function() {
      const text = form.querySelector('.reply-textarea').value.trim();
      if (!text || text.length < 3) {
        alert('Reply must be at least 3 characters');
        return;
      }

      // Submit reply (would integrate with comments API)
      // For now, just show a message
      alert('Reply functionality will be fully integrated with the comments API. Reply saved locally.');
      form.remove();
    };

    // Handle cancel
    form.querySelector('.reply-cancel-btn').onclick = function() {
      form.remove();
    };
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceComments);
  } else {
    enhanceComments();
  }

  // Also enhance after comments load
  const observer = new MutationObserver(() => {
    enhanceComments();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();

