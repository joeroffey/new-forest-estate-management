-- =============================================================================
-- Cleaning runs: the cleaning teams, how long each clean takes, where each house is,
-- and the planned order of each day's cleans.
-- Safe to re-run: every statement checks whether the object exists.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Settings: the working day, and the morning WhatsApp message
-- -----------------------------------------------------------------------------
alter table public.settings add column if not exists clean_day_start time not null default '09:00';
alter table public.settings add column if not exists clean_day_end time not null default '17:00';
alter table public.settings add column if not exists cleaning_plan_whatsapp boolean not null default true;

-- -----------------------------------------------------------------------------
-- Properties: clean time (admins only) and map location (found from the postcode)
-- -----------------------------------------------------------------------------
alter table public.properties add column if not exists clean_minutes int;
do $$ begin
  alter table public.properties add constraint properties_clean_minutes_range
    check (clean_minutes is null or clean_minutes between 15 and 720);
exception when duplicate_object then null; end $$;
alter table public.properties add column if not exists lat double precision;
alter table public.properties add column if not exists lng double precision;
-- The postcode (or town) the location was looked up from; a mismatch means "look it up again".
alter table public.properties add column if not exists located_from text;

-- Owners can edit their own properties, but not the clean time or the location.
create or replace function public.properties_keep_admin_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.clean_minutes := null;
      new.lat := null;
      new.lng := null;
      new.located_from := null;
    else
      new.clean_minutes := old.clean_minutes;
      new.lat := old.lat;
      new.lng := old.lng;
      new.located_from := old.located_from;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists properties_keep_admin_fields on public.properties;
create trigger properties_keep_admin_fields before insert or update on public.properties
  for each row execute function public.properties_keep_admin_fields();

-- -----------------------------------------------------------------------------
-- Cleaning teams
-- -----------------------------------------------------------------------------
create table if not exists public.cleaning_teams (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(trim(name)) between 1 and 60),
  home_postcode    text,
  lat              double precision,
  lng              double precision,
  located_from     text,
  works_by_default boolean not null default true,
  archived         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists cleaning_teams_touch on public.cleaning_teams;
create trigger cleaning_teams_touch before update on public.cleaning_teams
  for each row execute function public.touch_updated_at();

-- Start with one team so plans work straight away; rename it and set its postcode in Settings.
insert into public.cleaning_teams (name, home_postcode)
select 'Team 1', 'BH25 7DX'
where not exists (select 1 from public.cleaning_teams);

-- -----------------------------------------------------------------------------
-- Days: which teams are working (when it differs from usual)
-- -----------------------------------------------------------------------------
create table if not exists public.cleaning_days (
  day              date primary key,
  team_ids         uuid[],          -- null means the teams that usually work
  whatsapp_sent_at timestamptz,
  updated_at       timestamptz not null default now()
);

drop trigger if exists cleaning_days_touch on public.cleaning_days;
create trigger cleaning_days_touch before update on public.cleaning_days
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- The plan: one row per changeover clean
-- -----------------------------------------------------------------------------
create table if not exists public.cleaning_jobs (
  booking_id      uuid primary key references public.bookings (id) on delete cascade,
  day             date not null,
  team_id         uuid references public.cleaning_teams (id) on delete set null,
  run_order       int,
  run_count       int,
  starts_at       time,
  ends_at         time,
  drive_minutes   int,
  drive_from      text,
  route_url       text,
  late_minutes    int not null default 0,
  warning         text,
  -- The booking whose arrival sets this clean's deadline (same-day turnaround).
  next_booking_id uuid references public.bookings (id) on delete set null,
  -- An admin moved this clean to a team for this day.
  pinned_team_id  uuid references public.cleaning_teams (id) on delete set null,
  pinned_day      date,
  signature       text,
  planned_at      timestamptz not null default now()
);
create index if not exists cleaning_jobs_day on public.cleaning_jobs (day);
create index if not exists cleaning_jobs_next on public.cleaning_jobs (next_booking_id);

-- -----------------------------------------------------------------------------
-- Security: only admins (and the server) can see or change any of this
-- -----------------------------------------------------------------------------
alter table public.cleaning_teams enable row level security;
alter table public.cleaning_days  enable row level security;
alter table public.cleaning_jobs  enable row level security;

drop policy if exists cleaning_teams_admin on public.cleaning_teams;
create policy cleaning_teams_admin on public.cleaning_teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists cleaning_days_admin on public.cleaning_days;
create policy cleaning_days_admin on public.cleaning_days for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists cleaning_jobs_admin on public.cleaning_jobs;
create policy cleaning_jobs_admin on public.cleaning_jobs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.cleaning_teams, public.cleaning_days, public.cleaning_jobs to authenticated, service_role;
