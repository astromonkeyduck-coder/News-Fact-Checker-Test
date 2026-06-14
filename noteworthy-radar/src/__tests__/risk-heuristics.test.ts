import { analyzeRisk, isHighRisk, maxSeverity } from "@/lib/domain/risk";
import type { LeadInput } from "@/lib/validation/schemas";

function lead(overrides: Partial<LeadInput> = {}): Partial<LeadInput> {
  return { platform: "Facebook", media_type: "video", ...overrides };
}

describe("risk heuristics", () => {
  it("returns low risk for an innocuous lead", () => {
    const { level } = analyzeRisk(lead({ what_it_appears_to_show: "players greeting fans" }));
    expect(level).toBe("low");
  });

  it("flags weapons from free text", () => {
    const { signals, level } = analyzeRisk(lead({ post_text: "sounds of gunfire near the arena" }));
    expect(signals.some((s) => s.key === "weapon")).toBe(true);
    expect(isHighRisk(level)).toBe(true);
  });

  it("escalates to critical for death/injury claims", () => {
    const { level } = analyzeRisk(lead({ what_it_appears_to_show: "a fatal incident, victim on ground" }));
    expect(level).toBe("critical");
  });

  it("honors explicit editor flags", () => {
    const { signals, level } = analyzeRisk(lead({ graphic_flag: true }));
    expect(signals.some((s) => s.key === "graphic_flag")).toBe(true);
    expect(level).toBe("critical");
  });

  it("flags minors", () => {
    const { signals } = analyzeRisk(lead({ post_text: "children seen running" }));
    expect(signals.some((s) => s.key === "minors")).toBe(true);
  });

  it("adds unverified-context signal when sensitive but missing time/location", () => {
    const { signals } = analyzeRisk(
      lead({ post_text: "a fight broke out", claimed_location: "", claimed_time: "" }),
    );
    expect(signals.some((s) => s.key === "unverified_context")).toBe(true);
  });

  it("de-duplicates signals by key", () => {
    const { signals } = analyzeRisk(lead({ weapon_flag: true, post_text: "gun gunfire shooting" }));
    const keys = signals.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("maxSeverity picks the higher level", () => {
    expect(maxSeverity("low", "high")).toBe("high");
    expect(maxSeverity("critical", "medium")).toBe("critical");
  });
});
