/**
 * Telegram source adapter.
 *
 * COMPLIANCE: Noteworthy Radar does NOT scrape Telegram, automate accounts, or
 * collect data from channels the team does not control. For now this adapter
 * only normalizes manually-pasted public Telegram URLs into lead fields.
 *
 * A future official integration (Bot API / webhook) is sketched below but is
 * DISABLED by default and must only ever be enabled for channels/groups the
 * team owns or has explicit permission to ingest.
 */
import type { Platform } from "@/lib/constants";

export interface NormalizedTelegramSource {
  platform: Platform;
  source_url: string;
  source_handle: string | null;
}

const TELEGRAM_URL = /^https?:\/\/(t\.me|telegram\.me)\/([^/?#]+)(?:\/(\d+))?/i;

/** Parses a manually-pasted public Telegram URL. Returns null if not a Telegram URL. */
export function normalizeTelegramUrl(url: string): NormalizedTelegramSource | null {
  const match = url.trim().match(TELEGRAM_URL);
  if (!match) return null;
  const channel = match[2];
  return {
    platform: "Telegram",
    source_url: url.trim(),
    source_handle: channel ? `@${channel}` : null,
  };
}

/**
 * Placeholder for an official, permissioned Telegram Bot API integration.
 * Intentionally inert. Enabling it requires a bot token AND a recorded
 * permission/ownership check for the target channel.
 */
export interface TelegramOfficialAdapterConfig {
  enabled: boolean;
  botToken?: string;
  /** Channels/groups the team owns or is permitted to ingest from. */
  permittedChats: string[];
}

export const telegramOfficialAdapter = {
  config(): TelegramOfficialAdapterConfig {
    return { enabled: false, permittedChats: [] };
  },
  /** Throws unless explicitly enabled with a permitted chat. No-op by design. */
  assertPermitted(chatId: string, config: TelegramOfficialAdapterConfig): void {
    if (!config.enabled) {
      throw new Error("Telegram official adapter is disabled.");
    }
    if (!config.permittedChats.includes(chatId)) {
      throw new Error(
        `Chat ${chatId} is not in the permitted list. Refusing to ingest non-permissioned sources.`,
      );
    }
  },
};
