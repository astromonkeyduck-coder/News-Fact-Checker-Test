import type { LeadRow } from "@/lib/types";
import type { LeadInput } from "@/lib/validation/schemas";

/** Maps a stored lead row to the LeadInput shape used by AI + domain logic. */
export function leadRowToInput(lead: LeadRow): LeadInput {
  return {
    event_id: lead.event_id ?? "",
    platform: lead.platform,
    source_url: lead.source_url ?? "",
    source_handle: lead.source_handle ?? "",
    post_text: lead.post_text ?? "",
    claimed_location: lead.claimed_location ?? "",
    claimed_time: lead.claimed_time ?? "",
    what_it_appears_to_show: lead.what_it_appears_to_show ?? "",
    media_type: lead.media_type,
    violence_flag: lead.violence_flag,
    weapon_flag: lead.weapon_flag,
    graphic_flag: lead.graphic_flag,
    minors_visible_flag: lead.minors_visible_flag,
    private_people_identifiable_flag: lead.private_people_identifiable_flag,
    law_enforcement_involved_flag: lead.law_enforcement_involved_flag,
    permission_status: lead.permission_status,
    notes: lead.notes ?? "",
  };
}
