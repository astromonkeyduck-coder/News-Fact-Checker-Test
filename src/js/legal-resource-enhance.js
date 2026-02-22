/**
 * Legal & Resource Pages - Advanced Enhancement
 * Particles, matrix rain, scroll reveal, reading progress, back-to-top, active TOC
 */
(function() {
    'use strict';

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        createParticles();
        createMatrixRain();
        initScrollReveal();
        initReadingProgress();
        initBackToTop();
        initActiveTOC();
    }

    function createParticles() {
        const container = document.getElementById('particles');
        if (!container || container.children.length > 0) return;

        const count = 50;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.top = Math.random() * 100 + '%';
            p.style.animationDelay = Math.random() * 6 + 's';
            p.style.animationDuration = (Math.random() * 3 + 4) + 's';
            container.appendChild(p);
        }
    }

    function createMatrixRain() {
        const container = document.getElementById('matrixRain');
        if (!container || container.children.length > 0) return;

        const columns = Math.floor(window.innerWidth / 20);
        const chars = '01';
        for (let i = 0; i < columns; i++) {
            const el = document.createElement('div');
            el.className = 'matrix-character';
            el.textContent = chars[Math.floor(Math.random() * chars.length)];
            el.style.left = i * 20 + 'px';
            el.style.animationDelay = Math.random() * 3 + 's';
            container.appendChild(el);
        }
    }

    function initScrollReveal() {
        const reveals = document.querySelectorAll('.reveal');
        if (reveals.length === 0) return;

        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

        reveals.forEach(function(el) { observer.observe(el); });
    }

    function initReadingProgress() {
        const bar = document.getElementById('readingProgress');
        if (!bar) return;

        function update() {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
            bar.style.transform = 'scaleX(' + pct / 100 + ')';
        }

        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
    }

    function initBackToTop() {
        const btn = document.getElementById('backToTop') || document.getElementById('scrollToTop');
        if (!btn) return;

        function update() {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            if (scrollTop > 400) {
                btn.classList.add('visible');
            } else {
                btn.classList.remove('visible');
            }
        }

        btn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    function initActiveTOC() {
        const tocLinks = document.querySelectorAll('.legal-quick-ref a[href^="#"], .table-of-contents a[href^="#"], .resource-nav a[href^="#"]');
        const sections = document.querySelectorAll('[id]');
        if (tocLinks.length === 0) return;

        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    if (id) {
                        tocLinks.forEach(function(link) {
                            const href = link.getAttribute('href');
                            if (href === '#' + id || href.endsWith('#' + id)) {
                                tocLinks.forEach(function(l) { l.classList.remove('active'); });
                                link.classList.add('active');
                            }
                        });
                    }
                }
            });
        }, { threshold: 0.3, rootMargin: '-80px 0px -60% 0px' });

        sections.forEach(function(s) {
            if (tocLinks.length && Array.from(tocLinks).some(function(l) {
                const h = l.getAttribute('href');
                return h && (h === '#' + s.id || h.endsWith('#' + s.id));
            })) {
                observer.observe(s);
            }
        });
    }
})();
