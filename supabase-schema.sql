-- MPC Studio — schéma Supabase sécurisé
-- À utiliser dans un projet Supabase dédié à MPC Studio.

create table if not exists public.music_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  bpm integer not null default 120 check (bpm between 40 and 300),
  swing integer not null default 0 check (swing between 0 and 70),
  project_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.music_projects enable row level security;
grant select, insert, update, delete on public.music_projects to authenticated;

drop policy if exists "music_projects_select_own" on public.music_projects;
create policy "music_projects_select_own"
on public.music_projects for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "music_projects_insert_own" on public.music_projects;
create policy "music_projects_insert_own"
on public.music_projects for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "music_projects_update_own" on public.music_projects;
create policy "music_projects_update_own"
on public.music_projects for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "music_projects_delete_own" on public.music_projects;
create policy "music_projects_delete_own"
on public.music_projects for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists music_projects_user_updated_idx
on public.music_projects (user_id, updated_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'music-samples',
  'music-samples',
  false,
  52428800,
  array[
    'audio/wav','audio/x-wav','audio/mpeg','audio/mp3','audio/ogg',
    'audio/webm','audio/mp4','audio/x-m4a','application/octet-stream'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "music_samples_select_own" on storage.objects;
create policy "music_samples_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'music-samples'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "music_samples_insert_own" on storage.objects;
create policy "music_samples_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'music-samples'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "music_samples_update_own" on storage.objects;
create policy "music_samples_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'music-samples'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'music-samples'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "music_samples_delete_own" on storage.objects;
create policy "music_samples_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'music-samples'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
