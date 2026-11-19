begin;

alter table public.edge_tasks add column if not exists starts_at timestamptz;
alter table public.edge_tasks add column if not exists ends_at timestamptz;
alter table public.edge_tasks drop constraint if exists edge_tasks_schedule_valid;
alter table public.edge_tasks add constraint edge_tasks_schedule_valid check (
  (starts_at is null and ends_at is null) or
  (starts_at is not null and ends_at is not null and ends_at > starts_at)
);
create index if not exists edge_tasks_schedule on public.edge_tasks(starts_at, ends_at)
  where archived_at is null;
grant insert(starts_at,ends_at), update(starts_at,ends_at)
  on public.edge_tasks to anon, authenticated;

-- Retain the existing revision and history contract, including schedule edits.
create or replace function public.edge_task_history()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  changed_field text;
  before_row jsonb;
  after_row jsonb := to_jsonb(new);
begin
  if tg_op = 'INSERT' then
    insert into public.edge_history(task_id, field, new_value) values (new.id, 'created', new.title);
    if new.assignee_email is not null then
      insert into public.edge_history(task_id, field, new_value) values (new.id, 'assignee_email', new.assignee_email);
    end if;
    return new;
  end if;
  before_row := to_jsonb(old);
  new.updated_at := now();
  new.revision := old.revision + 1;
  foreach changed_field in array array['title','scope','priority','status','description','acceptance',
    'assignee_email','backend_url','frontend_url','due_date','archived_at','starts_at','ends_at']
  loop
    if before_row -> changed_field is distinct from after_row -> changed_field then
      insert into public.edge_history(task_id,field,old_value,new_value)
      values(new.id,changed_field,before_row ->> changed_field,after_row ->> changed_field);
    end if;
  end loop;
  return new;
end
$$;
revoke all on function public.edge_task_history() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
