// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db;
const schema = readFileSync(
  new URL("../supabase/schema.sql", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../supabase/migrations/001_delete_actions.sql", import.meta.url),
  "utf8",
);
beforeAll(async () => {
  db = new PGlite();
  // Supabase provides these roles and storage tables. Reproduce their relevant
  // surface in an isolated PostgreSQL instance; no live board data is touched.
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select, insert, delete on storage.objects to anon, authenticated;
    create policy storage_test_read on storage.objects for select using (bucket_id = 'gnb-edge-docs');
  `);
  await db.exec(schema);
  await db.exec(migration);
  await db.exec(migration);
  for (const file of ["002_issue_photos.sql", "003_issue_schedule.sql"]) {
    const sql = readFileSync(
      new URL("../supabase/migrations/" + file, import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
  }
}, 30000);
afterAll(async () => {
  if (db) await db.close();
});

describe("Supabase deletion migration in PostgreSQL", () => {
  it("unassigns active and archived tasks transactionally and retains audit history", async () => {
    const email = "11111111-1111-4111-8111-111111111111@roster.invalid";
    await db.query(
      "insert into public.edge_members(email,name) values ($1,$2)",
      [email, "Amit"],
    );
    await db.query(
      `insert into public.edge_tasks(title,assignee_email,archived_at) values ('Active task',$1,null),('Archived task',$1,now())`,
      [email],
    );
    await db.exec("set role anon");
    const result = await db.query(
      "select public.edge_remove_member($1) as email",
      [email],
    );
    expect(result.rows).toEqual([{ email }]);
    await db.exec("reset role");
    expect(
      (await db.query("select * from public.edge_members")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select assignee_email,revision from public.edge_tasks"))
        .rows,
    ).toEqual([
      { assignee_email: null, revision: 1 },
      { assignee_email: null, revision: 1 },
    ]);
    expect(
      (
        await db.query(
          "select * from public.edge_history where field = 'assignee_email' and old_value = $1 and new_value is null",
          [email],
        )
      ).rows,
    ).toHaveLength(2);
  });

  it("rolls back task unassignment if member removal fails", async () => {
    const email = "22222222-2222-4222-8222-222222222222@roster.invalid";
    await db.query(
      "insert into public.edge_members(email,name) values ($1,$2)",
      [email, "Keep"],
    );
    await db.query(
      "insert into public.edge_tasks(title,assignee_email) values ('Keep assigned',$1)",
      [email],
    );
    await db.exec(`
      create function public.reject_test_delete() returns trigger language plpgsql as $$ begin raise exception 'Deletion failed'; end $$;
      create trigger reject_test_delete before delete on public.edge_members for each row execute function public.reject_test_delete();
      set role anon;
    `);
    await expect(
      db.query("select public.edge_remove_member($1)", [email]),
    ).rejects.toThrow("Deletion failed");
    await db.exec("reset role");
    const rows = (
      await db.query(
        "select assignee_email,revision from public.edge_tasks where title='Keep assigned'",
      )
    ).rows;
    expect(rows).toEqual([{ assignee_email: email, revision: 0 }]);
    await db.exec(
      "drop trigger reject_test_delete on public.edge_members; drop function public.reject_test_delete();",
    );
  });

  it("permits shared-document deletion and only removes storage objects after metadata is gone", async () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const path = `shared/${id}.md`;
    await db.query(
      "insert into public.edge_docs(id,title,path,kind,file_name) values ($1,'Notes',$2,'md','notes.md')",
      [id, path],
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values ('gnb-edge-docs',$1)",
      [path],
    );
    await db.exec("set role anon");
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning name",
          [path],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "delete from public.edge_docs where id=$1 returning id",
          [id],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning name",
          [path],
        )
      ).rows,
    ).toEqual([{ name: path }]);
    await db.exec("reset role");
  });
});

describe("Issue schedules and photo permissions in PostgreSQL", () => {
  it("validates start/end times and records schedule changes in issue history", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    await db.exec("set role anon");
    await db.query(
      "insert into public.edge_tasks(id,title,starts_at,ends_at) values ($1,'Scheduled',$2,$3)",
      [id, "2026-11-20T10:00:00+05:30", "2026-11-20T11:00:00+05:30"],
    );
    await expect(
      db.query("update public.edge_tasks set ends_at=starts_at where id=$1", [
        id,
      ]),
    ).rejects.toThrow("edge_tasks_schedule_valid");
    await db.query("update public.edge_tasks set ends_at=$2 where id=$1", [
      id,
      "2026-11-20T12:00:00+05:30",
    ]);
    expect(
      (
        await db.query(
          "select field from public.edge_history where task_id=$1 and field='ends_at'",
          [id],
        )
      ).rows,
    ).toEqual([{ field: "ends_at" }]);
    expect(
      (
        await db.query("select revision from public.edge_tasks where id=$1", [
          id,
        ])
      ).rows[0].revision,
    ).toBe(1);
    await db.exec("reset role");
  });
  it("allows photo uploads only to a real active issue and protects referenced files from cleanup", async () => {
    const task = "55555555-5555-4555-8555-555555555555";
    const photo = "66666666-6666-4666-8666-666666666666";
    const path = `issues/${task}/${photo}.png`;
    await db.query(
      "insert into public.edge_tasks(id,title) values ($1,'Photo issue')",
      [task],
    );
    await db.exec("set role anon");
    await db.query(
      "insert into storage.objects(bucket_id,name) values ('gnb-edge-issue-photos',$1)",
      [path],
    );
    await db.query(
      "insert into public.edge_task_photos(id,task_id,path,file_name,content_type,bytes) values ($1,$2,$3,'screen.png','image/png',128)",
      [photo, task, path],
    );
    expect(
      (
        await db.query("select path from public.edge_task_photos where id=$1", [
          photo,
        ])
      ).rows,
    ).toEqual([{ path }]);
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning name",
          [path],
        )
      ).rows,
    ).toHaveLength(0);
    await db.query("delete from public.edge_task_photos where id=$1", [photo]);
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning name",
          [path],
        )
      ).rows,
    ).toEqual([{ name: path }]);
    await db.query(
      "update public.edge_tasks set archived_at=now() where id=$1",
      [task],
    );
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values ('gnb-edge-issue-photos',$1)",
        [path],
      ),
    ).rejects.toThrow("row-level security");
    await expect(
      db.query(
        "insert into public.edge_task_photos(id,task_id,path,file_name,content_type,bytes) values ($1,$2,$3,'screen.png','image/png',128)",
        [photo, task, path],
      ),
    ).rejects.toThrow("row-level security");
    await db.exec("reset role");
  });
});
