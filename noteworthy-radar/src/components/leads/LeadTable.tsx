"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Badge, PermissionBadge, RiskBadge, ScorePill, StatusBadge } from "@/components/ui/badges";
import { Select } from "@/components/ui/primitives";
import {
  LEAD_STATUSES,
  PERMISSION_STATUSES,
  PLATFORMS,
  RISK_LEVELS,
} from "@/lib/constants";
import type { EventRow, LeadRow } from "@/lib/types";

interface Props {
  leads: LeadRow[];
  events: Pick<EventRow, "id" | "event_name">[];
}

export function LeadTable({ leads, events }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [filters, setFilters] = useState({
    platform: "",
    status: "",
    event: "",
    risk: "",
    permission: "",
    minVerification: "",
    since: "",
  });

  const eventName = useMemo(() => {
    const map = new Map(events.map((e) => [e.id, e.event_name]));
    return (id: string | null) => (id ? (map.get(id) ?? "-") : "-");
  }, [events]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filters.platform && l.platform !== filters.platform) return false;
      if (filters.status && l.status !== filters.status) return false;
      if (filters.event && l.event_id !== filters.event) return false;
      if (filters.risk && l.risk_level !== filters.risk) return false;
      if (filters.permission && l.permission_status !== filters.permission) return false;
      if (filters.minVerification && (l.verification_score ?? -1) < Number(filters.minVerification))
        return false;
      if (filters.since && new Date(l.created_at) < new Date(filters.since)) return false;
      return true;
    });
  }, [leads, filters]);

  const columns = useMemo<ColumnDef<LeadRow>[]>(
    () => [
      {
        accessorKey: "headline",
        header: "Headline / summary",
        cell: ({ row }) => (
          <div className="max-w-xs">
            <Link href={`/leads/${row.original.id}`} className="font-medium text-ink hover:underline">
              {row.original.headline || row.original.what_it_appears_to_show || "(untitled lead)"}
            </Link>
            <div className="mt-0.5 truncate text-2xs text-ink-faint">
              {eventName(row.original.event_id)}
            </div>
          </div>
        ),
      },
      { accessorKey: "platform", header: "Platform", cell: ({ row }) => <span className="text-ink-muted">{row.original.platform}</span> },
      {
        accessorKey: "source_handle",
        header: "Handle",
        cell: ({ row }) => <span className="text-ink-muted">{row.original.source_handle || "-"}</span>,
      },
      {
        accessorKey: "claimed_location",
        header: "Location",
        cell: ({ row }) => <span className="text-ink-muted">{row.original.claimed_location || "-"}</span>,
      },
      {
        id: "newsworthiness",
        header: "News",
        cell: ({ row }) => <ScorePill value={row.original.newsworthiness_score} label="Newsworthiness" />,
      },
      {
        id: "verification",
        header: "Verify",
        cell: ({ row }) => <ScorePill value={row.original.verification_score} label="Verification" />,
      },
      { id: "risk", header: "Risk", cell: ({ row }) => <RiskBadge level={row.original.risk_level} /> },
      { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: "permission",
        header: "Permission",
        cell: ({ row }) => <PermissionBadge status={row.original.permission_status} />,
      },
      {
        id: "action",
        header: "Recommended",
        cell: ({ row }) =>
          row.original.recommended_action ? (
            <Badge>{row.original.recommended_action.replace(/_/g, " ")}</Badge>
          ) : (
            <span className="text-ink-faint">-</span>
          ),
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-2xs text-ink-faint">
            {new Date(row.original.created_at).toLocaleDateString()}
          </span>
        ),
      },
    ],
    [eventName],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const set = (key: keyof typeof filters) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-3">
      <div className="panel flex flex-wrap items-end gap-2 p-3">
        <FilterSelect label="Platform" value={filters.platform} onChange={set("platform")} options={PLATFORMS} />
        <FilterSelect label="Status" value={filters.status} onChange={set("status")} options={LEAD_STATUSES} />
        <div>
          <span className="label mb-1 block">Event</span>
          <Select value={filters.event} onChange={set("event")} className="h-8 py-0 text-xs">
            <option value="">All</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.event_name}
              </option>
            ))}
          </Select>
        </div>
        <FilterSelect label="Risk" value={filters.risk} onChange={set("risk")} options={RISK_LEVELS} />
        <FilterSelect
          label="Permission"
          value={filters.permission}
          onChange={set("permission")}
          options={PERMISSION_STATUSES}
        />
        <FilterSelect
          label="Min verify"
          value={filters.minVerification}
          onChange={set("minVerification")}
          options={["0", "1", "2", "3", "4", "5"]}
        />
        <div>
          <span className="label mb-1 block">Since</span>
          <input
            type="date"
            value={filters.since}
            onChange={set("since")}
            className="field h-8 py-0 text-xs"
          />
        </div>
        <span className="ml-auto self-center text-2xs text-ink-faint">
          {filtered.length} of {leads.length}
        </span>
      </div>

      <div className="panel overflow-x-auto p-0">
        <table>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border text-left">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-ink-faint hover:text-ink"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50 align-top hover:bg-panel-raised">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-ink-faint">
                  No leads match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: readonly string[];
}) {
  return (
    <div>
      <span className="label mb-1 block">{label}</span>
      <Select value={value} onChange={onChange} className="h-8 py-0 text-xs">
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </Select>
    </div>
  );
}
