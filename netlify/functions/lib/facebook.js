/**
 * Facebook link handling for the Video Watermarker tool.
 *
 * LEGAL / PLATFORM CONSTRAINTS (enforced here):
 *   - We do NOT scrape Facebook, bypass login, DRM, or anti-bot protections.
 *   - The ONLY automated retrieval path is the official Meta Graph API `source`
 *     field, which returns a media URL only for videos the configured token is
 *     actually permitted to access.
 *   - When Graph access is unavailable or the video isn't accessible, we return
 *     { retrievable: false } so the UI can offer a manual-upload fallback.
 *
 * This module never downloads media itself — it resolves a URL + username and
 * (when permitted) a Graph `source` URL that the background processor fetches
 * server-side. The access token is never returned to callers/clients.
 */

const FB_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
  "fb.watch",
  "www.fb.watch",
  "fb.com",
  "www.fb.com",
]);

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v19.0";

function isFacebookHost(hostname) {
  return FB_HOSTS.has(String(hostname || "").toLowerCase());
}

/**
 * Validate that a string is a well-formed Facebook URL we recognise.
 */
function isValidFacebookUrl(url) {
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && isFacebookHost(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Parse and classify a Facebook URL. Extracts a numeric video id and a likely
 * username/page slug where possible.
 *
 * Recognised shapes:
 *   - facebook.com/watch/?v=123
 *   - facebook.com/watch?v=123
 *   - facebook.com/reel/123
 *   - facebook.com/share/v/abc/
 *   - facebook.com/{page}/videos/123
 *   - facebook.com/{page}/videos/slug/123
 *   - facebook.com/video.php?v=123
 *   - fb.watch/<short>     (requires redirect resolution)
 *
 * @returns {{ type: string, videoId: string|null, username: string|null, needsResolve: boolean }}
 */
function parseFacebookUrl(url) {
  const result = { type: "unknown", videoId: null, username: null, needsResolve: false };
  let u;
  try {
    u = new URL(url);
  } catch {
    return result;
  }

  const host = u.hostname.toLowerCase();
  const path = u.pathname.replace(/\/+$/, "");
  const segments = path.split("/").filter(Boolean);
  const vParam = u.searchParams.get("v");

  // Short links must be resolved to a canonical URL first.
  if (host === "fb.watch" || host === "www.fb.watch" || host === "fb.com" || host === "www.fb.com") {
    result.type = "short";
    result.needsResolve = true;
    return result;
  }

  // watch?v= / video.php?v=
  if (vParam && /^\d+$/.test(vParam)) {
    result.videoId = vParam;
    result.type = segments[0] === "watch" ? "watch" : "video";
    return result;
  }

  if (segments.length >= 1) {
    const first = segments[0].toLowerCase();

    if (first === "reel" && segments[1] && /^\d+$/.test(segments[1])) {
      result.type = "reel";
      result.videoId = segments[1];
      return result;
    }

    if (first === "share" && (segments[1] === "v" || segments[1] === "r") && segments[2]) {
      // share links wrap an opaque id; usually need resolution to a numeric id.
      result.type = "share";
      result.needsResolve = true;
      return result;
    }

    // {page}/videos/{id} or {page}/videos/{slug}/{id}
    const videosIdx = segments.indexOf("videos");
    if (videosIdx > 0) {
      result.username = segments[0];
      result.type = "page-video";
      const after = segments.slice(videosIdx + 1).filter((s) => /^\d+$/.test(s));
      if (after.length) result.videoId = after[after.length - 1];
      else result.needsResolve = true;
      return result;
    }

    // Bare profile/page slug with a watch param handled above; otherwise unknown.
    if (!["watch", "reel", "share", "video.php", "story.php", "permalink.php"].includes(first)) {
      result.username = segments[0];
    }
  }

  return result;
}

/**
 * Extract a display username/page slug from a parsed URL, defaulting to
 * "Facebook" when nothing usable is found.
 */
function extractUsername(parsed) {
  if (parsed && parsed.username) {
    const clean = parsed.username.replace(/[^a-zA-Z0-9._-]/g, "");
    if (clean && !/^\d+$/.test(clean)) return clean;
  }
  return "Facebook";
}

/**
 * Resolve a short / share link to its canonical Facebook URL by following
 * redirects safely:
 *   - only follow redirects that stay on Facebook hosts,
 *   - cap the number of hops,
 *   - send no credentials/cookies.
 */
async function resolveRedirect(url, maxHops = 5) {
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    if (!isValidFacebookUrl(current)) return null;
    let res;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: {
          // A realistic UA so FB returns a normal redirect rather than blocking;
          // we do not send cookies or auth and do not parse page HTML for media.
          "User-Agent":
            "Mozilla/5.0 (compatible; NoteworthyNewsBot/1.0; +https://noteworthynews.co)",
          Accept: "text/html",
        },
      });
    } catch {
      return null;
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      current = new URL(location, current).toString();
      if (!isValidFacebookUrl(current)) return null;
      continue;
    }
    // Non-redirect response: this is the canonical URL.
    return res.url || current;
  }
  return null;
}

