/**
 * PostCard Component - X-style post card
 * Vanilla TypeScript implementation compatible with vanilla JS setup
 */

import { Post } from '../../lib/feed/types';
import { formatCount, formatRelativeTime, formatAbsoluteTime, highlightMatches } from '../../lib/feed/utils';

export interface PostCardOptions {
  searchQuery?: string;
  onCommentClick?: (postId: string) => void;
  onPostClick?: (post: Post) => void;
}

/**
 * Render a single post card
 */
export function renderPostCard(post: Post, options: PostCardOptions = {}): string {
  const { searchQuery = '', onCommentClick, onPostClick } = options;
  
  const textHtml = searchQuery 
    ? highlightMatches(post.text, searchQuery)
    : escapeHtml(post.text);
  
  const timestamp = formatRelativeTime(post.createdAt);
  const timestampTooltip = formatAbsoluteTime(post.createdAt);
  
  // Clamp text to lines (handled by CSS)
  const clampedText = truncateText(post.text, 200); // Rough character limit
  
  return `
    <article 
      class="feed-post-card" 
      data-post-id="${post.id}"
      data-post-pinned="${post.isPinned || false}"
      style="
        min-height: 360px;
        padding: 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        transition: background 0.2s ease;
        display: grid;
        grid-template-rows: auto 1fr auto;
      "
      onmouseover="this.style.background='rgba(255,255,255,0.03)'"
      onmouseout="this.style.background='transparent'"
    >
      <!-- Header: Avatar + Name + Handle + Time -->
      <div style="display: flex; gap: 0.75rem; margin-bottom: 0.75rem;">
        <a 
          href="https://x.com/newsnoteworthy" 
          target="_blank" 
          rel="noopener noreferrer"
          style="flex-shrink: 0; text-decoration: none;"
        >
          <img 
            src="${post.author.avatarUrl}" 
            alt="${escapeHtml(post.author.name)}"
            class="feed-avatar"
            style="
              width: 40px;
              height: 40px;
              border-radius: 50%;
              object-fit: cover;
              display: block;
            "
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <div 
            style="
              width: 40px;
              height: 40px;
              border-radius: 50%;
              background: linear-gradient(135deg, #1DA1F2 0%, #1a91da 100%);
              display: none;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              font-size: 1rem;
              color: white;
            "
          >NW</div>
        </a>
        
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
            <a 
              href="https://x.com/${post.author.handle}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="feed-author-name"
              style="
                font-weight: 700;
                font-size: 0.938rem;
                color: rgb(231, 233, 234);
                text-decoration: none;
                line-height: 1.25rem;
              "
              onmouseover="this.style.textDecoration='underline'"
              onmouseout="this.style.textDecoration='none'"
            >${escapeHtml(post.author.name)}</a>
            
            <span style="color: rgb(113, 118, 123); font-size: 0.938rem; line-height: 1.25rem;">
              @${post.author.handle}
            </span>
            
            ${post.author.verified ? `
              <span 
                style="color: rgb(29, 155, 240); font-size: 0.938rem;"
                title="Verified account"
                aria-label="Verified"
              >✓</span>
            ` : ''}
            
            <span style="color: rgb(113, 118, 123); font-size: 0.938rem; line-height: 1.25rem;">·</span>
            
            <a 
              href="${post.url}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="feed-timestamp"
              style="
                color: rgb(113, 118, 123);
                font-size: 0.938rem;
                text-decoration: none;
                line-height: 1.25rem;
              "
              title="${timestampTooltip}"
              onmouseover="this.style.textDecoration='underline'"
              onmouseout="this.style.textDecoration='none'"
            >${timestamp}</a>
            
            ${post.isPinned ? `
              <span 
                class="feed-pinned-badge"
                style="
                  color: rgb(113, 118, 123);
                  font-size: 0.75rem;
                  font-weight: 600;
                  text-transform: uppercase;
                  padding: 0.125rem 0.375rem;
                  background: rgba(255, 255, 255, 0.1);
                  border-radius: 4px;
                "
              >PINNED</span>
            ` : ''}
          </div>
        </div>
      </div>
      
      <!-- Body: Text + Media -->
      <div style="margin-bottom: 0.75rem;">
        <div 
          class="feed-post-text"
          style="
            color: rgb(231, 233, 234);
            font-size: 0.938rem;
            line-height: 1.375rem;
            white-space: pre-wrap;
            word-wrap: break-word;
            margin-bottom: 0.75rem;
            display: -webkit-box;
            -webkit-line-clamp: 6;
            -webkit-box-orient: vertical;
            overflow: hidden;
          "
        >${clampedText.replace(/\n/g, '<br>')}</div>
        
        ${post.media && post.media.length > 0 ? renderMedia(post.media) : ''}
      </div>
      
      <!-- Action Bar: Engagement Stats -->
      <div 
        class="feed-action-bar"
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 425px;
          padding-top: 0.5rem;
        "
      >
        ${renderEngagementBar(post, onCommentClick)}
      </div>
    </article>
  `;
}

/**
 * Render media gallery
 */
