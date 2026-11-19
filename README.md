# GNB Edge

## DriverApp release audit — 20 November 2026

The audit is available on this branch:

- [Detailed README with screen/backend status and embedded screenshots](audits/driverapp-2026-11-20/README.md)
- [Download the Excel audit](audits/driverapp-2026-11-20/DriverApp_Screen_Runtime_Audit_2026-11-20.xlsx)
- [All 117 original screenshots](audits/driverapp-2026-11-20/screenshots/)

It covers 191 plan entries, 96 runtime observations, 88 API checks and 20 findings.
Working behavior, planned gaps and unverified acceptance checks are labelled separately.

React + Vite version of the existing Kanban board. It uses the same Supabase
workspace, tables, document bucket and release handoff as the original HTML app.
Existing tasks, members and documents stay in place. New photo and scheduling
features require the additive SQL migrations described below.

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
For a new Supabase project, run `supabase/schema.sql` first, then the migrations
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

## Issue photos, scheduling and reports

Run these in the Supabase SQL Editor in order (safe to rerun):

1. `supabase/migrations/002_issue_photos.sql`: issue-photo metadata, private
   storage bucket and policies.
2. `supabase/migrations/003_issue_schedule.sql`: issue start/end timestamps,
   validation and schedule audit history.

The app opens on **Today**, showing issues whose scheduled interval overlaps
today in IST. **Last 7 days** includes today and the previous six calendar days;
**Custom range** includes both selected dates. Overnight issues appear on each
day they overlap; an issue ending exactly at midnight does not also appear on
the following day. **All time** includes unscheduled issues. Existing issues
start unscheduled; use All time to edit their start and end times.

New issues default to the current time plus a one-hour end time. Edit both
values, or clear both to leave the issue unscheduled. A scheduled issue must
have an end later than its start. Timestamps and CSV reports use IST regardless
of the browser's timezone. Search, assignee and period filters compose, and the
CSV download contains the matching current-board issues (not archived issues).
The board paginates its Supabase reads so reports are not silently limited to
the first API page.

Attach photos when creating an issue or upload them in an existing issue's
Photos section. JPG, PNG, WebP and GIF are supported, up to 10 MB each and ten
files per batch. View full images or delete individual photos. If creating an
issue succeeds but photo uploads fail, the saved issue opens for retry rather
than being created again. Uploads retain successful files in partial batches.
The private bucket uses signed image links and the same shared-board access
model as the rest of this app.
