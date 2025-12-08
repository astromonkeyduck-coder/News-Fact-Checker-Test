/**
 * Premium SVG Icon Library for Noteworthy News
 * 
 * Replaces all non-flag emojis with high-quality, consistent SVG icons.
 * All icons use currentColor for theme compatibility and follow a unified design system.
 * 
 * Design Principles:
 * - 24x24 viewBox for consistency
 * - Stroke width: 1.5-2px for clean lines
 * - Slightly rounded shapes, not harsh geometric
 * - Clean outlines + subtle interior detail
 * - currentColor for automatic theme adaptation
 */

import React from "react";

// Base icon props interface
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

// Helper to merge className
const cn = (...classes: (string | undefined)[]): string => {
  return classes.filter(Boolean).join(" ");
};

/**
 * Fire Icon - for trending/hot content
 * Replaces: 🔥
 */
export const FireIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M12 2C8.5 2 6 4.5 6 8c0 2.5 1.5 4.5 3 6.5s2 4 2 6c0 1.5-1.5 3-3 3s-3-1.5-3-3c0-2 1-4 2-5.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M12 2c3.5 0 6 2.5 6 6 0 2.5-1.5 4.5-3 6.5s-2 4-2 6c0 1.5 1.5 3 3 3s3-1.5 3-3c0-2-1-4-2-5.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M10 8c0-1.5 1-2.5 2-2.5s2 1 2 2.5c0 1-0.5 2-1 3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="currentColor"
      fillOpacity="0.3"
    />
  </svg>
);

/**
 * Reply/Comment Icon
 * Replaces: 💬
 */
export const ReplyIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M8 10h8M8 14h6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

/**
 * Like/Heart Icon
 * Replaces: ❤️
 */
export const LikeIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.1"
    />
  </svg>
);

/**
 * View/Eye Icon
 * Replaces: 👁️ 👀
 */
export const ViewIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle
      cx="12"
      cy="12"
      r="3"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="currentColor"
      fillOpacity="0.2"
    />
  </svg>
);

/**
 * Warning/Alert Icon
 * Replaces: ⚠️
 */
export const WarningIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M12 2L2 22h20L12 2z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.1"
    />
    <path
      d="M12 9v4M12 17h.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Info Icon
 * Replaces: ℹ️
 */
export const InfoIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <path
      d="M12 16v-4M12 8h.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Check/Success Icon
 * Replaces: ✅ ✔️
 */
export const CheckIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M20 6L9 17l-5-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
      opacity="0.3"
    />
  </svg>
);

/**
 * Bell/Notification Icon
 * Replaces: 🔔
 */
export const BellIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M13.73 21a2 2 0 0 1-3.46 0"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle
      cx="18"
      cy="6"
      r="3"
      fill="currentColor"
      fillOpacity="0.8"
    />
  </svg>
);

/**
 * Analytics/Chart Icon
 * Replaces: 📊
 */
export const AnalyticsIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <path
      d="M7 17l4-4 4 4 4-4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle
      cx="7"
      cy="17"
      r="1.5"
      fill="currentColor"
    />
    <circle
      cx="11"
      cy="13"
      r="1.5"
      fill="currentColor"
    />
    <circle
      cx="15"
      cy="17"
      r="1.5"
      fill="currentColor"
    />
    <circle
      cx="19"
      cy="13"
      r="1.5"
      fill="currentColor"
    />
  </svg>
);

/**
 * Target/Accuracy Icon
 * Replaces: 🎯
 */
export const TargetIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <circle
      cx="12"
      cy="12"
      r="6"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <circle
      cx="12"
      cy="12"
      r="2"
      fill="currentColor"
    />
  </svg>
);

/**
 * Star Icon
 * Replaces: ⭐ 🌟
 */
export const StarIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.2"
    />
  </svg>
);

/**
 * Lightbulb/Tip Icon
 * Replaces: 💡
 */
export const LightbulbIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.1"
    />
    <path
      d="M9 21h6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M10 18h4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Search Icon
 * Replaces: 🔍
 */
export const SearchIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <circle
      cx="11"
      cy="11"
      r="8"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    <path
      d="m21 21-4.35-4.35"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Location/Pin Icon
 * Replaces: 📍
 */
