-- =====================================================================
-- Noteworthy Radar - core schema
-- Postgres / Supabase. Run with `supabase db reset` or psql.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- users (mirror of auth.users for joins + display data)
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);
create index if not exists idx_team_members_user on public.team_members(user_id);

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  event_name text not null,
  event_type text not null default 'other'
    check (event_type in ('sports','weather','politics','entertainment','public_safety','other')),
  teams_or_entities text,
  location text,
  start_time timestamptz,
  end_time timestamptz,
  status text not null default 'planned'
    check (status in ('planned','live','post_event','archived')),
  keyword_seed text,
  generated_keywords text[] not null default '{}',
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_events_team on public.events(team_id);

-- ---------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  platform text not null
    check (platform in ('Facebook','Telegram','X','Reddit','Instagram','TikTok','YouTube','Official Source','Local News','Other')),
  source_url text,
  source_handle text,
  post_text text,
  claimed_location text,
  claimed_time timestamptz,
  what_it_appears_to_show text,
  media_type text not null default 'unknown'
    check (media_type in ('text','image','video','livestream','unknown')),
  violence_flag boolean not null default false,
  weapon_flag boolean not null default false,
  graphic_flag boolean not null default false,
  minors_visible_flag boolean not null default false,
  private_people_identifiable_flag boolean not null default false,
  law_enforcement_involved_flag boolean not null default false,
  permission_status text not null default 'unknown'
    check (permission_status in ('unknown','link_only','ask_permission','permission_requested','permission_granted','official_source','licensed','editorial_review_needed','do_not_use')),
  status text not null default 'new'
    check (status in ('new','triage','verify_more','ask_permission','approved_for_caption','approved_for_video','published','rejected','archived')),
  newsworthiness_score int check (newsworthiness_score between 0 and 5),
  verification_score int check (verification_score between 0 and 5),
  risk_level text check (risk_level in ('low','medium','high','critical')),
  recommended_action text
    check (recommended_action in ('ignore','monitor','verify_more','ask_permission','publish_link_only','editorial_review','do_not_use')),
  headline text,
  verification_checklist jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_leads_team on public.leads(team_id);
create index if not exists idx_leads_event on public.leads(event_id);
create index if not exists idx_leads_status on public.leads(status);

