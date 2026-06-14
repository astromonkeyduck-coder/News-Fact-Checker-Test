import { triageResultSchema } from "@/lib/validation/schemas";
import { computeStubTriage } from "@/lib/ai/stub";
import type { LeadInput } from "@/lib/validation/schemas";

function baseLead(overrides: Partial<LeadInput> = {}): LeadInput {
  return {
    event_id: "",
    platform: "Facebook",
    source_url: "",
    source_handle: "@someone",
    post_text: "",
    claimed_location: "",
    claimed_time: "",
    what_it_appears_to_show: "a crowd gathering",
    media_type: "video",
    violence_flag: false,
    weapon_flag: false,
    graphic_flag: false,
    minors_visible_flag: false,
    private_people_identifiable_flag: false,
    law_enforcement_involved_flag: false,
    permission_status: "unknown",
    notes: "",
    ...overrides,
  };
}

describe("triage JSON contract", () => {
  it("accepts a fully-formed valid triage object", () => {
    const valid = {
      short_summary: "A summary",
      event_connection: "related",
      newsworthiness_score: 3,
      verification_score: 2,
      risk_level: "medium",
      safety_risks: [],
      privacy_risks: [],
      copyright_permission_risks: [],
      missing_facts: ["location"],
      recommended_action: "verify_more",
      caption_drafts: {
        neutral_under_240: "x",
        breaking_under_280: "y",
        facebook_post: "z",
        instagram_caption: "w",
      },
      credit_line: "Credit: @someone/FB",
      editor_questions_before_publish: [],
    };
    expect(triageResultSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects out-of-range scores", () => {
    const bad = {
      short_summary: "A summary",
      event_connection: "related",
      newsworthiness_score: 9,
      verification_score: 2,
      risk_level: "medium",
      safety_risks: [],
      privacy_risks: [],
      copyright_permission_risks: [],
      missing_facts: [],
      recommended_action: "verify_more",
      caption_drafts: { neutral_under_240: "", breaking_under_280: "", facebook_post: "", instagram_caption: "" },
      credit_line: "",
      editor_questions_before_publish: [],
    };
    expect(triageResultSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invalid risk_level enum", () => {
    const bad = { risk_level: "extreme" };
    expect(triageResultSchema.safeParse(bad).success).toBe(false);
  });

  it("stub triage always produces schema-valid output", () => {
    const inputs: LeadInput[] = [
      baseLead(),
      baseLead({ weapon_flag: true, post_text: "shooting reported" }),
      baseLead({ platform: "Official Source", permission_status: "official_source", claimed_location: "NYC", claimed_time: "2026-01-01T00:00:00Z" }),
      baseLead({ graphic_flag: true, minors_visible_flag: true }),
    ];
    for (const input of inputs) {
      const result = computeStubTriage(input);
      expect(triageResultSchema.safeParse(result).success).toBe(true);
    }
  });

  it("stub triage hedges language for unverified content", () => {
    const result = computeStubTriage(baseLead({ post_text: "fans fighting" }));
    expect(result.caption_drafts.neutral_under_240.toLowerCase()).toMatch(
      /appears to show|circulating online|not.*confirmed/,
    );
  });

  it("stub triage recommends do_not_use for unverified critical content", () => {
    const result = computeStubTriage(
      baseLead({ graphic_flag: true, post_text: "fatal shooting, body visible" }),
    );
    expect(result.risk_level).toBe("critical");
    expect(["do_not_use", "editorial_review"]).toContain(result.recommended_action);
  });
});
