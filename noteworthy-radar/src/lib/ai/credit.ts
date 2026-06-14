import type { Platform } from "@/lib/constants";

const PLATFORM_SUFFIX: Partial<Record<Platform, string>> = {
  Facebook: "FB",
  X: "X",
  Instagram: "IG",
  TikTok: "TikTok",
  YouTube: "YouTube",
  Telegram: "Telegram",
  Reddit: "Reddit",
};

/**
 * Builds a credit line such as "Credit: @username/FB". Falls back to the
 * source label or "original uploader" when a handle is unknown.
 */
export function buildCreditLine(opts: {
  platform: Platform;
  handle?: string | null;
  sourceLabel?: string | null;
}): string {
  const { platform, handle, sourceLabel } = opts;

  if (platform === "Official Source" || platform === "Local News") {
    return `Credit: ${sourceLabel || handle || "official source"}`;
  }

  const suffix = PLATFORM_SUFFIX[platform];
  if (handle) {
    const clean = handle.startsWith("@") ? handle : `@${handle.replace(/^@/, "")}`;
    return suffix ? `Credit: ${clean}/${suffix}` : `Credit: ${clean}`;
  }
  return "Credit: original uploader";
}
