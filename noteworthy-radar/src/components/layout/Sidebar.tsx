"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/leads", label: "Lead Inbox" },
  { href: "/leads/new", label: "Add Lead" },
  { href: "/capture", label: "Capture Helper" },
];

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={cn(
            "rounded px-3 py-2 text-sm font-medium transition-colors",
            isActive(item.href)
              ? "bg-panel-raised text-ink"
              : "text-ink-muted hover:bg-panel hover:text-ink",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
