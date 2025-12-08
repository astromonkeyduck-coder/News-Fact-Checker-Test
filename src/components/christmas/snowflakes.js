/**
 * High-Quality SVG Snowflake Library
 * Premium vector snowflake designs for Christmas snowfall effect
 */

/**
 * Generate SVG snowflake with given paths
 */
function createSnowflakeSVG(paths, viewBox = "0 0 24 24") {
    return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width: 100%; height: 100%;">
    <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        ${paths}
    </g>
</svg>`;
}

/**
 * Snowflake A - Classic 6-arm design with inner details
 */
export const SnowflakeA = () => createSnowflakeSVG(`
    <path d="M12 2v20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12h20M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3M8.5 8.5l7 7M15.5 8.5l-7 7M8.5 15.5l7-7M15.5 15.5l-7-7"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    <path d="M12 6l-1.5 1.5M12 6l1.5 1.5M12 18l-1.5-1.5M12 18l1.5-1.5M6 12l-1.5-1.5M6 12l-1.5 1.5M18 12l1.5-1.5M18 12l1.5 1.5"/>
`);

/**
 * Snowflake B - Delicate 6-arm with branching
 */
export const SnowflakeB = () => createSnowflakeSVG(`
    <path d="M12 2v20M12 2l-2 2M12 2l2 2M12 22l-2-2M12 22l2-2M2 12h20M2 12l2-2M2 12l2 2M22 12l-2-2M22 12l-2 2"/>
    <path d="M12 4l-1.5 1.5M12 4l1.5 1.5M12 20l-1.5-1.5M12 20l1.5-1.5M4 12l-1.5-1.5M4 12l-1.5 1.5M20 12l1.5-1.5M20 12l1.5 1.5"/>
    <path d="M8.5 8.5l-1.5-1.5M15.5 8.5l1.5-1.5M8.5 15.5l-1.5 1.5M15.5 15.5l1.5 1.5M8.5 8.5l1.5 1.5M15.5 8.5l-1.5 1.5M8.5 15.5l1.5-1.5M15.5 15.5l-1.5-1.5"/>
    <circle cx="12" cy="12" r="1" fill="currentColor"/>
`);

/**
 * Snowflake C - Intricate 6-arm with multiple branches
 */
export const SnowflakeC = () => createSnowflakeSVG(`
    <path d="M12 1v22M12 1l-2.5 2.5M12 1l2.5 2.5M12 23l-2.5-2.5M12 23l2.5-2.5M1 12h22M1 12l2.5-2.5M1 12l2.5 2.5M23 12l-2.5-2.5M23 12l-2.5 2.5"/>
    <path d="M12 3l-1 1M12 3l1 1M12 21l-1-1M12 21l1-1M3 12l-1-1M3 12l-1 1M21 12l1-1M21 12l1 1"/>
    <path d="M7.5 7.5l-1.5-1.5M16.5 7.5l1.5-1.5M7.5 16.5l-1.5 1.5M16.5 16.5l1.5 1.5"/>
    <path d="M9 9l-1-1M15 9l1-1M9 15l-1 1M15 15l1 1"/>
    <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
`);

/**
 * Snowflake D - Star-like 6-arm design
 */
export const SnowflakeD = () => createSnowflakeSVG(`
    <path d="M12 2v20M12 2l-3.5 3.5M12 2l3.5 3.5M12 22l-3.5-3.5M12 22l3.5-3.5M2 12h20M2 12l3.5-3.5M2 12l3.5 3.5M22 12l-3.5-3.5M22 12l-3.5 3.5"/>
    <path d="M12 5l-2 2M12 5l2 2M12 19l-2-2M12 19l2-2M5 12l-2-2M5 12l-2 2M19 12l2-2M19 12l2 2"/>
    <path d="M8 8l-1.5-1.5M16 8l1.5-1.5M8 16l-1.5 1.5M16 16l1.5 1.5"/>
    <circle cx="12" cy="12" r="1.3" fill="currentColor"/>
`);

/**
 * Snowflake E - Elaborate 6-arm with cross patterns
 */
export const SnowflakeE = () => createSnowflakeSVG(`
    <path d="M12 2v20M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5M2 12h20M2 12l2.5-2.5M2 12l2.5 2.5M22 12l-2.5-2.5M22 12l-2.5 2.5"/>
    <path d="M9 9l-1.5-1.5M15 9l1.5-1.5M9 15l-1.5 1.5M15 15l1.5 1.5"/>
    <path d="M12 4l-1 1M12 4l1 1M12 20l-1-1M12 20l1-1M4 12l-1-1M4 12l-1 1M20 12l1-1M20 12l1 1"/>
    <path d="M7.5 7.5l-1-1M16.5 7.5l1-1M7.5 16.5l-1 1M16.5 16.5l1 1"/>
    <circle cx="12" cy="12" r="1.1" fill="currentColor"/>
`);

/**
 * Snowflake F - Minimalist 6-arm design
 */
export const SnowflakeF = () => createSnowflakeSVG(`
    <path d="M12 2v20M12 2l-2 2M12 2l2 2M12 22l-2-2M12 22l2-2M2 12h20M2 12l2-2M2 12l2 2M22 12l-2-2M22 12l-2 2"/>
    <path d="M10 10l-1-1M14 10l1-1M10 14l-1 1M14 14l1 1"/>
    <circle cx="12" cy="12" r="1" fill="currentColor"/>
`);

/**
 * Snowflake G - Complex 6-arm with inner hexagon
 */
export const SnowflakeG = () => createSnowflakeSVG(`
    <path d="M12 2v20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12h20M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/>
    <path d="M9 9l-1.5-1.5M15 9l1.5-1.5M9 15l-1.5 1.5M15 15l1.5 1.5"/>
    <path d="M12 5l-1.5 1.5M12 5l1.5 1.5M12 19l-1.5-1.5M12 19l1.5-1.5M5 12l-1.5-1.5M5 12l-1.5 1.5M19 12l1.5-1.5M19 12l1.5 1.5"/>
    <polygon points="12,8 14,10 12,12 10,10" fill="currentColor" opacity="0.3"/>
    <polygon points="12,16 14,14 12,12 10,14" fill="currentColor" opacity="0.3"/>
    <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
`);

/**
 * Snowflake H - Delicate 6-arm with fine details
 */
export const SnowflakeH = () => createSnowflakeSVG(`
    <path d="M12 2v20M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5M2 12h20M2 12l2.5-2.5M2 12l2.5 2.5M22 12l-2.5-2.5M22 12l-2.5 2.5"/>
    <path d="M12 4l-1 1M12 4l1 1M12 20l-1-1M12 20l1-1M4 12l-1-1M4 12l-1 1M20 12l1-1M20 12l1 1"/>
    <path d="M8.5 8.5l-1-1M15.5 8.5l1-1M8.5 15.5l-1 1M15.5 15.5l1 1"/>
    <circle cx="12" cy="12" r="0.8" fill="currentColor"/>
`);

/**
 * Snowflake I - Bold 6-arm with thick lines
 */
export const SnowflakeI = () => createSnowflakeSVG(`
    <path d="M12 2v20M12 2l-3.5 3.5M12 2l3.5 3.5M12 22l-3.5-3.5M12 22l3.5-3.5M2 12h20M2 12l3.5-3.5M2 12l3.5 3.5M22 12l-3.5-3.5M22 12l-3.5 3.5" stroke-width="1.8"/>
    <path d="M8.5 8.5l-1.5-1.5M15.5 8.5l1.5-1.5M8.5 15.5l-1.5 1.5M15.5 15.5l1.5 1.5" stroke-width="1.8"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
`);

/**
 * Snowflake J - Elegant 6-arm with curved branches
 */
export const SnowflakeJ = () => createSnowflakeSVG(`
    <path d="M12 2v20M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5M2 12h20M2 12l2.5-2.5M2 12l2.5 2.5M22 12l-2.5-2.5M22 12l-2.5 2.5"/>
    <path d="M12 3.5l-1.5 1.5M12 3.5l1.5 1.5M12 20.5l-1.5-1.5M12 20.5l1.5-1.5M3.5 12l-1.5-1.5M3.5 12l-1.5 1.5M20.5 12l1.5-1.5M20.5 12l1.5 1.5"/>
    <path d="M9 9l-1-1M15 9l1-1M9 15l-1 1M15 15l1 1"/>
    <circle cx="12" cy="12" r="1" fill="currentColor"/>
`);

/**
 * Array of all snowflake components for random selection
 */
const SNOWFLAKE_COMPONENTS = [
    SnowflakeA,
    SnowflakeB,
    SnowflakeC,
    SnowflakeD,
    SnowflakeE,
    SnowflakeF,
    SnowflakeG,
    SnowflakeH,
    SnowflakeI,
    SnowflakeJ
];

/**
 * Get a random snowflake SVG
 */
function getRandomSnowflake() {
    const randomIndex = Math.floor(Math.random() * SNOWFLAKE_COMPONENTS.length);
    return SNOWFLAKE_COMPONENTS[randomIndex]();
}

// Make available globally for vanilla JS usage
if (typeof window !== 'undefined') {
    window.getRandomSnowflake = getRandomSnowflake;
    window.SNOWFLAKE_COMPONENTS = SNOWFLAKE_COMPONENTS;
}

