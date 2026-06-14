import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

let cached: SupabaseClient | null = null;

/**
 * Service-role client that bypasses RLS. SERVER-ONLY. Use sparingly for
 * audit logging and trusted writes after authorization has been checked.
 */
export function createAdminSupabase(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
