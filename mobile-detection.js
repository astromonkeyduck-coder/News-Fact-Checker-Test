/**
 * Mobile Detection and Mobile Site Suggestion
 * 
 * Add this script to your main index.html to detect mobile users
 * and suggest they visit the mobile-optimized site.
 * 
 * Usage: <script src="mobile-detection.js"></script>
 */

(function() {
    'use strict';
    
    // Detect mobile devices
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth <= 768;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Check if user has already dismissed the banner
    const bannerDismissed = sessionStorage.getItem('mobileBannerDismissed');
    
    // Only show banner on mobile/small screens and if not dismissed
    if ((isMobileDevice || (isSmallScreen && isTouchDevice)) && !bannerDismissed) {
        // Don't show if already on mobile.html
        if (window.location.pathname.includes('mobile.html')) {
            return;
        }
        
        // Create banner
        const banner = document.createElement('div');
        banner.id = 'mobile-site-banner';
        banner.setAttribute('role', 'banner');
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, rgba(7, 21, 42, 0.98) 0%, rgba(13, 31, 58, 0.98) 100%);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            color: white;
            padding: 1rem;
            text-align: center;
            z-index: 10000;
            border-bottom: 1px solid rgba(79, 172, 254, 0.3);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        banner.innerHTML = `
            <div style="max-width: 100%; margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;">
                    <p style="margin: 0 0 0.5rem 0; font-size: 0.938rem; font-weight: 600;">
                        📱 <strong>Mobile-optimized site available!</strong>
                    </p>
                    <p style="margin: 0; font-size: 0.813rem; color: rgba(255, 255, 255, 0.8);">
                        Get a better experience on your phone
                    </p>
                </div>
                <div style="display: flex; gap: 0.75rem; align-items: center;">
                    <a href="mobile.html" 
                       style="background: linear-gradient(135deg, #4FACFE 0%, #4A90E2 100%);
                              color: white;
                              text-decoration: none;
                              padding: 0.75rem 1.5rem;
                              border-radius: 8px;
                              font-weight: 600;
                              font-size: 0.938rem;
                              min-height: 44px;
                              display: inline-flex;
                              align-items: center;
                              transition: transform 0.2s ease;
                              touch-action: manipulation;">
                        Visit Mobile Site
                    </a>
                    <button onclick="this.closest('#mobile-site-banner').remove(); sessionStorage.setItem('mobileBannerDismissed', 'true'); document.body.style.paddingTop = '';" 
                            style="background: rgba(255, 255, 255, 0.1);
                                   border: 1px solid rgba(255, 255, 255, 0.3);
                                   color: white;
                                   padding: 0.75rem 1rem;
                                   border-radius: 8px;
                                   font-size: 0.938rem;
                                   font-weight: 600;
                                   cursor: pointer;
                                   min-height: 44px;
                                   min-width: 44px;
                                   touch-action: manipulation;
                                   transition: all 0.2s ease;">
                        ✕
                    </button>
                </div>
            </div>
        `;
        
        // Add banner to page
        document.body.insertBefore(banner, document.body.firstChild);
        
        // Add padding to body to account for banner
        const bannerHeight = banner.offsetHeight;
        document.body.style.paddingTop = bannerHeight + 'px';
        
        // Handle banner close on link click (optional - keep banner visible)
        const mobileLink = banner.querySelector('a[href="mobile.html"]');
        if (mobileLink) {
            mobileLink.addEventListener('click', function() {
                // Optionally remove banner when user clicks to go to mobile site
                // banner.remove();
                // document.body.style.paddingTop = '';
            });
        }
        
        // Adjust padding on window resize
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                if (banner && banner.parentNode) {
                    const newHeight = banner.offsetHeight;
                    document.body.style.paddingTop = newHeight + 'px';
                }
            }, 250);
        });
    }
})();







