# Store Operations Dashboard

A centralized platform for store operations, employee training, compliance, and
SOPs. Built with Next.js (App Router), Tailwind CSS, and Supabase.

## What's fully working right now

- **Auth & RBAC** — Supabase Auth (email/password), login, forgot password,
  session middleware, 5 roles (`super_admin`, `area_head`, `store_manager`,
  `supervisor`, `employee`) enforced through Postgres Row Level Security.
- **Dashboard** — live KPI cards and charts (Chart.js) pulled from real tables.
- **Training Center** — upload (drag-and-drop), list, PDF/image/Office preview,
  download, per-user progress tracking (not started / in progress / completed).
- **Video Training** — dedicated player with resume-from-last-position,
  playback speed control, autosaved progress, mark-complete.
- **Store Operations Compliance** — submission form (category + branch +
  due date + multi-file upload), submission detail page with attachments,
  and an approve/reject flow with reviewer comments for Store
  Managers/Area Heads/Super Admins.
- **Database schema** — every module in the original brief (compliance, SOP
  library, policies/memos with e-signature acknowledgment, quizzes,
  certificates, notifications, announcements, audit log) has its table and RLS
  policy already defined in `supabase/schema.sql`, even where the UI is a
  stub — so adding a page doesn't require re-architecting the data model.

## What's scaffolded but needs the next pass

These have a working page reading real data, but not yet the write/interaction
layer:

| Module | Built | Still needed |
|---|---|---|
| SOP Library / Policies | document list, ack status | upload flow, e-signature capture |
| Quizzes | quiz list | question flow, auto-grading, cert issuance |
| Certificates | list of earned certs | PDF generation with QR code |
| Reports | KPI counts | Excel/PDF/CSV export |
| Users | table view (admin-gated) | invite/edit/deactivate actions |
| Notifications | list, unread highlighting | triggers that create them (DB functions/cron) |

Each of these is a natural next increment — the schema, RLS, and route already
exist, so it's additive work rather than rework.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**. Note the
   project URL and anon key from **Project Settings → API**.
2. Open **SQL Editor** and run the entire contents of `supabase/schema.sql`.
   This creates all tables, enums, RLS policies, and seed reference data
   (areas/branches/departments/compliance categories from the brief).
3. Create the storage buckets (**Storage → New bucket**), all **private**
   except `avatars`:
   - `training-files`
   - `compliance-files`
   - `documents`
   - `certificates`
   - `avatars` (public)
4. **Authentication → Providers**: email/password is enabled by default.
   Under **Authentication → URL Configuration**, set the site URL to your
   deployed URL (or `http://localhost:3000` for local dev) so password-reset
   links work.
5. Create your first `super_admin`: sign up once through the app's login
   flow (it will 404 until a user exists — instead use **Authentication →
   Users → Add user** in the Supabase dashboard), then in **SQL Editor** run:
   ```sql
   update profiles set role = 'super_admin' where email = 'you@company.com';
   ```

## 2. Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

> Office file preview (PPTX/DOCX/XLSX) uses the Microsoft Office Online
> viewer, which requires a **publicly reachable** URL — it won't render on
> `localhost`. PDF and image preview work locally. Deploy to see Office
> preview in action, or swap in a self-hosted viewer (e.g. `docx-preview`,
> `sheetjs`) if you need fully offline preview.

## 3. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or connect the repo in the Vercel dashboard. Either way, add these
environment variables in **Project Settings → Environment Variables**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (your production URL)
- `SUPABASE_SERVICE_ROLE_KEY` (only if/when you add admin-only server routes
  for user management — never expose this to the client)

## Architecture notes

- **App Router route groups**: `(auth)` for unauthenticated pages, `(dashboard)`
  for everything behind the sidebar shell — see `app/(dashboard)/layout.tsx`.
- **Auth**: `middleware.ts` refreshes the Supabase session and redirects
  unauthenticated users to `/login` on every request; `lib/supabase/server.ts`
  and `lib/supabase/client.ts` are the two entry points depending on whether
  you're in a Server or Client Component.
- **RBAC**: `lib/types.ts` exports `ROLE_PERMISSIONS` and `hasPermission()` as
  the single source of truth for what each role can do in the UI. The real
  enforcement boundary is Postgres RLS (`supabase/schema.sql`) — UI checks are
  for a good experience, not the security guarantee.
- **Design system**: corporate blue/white/gray palette in
  `tailwind.config.ts` (`brand`, `surface`, `subtle`, `border` color scales),
  dark mode via the `class` strategy toggled in `components/ThemeToggle.tsx`.

## Suggested build order from here

1. SOP/Policy upload flow + e-signature acknowledgment capture (mirrors the
   Training and Compliance upload patterns already built).
2. Quiz-taking flow + certificate PDF generation (`jspdf` + `qrcode` are
   already in `package.json`).
3. Reports export (Excel via `xlsx`/SheetJS, PDF via `jspdf`).
4. Admin user management server routes (service-role key, invite/reset/deactivate).
5. Notification triggers — Postgres functions or a scheduled Edge Function
   that inserts rows into `notifications` on training assignment / deadline
   approach / rejected submission. The compliance reject flow is a good first
   trigger point: call it from `ReviewActions.tsx` once the trigger exists.
