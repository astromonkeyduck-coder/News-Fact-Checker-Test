/**
 * Premium SVG Icon Library for Noteworthy News (JavaScript version)
 * 
 * Replaces all non-flag emojis with high-quality, consistent SVG icons.
 * All icons use currentColor for theme compatibility and follow a unified design system.
 * 
 * Usage in vanilla JS:
 * import { ReplyIcon, LikeIcon } from './icons/EmojiIcons.js';
 * element.innerHTML = ReplyIcon({ className: 'w-5 h-5' });
 */

/**
 * Helper to create SVG icon element
 */
function createIcon(svgContent, className = 'w-5 h-5') {
  const wrapper = document.createElement('span');
  wrapper.className = `icon-inline ${className}`;
  wrapper.innerHTML = svgContent;
  wrapper.setAttribute('aria-hidden', 'true');
  return wrapper;
}

/**
 * Helper to get SVG string with className
 */
function getSVGString(svgContent, className = 'w-5 h-5') {
  return `<span class="icon-inline ${className}" aria-hidden="true">${svgContent}</span>`;
}

// Icon SVG definitions
const iconSVGs = {
  fire: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M12 2C8.5 2 6 4.5 6 8c0 2.5 1.5 4.5 3 6.5s2 4 2 6c0 1.5-1.5 3-3 3s-3-1.5-3-3c0-2 1-4 2-5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M12 2c3.5 0 6 2.5 6 6 0 2.5-1.5 4.5-3 6.5s-2 4-2 6c0 1.5 1.5 3 3 3s3-1.5 3-3c0-2-1-4-2-5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M10 8c0-1.5 1-2.5 2-2.5s2 1 2 2.5c0 1-0.5 2-1 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="currentColor" fill-opacity="0.3"/>
  </svg>`,

  reply: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M8 10h8M8 14h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
  </svg>`,

  like: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
  </svg>`,

  view: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.2"/>
  </svg>`,

  warning: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M12 2L2 22h20L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
    <path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  info: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  check: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.3"/>
  </svg>`,

  bell: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="18" cy="6" r="3" fill="currentColor" fill-opacity="0.8"/>
  </svg>`,

  analytics: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <path d="M7 17l4-4 4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="7" cy="17" r="1.5" fill="currentColor"/>
    <circle cx="11" cy="13" r="1.5" fill="currentColor"/>
    <circle cx="15" cy="17" r="1.5" fill="currentColor"/>
    <circle cx="19" cy="13" r="1.5" fill="currentColor"/>
  </svg>`,

  target: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
  </svg>`,

  star: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.2"/>
  </svg>`,

  lightbulb: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
    <path d="M9 21h6M10 18h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  search: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  location: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
    <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.3"/>
  </svg>`,

  trophy: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M6 9v6a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V9M6 9h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
    <path d="M12 19v2M8 21h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  sparkle: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M6.34 6.34l2.83 2.83M14.83 14.83l2.83 2.83M17.66 6.34l-2.83 2.83M9.17 14.83l-2.83 2.83" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="2" fill="currentColor" fill-opacity="0.6"/>
  </svg>`,

  delete: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  sun: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.2"/>
    <path d="M12 1v3M12 20v3M23 12h-3M4 12H1M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12M19.07 19.07l-2.12-2.12M7.05 7.05L4.93 4.93" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  shield: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
    <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  paperclip: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,

  speaker: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <!-- Speaker box -->
    <path d="M4 8v8h4l5 5V3L8 8H4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.12"/>
    <!-- Sound waves - inner curve -->
    <path d="M15 10c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <!-- Sound waves - outer curve -->
    <path d="M17 6c3.3 0 6 2.7 6 6s-2.7 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <!-- Sound waves - largest curve -->
    <path d="M17 3c5 0 9 4 9 9s-4 9-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.7"/>
  </svg>`,
  
  speakerMuted: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <!-- Speaker box - dimmed -->
    <path d="M4 8v8h4l5 5V3L8 8H4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.08" opacity="0.6"/>
    <!-- Sound waves - dimmed and faded -->
    <path d="M15 10c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.25"/>
    <path d="M17 6c3.3 0 6 2.7 6 6s-2.7 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.25"/>
    <path d="M17 3c5 0 9 4 9 9s-4 9-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.2"/>
    <!-- Prominent red mute slash -->
    <path d="M2 2l20 20" stroke="#ff4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="1"/>
    <!-- Subtle inner slash for depth -->
    <path d="M3 3l18 18" stroke="#ff6666" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
  </svg>`,

  microphone: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`,

  art: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.1"/>
    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="12" cy="7" r="1.5" fill="currentColor"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    <circle cx="12" cy="17" r="1.5" fill="currentColor"/>
  </svg>`,

  lightning: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: currentColor;">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.2"/>
  </svg>`,
};

// Export functions to get icon HTML
export function getIconHTML(iconName, className = 'w-5 h-5') {
  const svg = iconSVGs[iconName];
  if (!svg) {
    console.warn(`Icon "${iconName}" not found`);
    return '';
  }
  return getSVGString(svg, className);
}

// Export individual icon getters
export const ReplyIcon = (className) => getIconHTML('reply', className);
export const LikeIcon = (className) => getIconHTML('like', className);
export const ViewIcon = (className) => getIconHTML('view', className);
export const WarningIcon = (className) => getIconHTML('warning', className);
export const InfoIcon = (className) => getIconHTML('info', className);
export const CheckIcon = (className) => getIconHTML('check', className);
export const BellIcon = (className) => getIconHTML('bell', className);
export const AnalyticsIcon = (className) => getIconHTML('analytics', className);
export const TargetIcon = (className) => getIconHTML('target', className);
export const StarIcon = (className) => getIconHTML('star', className);
export const LightbulbIcon = (className) => getIconHTML('lightbulb', className);
export const SearchIcon = (className) => getIconHTML('search', className);
export const LocationIcon = (className) => getIconHTML('location', className);
export const TrophyIcon = (className) => getIconHTML('trophy', className);
export const SparkleIcon = (className) => getIconHTML('sparkle', className);
export const DeleteIcon = (className) => getIconHTML('delete', className);
export const SunIcon = (className) => getIconHTML('sun', className);
export const ShieldIcon = (className) => getIconHTML('shield', className);
export const PaperclipIcon = (className) => getIconHTML('paperclip', className);
export const SpeakerIcon = (className) => getIconHTML('speaker', className);
export const SpeakerMutedIcon = (className) => getIconHTML('speakerMuted', className);
export const MicrophoneIcon = (className) => getIconHTML('microphone', className);
export const ArtIcon = (className) => getIconHTML('art', className);
export const LightningIcon = (className) => getIconHTML('lightning', className);
export const FireIcon = (className) => getIconHTML('fire', className);

// Export all as object
export const EmojiIcons = {
  ReplyIcon,
  LikeIcon,
  ViewIcon,
  WarningIcon,
  InfoIcon,
  CheckIcon,
  BellIcon,
  AnalyticsIcon,
  TargetIcon,
  StarIcon,
  LightbulbIcon,
  SearchIcon,
  LocationIcon,
  TrophyIcon,
  SparkleIcon,
  DeleteIcon,
  SunIcon,
  ShieldIcon,
  PaperclipIcon,
  SpeakerIcon,
  SpeakerMutedIcon,
  MicrophoneIcon,
  ArtIcon,
  LightningIcon,
  FireIcon,
};

