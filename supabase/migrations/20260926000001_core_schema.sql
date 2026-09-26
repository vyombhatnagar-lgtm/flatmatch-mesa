-- FlatMatch core schema
-- Tables: profiles, search_groups, group_members, invitations,
--         participant_requirements, requirement_items,
--         property_listings, match_results, match_explanations

create type public.requirement_priority as enum (
  'DEALBREAKER', 'MUST_HAVE', 'STRONG_PREFERENCE', 'NICE_TO_HAVE', 'NOT_IMPORTANT'
);
create type public.group_status as enum ('collecting', 'analyzed');
create type public.member_role as enum ('coordinator', 'participant');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked');
create type public.requirements_status as enum ('draft', 'submitted');

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- search_groups: one shared-flat search (exactly 3 members in the MVP)
-- ---------------------------------------------------------------------------
create table public.search_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  city text not null default 'Pune',
  coordinator_id uuid not null references public.profiles (id) on delete cascade,
  status public.group_status not null default 'collecting',
  max_members smallint not null default 3 check (max_members = 3),
  latest_run_id uuid,
  latest_run_meta jsonb,
  analyzed_at timestamptz,
  created_at timestamptz not null default now()
);
create index search_groups_coordinator_idx on public.search_groups (coordinator_id);

create table public.group_members (
  group_id uuid not null references public.search_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null,
  display_name text not null check (char_length(display_name) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.search_groups (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  label text check (label is null or char_length(label) <= 80),
  invited_by uuid not null references public.profiles (id) on delete cascade,
  status public.invitation_status not null default 'pending',
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);
create index invitations_group_idx on public.invitations (group_id);

-- ---------------------------------------------------------------------------
-- Requirements. `profile` holds the validated RequirementProfile JSON used by
-- the engine; requirement_items is a normalized, queryable copy.
-- ---------------------------------------------------------------------------
create table public.participant_requirements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.search_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  status public.requirements_status not null default 'draft',
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (group_id, user_id),
  foreign key (group_id, user_id) references public.group_members (group_id, user_id) on delete cascade
);

create table public.requirement_items (
  id uuid primary key default gen_random_uuid(),
  participant_requirement_id uuid not null references public.participant_requirements (id) on delete cascade,
  key text not null check (key ~ '^[a-z_]+(:[a-z0-9_]+)?$'),
  priority public.requirement_priority not null,
  value jsonb not null,
  unique (participant_requirement_id, key)
);

-- ---------------------------------------------------------------------------
-- Property catalog (mock listings are seeded from supabase/seed.sql)
-- ---------------------------------------------------------------------------
create table public.property_listings (
  id text primary key,
  source text not null default 'mock' check (source in ('mock', 'authorized_api')),
  title text not null,
  location text not null,
  locality text not null,
  city text not null default 'Pune',
  rent integer not null check (rent > 0),
  utilities_included boolean not null default false,
  bedrooms smallint not null check (bedrooms > 0),
  bathrooms smallint not null check (bathrooms > 0),
  floor smallint not null check (floor >= 0),
  total_floors smallint not null check (total_floors >= floor),
  lift boolean not null,
  parking text not null check (parking in ('none', 'two-wheeler', 'car')),
  furnishing text not null check (furnishing in ('furnished', 'semi-furnished', 'unfurnished')),
  pet_friendly boolean not null,
  balcony boolean not null,
  amenities text[] not null default '{}',
  latitude double precision not null,
  longitude double precision not null,
  listing_url text,
  image_url text not null,
  description text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Match results. Each analysis is a run (run_id). listing_id is not a FK so
-- future external providers can be used; a snapshot is kept in `result`.
-- ---------------------------------------------------------------------------
create table public.match_results (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.search_groups (id) on delete cascade,
  run_id uuid not null,
  listing_id text not null,
  bucket text not null check (bucket in ('shortlist', 'borderline', 'rejected')),
  rank smallint,
  viable boolean not null,
  group_score smallint not null check (group_score between 0 and 100),
  individual_scores jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index match_results_group_run_idx on public.match_results (group_id, run_id);

create table public.match_explanations (
  id uuid primary key default gen_random_uuid(),
  match_result_id uuid not null unique references public.match_results (id) on delete cascade,
  source text not null check (source in ('gemini', 'fallback')),
  model text,
  fallback_reason text,
  content jsonb not null,
  created_at timestamptz not null default now()
);
