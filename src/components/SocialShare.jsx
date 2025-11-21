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
  image = 'https://noteworthynews.co/PREVIEWIMAGEBRUH.jpg',
  className = ''
}) {
  const [copied, setCopied] = useState(false);

  // Add music=true parameter to shared URLs to enable audio on shared links
  const addMusicParam = (urlToShare) => {
    try {
      const urlObj = new URL(urlToShare);
      urlObj.searchParams.set('music', 'true');
      return urlObj.toString();
    } catch (e) {
      // If URL parsing fails, append parameter manually
      const separator = urlToShare.includes('?') ? '&' : '?';
      return `${urlToShare}${separator}music=true`;
    }
  };

  const urlWithMusic = addMusicParam(url);
  const shareUrl = encodeURIComponent(urlWithMusic);
  // Remove text from shares to show only the image
  const shareTitle = '';
  const shareDescription = '';
  const shareText = '';

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
      // Copy URL with music parameter
      await navigator.clipboard.writeText(urlWithMusic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = urlWithMusic;
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
          title: '', // No text, just image
          text: '', // No text, just image
          url: urlWithMusic, // Use URL with music parameter
          ...(image && { files: [image] }) // Include image if available (some platforms support this)
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