export const LocationIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.1"
    />
    <circle
      cx="12"
      cy="10"
      r="3"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="currentColor"
      fillOpacity="0.3"
    />
  </svg>
);

/**
 * Trophy Icon
 * Replaces: 🏆
 */
export const TrophyIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M6 9v6a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V9M6 9h12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.1"
    />
    <path
      d="M12 19v2M8 21h8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Sparkle/Star Icon
 * Replaces: ✨
 */
export const SparkleIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M12 2v4M12 18v4M2 12h4M18 12h4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M6.34 6.34l2.83 2.83M14.83 14.83l2.83 2.83M17.66 6.34l-2.83 2.83M9.17 14.83l-2.83 2.83"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle
      cx="12"
      cy="12"
      r="2"
      fill="currentColor"
      fillOpacity="0.6"
    />
  </svg>
);

/**
 * Delete/Trash Icon
 * Replaces: 🗑️
 */
export const DeleteIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M10 11v6M14 11v6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Sun/Light Mode Icon
 * Replaces: ☀️
 */
export const SunIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <circle
      cx="12"
      cy="12"
      r="5"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="currentColor"
      fillOpacity="0.2"
    />
    <path
      d="M12 1v3M12 20v3M23 12h-3M4 12H1M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12M19.07 19.07l-2.12-2.12M7.05 7.05L4.93 4.93"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Shield/Security Icon
 * Replaces: 🛡️
 */
export const ShieldIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.1"
    />
    <path
      d="M9 12l2 2 4-4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Paperclip/Attachment Icon
 * Replaces: 📎
 */
export const PaperclipIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

/**
 * Speaker/Audio Icon
 * Replaces: 🔊
 */
export const SpeakerIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    {/* Speaker box */}
    <path
      d="M4 8v8h4l5 5V3L8 8H4z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.12"
    />
    {/* Sound waves - inner curve */}
    <path
      d="M15 10c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
    />
    {/* Sound waves - outer curve */}
    <path
      d="M17 6c3.3 0 6 2.7 6 6s-2.7 6-6 6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
    />
    {/* Sound waves - largest curve */}
    <path
      d="M17 3c5 0 9 4 9 9s-4 9-9 9"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
      opacity="0.7"
    />
  </svg>
);

/**
 * Speaker Muted/Audio Off Icon
 * Replaces: 🔇 (muted speaker)
 */
export const SpeakerMutedIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    {/* Speaker box - dimmed */}
    <path
      d="M4 8v8h4l5 5V3L8 8H4z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.08"
      opacity="0.6"
    />
    {/* Sound waves - dimmed and faded */}
    <path
      d="M15 10c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
      opacity="0.25"
    />
    <path
      d="M17 6c3.3 0 6 2.7 6 6s-2.7 6-6 6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
      opacity="0.25"
    />
    <path
      d="M17 3c5 0 9 4 9 9s-4 9-9 9"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
      opacity="0.2"
    />
    {/* Prominent red mute slash */}
    <path
      d="M2 2l20 20"
      stroke="#ff4444"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="1"
    />
    {/* Subtle inner slash for depth */}
    <path
      d="M3 3l18 18"
      stroke="#ff6666"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.6"
    />
  </svg>
);

/**
 * Microphone/Voice Icon
 * Replaces: 🎤
 */
export const MicrophoneIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.1"
    />
    <path
      d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

/**
 * Art/Image Generation Icon
 * Replaces: 🎨
 */
export const ArtIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M12 2L2 7l10 5 10-5-10-5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.1"
    />
    <path
      d="M2 17l10 5 10-5M2 12l10 5 10-5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle
      cx="12"
      cy="7"
      r="1.5"
      fill="currentColor"
    />
    <circle
      cx="12"
      cy="12"
      r="1.5"
      fill="currentColor"
    />
    <circle
      cx="12"
      cy="17"
      r="1.5"
      fill="currentColor"
    />
  </svg>
);

/**
 * Lightning/Performance Icon
 * Replaces: ⚡
 */
export const LightningIcon: React.FC<IconProps> = ({ className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("w-5 h-5", className)}
    {...props}
  >
    <path
      d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.2"
    />
  </svg>
);

// Export all icons as a single object for easy access
export const EmojiIcons = {
  FireIcon,
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
};

