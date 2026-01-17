create extension if not exists "pgcrypto";

create table if not exists roster (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  role_order integer default 0,
  name text not null,
  tagline text not null,
  status text default 'Online',
  created_at timestamptz default now()
);

create table if not exists comps (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  situation text,
  core text[] default '{}',
  notes text,
  created_at timestamptz default now()
);

create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  opponent text not null,
  result text not null,
  score text,
  played_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists opponent_notes (
  id uuid primary key default gen_random_uuid(),
  opponent text not null,
  patch text,
  side text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  message text not null,
  created_at timestamptz default now()
);

alter table chat_messages enable row level security;

drop policy if exists chat_select on chat_messages;
drop policy if exists chat_insert on chat_messages;

create policy chat_select on chat_messages
  for select
  using (auth.role() = 'authenticated');

create policy chat_insert on chat_messages
  for insert
  with check (auth.role() = 'authenticated');

create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null,
  starts_at timestamptz,
  location text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists schedule_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null,
  opponent text,
  starts_at timestamptz,
  location text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists draft_boards (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  blue_bans text[] default '{}',
  blue_picks text[] default '{}',
  red_bans text[] default '{}',
  red_picks text[] default '{}',
  notes text,
  created_at timestamptz default now()
);

create table if not exists opponent_profiles (
  id uuid primary key default gen_random_uuid(),
  opponent text not null,
  tendencies text,
  win_conditions text,
  draft_notes text,
  pocket_picks text,
  created_at timestamptz default now()
);

create table if not exists skin_goals (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  tagline text not null,
  target_rank text not null,
  skin text not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists practice_goals (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  tagline text not null,
  goal text not null,
  timeframe text,
  status text default 'Active',
  notes text,
  created_at timestamptz default now()
);

create table if not exists meta_watchlist (
  id uuid primary key default gen_random_uuid(),
  champion text not null,
  role text,
  priority text default 'Medium',
  reason text,
  notes text,
  created_at timestamptz default now()
);
