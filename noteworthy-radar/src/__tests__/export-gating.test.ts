import { evaluateExportGate } from "@/lib/domain/permission";

describe("export permission gate", () => {
  it("blocks export when permission is unknown", () => {
    const d = evaluateExportGate({
      permissionStatus: "unknown",
      riskLevel: "low",
      finalEditorApproval: true,
    });
    expect(d.allowed).toBe(false);
  });

  it("blocks export for link_only", () => {
    const d = evaluateExportGate({
      permissionStatus: "link_only",
      riskLevel: "low",
      finalEditorApproval: true,
    });
    expect(d.allowed).toBe(false);
  });

  it("allows export for permission_granted (low risk)", () => {
    const d = evaluateExportGate({
      permissionStatus: "permission_granted",
      riskLevel: "low",
      finalEditorApproval: false,
    });
    expect(d.allowed).toBe(true);
  });

  it("allows export for official_source and licensed", () => {
    expect(
      evaluateExportGate({ permissionStatus: "official_source", riskLevel: "low", finalEditorApproval: false }).allowed,
    ).toBe(true);
    expect(
      evaluateExportGate({ permissionStatus: "licensed", riskLevel: "low", finalEditorApproval: false }).allowed,
    ).toBe(true);
  });

  it("requires override for editorial_review_needed", () => {
    const blocked = evaluateExportGate({
      permissionStatus: "editorial_review_needed",
      riskLevel: "low",
      finalEditorApproval: true,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.requiresOverride).toBe(true);

    const allowed = evaluateExportGate({
      permissionStatus: "editorial_review_needed",
      riskLevel: "low",
      finalEditorApproval: true,
      overrideHighRisk: true,
    });
    expect(allowed.allowed).toBe(true);
  });

  it("blocks high-risk export without final approval even when permission is granted", () => {
    const d = evaluateExportGate({
      permissionStatus: "permission_granted",
      riskLevel: "critical",
      finalEditorApproval: false,
    });
    expect(d.allowed).toBe(false);
  });

  it("allows high-risk export with final approval", () => {
    const d = evaluateExportGate({
      permissionStatus: "permission_granted",
      riskLevel: "high",
      finalEditorApproval: true,
    });
    expect(d.allowed).toBe(true);
  });

  it("refuses do_not_use outright", () => {
    const d = evaluateExportGate({
      permissionStatus: "do_not_use",
      riskLevel: "low",
      finalEditorApproval: true,
      overrideHighRisk: true,
    });
    expect(d.allowed).toBe(false);
  });
});
