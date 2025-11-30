/**
 * Theme Toggle Utility
 * Handles dark/light mode switching with persistence
 */

(function() {
  'use strict';

  const THEME_STORAGE_KEY = 'noteworthy-theme';
  const THEME_ATTRIBUTE = 'data-theme';

  /**
   * Get current theme
   */
  function getTheme() {
    // Check localStorage first
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }

    // Default to dark (your current theme)
    return 'dark';
  }

  /**
   * Set theme
   */
  function setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') {
      theme = 'dark';
    }

    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('theme-changed', {
      detail: { theme }
    }));
  }

  /**
   * Toggle theme
   */
  function toggleTheme() {
    const current = getTheme();
    const newTheme = current === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    return newTheme;
  }

  /**
   * Initialize theme on page load
   */
  function initTheme() {
    const theme = getTheme();
    setTheme(theme);

    // Listen for system preference changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      mediaQuery.addEventListener('change', (e) => {
        // Only auto-switch if user hasn't manually set a preference
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
          setTheme(e.matches ? 'light' : 'dark');
        }
      });
    }
  }

  /**
   * Create theme toggle button
   */
  function createThemeToggleButton() {
    const button = document.createElement('button');
    button.className = 'theme-toggle-btn';
    button.setAttribute('aria-label', 'Toggle theme');
    button.setAttribute('title', 'Toggle dark/light mode');
    
    updateButtonIcon(button, getTheme());
    
    button.addEventListener('click', function() {
      const newTheme = toggleTheme();
      updateButtonIcon(button, newTheme);
    });

    return button;
  }

  /**
   * Update button icon based on theme
   */
  function updateButtonIcon(button, theme) {
    if (!button) return;

    if (theme === 'light') {
      button.innerHTML = '🌙';
      button.title = 'Switch to dark mode';
    } else {
      button.innerHTML = '☀️';
      button.title = 'Switch to light mode';
    }
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }

  // Expose API
  window.ThemeToggle = {
    getTheme,
    setTheme,
    toggleTheme,
    createButton: createThemeToggleButton
  };
})();

