import { VERIFICATION_ITEMS, type VerificationKey } from "@/lib/constants";

export function emptyChecklist(): Record<VerificationKey, boolean> {
  return VERIFICATION_ITEMS.reduce(
    (acc, item) => {
      acc[item.key] = false;
      return acc;
    },
    {} as Record<VerificationKey, boolean>,
  );
}

export function hasFinalEditorApproval(checklist: Record<string, boolean> | null | undefined): boolean {
  return Boolean(checklist?.final_editor_approval);
}

export function verificationProgress(checklist: Record<string, boolean> | null | undefined): {
  done: number;
  total: number;
} {
  const total = VERIFICATION_ITEMS.length;
  if (!checklist) return { done: 0, total };
  const done = VERIFICATION_ITEMS.filter((i) => checklist[i.key]).length;
  return { done, total };
}
