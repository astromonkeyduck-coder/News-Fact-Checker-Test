/**
 * Alternative seed via the Supabase Admin API (version-agnostic).
 * Use this if the SQL seed (0003_seed.sql) is rejected by your Supabase
 * version's auth schema.
 *
 *   node supabase/seed.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 * (or .env.local). Idempotent: re-running upserts the same demo data.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Minimal .env.local loader (no dependency on dotenv).
try {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* no .env.local; rely on process env */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEAM_ID = "11111111-1111-1111-1111-111111111111";
const EVENT_ID = "e0000000-0000-0000-0000-000000000001";
const DEMO_PASSWORD = "radar-demo-123";

const DEMO_USERS = [
  { email: "owner@radar.test", role: "owner", display_name: "Olivia Owner" },
  { email: "editor@radar.test", role: "editor", display_name: "Eddie Editor" },
  { email: "viewer@radar.test", role: "viewer", display_name: "Vera Viewer" },
];

async function ensureUser({ email, display_name }) {
  // Find existing by listing (admin getUserByEmail isn't always available).
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users?.find((u) => u.email === email);
  // Recreate via the Admin API so all GoTrue columns are set correctly.
  // (Users inserted directly via SQL can break login with
  // "Database error querying schema" due to NULL token columns.)
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id);
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name },
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  const ids = {};
  for (const u of DEMO_USERS) {
    const id = await ensureUser(u);
    ids[u.role] = id;
    await admin.from("users").upsert({ id, email: u.email, display_name: u.display_name });
  }

  await admin.from("teams").upsert({ id: TEAM_ID, name: "Noteworthy Radar Desk" });
  for (const u of DEMO_USERS) {
    await admin
      .from("team_members")
      .upsert({ team_id: TEAM_ID, user_id: ids[u.role], role: u.role }, { onConflict: "team_id,user_id" });
  }

  await admin.from("events").upsert({
    id: EVENT_ID,
    team_id: TEAM_ID,
    event_name: "Knicks vs Spurs",
    event_type: "sports",
    teams_or_entities: "Knicks, Spurs",
    location: "Madison Square Garden, NYC",
    status: "post_event",
    keyword_seed: "knicks spurs game",
    generated_keywords: [
      "Knicks vs Spurs", "Knicks", "Spurs", "Knicks Spurs",
      "Madison Square Garden", "Knicks Spurs fight", "MSG",
    ],
    notes: "Monitor post-game crowd activity. Manual capture only.",
    created_by: ids.editor,
  });

  const leads = [
    {
      id: "b0000000-0000-0000-0000-000000000001", platform: "Facebook",
      source_url: "https://www.facebook.com/example/posts/1", source_handle: "@fanvideo",
      what_it_appears_to_show: "a confrontation between apparent Knicks and Spurs fans",
      claimed_location: "Madison Square Garden, NYC", media_type: "video",
      violence_flag: true, private_people_identifiable_flag: true,
      permission_status: "ask_permission", status: "triage",
      newsworthiness_score: 3, verification_score: 2, risk_level: "high",
      recommended_action: "ask_permission", headline: "Apparent fan confrontation outside MSG",
      verification_checklist: { source_url_saved: true, original_source_located: true },
    },
    {
      id: "b0000000-0000-0000-0000-000000000002", platform: "X",
      source_url: "https://x.com/example/status/2", source_handle: "@scannerfeed",
      what_it_appears_to_show: "people running; sound of possible gunfire",
      claimed_location: "7th Ave, NYC", media_type: "video",
      violence_flag: true, weapon_flag: true, law_enforcement_involved_flag: true,
      permission_status: "link_only", status: "verify_more",
      newsworthiness_score: 4, verification_score: 1, risk_level: "critical",
      recommended_action: "verify_more", headline: "Unconfirmed reports of gunfire near MSG",
      verification_checklist: { source_url_saved: true },
    },
    {
      id: "b0000000-0000-0000-0000-000000000003", platform: "Official Source",
      source_url: "https://www.nyc.gov/nypd/example", source_handle: "NYPD",
      what_it_appears_to_show: "official statement regarding post-game crowd",
      claimed_location: "Midtown, NYC", media_type: "text",
      law_enforcement_involved_flag: true,
      permission_status: "official_source", status: "approved_for_caption",
      newsworthiness_score: 4, verification_score: 5, risk_level: "low",
      recommended_action: "publish_link_only", headline: "NYPD: no injuries after post-game crowd dispersal",
      verification_checklist: {
        source_url_saved: true, original_source_located: true, official_source_checked: true,
        claimed_location_confirmed: true, claimed_time_confirmed: true, final_editor_approval: true,
      },
    },
    {
      id: "b0000000-0000-0000-0000-000000000004", platform: "Instagram",
      source_url: "https://www.instagram.com/p/example4", source_handle: "@courtsidefan",
      what_it_appears_to_show: "players greeting fans after the final whistle",
      claimed_location: "Madison Square Garden, NYC", media_type: "image",
      permission_status: "permission_granted", status: "approved_for_video",
      newsworthiness_score: 3, verification_score: 4, risk_level: "low",
      recommended_action: "monitor", headline: "Players greet fans courtside after win",
      verification_checklist: {
        source_url_saved: true, original_source_located: true,
        permission_reviewed: true, final_editor_approval: true,
      },
    },
    {
      id: "b0000000-0000-0000-0000-000000000005", platform: "Reddit",
      source_url: "https://www.reddit.com/r/example/comments/5", source_handle: "u/hoopsfan",
      what_it_appears_to_show: "a roundup of fan-posted clips",
      claimed_location: "NYC", media_type: "video",
      minors_visible_flag: true,
      permission_status: "unknown", status: "new",
      newsworthiness_score: 2, verification_score: 1, risk_level: "medium",
      recommended_action: "verify_more", headline: "Fan clip roundup thread",
      verification_checklist: {},
    },
  ];

  for (const l of leads) {
    await admin.from("leads").upsert({
      team_id: TEAM_ID, event_id: EVENT_ID, created_by: ids.editor, ...l,
    });
  }

  await admin.from("permissions").upsert(
    [
      {
        team_id: TEAM_ID, lead_id: "b0000000-0000-0000-0000-000000000004",
        permission_status: "permission_granted", original_uploader: "@courtsidefan",
        contact_method: "Instagram DM", allowed_platforms: ["Facebook", "Instagram", "X"],
        updated_by: ids.editor,
      },
      {
        team_id: TEAM_ID, lead_id: "b0000000-0000-0000-0000-000000000003",
        permission_status: "official_source", original_uploader: "NYPD",
        contact_method: "Public statement", allowed_platforms: ["Facebook", "Instagram", "X", "YouTube"],
        updated_by: ids.editor,
      },
    ],
    { onConflict: "lead_id" },
  );

  await admin.from("source_watchlists").upsert([
    {
      team_id: TEAM_ID, label: "NYC Scanner Updates", platform: "X",
      url: "https://x.com/example", notes: "Manual check only", created_by: ids.editor,
    },
    {
      team_id: TEAM_ID, label: "NYPD News", platform: "Official Source",
      url: "https://www.nyc.gov/nypd", notes: "Official confirmations", created_by: ids.editor,
    },
  ]);

  console.log("Seed complete. Login with owner@radar.test / radar-demo-123");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
