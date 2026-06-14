import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Role } from "@/lib/constants";
import type { SessionContext } from "@/lib/types";

/**
 * Resolves the signed-in user, their (first) team membership, and role.
 * Returns null when there is no authenticated session or no team membership.
 */
export async function getSession(): Promise<SessionContext | null> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("team_members")
    .select("role, team:teams(*)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership || !membership.team) return null;

  const team = Array.isArray(membership.team) ? membership.team[0] : membership.team;
  if (!team) return null;

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      display_name: (user.user_metadata?.display_name as string | undefined) ?? null,
      created_at: user.created_at ?? new Date().toISOString(),
    },
    team,
    role: membership.role as Role,
  };
}

/** For pages/route handlers: require an authenticated session or redirect. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
