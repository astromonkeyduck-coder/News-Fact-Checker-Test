/**
 * Social Share Component
 * Provides easy sharing to social media platforms
 * 
 * Usage:
 *   <SocialShare 
 *     url="https://noteworthynews.co/article"
 *     title="Article Title"
 *     description="Article description"
 *   />
 */

import React, { useState } from 'react';

export default function SocialShare({ 
  url = typeof window !== 'undefined' ? window.location.href : '',
  title = '',
  description = '',
  image = '',
  className = ''
}) {
  const [copied, setCopied] = useState(false);

  const shareUrl = encodeURIComponent(url);
  const shareTitle = encodeURIComponent(title);
  const shareDescription = encodeURIComponent(description);
  const shareText = encodeURIComponent(`${title} - ${description}`);

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
    reddit: `https://reddit.com/submit?url=${shareUrl}&title=${shareTitle}`,
    email: `mailto:?subject=${shareTitle}&body=${shareDescription}%20${shareUrl}`
  };

  const handleShare = (platform) => {
    const link = shareLinks[platform];
    if (link) {
      window.open(link, '_blank', 'width=600,height=400');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url
        });
      } catch (err) {
        // User cancelled or error occurred
        console.log('Share cancelled or failed');
      }
    }
  };

  const buttonStyle = {
    padding: '0.5rem 1rem',
    margin: '0.25rem',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.875rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'all 0.2s'
  };

  const hoverStyle = {
    background: 'rgba(255, 255, 255, 0.2)',
    transform: 'translateY(-1px)'
  };

  return (
    <div className={`social-share ${className}`} style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.5rem',
      alignItems: 'center'
    }}>
      <span style={{ marginRight: '0.5rem', color: 'rgba(255, 255, 255, 0.7)' }}>
        Share:
      </span>

      {/* Native Share (mobile) */}
      {navigator.share && (
        <button
          onClick={handleNativeShare}
          style={buttonStyle}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, hoverStyle)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
          aria-label="Share"
        >
          📤 Share
        </button>
      )}

      {/* Twitter */}
      <button
        onClick={() => handleShare('twitter')}
        style={buttonStyle}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, hoverStyle)}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
        aria-label="Share on Twitter"
      >
        🐦 Twitter
      </button>

      {/* Facebook */}
      <button
        onClick={() => handleShare('facebook')}
        style={buttonStyle}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, hoverStyle)}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
        aria-label="Share on Facebook"
      >
        📘 Facebook
      </button>

      {/* LinkedIn */}
      <button
        onClick={() => handleShare('linkedin')}
        style={buttonStyle}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, hoverStyle)}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
        aria-label="Share on LinkedIn"
      >
        💼 LinkedIn
      </button>

      {/* Reddit */}
      <button
        onClick={() => handleShare('reddit')}
        style={buttonStyle}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, hoverStyle)}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
        aria-label="Share on Reddit"
      >
        🤖 Reddit
      </button>

      {/* Email */}
      <button
        onClick={() => handleShare('email')}
        style={buttonStyle}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, hoverStyle)}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, buttonStyle)}
        aria-label="Share via Email"
      >
        📧 Email
      </button>

      {/* Copy Link */}
      <button
        onClick={handleCopyLink}
        style={{
          ...buttonStyle,
          ...(copied ? { background: 'rgba(46, 204, 113, 0.3)' } : {})
        }}
        onMouseEnter={(e) => !copied && Object.assign(e.currentTarget.style, hoverStyle)}
        onMouseLeave={(e) => !copied && Object.assign(e.currentTarget.style, buttonStyle)}
        aria-label="Copy link"
      >
        {copied ? '✓ Copied!' : '🔗 Copy Link'}
      </button>
    </div>
  );
}

