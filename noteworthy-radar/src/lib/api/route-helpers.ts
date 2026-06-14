import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth/session";
import { AuthorizationError, assertRole } from "@/lib/auth/rbac";
import type { Role } from "@/lib/constants";
import type { SessionContext } from "@/lib/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Resolves the session for a route handler or throws a 401 HttpError. */
export async function requireApiSession(minRole?: Role): Promise<SessionContext> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Not authenticated.");
  if (minRole) assertRole(session.role, minRole);
  return session;
}

/** Wraps a route handler with consistent error -> JSON mapping. */
export async function withErrors(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.flatten() },
        { status: 422 },
      );
    }
    console.error("[api] unhandled error", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
