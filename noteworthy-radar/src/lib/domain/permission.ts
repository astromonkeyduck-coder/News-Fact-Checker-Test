import {
  EXPORT_ALLOWED_PERMISSIONS,
  EXPORT_OVERRIDE_PERMISSION,
  type PermissionStatus,
  type RiskLevel,
} from "@/lib/constants";
import { isHighRisk } from "@/lib/domain/risk";

export interface ExportGateInput {
  permissionStatus: PermissionStatus;
  riskLevel: RiskLevel | null;
  finalEditorApproval: boolean;
  overrideHighRisk?: boolean;
}

export interface ExportGateDecision {
  allowed: boolean;
  requiresOverride: boolean;
  reason?: string;
}

/**
 * Server-side gate that decides whether a video export may proceed.
 *
 * Rules:
 *  - Export is refused unless permission is granted/official/licensed, OR
 *    editorial_review_needed WITH an explicit editor override.
 *  - High/critical-risk leads additionally require final editor approval
 *    (or an explicit override) before export.
 */
export function evaluateExportGate(input: ExportGateInput): ExportGateDecision {
  const { permissionStatus, riskLevel, finalEditorApproval, overrideHighRisk } = input;

  const cleanlyAllowed = (
    EXPORT_ALLOWED_PERMISSIONS as readonly PermissionStatus[]
  ).includes(permissionStatus);
  const overridable = permissionStatus === EXPORT_OVERRIDE_PERMISSION;

  if (!cleanlyAllowed && !overridable) {
    return {
      allowed: false,
      requiresOverride: false,
      reason: `Export blocked: permission status "${permissionStatus}" does not allow republishing. Required: permission_granted, official_source, licensed, or editorial_review_needed with override.`,
    };
  }

  if (overridable && !overrideHighRisk) {
    return {
      allowed: false,
      requiresOverride: true,
      reason:
        'Permission is "editorial_review_needed". An explicit editor override is required to export.',
    };
  }

  if (isHighRisk(riskLevel) && !finalEditorApproval && !overrideHighRisk) {
    return {
      allowed: false,
      requiresOverride: true,
      reason:
        "High-risk lead requires final editor approval (verification checklist) or an explicit override before export.",
    };
  }

  return { allowed: true, requiresOverride: overridable || isHighRisk(riskLevel) };
}
