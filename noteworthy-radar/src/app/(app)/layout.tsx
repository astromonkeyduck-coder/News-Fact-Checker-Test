import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { requireSession } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badges";
import { BRAND_NAME } from "@/lib/constants";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-border bg-surface p-4 lg:h-screen lg:w-60 lg:border-b-0 lg:border-r lg:sticky lg:top-0">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-urgent" aria-hidden />
            <span className="text-sm font-bold tracking-tight">NOTEWORTHY RADAR</span>
          </Link>
          <p className="mt-1 text-2xs uppercase tracking-wider text-ink-faint">
            Newsroom command center
          </p>
        </div>
        <Sidebar />
        <div className="mt-auto hidden flex-col gap-2 lg:flex">
          <div className="panel p-3">
            <div className="label">Team</div>
            <div className="mt-0.5 truncate text-xs text-ink">{session.team.name}</div>
            <div className="mt-2 flex items-center justify-between">
              <span className="truncate text-2xs text-ink-faint">{session.user.email}</span>
              <Badge tone="info">{session.role}</Badge>
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button className="w-full rounded px-3 py-2 text-left text-xs text-ink-faint hover:bg-panel hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-canvas">
        <header className="sticky top-0 z-10 border-b border-border bg-canvas/90 px-6 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-ink-faint">{BRAND_NAME} &middot; internal tooling</span>
            <span className="text-2xs uppercase tracking-wider text-ink-faint">
              Manual capture only &middot; no automated scraping
            </span>
          </div>
        </header>
        <div className="px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