/**
 * Compliant media retrieval via the Meta Graph API.
 * Returns a temporary `source` URL only if the configured token may access it.
 *
 * @returns {Promise<{ ok: boolean, sourceUrl?: string, fromName?: string, reason?: string }>}
 */
async function fetchGraphSource(videoId) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, reason: "GRAPH_NOT_CONFIGURED" };
  }
  if (!/^\d+$/.test(String(videoId || ""))) {
    return { ok: false, reason: "NO_VIDEO_ID" };
  }

  const endpoint =
    `https://graph.facebook.com/${GRAPH_VERSION}/${videoId}` +
    `?fields=source,from&access_token=${encodeURIComponent(token)}`;

  let res;
  try {
    res = await fetch(endpoint, { method: "GET" });
  } catch (err) {
    return { ok: false, reason: "GRAPH_REQUEST_FAILED" };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, reason: "GRAPH_BAD_RESPONSE" };
  }

  if (!res.ok || data.error) {
    // Token lacks permission, video private, or not owned — fall back gracefully.
    return { ok: false, reason: "GRAPH_NO_ACCESS" };
  }

  if (!data.source) {
    return { ok: false, reason: "NO_SOURCE" };
  }

  return {
    ok: true,
    sourceUrl: data.source,
    fromName: data.from && data.from.name ? data.from.name : null,
  };
}

/**
 * High-level resolver used by watermark-create-job.
 * Returns whether the video is retrievable via compliant means, the resolved
 * server-side source URL (never sent to the client), and a detected username.
 *
 * @returns {Promise<{ retrievable: boolean, sourceUrl?: string, username: string, reason?: string }>}
 */
async function resolveFacebookVideo(inputUrl) {
  if (!isValidFacebookUrl(inputUrl)) {
    return { retrievable: false, username: "Facebook", reason: "INVALID_URL" };
  }

  let parsed = parseFacebookUrl(inputUrl);

  if (parsed.needsResolve) {
    const canonical = await resolveRedirect(inputUrl);
    if (canonical) {
      const reparsed = parseFacebookUrl(canonical);
      // Prefer a username if the canonical URL exposed one.
      parsed = {
        ...reparsed,
        username: reparsed.username || parsed.username,
      };
    }
  }

  const username = extractUsername(parsed);

  if (!parsed.videoId) {
    return { retrievable: false, username, reason: "NO_VIDEO_ID" };
  }

  const graph = await fetchGraphSource(parsed.videoId);
  if (!graph.ok) {
    return { retrievable: false, username, reason: graph.reason };
  }

  return {
    retrievable: true,
    sourceUrl: graph.sourceUrl,
    username,
  };
}

module.exports = {
  isValidFacebookUrl,
  parseFacebookUrl,
  extractUsername,
  resolveRedirect,
  fetchGraphSource,
  resolveFacebookVideo,
};
