/**
 * Christmas Theme Configuration
 * 
 * To turn off Christmas theme after the holidays:
 * Simply change ENABLE_CHRISTMAS_THEME to false
 */

const CHRISTMAS_CONFIG = {
    // Set to false to disable Christmas theme
    ENABLE_CHRISTMAS_THEME: true,
    
    // Optional: Auto-disable after a certain date
    AUTO_DISABLE_DATE: new Date('2025-01-15'), // January 15th, 2025 (extended)
    
    // SVG Snowfall settings (high-quality)
    ENABLE_SVG_SNOWFALL: true, // Set to false to disable snowfall
    SNOWFLAKE_COUNT: 50, // Desktop count (mobile will be ~40% of this)
    SNOWFLAKE_MIN_SIZE: 12, // Minimum size in pixels
    SNOWFLAKE_MAX_SIZE: 20, // Maximum size in pixels
    SNOWFLAKE_MIN_OPACITY: 0.6,
    SNOWFLAKE_MAX_OPACITY: 0.95,
    SNOWFLAKE_MIN_DURATION: 8, // Minimum fall duration in seconds
    SNOWFLAKE_MAX_DURATION: 15, // Maximum fall duration in seconds
    
    // Legacy emoji snowflake settings (deprecated, kept for compatibility)
    SNOWFLAKE_SYMBOLS: ['❄', '❅', '❆', '✻', '✼', '✽', '✾', '✿', '❀']
};

// Auto-disable check
if (CHRISTMAS_CONFIG.ENABLE_CHRISTMAS_THEME && CHRISTMAS_CONFIG.AUTO_DISABLE_DATE) {
    const now = new Date();
    if (now > CHRISTMAS_CONFIG.AUTO_DISABLE_DATE) {
        CHRISTMAS_CONFIG.ENABLE_CHRISTMAS_THEME = false;
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CHRISTMAS_CONFIG;
}

