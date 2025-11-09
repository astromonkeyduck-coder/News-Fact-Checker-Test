/**
 * Comprehensive Analytics Tracker for Noteworthy News
 * Tracks: page views, clicks, time on site, scroll depth, user interactions, and more
 */

class AnalyticsTracker {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.pageStartTime = Date.now();
    this.lastActivity = Date.now();
    this.scrollDepth = 0;
    this.maxScrollDepth = 0;
    this.clicks = [];
    this.pageViews = [];
    this.interactions = [];
    this.isActive = true;
    
    // User fingerprinting (for unique visitor tracking)
    this.fingerprint = this.generateFingerprint();
    
    // Initialize tracking
    this.init();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateFingerprint() {
    // Create a simple fingerprint from available browser data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Noteworthy News Fingerprint', 2, 2);
    
    const fingerprint = {
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      canvasHash: canvas.toDataURL().substring(0, 100), // First 100 chars of canvas hash
      userAgent: navigator.userAgent,
    };
    
    return btoa(JSON.stringify(fingerprint)).substring(0, 32);
  }

  async log(dataType, data) {
    try {
      // Try to get user email from various sources
      let userEmail = null;
      let userName = null;
      
      // Check if user is logged in (Auth0)
      if (window.auth0 && typeof window.auth0.getUser === 'function') {
        try {
          const user = await window.auth0.getUser();
          if (user && user.email) {
            userEmail = user.email.toLowerCase().trim();
            userName = user.name || user.nickname || user.email.split('@')[0];
          }
        } catch (e) {
          // Not logged in or error
        }
      }
      
      // Check for email in newsletter input fields
      if (!userEmail) {
        const newsletterInputs = document.querySelectorAll('input[type="email"], .newsletter-input');
        for (const input of newsletterInputs) {
          if (input.value && input.value.includes('@')) {
            userEmail = input.value.toLowerCase().trim();
            break;
          }
        }
      }
      
      // Check for stored user info
      if (!userEmail && window.currentUser && window.currentUser.email) {
        userEmail = window.currentUser.email.toLowerCase().trim();
        userName = window.currentUser.name;
      }
      
      // Check localStorage for newsletter email
      if (!userEmail) {
        try {
          const storedEmail = localStorage.getItem('newsletterEmail') || localStorage.getItem('userEmail');
          if (storedEmail && storedEmail.includes('@')) {
            userEmail = storedEmail.toLowerCase().trim();
          }
        } catch (e) {
          // localStorage not available
        }
      }

      const fullData = {
        ...data,
        sessionId: this.sessionId,
        fingerprint: this.fingerprint,
        pageUrl: window.location.href,
        pageTitle: document.title,
        referrer: document.referrer,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        screen: {
          width: screen.width,
          height: screen.height,
        },
        timeOnSite: Date.now() - this.startTime,
        timeOnPage: Date.now() - this.pageStartTime,
        // Include user email/name if available
        ...(userEmail ? { email: userEmail, userEmail: userEmail } : {}),
        ...(userName ? { userName: userName, name: userName } : {}),
      };

      await fetch('/.netlify/functions/log-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataType,
          data: fullData,
        }),
      });
    } catch (error) {
      console.error('[Analytics] Failed to log:', error);
      // Silently fail - don't break the site
    }
  }

  init() {
    // Track page view
    this.trackPageView();

    // Track clicks
    document.addEventListener('click', (e) => {
      this.trackClick(e);
    }, true);

    // Track scroll depth
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.trackScroll();
      }, 100);
    });

    // Track time on page
    setInterval(() => {
      this.trackActivity();
    }, 30000); // Every 30 seconds

    // Track when user leaves page
    window.addEventListener('beforeunload', () => {
      this.trackPageExit();
    });

    // Track visibility changes (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackTabHidden();
      } else {
        this.trackTabVisible();
      }
    });

    // Track form interactions
    document.addEventListener('submit', (e) => {
      this.trackFormSubmit(e);
    });

    // Track input focus (but throttle it)
    let focusTimeout;
    document.addEventListener('focusin', (e) => {
      clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => {
        this.trackInputFocus(e);
      }, 500);
    });

    // Track mouse movements (heatmap data) - throttled
    let mouseMoveTimeout;
    document.addEventListener('mousemove', (e) => {
      clearTimeout(mouseMoveTimeout);
      mouseMoveTimeout = setTimeout(() => {
        this.trackMouseMove(e);
      }, 1000); // Only log every second
    });

    // Track errors
    window.addEventListener('error', (e) => {
      this.trackError(e);
    });

    // Track console errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      this.trackConsoleError(args);
      originalConsoleError.apply(console, args);
    };
  }

  trackPageView() {
    const pageData = {
      path: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      timestamp: new Date().toISOString(),
    };

    this.pageViews.push(pageData);
    this.log('page-view', pageData);
  }

  trackClick(e) {
    const clickData = {
      target: {
        tag: e.target.tagName,
        id: e.target.id || null,
        className: e.target.className || null,
        text: e.target.textContent?.substring(0, 100) || null, // First 100 chars
        href: e.target.href || null,
      },
      position: {
        x: e.clientX,
        y: e.clientY,
      },
      timestamp: new Date().toISOString(),
    };

    this.clicks.push(clickData);
    
    // Only log every 10th click to avoid spam
    if (this.clicks.length % 10 === 0) {
      this.log('click-batch', {
        clicks: this.clicks.slice(-10),
        totalClicks: this.clicks.length,
      });
      this.clicks = []; // Clear after logging
    }
  }

  trackScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

    if (scrollPercent > this.maxScrollDepth) {
      this.maxScrollDepth = scrollPercent;
      this.log('scroll-depth', {
        depth: Math.round(scrollPercent),
        maxDepth: Math.round(this.maxScrollDepth),
        scrollTop,
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
      });
    }
  }

  trackActivity() {
    const timeSinceLastActivity = Date.now() - this.lastActivity;
    this.log('activity-heartbeat', {
      timeSinceLastActivity,
      isActive: this.isActive,
      timeOnSite: Date.now() - this.startTime,
    });
  }

  trackPageExit() {
    // Use sendBeacon for reliable delivery on page unload
    const exitData = {
      timeOnPage: Date.now() - this.pageStartTime,
      timeOnSite: Date.now() - this.startTime,
      maxScrollDepth: Math.round(this.maxScrollDepth),
      clicks: this.clicks.length,
      pageViews: this.pageViews.length,
    };

    const blob = new Blob([JSON.stringify({
      dataType: 'page-exit',
      data: exitData,
    })], { type: 'application/json' });

    navigator.sendBeacon('/.netlify/functions/log-data', blob);
  }

  trackTabHidden() {
    this.isActive = false;
    this.log('tab-hidden', {
      timeOnPage: Date.now() - this.pageStartTime,
    });
  }

  trackTabVisible() {
    this.isActive = true;
    this.lastActivity = Date.now();
    this.log('tab-visible', {
      timeOnPage: Date.now() - this.pageStartTime,
    });
  }

  trackFormSubmit(e) {
    const formData = {
      formId: e.target.id || null,
      formAction: e.target.action || null,
      formMethod: e.target.method || null,
      fieldCount: e.target.elements.length,
    };

    this.log('form-submit', formData);
  }

  trackInputFocus(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      this.log('input-focus', {
        inputType: e.target.type || 'text',
        inputId: e.target.id || null,
        inputName: e.target.name || null,
        inputPlaceholder: e.target.placeholder || null,
      });
    }
  }

  trackMouseMove(e) {
    // Only log occasionally to avoid spam
    if (Math.random() < 0.1) { // 10% of mouse moves
      this.log('mouse-move', {
        x: e.clientX,
        y: e.clientY,
        timestamp: new Date().toISOString(),
      });
    }
  }

  trackError(e) {
    this.log('javascript-error', {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      error: e.error?.toString() || null,
      stack: e.error?.stack || null,
    });
  }

  trackConsoleError(args) {
    // Only log occasionally to avoid spam
    if (Math.random() < 0.1) {
      this.log('console-error', {
        args: args.map(arg => String(arg).substring(0, 200)), // Limit length
      });
    }
  }

  // Public method to track custom events
  trackEvent(eventName, eventData = {}) {
    this.log('custom-event', {
      eventName,
      ...eventData,
    });
  }
}

// Initialize global tracker
if (typeof window !== 'undefined') {
  window.analyticsTracker = new AnalyticsTracker();
  
  // Make it available globally for easy access
  window.trackEvent = (eventName, eventData) => {
    window.analyticsTracker.trackEvent(eventName, eventData);
  };
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyticsTracker;
}

