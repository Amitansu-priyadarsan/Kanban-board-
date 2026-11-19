begin;

create table if not exists public.edge_task_photos (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.edge_tasks(id) on delete cascade,
  path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp','image/gif')),
  bytes integer not null check (bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  check (path = 'issues/' || task_id::text || '/' || id::text ||
    case content_type when 'image/jpeg' then '.jpg' when 'image/png' then '.png'
      when 'image/webp' then '.webp' when 'image/gif' then '.gif' end)
);
create index if not exists edge_task_photos_task_created
  on public.edge_task_photos(task_id, created_at, id);
alter table public.edge_task_photos enable row level security;
revoke all on public.edge_task_photos from anon, authenticated;
grant select, insert, delete on public.edge_task_photos to anon, authenticated;

drop policy if exists edge_task_photos_read on public.edge_task_photos;
create policy edge_task_photos_read on public.edge_task_photos
  for select to anon, authenticated using (true);
drop policy if exists edge_task_photos_add on public.edge_task_photos;
create policy edge_task_photos_add on public.edge_task_photos
  for insert to anon, authenticated with check (
    exists (select 1 from public.edge_tasks t where t.id = task_id and t.archived_at is null)
  );
drop policy if exists edge_task_photos_delete on public.edge_task_photos;
create policy edge_task_photos_delete on public.edge_task_photos
  for delete to anon, authenticated using (
    exists (select 1 from public.edge_tasks t where t.id = task_id and t.archived_at is null)
  );

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('gnb-edge-issue-photos','gnb-edge-issue-photos',false,10485760,
  array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists edge_issue_photos_read on storage.objects;
create policy edge_issue_photos_read on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'gnb-edge-issue-photos'
    and name ~ '^issues/[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp|gif)$'
  );
drop policy if exists edge_issue_photos_upload on storage.objects;
create policy edge_issue_photos_upload on storage.objects
  for insert to anon, authenticated with check (
    bucket_id = 'gnb-edge-issue-photos'
    and name ~ '^issues/[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp|gif)$'
    and exists (select 1 from public.edge_tasks t where t.id::text = split_part(name,'/',2) and t.archived_at is null)
  );
drop policy if exists edge_issue_photos_cleanup on storage.objects;
create policy edge_issue_photos_cleanup on storage.objects
  for delete to anon, authenticated using (
    bucket_id = 'gnb-edge-issue-photos'
    and name ~ '^issues/[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp|gif)$'
    and not exists (select 1 from public.edge_task_photos p where p.path = storage.objects.name)
  );

notify pgrst, 'reload schema';
commit;
