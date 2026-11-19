# GNB Edge

React + Vite version of the existing Kanban board. It uses the same Supabase
workspace, tables, document bucket and release handoff as the original HTML app.
No data migration is needed.

## Run locally

Requires Node.js 22.12 or later.

```sh
npm install
npm run dev
```

Open the localhost address printed by Vite. Routes remain hash based, so task
and document links work on static hosting without server rewrite rules.

The existing shared Supabase URL and browser publishable key are the defaults.
To connect another workspace, copy `.env.example` to `.env.local`, set both
values, then restart Vite. Only use browser publishable keys here.
For a new Supabase project, run `supabase/schema.sql` first, then the migration
described below. The existing shared project already has the base schema.

## Checks and production build

```sh
npm run lint
npm test
npm run build
npm run preview
```

Deploy the generated `dist/` folder to a static host. Opening the source
`index.html` directly no longer runs the app; use Vite or the production build.
The relative asset base supports hosting under a subdirectory.

## Structure

- `src/App.jsx`: workspace state, navigation and actions.
- `src/components/`: board, task editor, history, documents and dialogs.
- `src/api.js`: Supabase queries, revision checks and upload handling.
- `src/model.js`: filters, form values and formatting.
- `public/release-handoff.html`: the existing built-in release document.

Tasks support drag handles (pointer, touch and keyboard), status editing,
assignment, revision-checked updates, history and archival. Documents support
HTML, Markdown and PDF uploads and previews. The workspace remains a shared
board without login, with the same access rules as before.

## Enable member and document deletion

Run `supabase/migrations/001_delete_actions.sql` once in the existing Supabase
project's SQL Editor. It is safe to rerun. This migration is required because
the original board only granted read/insert permissions on members and docs.
No service-role key belongs in the frontend.

Member deletion unassigns their tasks (including archived ones) in one database
transaction, retaining the existing task audit history. Uploaded documents can
be deleted from their card or viewer. The metadata is deleted first, followed
by the storage object; failed file cleanup offers a retry. The release document
included in the app remains bundled with the source.
