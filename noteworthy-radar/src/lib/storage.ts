import { createAdminSupabase } from "@/lib/supabase/admin";

export const MEDIA_BUCKET = "lead-media";

export async function createSignedUrl(path: string, expiresIn = 60 * 60): Promise<string | null> {
  try {
    const admin = createAdminSupabase();
    const { data } = await admin.storage.from(MEDIA_BUCKET).createSignedUrl(path, expiresIn);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