function renderMedia(media: Array<{ type: 'image' | 'video'; url: string; ratio?: number }>): string {
  if (media.length === 0) return '';
  
  if (media.length === 1) {
    const item = media[0];
    if (item.type === 'image') {
      return `
        <div 
          class="feed-media-single"
          style="
            width: 100%;
            max-height: 400px;
            border-radius: 16px;
            overflow: hidden;
            margin-bottom: 0.75rem;
            border: 1px solid rgba(255,255,255,0.08);
          "
        >
          <img 
            src="${item.url}" 
            alt="Post media"
            loading="lazy"
            style="
              width: 100%;
              height: auto;
              display: block;
              object-fit: cover;
            "
            onerror="this.style.display='none';"
          />
        </div>
      `;
    } else {
      return `
        <div 
          class="feed-media-video"
          style="
            width: 100%;
            max-height: 400px;
            border-radius: 16px;
            overflow: hidden;
            margin-bottom: 0.75rem;
            border: 1px solid rgba(255,255,255,0.08);
          "
        >
          <video 
            src="${item.url}" 
            controls
            style="width: 100%; height: auto; display: block;"
            onerror="this.style.display='none';"
          ></video>
        </div>
      `;
    }
  }
  
  // Multiple media items - grid layout
  const gridCols = media.length === 2 ? '1fr 1fr' : 'repeat(2, 1fr)';
  return `
    <div 
      class="feed-media-grid"
      style="
        display: grid;
        grid-template-columns: ${gridCols};
        gap: 2px;
        width: 100%;
        max-height: 400px;
        overflow: hidden;
        border-radius: 16px;
        margin-bottom: 0.75rem;
        border: 1px solid rgba(255,255,255,0.08);
      "
    >
      ${media.slice(0, 4).map((item, idx) => {
        const isLastIn3 = media.length === 3 && idx === 2;
        return `
          <div 
            style="
              aspect-ratio: ${isLastIn3 ? '2/1' : '1'};
              overflow: hidden;
              background: rgba(0,0,0,0.3);
              ${isLastIn3 ? 'grid-column: 1 / -1;' : ''}
            "
          >
            ${item.type === 'image' ? `
              <img 
                src="${item.url}" 
                alt="Post image ${idx + 1}"
                loading="lazy"
                style="width: 100%; height: 100%; object-fit: cover;"
                onerror="this.style.display='none';"
              />
            ` : `
              <video 
                src="${item.url}" 
                controls
                style="width: 100%; height: 100%; object-fit: cover;"
                onerror="this.style.display='none';"
              ></video>
            `}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Render engagement action bar
 */
function renderEngagementBar(
  post: Post, 
  onCommentClick?: (postId: string) => void
): string {
  const stats = post.stats;
  
  const buttons = [
    {
      icon: '💬',
      count: stats.comments,
      label: 'Comments',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(29, 155, 240)',
      onClick: onCommentClick ? `window.feedOpenCommentDrawer('${post.id}')` : undefined,
      href: onCommentClick ? undefined : post.url,
    },
    {
      icon: '🔄',
      count: stats.reposts,
      label: 'Reposts',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(0, 186, 124)',
      href: post.url,
    },
    {
      icon: '❤️',
      count: stats.likes,
      label: 'Likes',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(249, 24, 128)',
      href: post.url,
    },
    {
      icon: '👁️',
      count: stats.views,
      label: 'Views',
      color: 'rgb(113, 118, 123)',
      hoverColor: 'rgb(29, 155, 240)',
      href: post.url,
    },
  ];
  
  return buttons.map(btn => {
    const hrefAttr = btn.href ? `href="${btn.href}" target="_blank" rel="noopener noreferrer"` : '';
    const onClickAttr = btn.onClick ? `onclick="event.preventDefault(); ${btn.onClick}; return false;"` : '';
    const tag = btn.onClick ? 'button' : 'a';
    
    return `
      <${tag}
        ${hrefAttr}
        ${onClickAttr}
        class="feed-engagement-btn"
        style="
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          color: ${btn.color};
          text-decoration: none;
          border: none;
          background: transparent;
          border-radius: 50%;
          transition: all 0.2s ease;
          min-width: 36px;
          justify-content: flex-start;
          cursor: pointer;
          font-size: inherit;
        "
        title="${btn.label}: ${formatCount(btn.count)}"
        aria-label="${btn.label}"
        onmouseover="this.style.color='${btn.hoverColor}'; this.style.backgroundColor='rgba(29, 155, 240, 0.1)'"
        onmouseout="this.style.color='${btn.color}'; this.style.backgroundColor='transparent'"
      >
        <span style="font-size: 1.25rem; line-height: 1;">${btn.icon}</span>
        ${stats.comments !== undefined || stats.likes !== undefined || stats.reposts !== undefined || stats.views !== undefined ? `
          <span style="font-size: 0.813rem; line-height: 1; font-weight: 400;">${formatCount(btn.count)}</span>
        ` : ''}
      </${tag}>
    `;
  }).join('');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Truncate text roughly to character limit (exact line clamping handled by CSS)
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

