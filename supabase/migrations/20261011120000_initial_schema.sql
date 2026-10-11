-- =============================================================================
-- New Forest Estate Management — database schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- It is safe to re-run: every statement checks whether the object exists.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'customer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.booking_status as enum ('confirmed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_status as enum ('draft', 'sent', 'paid', 'void');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Settings (single row)
-- -----------------------------------------------------------------------------
create table if not exists public.settings (
  id                  int primary key default 1 check (id = 1),
  business_name       text not null default 'New Forest Estate Management',
  email               text,
  phone               text default '07851 489297',
  address             text default E'38 Marine Drive East\nBarton on Sea\nHampshire\nBH25 7DX',
  company_number      text,
  vat_number          text,
  vat_registered      boolean not null default false,
  vat_rate            numeric(5,2) not null default 20 check (vat_rate >= 0 and vat_rate <= 100),
  bank_name           text,
  bank_account_name   text,
  bank_sort_code      text,
  bank_account_number text,
  invoice_prefix      text not null default 'NFEM',
  invoice_next_number int not null default 1001 check (invoice_next_number > 0),
  payment_terms_days  int not null default 14 check (payment_terms_days >= 0 and payment_terms_days <= 365),
  invoice_notes       text default 'Thank you for your business.',
  notify_emails       text[] not null default '{}',
  late_change_hours   int not null default 48,
  whatsapp_enabled    boolean not null default false,
  whatsapp_provider   text not null default 'greenapi' check (whatsapp_provider in ('greenapi', 'whapi')),
  whatsapp_chat_id    text,
  whatsapp_chat_name  text,
  notion_enabled      boolean not null default false,
  notion_database_id  text,
  notion_title_prop   text default 'Name',
  updated_at          timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Profiles (one per login)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       public.user_role not null default 'customer',
  full_name  text,
  email      text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Customers
-- -----------------------------------------------------------------------------
create table if not exists public.customers (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null check (length(trim(full_name)) > 0),
  company_name    text,
  email           text not null check (position('@' in email) > 1),
  phone           text,
  phone_secondary text,
  address_line1   text,
  address_line2   text,
  town            text,
  county          text,
  postcode        text,
  notes           text,
  archived        boolean not null default false,
  user_id         uuid unique references auth.users (id) on delete set null,
  invited_at      timestamptz,
  joined_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists customers_email_unique on public.customers (lower(email));

drop trigger if exists customers_touch on public.customers;
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

create table if not exists public.customer_contacts (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers (id) on delete cascade,
  name              text not null,
  email             text,
  phone             text,
  role              text,
  receives_invoices boolean not null default false,
  receives_bookings boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists customer_contacts_customer on public.customer_contacts (customer_id);

-- -----------------------------------------------------------------------------
-- Properties
-- -----------------------------------------------------------------------------
create table if not exists public.properties (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.customers (id) on delete cascade,
  name                  text not null check (length(trim(name)) > 0),
  address_line1         text,
  address_line2         text,
  town                  text,
  postcode              text,
  bedrooms              int check (bedrooms is null or bedrooms between 0 and 50),
  bathrooms             int check (bathrooms is null or bathrooms between 0 and 50),
  sleeps                int check (sleeps is null or sleeps between 0 and 100),
  standard_setup        text,
  access_notes          text,
  cleaner_notes         text,
  default_checkout_time time not null default '10:00',
  default_arrival_time  time not null default '16:00',
  archived              boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists properties_customer on public.properties (customer_id);

drop trigger if exists properties_touch on public.properties;
create trigger properties_touch before update on public.properties
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Bookings
-- -----------------------------------------------------------------------------
create sequence if not exists public.booking_ref_seq start 1001;

create table if not exists public.bookings (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique default ('B' || nextval('public.booking_ref_seq')::text),
  customer_id      uuid not null references public.customers (id) on delete cascade,
  property_id      uuid not null references public.properties (id) on delete cascade,
  arrival_date     date not null,
  departure_date   date not null,
  nights           int generated always as (departure_date - arrival_date) stored,
  checkout_time    time not null default '10:00',
  arrival_time     time,
  adults           int not null default 1 check (adults between 0 and 50),
  children         int not null default 0 check (children between 0 and 50),
  infants          int not null default 0 check (infants between 0 and 20),
  dogs             int not null default 0 check (dogs between 0 and 10),
  setup            text not null default 'standard' check (setup in ('standard', 'custom')),
  setup_notes      text,
  reset_after      boolean not null default false,
  extras           text[] not null default '{}',
  guest_name       text,
  source           text,
  notes            text,
  status           public.booking_status not null default 'confirmed',
  cancelled_at     timestamptz,
  cancel_reason    text,
  created_by       uuid references auth.users (id) on delete set null,
  notion_page_id   text,
  notion_synced_at timestamptz,
  notion_error     text,
  whatsapp_sent_at timestamptz,
  whatsapp_error   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint bookings_dates_valid check (departure_date > arrival_date),
  constraint bookings_max_length check (departure_date - arrival_date <= 365)
);

-- A property can never have two confirmed stays on the same night.
-- Departure day is excluded, so a same-day turnaround (out 10am, in 4pm) is allowed.
do $$ begin
  alter table public.bookings add constraint bookings_no_overlap
    exclude using gist (
      property_id with =,
      daterange(arrival_date, departure_date, '[)') with &&
    ) where (status = 'confirmed');
exception when duplicate_object or duplicate_table then null; end $$;

create index if not exists bookings_customer on public.bookings (customer_id);
create index if not exists bookings_property_dates on public.bookings (property_id, arrival_date);
create index if not exists bookings_departure on public.bookings (departure_date);

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Invoices
-- -----------------------------------------------------------------------------
create table if not exists public.invoices (
  id                uuid primary key default gen_random_uuid(),
  number            text not null unique,
  customer_id       uuid not null references public.customers (id) on delete restrict,
  status            public.invoice_status not null default 'draft',
  issue_date        date not null default current_date,
  due_date          date not null,
  period_label      text,
  period_start      date,
  period_end        date,
  vat_rate          numeric(5,2) not null default 0 check (vat_rate >= 0 and vat_rate <= 100),
  subtotal          numeric(12,2) not null default 0,
  vat_amount        numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  notes             text,
  sent_at           timestamptz,
  sent_to           text[],
  last_reminder_at  timestamptz,
  paid_at           date,
  payment_method    text,
  payment_reference text,
  copied_from       uuid references public.invoices (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists invoices_customer on public.invoices (customer_id, issue_date desc);
create index if not exists invoices_status on public.invoices (status);

drop trigger if exists invoices_touch on public.invoices;
create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();

create table if not exists public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete cascade,
  position    int not null default 0,
  description text not null check (length(trim(description)) > 0),
  quantity    numeric(10,2) not null default 1 check (quantity > 0),
  unit_price  numeric(12,2) not null default 0,
  amount      numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  booking_id  uuid references public.bookings (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null
);
create index if not exists invoice_items_invoice on public.invoice_items (invoice_id, position);

-- -----------------------------------------------------------------------------
-- Invitations (portal sign-up links) — server only
-- -----------------------------------------------------------------------------
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('customer', 'admin')),
  customer_id uuid references public.customers (id) on delete cascade,
  email       text not null,
  full_name   text,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists invitations_email on public.invitations (lower(email));

-- -----------------------------------------------------------------------------
-- Activity log
-- -----------------------------------------------------------------------------
create table if not exists public.activity (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  actor_id    uuid references auth.users (id) on delete set null,
  actor_name  text,
  customer_id uuid references public.customers (id) on delete cascade,
  booking_id  uuid references public.bookings (id) on delete cascade,
  invoice_id  uuid references public.invoices (id) on delete cascade,
  kind        text not null,
  message     text not null,
  meta        jsonb
);
create index if not exists activity_created on public.activity (created_at desc);
create index if not exists activity_customer on public.activity (customer_id, created_at desc);
create index if not exists activity_booking on public.activity (booking_id, created_at desc);
create index if not exists activity_invoice on public.activity (invoice_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Access helpers (used by row level security)
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_customer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.customers where user_id = auth.uid() and archived = false limit 1;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.my_customer_id() from public;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.my_customer_id() from anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_customer_id() to authenticated;

-- -----------------------------------------------------------------------------
-- Invoice save (atomic: header + lines + totals + number)
-- -----------------------------------------------------------------------------
create or replace function public.save_invoice(
  p_invoice_id   uuid,
  p_customer_id  uuid,
  p_issue_date   date,
  p_due_date     date,
  p_period_label text,
  p_period_start date,
  p_period_end   date,
  p_vat_rate     numeric,
  p_notes        text,
  p_items        jsonb,
  p_copied_from  uuid default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id       uuid := p_invoice_id;
  v_number   text;
  v_status   public.invoice_status;
  v_subtotal numeric(12,2);
  v_vat      numeric(12,2);
  v_item     jsonb;
  v_pos      int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can save invoices' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An invoice needs at least one line' using errcode = '22023';
  end if;
  if p_due_date < p_issue_date then
    raise exception 'The due date cannot be before the invoice date' using errcode = '22023';
  end if;

  if v_id is null then
    update public.settings
       set invoice_next_number = invoice_next_number + 1
     where id = 1
     returning invoice_prefix || '-' || (invoice_next_number - 1)::text into v_number;

    insert into public.invoices (number, customer_id, issue_date, due_date, period_label,
                                 period_start, period_end, vat_rate, notes, copied_from)
    values (v_number, p_customer_id, p_issue_date, p_due_date, p_period_label,
            p_period_start, p_period_end, coalesce(p_vat_rate, 0), p_notes, p_copied_from)
    returning id into v_id;
  else
    select status into v_status from public.invoices where id = v_id for update;
    if v_status is null then
      raise exception 'Invoice not found' using errcode = 'P0002';
    end if;
    if v_status in ('paid', 'void') then
      raise exception 'Paid or void invoices cannot be edited' using errcode = '22023';
    end if;
    update public.invoices
       set customer_id = p_customer_id, issue_date = p_issue_date, due_date = p_due_date,
           period_label = p_period_label, period_start = p_period_start, period_end = p_period_end,
           vat_rate = coalesce(p_vat_rate, 0), notes = p_notes
     where id = v_id;
    delete from public.invoice_items where invoice_id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.invoice_items (invoice_id, position, description, quantity, unit_price, booking_id, property_id)
    values (
      v_id,
      v_pos,
      trim(v_item->>'description'),
      coalesce(nullif(v_item->>'quantity', '')::numeric, 1),
      coalesce(nullif(v_item->>'unit_price', '')::numeric, 0),
      nullif(v_item->>'booking_id', '')::uuid,
      nullif(v_item->>'property_id', '')::uuid
    );
    v_pos := v_pos + 1;
  end loop;

  select coalesce(sum(amount), 0) into v_subtotal from public.invoice_items where invoice_id = v_id;
  v_vat := round(v_subtotal * coalesce(p_vat_rate, 0) / 100, 2);
  update public.invoices
     set subtotal = v_subtotal, vat_amount = v_vat, total = v_subtotal + v_vat
   where id = v_id;

  return v_id;
end $$;

revoke all on function public.save_invoice(uuid, uuid, date, date, text, date, date, numeric, text, jsonb, uuid) from public;
revoke execute on function public.save_invoice(uuid, uuid, date, date, text, date, date, numeric, text, jsonb, uuid) from anon;
grant execute on function public.save_invoice(uuid, uuid, date, date, text, date, date, numeric, text, jsonb, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.settings          enable row level security;
alter table public.profiles          enable row level security;
alter table public.customers         enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.properties        enable row level security;
alter table public.bookings          enable row level security;
alter table public.invoices          enable row level security;
alter table public.invoice_items     enable row level security;
alter table public.invitations       enable row level security;
alter table public.activity          enable row level security;

-- settings
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated using (true);
drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- customers
drop policy if exists customers_admin on public.customers;
create policy customers_admin on public.customers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists customers_self_read on public.customers;
create policy customers_self_read on public.customers for select to authenticated
  using (user_id = auth.uid());

-- customer contacts
drop policy if exists contacts_admin on public.customer_contacts;
create policy contacts_admin on public.customer_contacts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists contacts_self_read on public.customer_contacts;
create policy contacts_self_read on public.customer_contacts for select to authenticated
  using (customer_id = public.my_customer_id());

-- properties
drop policy if exists properties_admin on public.properties;
create policy properties_admin on public.properties for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists properties_self_read on public.properties;
create policy properties_self_read on public.properties for select to authenticated
  using (customer_id = public.my_customer_id());
drop policy if exists properties_self_insert on public.properties;
create policy properties_self_insert on public.properties for insert to authenticated
  with check (customer_id = public.my_customer_id());
drop policy if exists properties_self_update on public.properties;
create policy properties_self_update on public.properties for update to authenticated
  using (customer_id = public.my_customer_id())
  with check (customer_id = public.my_customer_id());

-- bookings
drop policy if exists bookings_admin on public.bookings;
create policy bookings_admin on public.bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists bookings_self_read on public.bookings;
create policy bookings_self_read on public.bookings for select to authenticated
  using (customer_id = public.my_customer_id());
drop policy if exists bookings_self_insert on public.bookings;
create policy bookings_self_insert on public.bookings for insert to authenticated
  with check (
    customer_id = public.my_customer_id()
    and exists (select 1 from public.properties p
                where p.id = property_id and p.customer_id = public.my_customer_id())
  );
drop policy if exists bookings_self_update on public.bookings;
create policy bookings_self_update on public.bookings for update to authenticated
  using (customer_id = public.my_customer_id() and departure_date >= current_date)
  with check (
    customer_id = public.my_customer_id()
    and exists (select 1 from public.properties p
                where p.id = property_id and p.customer_id = public.my_customer_id())
  );

-- invoices (customers only ever see invoices that have been sent to them)
drop policy if exists invoices_admin on public.invoices;
create policy invoices_admin on public.invoices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists invoices_self_read on public.invoices;
create policy invoices_self_read on public.invoices for select to authenticated
  using (customer_id = public.my_customer_id() and status in ('sent', 'paid'));

drop policy if exists invoice_items_admin on public.invoice_items;
create policy invoice_items_admin on public.invoice_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists invoice_items_self_read on public.invoice_items;
create policy invoice_items_self_read on public.invoice_items for select to authenticated
  using (exists (select 1 from public.invoices i
                 where i.id = invoice_id
                   and i.customer_id = public.my_customer_id()
                   and i.status in ('sent', 'paid')));

-- activity: admins can read; writes happen on the server
drop policy if exists activity_admin_read on public.activity;
create policy activity_admin_read on public.activity for select to authenticated
  using (public.is_admin());

-- invitations: no client access at all (server uses the service role)

-- -----------------------------------------------------------------------------
-- Grants (Supabase defaults already grant these; repeated for clarity)
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke all on public.invitations from authenticated;
