/**
 * Utility functions for feed
 */

/**
 * Format large numbers with abbreviations (K, M, B)
 */
export function formatCount(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '0';
  if (n < 1000) return n.toString();
  if (n < 1000000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  if (n < 1000000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
}

/**
 * Format relative time (e.g., "1h", "2d", "3w")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return `${diffSec}s`;
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  if (diffWeek < 4) return `${diffWeek}w`;
  if (diffMonth < 12) return `${diffMonth}mo`;
  return `${diffYear}y`;
}

/**
 * Format absolute time for tooltip
 */
export function formatAbsoluteTime(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

/**
 * Search posts by query (searches text, tags, author.handle)
 */
export function searchPosts(posts: Array<{ text: string; tags?: string[]; author: { handle: string } }>, query: string): typeof posts {
  if (!query.trim()) return posts;
  
  const lowerQuery = query.toLowerCase();
  
  return posts.filter(post => {
    const textMatch = post.text.toLowerCase().includes(lowerQuery);
    const handleMatch = post.author.handle.toLowerCase().includes(lowerQuery);
    const tagMatch = post.tags?.some(tag => tag.toLowerCase().includes(lowerQuery));
    const hashtagMatch = post.text.toLowerCase().includes(`#${lowerQuery}`);
    
    return textMatch || handleMatch || tagMatch || hashtagMatch;
  });
}

/**
 * Highlight search matches in text
 */
export function highlightMatches(text: string, query: string): string {
  if (!query.trim()) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Track analytics event (no-op if analytics not configured)
 */
export function track(event: string, properties?: Record<string, any>): void {
  // Check if analytics is available (e.g., gtag, dataLayer, custom)
  if (typeof window !== 'undefined') {
    // Example: Google Analytics
    if ((window as any).gtag) {
      (window as any).gtag('event', event, properties);
    }
    // Example: Custom analytics
    if ((window as any).track) {
      (window as any).track(event, properties);
    }
    // Example: Console log for debugging
    console.log('[Analytics]', event, properties);
  }
}

