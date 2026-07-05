/**
 * Cookie Consent Banner
 * GDPR-compliant cookie consent management
 */

(function() {
    'use strict';

    const COOKIE_CONSENT_KEY = 'cookieConsent';
    const COOKIE_CONSENT_EXPIRY_DAYS = 365;

    /**
     * Create and show cookie banner
     */
    function createCookieBanner() {
        // Check if user has already made a choice
        const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (consent) {
            return; // User already made a choice
        }

        // Create banner HTML
        const banner = document.createElement('div');
        banner.id = 'cookie-banner';
        banner.className = 'cookie-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Cookie consent');
        banner.setAttribute('aria-live', 'polite');
        
        banner.innerHTML = `
            <div class="cookie-banner-content">
                <div class="cookie-banner-text">
                    <h3 class="cookie-banner-title">Cookie Preferences</h3>
                    <p>We use cookies and similar technologies to enhance your browsing experience, analyze site traffic, and personalize content. This includes cookies from Google AdSense for advertising purposes. By clicking "Accept All", you consent to our use of cookies. <a href="/privacy.html" target="_blank" rel="noopener">Learn more in our Privacy Policy</a></p>
                </div>
                <div class="cookie-banner-buttons">
                    <button id="accept-cookies" class="cookie-btn cookie-btn-accept" aria-label="Accept all cookies">
                        Accept All
                    </button>
                    <button id="reject-cookies" class="cookie-btn cookie-btn-reject" aria-label="Reject non-essential cookies">
                        Reject Non-Essential
                    </button>
                    <a href="/privacy.html" class="cookie-btn cookie-btn-learn" target="_blank" rel="noopener" aria-label="Learn more about cookies">
                        Privacy Policy
                    </a>
                </div>
            </div>
        `;

        // Add to page
        document.body.appendChild(banner);
        document.body.classList.add('cookie-banner-open');

        // Show banner with animation
        setTimeout(() => {
            banner.classList.add('cookie-banner-visible');
        }, 100);

        // Handle accept button
        const acceptBtn = document.getElementById('accept-cookies');
        if (acceptBtn) {
            acceptBtn.addEventListener('click', function() {
                handleCookieConsent('accepted');
                hideBanner(banner);
            });
        }

        // Handle reject button
        const rejectBtn = document.getElementById('reject-cookies');
        if (rejectBtn) {
            rejectBtn.addEventListener('click', function() {
                handleCookieConsent('rejected');
                hideBanner(banner);
            });
        }
    }

    /**
     * Handle cookie consent choice
     */
    function handleCookieConsent(choice) {
        // Store consent with expiry date
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + COOKIE_CONSENT_EXPIRY_DAYS);
        
        const consentData = {
            choice: choice,
            date: new Date().toISOString(),
            expiry: expiryDate.toISOString()
        };
        
        localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData));

        // If accepted, enable Google AdSense and analytics
        if (choice === 'accepted') {
            enableTrackingCookies();
        } else {
            disableNonEssentialCookies();
        }

        // Dispatch custom event for other scripts
        const event = new CustomEvent('cookieConsent', {
            detail: { choice: choice }
        });
        document.dispatchEvent(event);
    }

    /**
     * Enable tracking cookies (AdSense, analytics)
     */
    function enableTrackingCookies() {
        // Google AdSense will automatically work when consent is given
        // This is handled by the AdSense script in the page
        
        // Enable analytics if using gtag
        if (typeof gtag !== 'undefined') {
            gtag('consent', 'update', { 'analytics_storage': 'granted' });
        }
    }

    /**
     * Disable non-essential cookies
     */
    function disableNonEssentialCookies() {
        // Disable analytics if using gtag
        if (typeof gtag !== 'undefined') {
            gtag('consent', 'update', { 'analytics_storage': 'denied' });
        }
        
        // Note: AdSense may still show ads, but without personalization
    }

    /**
     * Hide banner with animation
     */
    function hideBanner(banner) {
        banner.classList.remove('cookie-banner-visible');
        banner.classList.add('cookie-banner-hidden');
        document.body.classList.remove('cookie-banner-open');
        
        setTimeout(() => {
            if (banner.parentNode) {
                banner.parentNode.removeChild(banner);
            }
        }, 300);
    }

    /**
     * Check if consent has expired
     */
    function checkConsentExpiry() {
        const consentData = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (!consentData) {
            return false;
        }

        try {
            const data = JSON.parse(consentData);
            const expiryDate = new Date(data.expiry);
            const now = new Date();

            if (now > expiryDate) {
                // Consent expired, remove it
                localStorage.removeItem(COOKIE_CONSENT_KEY);
                return false;
            }

            return true;
        } catch (e) {
            // Invalid data, remove it
            localStorage.removeItem(COOKIE_CONSENT_KEY);
            return false;
        }
    }

    /**
     * Initialize cookie banner
     */
    function init() {
        // Check if consent has expired
        if (!checkConsentExpiry()) {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', createCookieBanner);
            } else {
                createCookieBanner();
            }
        }
    }

    // Initialize
    init();

    // Export for external use
    window.CookieBanner = {
        show: createCookieBanner,
        getConsent: function() {
            const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
            if (!consent) return null;
            try {
                return JSON.parse(consent);
            } catch (e) {
                return null;
            }
        },
        clearConsent: function() {
            localStorage.removeItem(COOKIE_CONSENT_KEY);
        }
    };
})();

