/**
 * Premium Features for Noteworthy News
 * Handles ad-free experience, early access, and exclusive content for authenticated users
 */

class PremiumFeatures {
  constructor() {
    this.isPremium = false;
    this.user = null;
    this.init();
  }
  
  async init() {
    // Check if user is authenticated
    if (window.auth0 && typeof window.auth0.isAuthenticated === 'function') {
      try {
        const isAuth = await window.auth0.isAuthenticated();
        if (isAuth) {
          this.user = await window.auth0.getUser();
          this.isPremium = true; // All authenticated users get premium features for now
          this.applyPremiumFeatures();
        }
      } catch (err) {
        console.log('[Premium] Could not check auth:', err);
      }
    }
    
    // Monitor auth state changes
    this.monitorAuthState();
  }
  
  monitorAuthState() {
    // Check every 2 seconds for auth state changes
    setInterval(async () => {
      if (window.auth0 && typeof window.auth0.isAuthenticated === 'function') {
        try {
          const isAuth = await window.auth0.isAuthenticated();
          if (isAuth && !this.isPremium) {
            this.user = await window.auth0.getUser();
            this.isPremium = true;
            this.applyPremiumFeatures();
          } else if (!isAuth && this.isPremium) {
            this.isPremium = false;
            this.removePremiumFeatures();
          }
        } catch (err) {
          // Auth check failed, ignore
        }
      }
    }, 2000);
  }
  
  applyPremiumFeatures() {
    console.log('[Premium] Applying premium features');
    
    // 1. Hide ads
    this.hideAds();
    
    // 2. Show early access badges
    this.showEarlyAccessBadges();
    
    // 3. Add premium indicator
    this.addPremiumIndicator();
    
    // Add premium class to body
    document.body.classList.add('premium-user');
  }
  
  removePremiumFeatures() {
    console.log('[Premium] Removing premium features');
    
    // Show ads again
    this.showAds();
    
    // Hide early access badges
    this.hideEarlyAccessBadges();
    
    // Remove premium indicator
    this.removePremiumIndicator();
    
    // Remove premium class
    document.body.classList.remove('premium-user');
  }
  
  hideAds() {
    // Hide Google AdSense ads
    const adContainers = document.querySelectorAll('.adsbygoogle, ins.adsbygoogle, [id*="google_ads"], [class*="ad-"]');
    adContainers.forEach(ad => {
      ad.style.display = 'none';
      ad.setAttribute('data-premium-hidden', 'true');
    });
    
    // Hide ad containers
    const adWrappers = document.querySelectorAll('[class*="ad-container"], [id*="ad-container"]');
    adWrappers.forEach(wrapper => {
      wrapper.style.display = 'none';
      wrapper.setAttribute('data-premium-hidden', 'true');
    });
  }
  
  showAds() {
    // Show ads again
    const hiddenAds = document.querySelectorAll('[data-premium-hidden="true"]');
    hiddenAds.forEach(ad => {
      ad.style.display = '';
      ad.removeAttribute('data-premium-hidden');
    });
  }
  
  showEarlyAccessBadges() {
    // Add early access badges to new features
    const gameCards = document.querySelectorAll('.fact-checker-card, .geography-game-card');
    gameCards.forEach(card => {
      if (!card.querySelector('.early-access-badge')) {
        const badge = document.createElement('div');
        badge.className = 'early-access-badge';
        badge.textContent = '✨ Early Access';
        badge.style.cssText = `
          position: absolute;
          top: 10px;
          right: 10px;
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: #000;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 700;
          z-index: 10;
          box-shadow: 0 2px 8px rgba(255, 215, 0, 0.5);
        `;
        card.style.position = 'relative';
        card.appendChild(badge);
      }
    });
  }
  
  hideEarlyAccessBadges() {
    const badges = document.querySelectorAll('.early-access-badge');
    badges.forEach(badge => badge.remove());
  }
  
  
  addPremiumIndicator() {
    // Add premium badge to header or user menu
    if (!document.querySelector('.premium-badge-header')) {
      const signinBtn = document.getElementById('signinBtn');
      if (signinBtn && signinBtn.textContent.includes('✓')) {
        signinBtn.setAttribute('title', signinBtn.getAttribute('title') + ' (Premium Member)');
        signinBtn.classList.add('premium-member');
      }
    }
  }
  
  removePremiumIndicator() {
    const signinBtn = document.getElementById('signinBtn');
    if (signinBtn) {
      signinBtn.classList.remove('premium-member');
      const title = signinBtn.getAttribute('title');
      if (title && title.includes('(Premium Member)')) {
        signinBtn.setAttribute('title', title.replace(' (Premium Member)', ''));
      }
    }
  }
}

// Initialize premium features
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.premiumFeatures = new PremiumFeatures();
  });
} else {
  window.premiumFeatures = new PremiumFeatures();
}

