-- =====================================================================
-- Noteworthy Radar - storage bucket for uploaded media + exports
-- Private bucket. The app uses the service-role client to write and to
-- mint short-lived signed URLs for playback, so no public policies needed.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('lead-media', 'lead-media', false)
on conflict (id) do nothing;
