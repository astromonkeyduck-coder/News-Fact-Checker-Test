/* ========================================
   Noteworthy News Mobile JavaScript
   Mobile-Optimized Interactions
   ======================================== */

(function() {
    'use strict';
    
    // ========================================
    // Mobile Desktop Notice Modal
    // ========================================
    const mobileDesktopNotice = document.getElementById('mobileDesktopNotice');
    const mobileNoticeClose = document.getElementById('mobileNoticeClose');
    const mobileNoticeBtn = document.getElementById('mobileNoticeBtn');
    
    // Show notice on first visit (check localStorage)
    function showMobileNotice() {
        if (!mobileDesktopNotice) return;
        
        const hasSeenNotice = localStorage.getItem('mobileNoticeDismissed');
        if (!hasSeenNotice) {
            mobileDesktopNotice.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }
    
    // Hide notice and save to localStorage
    function hideMobileNotice() {
        if (!mobileDesktopNotice) return;
        
        mobileDesktopNotice.classList.remove('show');
        document.body.style.overflow = '';
        localStorage.setItem('mobileNoticeDismissed', 'true');
    }
    
    // Event listeners for notice
    if (mobileNoticeClose) {
        mobileNoticeClose.addEventListener('click', hideMobileNotice);
        mobileNoticeClose.addEventListener('touchend', function(e) {
            e.preventDefault();
            hideMobileNotice();
        });
    }
    
    if (mobileNoticeBtn) {
        mobileNoticeBtn.addEventListener('click', hideMobileNotice);
        mobileNoticeBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            hideMobileNotice();
        });
    }
    
    // Close on backdrop click
    if (mobileDesktopNotice) {
        mobileDesktopNotice.addEventListener('click', function(e) {
            if (e.target === mobileDesktopNotice) {
                hideMobileNotice();
            }
        });
    }
    
    // Show notice after page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showMobileNotice);
    } else {
        showMobileNotice();
    }
    
    // ========================================
    // Mobile Navigation Menu
    // ========================================
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileNav = document.getElementById('mobileNav');
    const mobileNavClose = document.getElementById('mobileNavClose');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    
    function toggleMobileNav() {
        const isOpen = mobileNav.classList.contains('active');
        
        if (isOpen) {
            closeMobileNav();
        } else {
            openMobileNav();
        }
    }
    
    function openMobileNav() {
        if (!mobileNav) return;
        
        mobileNav.classList.add('active');
        mobileNav.setAttribute('aria-hidden', 'false');
        if (mobileMenuToggle) {
            mobileMenuToggle.setAttribute('aria-expanded', 'true');
        }
        document.body.style.overflow = 'hidden';
    }
    
    function closeMobileNav() {
        if (!mobileNav) return;
        
        mobileNav.classList.remove('active');
        mobileNav.setAttribute('aria-hidden', 'true');
        if (mobileMenuToggle) {
            mobileMenuToggle.setAttribute('aria-expanded', 'false');
        }
        document.body.style.overflow = '';
    }
    
    // Toggle menu
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleMobileNav);
        mobileMenuToggle.addEventListener('touchend', function(e) {
            e.preventDefault();
            toggleMobileNav();
        });
    }
    
    // Close menu button
    if (mobileNavClose) {
        mobileNavClose.addEventListener('click', closeMobileNav);
        mobileNavClose.addEventListener('touchend', function(e) {
            e.preventDefault();
            closeMobileNav();
        });
    }
    
    // Close menu when clicking a link
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Don't close if it's an external link or special action
            const href = link.getAttribute('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                // Allow navigation, but close menu after a short delay
                setTimeout(closeMobileNav, 100);
            } else {
                closeMobileNav();
            }
        });
    });
    
    // Close menu on backdrop click
    if (mobileNav) {
        mobileNav.addEventListener('click', function(e) {
            if (e.target === mobileNav) {
                closeMobileNav();
            }
        });
    }
    
    // Close menu on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
            closeMobileNav();
        }
    });
    
    // ========================================
    // Smooth Scrolling for Anchor Links
    // ========================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#' || !href) return;
            
            const target = document.querySelector(href);
            if (!target) return;
            
            e.preventDefault();
            const header = document.querySelector('.mobile-header');
            const headerHeight = header ? header.offsetHeight : 0;
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
            
            if (mobileNav && mobileNav.classList.contains('active')) {
                closeMobileNav();
            }
        });
    });
    
    // ========================================
    // Tip Submission Modal
    // ========================================
    const mobileTipBtn = document.getElementById('mobileTipBtn');
    const mobileTipModal = document.getElementById('mobileTipModal');
    const mobileTipModalClose = document.getElementById('mobileTipModalClose');
    const mobileTipForm = document.getElementById('mobileTipForm');
    
    function openTipModal() {
        if (!mobileTipModal) return;
        
        mobileTipModal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    
    function closeTipModal() {
        if (!mobileTipModal) return;
        
        mobileTipModal.classList.remove('show');
        document.body.style.overflow = '';
    }
    
    // Open tip modal
    if (mobileTipBtn) {
        mobileTipBtn.addEventListener('click', function(e) {
            e.preventDefault();
            closeMobileNav(); // Close nav menu first
            setTimeout(openTipModal, 300);
        });
    }
    
    // Close tip modal
    if (mobileTipModalClose) {
        mobileTipModalClose.addEventListener('click', closeTipModal);
        mobileTipModalClose.addEventListener('touchend', function(e) {
            e.preventDefault();
            closeTipModal();
        });
    }
    
    // Close on backdrop click
    if (mobileTipModal) {
        mobileTipModal.addEventListener('click', function(e) {
            if (e.target === mobileTipModal) {
                closeTipModal();
            }
        });
    }
    
    // Handle tip form submission
    if (mobileTipForm) {
        mobileTipForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const emailInput = document.getElementById('mobileTipEmail');
            const tipInput = document.getElementById('mobileTipContent');
            
            if (!emailInput || !tipInput) return;
            
            const email = emailInput.value.trim();
            const tip = tipInput.value.trim();
            
            // Validation
            if (!email || !tip) {
                showFormMessage(mobileTipForm, 'Please fill in all fields.', 'error');
                return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showFormMessage(mobileTipForm, 'Please enter a valid email address.', 'error');
                return;
            }
            
            // Show loading state
            const submitButton = mobileTipForm.querySelector('button[type="submit"]');
            if (!submitButton) return;
            
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Submitting...';
            submitButton.disabled = true;
            
            // Submit to backend (replace with actual API call)
            setTimeout(function() {
                showFormMessage(mobileTipForm, 'Thank you for your tip! We\'ll review it shortly.', 'success');
                mobileTipForm.reset();
                submitButton.textContent = originalText;
                submitButton.disabled = false;
                
                setTimeout(function() {
                    closeTipModal();
                }, 2000);
            }, 1000);
        });
    }
    
    // Helper function for form messages
    function showFormMessage(form, message, type) {
        const existingMsg = form.querySelector('.form-message');
        if (existingMsg) {
            existingMsg.remove();
        }
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'form-message form-message-' + type;
        msgDiv.textContent = message;
        msgDiv.style.cssText = 'padding: 0.75rem; margin-bottom: 1rem; border-radius: 6px; font-size: 0.875rem; ' +
            (type === 'error' ? 'background: rgba(255, 59, 48, 0.1); color: #ff3b30; border: 1px solid rgba(255, 59, 48, 0.3);' :
             'background: rgba(52, 199, 89, 0.1); color: #34c759; border: 1px solid rgba(52, 199, 89, 0.3);');
        
        form.insertBefore(msgDiv, form.firstChild);
        
        if (type === 'success') {
            setTimeout(function() {
                if (msgDiv.parentNode) {
                    msgDiv.remove();
                }
            }, 5000);
        }
    }
    
    // ========================================
    // Newsletter Subscription Form
    // ========================================
    const mobileSubscribeForm = document.getElementById('mobileSubscribeForm');
    
    if (mobileSubscribeForm) {
        mobileSubscribeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const emailInput = this.querySelector('.mobile-subscribe-input');
            if (!emailInput) return;
            
            const email = emailInput.value.trim();
            
            if (!email) {
                showSubscribeMessage(mobileSubscribeForm, 'Please enter your email address.', 'error');
                return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showSubscribeMessage(mobileSubscribeForm, 'Please enter a valid email address.', 'error');
                return;
            }
            
            const submitButton = this.querySelector('button[type="submit"]');
            if (!submitButton) return;
            
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Subscribing...';
            submitButton.disabled = true;
            
            // Submit to backend (replace with actual API call)
            setTimeout(function() {
                showSubscribeMessage(mobileSubscribeForm, 'Thank you for subscribing! Check your email to confirm.', 'success');
                mobileSubscribeForm.reset();
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }, 1000);
        });
    }
    
    // Helper function for subscribe form messages
    function showSubscribeMessage(form, message, type) {
        const container = form.closest('.mobile-subscribe-content');
        if (!container) return;
        
        const existingMsg = container.querySelector('.subscribe-message');
        if (existingMsg) {
            existingMsg.remove();
        }
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'subscribe-message subscribe-message-' + type;
        msgDiv.textContent = message;
        msgDiv.style.cssText = 'padding: 0.75rem; margin-top: 1rem; border-radius: 6px; font-size: 0.875rem; text-align: center; ' +
            (type === 'error' ? 'background: rgba(255, 59, 48, 0.1); color: #ff3b30; border: 1px solid rgba(255, 59, 48, 0.3);' :
             'background: rgba(52, 199, 89, 0.1); color: #34c759; border: 1px solid rgba(52, 199, 89, 0.3);');
        
        container.appendChild(msgDiv);
        
        if (type === 'success') {
            setTimeout(function() {
                if (msgDiv.parentNode) {
                    msgDiv.remove();
                }
            }, 5000);
        }
    }
    
    // ========================================
    // Touch Event Optimizations
    // ========================================
    // Prevent double-tap zoom on buttons
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(e) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
    // Add touch feedback to interactive elements
    const interactiveElements = document.querySelectorAll('a, button, .mobile-news-item, .mobile-game-card');
    interactiveElements.forEach(element => {
        element.addEventListener('touchstart', function() {
            this.style.opacity = '0.8';
        });
        
        element.addEventListener('touchend', function() {
            setTimeout(() => {
                this.style.opacity = '';
            }, 150);
        });
    });
    
    // ========================================
    // Performance Optimizations
    // ========================================
    // Lazy load images (if any are added dynamically)
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                }
            });
        });
        
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
    
    // ========================================
    // Analytics
    // ========================================
    if (typeof gtag !== 'undefined') {
        gtag('event', 'mobile_site_view', {
            'event_category': 'Mobile',
            'event_label': 'Mobile Site Visit'
        });
    }
    
})();

