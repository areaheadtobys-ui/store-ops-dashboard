-- ============================================================================
-- Store Operations Dashboard — full database schema
-- Run this in the Supabase SQL Editor on a fresh project (Project > SQL Editor).
-- Safe to re-run: guarded with IF NOT EXISTS / OR REPLACE where possible.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('super_admin', 'area_head', 'store_manager', 'supervisor', 'employee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type training_status as enum ('not_started', 'in_progress', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type compliance_status as enum ('pending', 'submitted', 'approved', 'rejected', 'overdue');
exception when duplicate_object then null; end $$;

do $$ begin
  create type file_kind as enum ('pdf', 'pptx', 'docx', 'xlsx', 'image', 'video', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type question_type as enum ('multiple_choice', 'true_false', 'identification');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum (
    'training_assigned', 'training_due', 'compliance_deadline',
    'submission_rejected', 'sop_uploaded', 'memo_uploaded', 'general'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Org structure: Areas > Branches > Departments
-- ---------------------------------------------------------------------------
create table if not exists areas (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists branches (
  id uuid primary key default uuid_generate_v4(),
  area_id uuid not null references areas(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  unique (area_id, name)
);

create table if not exists departments (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique
);

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role user_role not null default 'employee',
  area_id uuid references areas(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,
  department_id uuid references departments(id) on delete set null,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep profiles.email in sync and auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email, 'employee')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Training Center
-- ---------------------------------------------------------------------------
create table if not exists training_modules (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  category text,
  department_id uuid references departments(id),
  branch_id uuid references branches(id),
  area_id uuid references areas(id),
  file_kind file_kind not null,
  file_path text not null,          -- path inside the 'training-files' storage bucket
  thumbnail_path text,
  version text not null default '1.0',
  author_id uuid references profiles(id),
  estimated_duration_minutes int,
  expiration_date date,
  is_video boolean not null default false,
  video_duration_seconds int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists training_progress (
  id uuid primary key default uuid_generate_v4(),
  training_id uuid not null references training_modules(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status training_status not null default 'not_started',
  progress_percent int not null default 0 check (progress_percent between 0 and 100),
  last_position_seconds int not null default 0, -- video resume point
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (training_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Quizzes & Certificates
-- ---------------------------------------------------------------------------
create table if not exists quizzes (
  id uuid primary key default uuid_generate_v4(),
  training_id uuid not null references training_modules(id) on delete cascade,
  passing_score int not null default 80,
  created_at timestamptz not null default now()
);

create table if not exists quiz_questions (
  id uuid primary key default uuid_generate_v4(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  question text not null,
  question_type question_type not null,
  choices jsonb,           -- e.g. [{"id":"a","text":"..."}]
  correct_answer text not null,
  sort_order int not null default 0
);

create table if not exists quiz_attempts (
  id uuid primary key default uuid_generate_v4(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  score int not null,
  passed boolean not null,
  answers jsonb,
  attempted_at timestamptz not null default now()
);

create table if not exists certificates (
  id uuid primary key default uuid_generate_v4(),
  certificate_number text not null unique,
  user_id uuid not null references profiles(id) on delete cascade,
  training_id uuid not null references training_modules(id) on delete cascade,
  quiz_attempt_id uuid references quiz_attempts(id),
  issued_at timestamptz not null default now(),
  pdf_path text -- generated certificate stored in 'certificates' bucket
);

-- ---------------------------------------------------------------------------
-- Store Operations Compliance
-- ---------------------------------------------------------------------------
create table if not exists compliance_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique -- Opening Checklist, Closing Checklist, Visual Merchandising, etc.
);

create table if not exists compliance_submissions (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references compliance_categories(id),
  branch_id uuid not null references branches(id),
  submitted_by uuid references profiles(id),
  status compliance_status not null default 'pending',
  due_date date,
  submitted_at timestamptz,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  review_comments text,
  created_at timestamptz not null default now()
);

create table if not exists compliance_attachments (
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid not null references compliance_submissions(id) on delete cascade,
  file_path text not null, -- path inside 'compliance-files' bucket
  file_kind file_kind not null,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SOP Library / Policies / Memos
-- ---------------------------------------------------------------------------
create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  doc_type text not null check (doc_type in ('sop', 'policy', 'manual', 'guideline', 'form', 'memo')),
  category text,
  file_path text not null, -- 'documents' bucket
  version text not null default '1.0',
  requires_acknowledgment boolean not null default false,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists document_versions (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references documents(id) on delete cascade,
  version text not null,
  file_path text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists document_acknowledgments (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  signature_data text, -- base64 signature or typed full-name attestation
  unique (document_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Notifications & Announcements & Audit Log
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists announcements (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  body text not null,
  created_by uuid references profiles(id),
  branch_id uuid references branches(id), -- null = company-wide
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id),
  action text not null,       -- e.g. 'training.upload', 'compliance.approve'
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper: current user's role (used throughout RLS policies)
-- ---------------------------------------------------------------------------
create or replace function public.current_role_name()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function public.is_admin_or_head()
returns boolean as $$
  select public.current_role_name() in ('super_admin', 'area_head');
$$ language sql stable security definer;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table training_modules enable row level security;
alter table training_progress enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_attempts enable row level security;
alter table certificates enable row level security;
alter table compliance_submissions enable row level security;
alter table compliance_attachments enable row level security;
alter table documents enable row level security;
alter table document_versions enable row level security;
alter table document_acknowledgments enable row level security;
alter table notifications enable row level security;
alter table announcements enable row level security;
alter table audit_logs enable row level security;

-- Profiles: everyone can read profiles (needed for names on submissions etc.);
-- only the user themself or an admin/area head can update.
create policy "profiles_select_all" on profiles for select using (true);
create policy "profiles_update_self_or_admin" on profiles for update
  using (id = auth.uid() or public.is_admin_or_head());
create policy "profiles_insert_admin" on profiles for insert
  with check (public.is_admin_or_head() or id = auth.uid());

-- Training: everyone can read; only admin/area head/store manager can write.
create policy "training_select_all" on training_modules for select using (true);
create policy "training_write_admin" on training_modules for insert
  with check (public.current_role_name() in ('super_admin', 'area_head', 'store_manager'));
create policy "training_update_admin" on training_modules for update
  using (public.current_role_name() in ('super_admin', 'area_head', 'store_manager'));

-- Training progress: users manage their own progress; admins can view all.
create policy "progress_select_own_or_admin" on training_progress for select
  using (user_id = auth.uid() or public.is_admin_or_head());
create policy "progress_upsert_own" on training_progress for insert
  with check (user_id = auth.uid());
create policy "progress_update_own" on training_progress for update
  using (user_id = auth.uid());

-- Quizzes / questions: readable by all authenticated users, writable by admins.
create policy "quizzes_select_all" on quizzes for select using (true);
create policy "quizzes_write_admin" on quizzes for insert with check (public.is_admin_or_head());
create policy "quiz_questions_select_all" on quiz_questions for select using (true);
create policy "quiz_questions_write_admin" on quiz_questions for insert with check (public.is_admin_or_head());

-- Quiz attempts & certificates: users see their own; admins see all.
create policy "attempts_select_own_or_admin" on quiz_attempts for select
  using (user_id = auth.uid() or public.is_admin_or_head());
create policy "attempts_insert_own" on quiz_attempts for insert with check (user_id = auth.uid());
create policy "certs_select_own_or_admin" on certificates for select
  using (user_id = auth.uid() or public.is_admin_or_head());

-- Compliance: branch staff submit; store manager/area head/super admin review.
create policy "compliance_select_all" on compliance_submissions for select using (true);
create policy "compliance_insert_own_branch" on compliance_submissions for insert
  with check (
    submitted_by = auth.uid()
    or public.current_role_name() in ('super_admin', 'area_head', 'store_manager', 'supervisor')
  );
create policy "compliance_update_reviewers" on compliance_submissions for update
  using (public.current_role_name() in ('super_admin', 'area_head', 'store_manager'));

create policy "compliance_attachments_select_all" on compliance_attachments for select using (true);
create policy "compliance_attachments_insert_all" on compliance_attachments for insert with check (true);

-- Documents (SOP/Policy/Memo): readable by all; writable by admins.
create policy "documents_select_all" on documents for select using (true);
create policy "documents_write_admin" on documents for insert with check (public.is_admin_or_head());
create policy "doc_versions_select_all" on document_versions for select using (true);
create policy "doc_ack_own" on document_acknowledgments for select
  using (user_id = auth.uid() or public.is_admin_or_head());
create policy "doc_ack_insert_own" on document_acknowledgments for insert with check (user_id = auth.uid());

-- Notifications: strictly own-user.
create policy "notifications_select_own" on notifications for select using (user_id = auth.uid());
create policy "notifications_update_own" on notifications for update using (user_id = auth.uid());

-- Announcements: readable by all, writable by admins.
create policy "announcements_select_all" on announcements for select using (true);
create policy "announcements_write_admin" on announcements for insert with check (public.is_admin_or_head());

-- Audit logs: admins only.
create policy "audit_select_admin" on audit_logs for select using (public.is_admin_or_head());
create policy "audit_insert_all" on audit_logs for insert with check (true);

-- ---------------------------------------------------------------------------
-- Seed reference data (safe to edit before running)
-- ---------------------------------------------------------------------------
insert into areas (name) values ('Central Area'), ('North Area'), ('South Area')
  on conflict (name) do nothing;

insert into branches (area_id, name)
  select id, branch_name from areas, unnest(array[
    'SM Aura', 'SM Megamall', 'Greenhills', 'Trinoma', 'Robinsons Ermita'
  ]) as branch_name
  where areas.name = 'Central Area'
  on conflict do nothing;

insert into compliance_categories (name) values
  ('Opening Checklist'), ('Closing Checklist'), ('Visual Merchandising'),
  ('Safety Inspection'), ('Housekeeping'), ('POS Compliance'),
  ('Inventory Accuracy'), ('Cash Handling'), ('Store Audit'),
  ('Fire Safety'), ('Emergency Procedures')
  on conflict (name) do nothing;

insert into departments (name) values
  ('Operations'), ('Merchandising'), ('Loss Prevention'), ('Human Resources'), ('Finance')
  on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Storage buckets (run once — Supabase Storage API, not plain SQL, so this is
-- also documented in README.md as a dashboard/CLI step). Included here for
-- reference if you're using the Supabase CLI with a storage migration.
-- ---------------------------------------------------------------------------
-- insert into storage.buckets (id, name, public) values
--   ('training-files', 'training-files', false),
--   ('compliance-files', 'compliance-files', false),
--   ('documents', 'documents', false),
--   ('certificates', 'certificates', false),
--   ('avatars', 'avatars', true)
-- on conflict (id) do nothing;
