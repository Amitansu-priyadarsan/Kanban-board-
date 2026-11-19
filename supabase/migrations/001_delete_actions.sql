begin;

-- Match the existing shared-board access model. This function only removes
-- roster entries, and unassigns their tasks in the same transaction. The
-- existing task audit trigger records each assignment change.
create or replace function public.edge_remove_member(member_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_email text;
begin
  select email into removed_email
  from public.edge_members
  where email = member_email and email like '%@roster.invalid'
  for update;

  if removed_email is null then
    raise exception 'Member not found. Refresh the roster before trying again.';
  end if;

  -- Includes archived tasks so the foreign key cannot block deletion.
  update public.edge_tasks
  set assignee_email = null
  where assignee_email = removed_email;

  delete from public.edge_members where email = removed_email;
  return removed_email;
end;
$$;

revoke all on function public.edge_remove_member(text) from public;
grant execute on function public.edge_remove_member(text) to anon, authenticated;

grant delete on public.edge_docs to anon, authenticated;
drop policy if exists edge_docs_delete on public.edge_docs;
create policy edge_docs_delete on public.edge_docs
  for delete to anon, authenticated
  using (split_part(path, '/', 1) = 'shared');

-- The original storage rollback policy permits deleting unreferenced files.
-- Remove the metadata first, then remove that file through the storage API.
drop policy if exists edge_storage_rollback on storage.objects;
create policy edge_storage_rollback on storage.objects
  for delete to anon, authenticated
  using (
    bucket_id = 'gnb-edge-docs'
    and name ~ '^shared/[0-9a-f-]{36}[.](html|md|pdf)$'
    and not exists (select 1 from public.edge_docs as d where d.path = storage.objects.name)
  );

commit;
