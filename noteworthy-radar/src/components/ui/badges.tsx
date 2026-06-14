import { cn } from "@/lib/cn";
import type { LeadStatus, PermissionStatus, RiskLevel } from "@/lib/constants";

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "urgent" | "warn" | "ok" | "info";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "border-border bg-surface text-ink-muted",
    urgent: "border-urgent/40 bg-urgent-soft text-urgent",
    warn: "border-warn/40 bg-warn-soft text-warn",
    ok: "border-ok/40 bg-ok-soft text-ok",
    info: "border-info/40 bg-info/10 text-info",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RiskBadge({ level }: { level: RiskLevel | null | undefined }) {
  if (!level) return <Badge>unscored</Badge>;
  const tone = level === "critical" || level === "high" ? "urgent" : level === "medium" ? "warn" : "ok";
  return <Badge tone={tone}>{level}</Badge>;
}

const LEAD_STATUS_TONE: Record<LeadStatus, "default" | "urgent" | "warn" | "ok" | "info"> = {
  new: "info",
  triage: "info",
  verify_more: "warn",
  ask_permission: "warn",
  approved_for_caption: "ok",
  approved_for_video: "ok",
  published: "ok",
  rejected: "urgent",
  archived: "default",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={LEAD_STATUS_TONE[status]}>{status.replace(/_/g, " ")}</Badge>;
}

const PERMISSION_TONE: Record<PermissionStatus, "default" | "urgent" | "warn" | "ok" | "info"> = {
  unknown: "default",
  link_only: "info",
  ask_permission: "warn",
  permission_requested: "warn",
  permission_granted: "ok",
  official_source: "ok",
  licensed: "ok",
  editorial_review_needed: "warn",
  do_not_use: "urgent",
};

export function PermissionBadge({ status }: { status: PermissionStatus }) {
  return <Badge tone={PERMISSION_TONE[status]}>{status.replace(/_/g, " ")}</Badge>;
}

export function ScorePill({ value, label }: { value: number | null | undefined; label: string }) {
  const v = value ?? null;
  const tone = v == null ? "default" : v >= 4 ? "ok" : v >= 2 ? "warn" : "urgent";
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <Badge tone={tone}>{v == null ? "–" : `${v}/5`}</Badge>
    </span>
  );
}
