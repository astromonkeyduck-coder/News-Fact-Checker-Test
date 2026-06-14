import type { Role } from "@/lib/constants";

const RANK: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };

export function hasAtLeast(role: Role, required: Role): boolean {
  return RANK[role] >= RANK[required];
}

export function canEdit(role: Role): boolean {
  return hasAtLeast(role, "editor");
}

export function canManageTeam(role: Role): boolean {
  return hasAtLeast(role, "owner");
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Throws AuthorizationError if the role is below the required level. */
export function assertRole(role: Role, required: Role): void {
  if (!hasAtLeast(role, required)) {
    throw new AuthorizationError(
      `Requires ${required} role; current role is ${role}.`,
    );
  }
}
