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
    grant select, delete on storage.objects to anon, authenticated;
    create policy storage_test_read on storage.objects for select using (true);
  `);
  await db.exec(schema);
  await db.exec(migration);
  await db.exec(migration);
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
