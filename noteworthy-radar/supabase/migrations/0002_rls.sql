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
