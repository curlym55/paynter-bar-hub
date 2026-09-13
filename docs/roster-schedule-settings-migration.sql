-- Roster Schedule Settings — one-time migration
-- ================================================
-- Run this ONCE in the Supabase SQL Editor for this project (or the new
-- village's own Supabase project when they're set up).
--
-- Adds:
--   1. roster_settings          — singleton row: which weekdays the bar is
--                                  open (with a default time each), plus an
--                                  in-app-changeable admin PIN hash.
--   2. roster_recurring_events  — named nights (Trivia, Bingo, etc.), either
--                                  on a weekday pattern ("last Wednesday") or
--                                  a fixed date every year (Australia Day).
--
-- After this runs, pages/api/roster/generate-sessions.js reads these tables
-- instead of the old generate_monthly_sessions() Postgres function — that
-- old function is no longer called and can be dropped later if you like,
-- but it's harmless to leave in place.
--
-- The seed data below reproduces Palmwoods' current schedule exactly, so
-- nothing changes in the live app until you edit it via Admin ▸ Settings.

create extension if not exists pgcrypto;

create table if not exists roster_settings (
  id int primary key default 1,
  days jsonb not null default '{}'::jsonb,
  pin_hash text,
  updated_at timestamptz not null default now(),
  constraint roster_settings_singleton check (id = 1)
);

insert into roster_settings (id, days)
values (1, '{
  "0": {"enabled": true, "time": "4:30 - 6:30"},
  "3": {"enabled": true, "time": "4:30 - 6:30"},
  "5": {"enabled": true, "time": "4:30 - 6:30"}
}'::jsonb)
on conflict (id) do nothing;

create table if not exists roster_recurring_events (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  weekday int,        -- 0=Sun..6=Sat, null if fixed_date is set instead
  occurrence text,     -- '1','2','3','4','last' — which weekday-of-month
  fixed_date text,     -- 'MM-DD' for a fixed annual date, e.g. '01-26'
  time_slot text,      -- overrides the day's default time if set
  icon text,
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed with Palmwoods' current recurring events. Delete/edit freely via
-- Admin ▸ Settings once this is live — this is just the starting point so
-- existing behaviour doesn't change on migration day.
insert into roster_recurring_events (label, weekday, occurrence, icon, color)
values
  ('Trivia', 3, 'last', '🧠', '#9C27B0'),
  ('Bingo',  3, '3',    '🎱', '#FF9800'),
  ('Social', 3, '2',    '🎉', '#2196F3');

insert into roster_recurring_events (label, fixed_date, icon, color)
values
  ('Australia Day',      '01-26', '🇦🇺', '#FF5252'),
  ('Melbourne Cup',      '11-03', '🏇', '#4CAF50'),
  ('Christmas in July',  '07-17', '🎅', '#F44336');

-- Same read-only-for-anon / writes-only-via-service-role pattern as every
-- other roster table (see write.js) — anon can SELECT, nothing else.
alter table roster_settings enable row level security;
alter table roster_recurring_events enable row level security;

create policy "roster_settings read-only" on roster_settings
  for select using (true);
create policy "roster_recurring_events read-only" on roster_recurring_events
  for select using (true);

-- NOTE — known simplification vs. the old hardcoded schedule:
-- The previous SQL function auto-added a *second* Trivia shift (6:30-8:00pm)
-- alongside the main one from May 2026 onward. That was a one-off Palmwoods
-- scheduling change baked into the old code, not a general "recurring
-- events can have two shifts" feature. This migration does not reproduce
-- it — if Palmwoods still wants a second Trivia shift each week, add it
-- manually via the existing "+ Add Extra Day" button on trivia nights, or
-- ask Claude to add proper multi-shift support to recurring events later.
