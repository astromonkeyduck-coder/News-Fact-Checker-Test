"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Button, Input, Label } from "@/components/ui/primitives";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@radar.test");
  const [password, setPassword] = useState("radar-demo-123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      router.refresh();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-urgent" aria-hidden />
          <h1 className="text-lg font-bold tracking-tight">NOTEWORTHY RADAR</h1>
        </div>

        {!configured ? (
          <div className="panel mb-4 border-warn/40 bg-warn-soft p-3 text-xs text-warn">
            Supabase is not configured. Copy <code>.env.example</code> to{" "}
            <code>.env.local</code> and set your project URL + keys, then restart.
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="panel space-y-4 p-5">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-xs text-urgent">{error}</p> : null}
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-2xs text-ink-faint">
            Demo: owner@radar.test / editor@radar.test / viewer@radar.test &middot; password
            radar-demo-123
          </p>
        </form>
      </div>
    </div>
  );
}