-- ---------------------------------------------------------------------
-- lead_ai_triage
-- ---------------------------------------------------------------------
create table if not exists public.lead_ai_triage (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  provider text not null,
  model text,
  result jsonb not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_triage_lead on public.lead_ai_triage(lead_id);

-- ---------------------------------------------------------------------
-- lead_status_history
-- ---------------------------------------------------------------------
create table if not exists public.lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_status_history_lead on public.lead_status_history(lead_id);

-- ---------------------------------------------------------------------
-- media_assets
-- ---------------------------------------------------------------------
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  rights_status text not null default 'unknown'
    check (rights_status in ('unknown','link_only','ask_permission','permission_requested','permission_granted','official_source','licensed','editorial_review_needed','do_not_use')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_media_lead on public.media_assets(lead_id);

-- ---------------------------------------------------------------------
-- permissions (one row per lead, latest state)
-- ---------------------------------------------------------------------
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  permission_status text not null default 'unknown'
    check (permission_status in ('unknown','link_only','ask_permission','permission_requested','permission_granted','official_source','licensed','editorial_review_needed','do_not_use')),
  original_uploader text,
  contact_method text,
  date_requested timestamptz,
  date_granted timestamptz,
  license_notes text,
  allowed_platforms text[] not null default '{}',
  expiration timestamptz,
  evidence_url text,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (lead_id)
);

-- ---------------------------------------------------------------------
-- captions
-- ---------------------------------------------------------------------
create table if not exists public.captions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  neutral_under_240 text not null default '',
  breaking_under_280 text not null default '',
  facebook_post text not null default '',
  instagram_caption text not null default '',
  credit_line text not null default '',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_captions_lead on public.captions(lead_id);

-- ---------------------------------------------------------------------
-- exports
-- ---------------------------------------------------------------------
create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  status text not null check (status in ('rendered','stubbed','failed')),
  output_path text,
  top_label text not null default 'NOT REALLY THE NEWS',
  caption_text text,
  credit_line text,
  permission_status_at_export text not null,
  override_used boolean not null default false,
  error text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_exports_lead on public.exports(lead_id);

-- ---------------------------------------------------------------------
-- source_watchlists
-- ---------------------------------------------------------------------
create table if not exists public.source_watchlists (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  label text not null,
  platform text not null
    check (platform in ('Facebook','Telegram','X','Reddit','Instagram','TikTok','YouTube','Official Source','Local News','Other')),
  url text,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_watchlist_team on public.source_watchlists(team_id);

-- ---------------------------------------------------------------------
-- audit_logs (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_team on public.audit_logs(team_id, created_at desc);

-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_events_updated on public.events;
create trigger trg_events_updated before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists trg_leads_updated on public.leads;
create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Auto-create public.users row on auth signup
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- =====================================================================
-- Noteworthy Radar - Row Level Security
-- Data is scoped to team membership. Mutations require editor+ role.
-- =====================================================================

-- Helper: is the current user a member of this team?
create or replace function public.radar_is_member(target_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = target_team and tm.user_id = auth.uid()
  );
$$;

-- Helper: current user's role in this team (null if not a member).
create or replace function public.radar_role(target_team uuid)
returns text language sql stable security definer set search_path = public as $$
  select tm.role from public.team_members tm
  where tm.team_id = target_team and tm.user_id = auth.uid()
  limit 1;
$$;

-- Helper: can current user edit (editor or owner) in this team?
create or replace function public.radar_can_edit(target_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.radar_role(target_team) in ('editor','owner');
$$;

-- Enable RLS everywhere.
alter table public.users enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.events enable row level security;
alter table public.leads enable row level security;
alter table public.lead_ai_triage enable row level security;
alter table public.lead_status_history enable row level security;
alter table public.media_assets enable row level security;
alter table public.permissions enable row level security;
alter table public.captions enable row level security;
alter table public.exports enable row level security;
alter table public.source_watchlists enable row level security;
alter table public.audit_logs enable row level security;

-- users: see self + teammates.
drop policy if exists users_select on public.users;
create policy users_select on public.users for select using (
  id = auth.uid()
  or exists (
    select 1 from public.team_members me
    join public.team_members them on them.team_id = me.team_id
    where me.user_id = auth.uid() and them.user_id = public.users.id
  )
);
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update using (id = auth.uid()) with check (id = auth.uid());

-- teams: members can read; owners can update.
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select using (public.radar_is_member(id));
drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams for update using (public.radar_role(id) = 'owner');

-- team_members: members can read their team's roster; owners manage.
drop policy if exists members_select on public.team_members;
create policy members_select on public.team_members for select using (public.radar_is_member(team_id));
drop policy if exists members_write on public.team_members;
create policy members_write on public.team_members for all
  using (public.radar_role(team_id) = 'owner')
  with check (public.radar_role(team_id) = 'owner');

-- Generic team-scoped tables: select for members, write for editors+.
do $$
declare t text;
begin
  foreach t in array array[
    'events','leads','lead_ai_triage','lead_status_history',
    'media_assets','permissions','captions','exports','source_watchlists'
  ]
  loop
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format(
      'create policy %1$s_select on public.%1$s for select using (public.radar_is_member(team_id));', t);

    execute format('drop policy if exists %1$s_insert on public.%1$s;', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert with check (public.radar_can_edit(team_id));', t);

    execute format('drop policy if exists %1$s_update on public.%1$s;', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update using (public.radar_can_edit(team_id)) with check (public.radar_can_edit(team_id));', t);

    execute format('drop policy if exists %1$s_delete on public.%1$s;', t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete using (public.radar_role(team_id) = ''owner'');', t);
  end loop;
end $$;

-- audit_logs: members can read; inserts happen via service role (bypasses RLS).
-- No update/delete policies => append-only for normal clients.
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select using (public.radar_is_member(team_id));
-- =====================================================================
-- Noteworthy Radar - demo seed
--
-- IMPORTANT: Demo users + data are seeded via the Admin API, NOT raw SQL.
--
--     node supabase/seed.mjs
--
-- Why: inserting directly into auth.users from SQL leaves NULL token
-- columns that break GoTrue ("Database error querying schema" on login and
-- "Database error finding users" on the Admin API). The Admin API sets every
-- column correctly and is version-safe.
--
-- seed.mjs creates: 3 demo users (owner/editor/viewer, password
-- radar-demo-123), the "Noteworthy Radar Desk" team + memberships, a
-- "Knicks vs Spurs" event with keywords, sample leads across risk/permission
-- states, and permission rows.
--
-- This file is intentionally a no-op so the schema can be applied without
-- creating fragile auth rows.
-- =====================================================================
select 1;
-- =====================================================================
-- Noteworthy Radar - storage bucket for uploaded media + exports
-- Private bucket. The app uses the service-role client to write and to
-- mint short-lived signed URLs for playback, so no public policies needed.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('lead-media', 'lead-media', false)
on conflict (id) do nothing;
