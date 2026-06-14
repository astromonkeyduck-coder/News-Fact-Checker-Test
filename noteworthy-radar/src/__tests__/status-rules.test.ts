import { canTransition, evaluateTransition, allowedNextStatuses } from "@/lib/domain/status";

describe("status transition graph", () => {
  it("allows new -> triage", () => {
    expect(canTransition("new", "triage")).toBe(true);
  });

  it("disallows new -> published", () => {
    expect(canTransition("new", "published")).toBe(false);
  });

  it("disallows no-op transitions", () => {
    expect(canTransition("triage", "triage")).toBe(false);
  });

  it("published can only be archived", () => {
    expect(allowedNextStatuses("published")).toEqual(["archived"]);
  });
});

describe("high-risk approval gate", () => {
  it("blocks high-risk advance to approved_for_caption without final approval", () => {
    const decision = evaluateTransition("triage", "approved_for_caption", {
      riskLevel: "high",
      finalEditorApproval: false,
    });
    expect(decision.allowed).toBe(false);
  });

  it("allows high-risk advance with final editor approval", () => {
    const decision = evaluateTransition("triage", "approved_for_caption", {
      riskLevel: "high",
      finalEditorApproval: true,
    });
    expect(decision.allowed).toBe(true);
  });

  it("allows high-risk advance with explicit override", () => {
    const decision = evaluateTransition("approved_for_caption", "approved_for_video", {
      riskLevel: "critical",
      finalEditorApproval: false,
      overrideHighRisk: true,
    });
    expect(decision.allowed).toBe(true);
  });

  it("does not gate low-risk leads", () => {
    const decision = evaluateTransition("triage", "approved_for_caption", {
      riskLevel: "low",
      finalEditorApproval: false,
    });
    expect(decision.allowed).toBe(true);
  });

  it("does not gate non-publish transitions even when high-risk", () => {
    const decision = evaluateTransition("triage", "verify_more", {
      riskLevel: "critical",
      finalEditorApproval: false,
    });
    expect(decision.allowed).toBe(true);
  });
});
