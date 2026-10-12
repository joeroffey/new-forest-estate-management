-- Security and integrity tests. Run against a scratch database after the migration.
-- Every block raises an exception (and stops psql) if an expectation fails.
\set ON_ERROR_STOP 1
-- Everything runs in one transaction and is rolled back, so the database is left untouched.
begin;

-- Fixtures ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.com'),
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'bob@example.com');
insert into public.profiles (id, role, full_name, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', 'Admin', 'admin@example.com'),
  ('00000000-0000-0000-0000-0000000000a1', 'customer', 'Alice', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'customer', 'Bob', 'bob@example.com');
insert into public.customers (id, full_name, email, user_id) values
  ('10000000-0000-0000-0000-0000000000a1', 'Alice Owner', 'alice@example.com', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-0000000000b1', 'Bob Owner', 'bob@example.com', '00000000-0000-0000-0000-0000000000b1');
insert into public.properties (id, customer_id, name) values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', '9 Island Point'),
  ('20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b1', 'Bob Cottage');
insert into public.bookings (customer_id, property_id, arrival_date, departure_date) values
  ('10000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-0000000000b1', current_date + 10, current_date + 13);

-- Customer Alice ---------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

do $$ begin
  if (select count(*) from public.customers) <> 1 then raise exception 'Alice should see exactly 1 customer'; end if;
  if (select count(*) from public.properties) <> 1 then raise exception 'Alice should see exactly 1 property'; end if;
  if (select count(*) from public.bookings) <> 0 then raise exception 'Alice should not see Bob''s bookings'; end if;
  if (select count(*) from public.activity) <> 0 then raise exception 'Customers cannot read activity'; end if;
  if public.is_admin() then raise exception 'Alice is not an admin'; end if;
end $$;

-- Alice can book her own property
insert into public.bookings (customer_id, property_id, arrival_date, departure_date, adults)
values ('10000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', current_date + 5, current_date + 8, 3);

-- Same-day turnaround is allowed (arrive on the previous departure day)
insert into public.bookings (customer_id, property_id, arrival_date, departure_date)
values ('10000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', current_date + 8, current_date + 10);

-- Overlap is rejected
do $$ begin
  begin
    insert into public.bookings (customer_id, property_id, arrival_date, departure_date)
    values ('10000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', current_date + 6, current_date + 7);
    raise exception 'Overlapping booking was accepted';
  exception when exclusion_violation then null;
  end;
end $$;

-- Departure must be after arrival
do $$ begin
  begin
    insert into public.bookings (customer_id, property_id, arrival_date, departure_date)
    values ('10000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', current_date + 30, current_date + 30);
    raise exception 'Zero-night booking was accepted';
  exception when check_violation then null;
  end;
end $$;

-- Alice cannot book Bob's property, nor book in Bob's name
do $$ begin
  begin
    insert into public.bookings (customer_id, property_id, arrival_date, departure_date)
    values ('10000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000b1', current_date + 40, current_date + 42);
    raise exception 'Alice booked Bob''s property';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.bookings (customer_id, property_id, arrival_date, departure_date)
    values ('10000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-0000000000b1', current_date + 40, current_date + 42);
    raise exception 'Alice booked as Bob';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Alice cannot move her booking onto Bob's account
do $$ declare n int; begin
  update public.bookings set customer_id = '10000000-0000-0000-0000-0000000000b1'
   where property_id = '20000000-0000-0000-0000-0000000000a1';
  raise exception 'Alice re-assigned a booking to Bob';
exception when insufficient_privilege then null;
end $$;

-- Alice cannot edit Bob's customer record or bookings (silently 0 rows)
do $$ declare n int; begin
  update public.bookings set adults = 9 where customer_id = '10000000-0000-0000-0000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Alice updated Bob''s bookings'; end if;
  update public.customers set full_name = 'Hacked';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Customers must not edit customer records'; end if;
end $$;

-- Cancelling frees the dates
update public.bookings set status = 'cancelled', cancelled_at = now()
 where property_id = '20000000-0000-0000-0000-0000000000a1' and arrival_date = current_date + 5;
insert into public.bookings (customer_id, property_id, arrival_date, departure_date)
values ('10000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', current_date + 6, current_date + 7);

-- Customers cannot save invoices
do $$ begin
  begin
    perform public.save_invoice(null, '10000000-0000-0000-0000-0000000000a1', current_date, current_date + 14,
      'Test', null, null, 0, null, '[{"description":"x","quantity":1,"unit_price":10}]'::jsonb);
    raise exception 'Customer saved an invoice';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Customers cannot touch invitations
do $$ begin
  begin
    perform 1 from public.invitations;
    raise exception 'Customer read invitations';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Customers can't see or change the cleaning teams or plans
do $$ declare n int; begin
  if (select count(*) from public.cleaning_teams) <> 0 then raise exception 'Customer can see cleaning teams'; end if;
  if (select count(*) from public.cleaning_jobs) <> 0 then raise exception 'Customer can see cleaning plans'; end if;
  begin
    insert into public.cleaning_teams (name) values ('Sneaky');
    raise exception 'Customer added a cleaning team';
  exception when insufficient_privilege then null;
  end;
end $$;

-- An owner editing their property can't change its clean time or map location
update public.properties set clean_minutes = 15, lat = 1, lng = 1, located_from = 'X', town = 'Lymington'
 where id = '20000000-0000-0000-0000-0000000000a1';
reset role;
do $$ declare r record; begin
  select * into r from public.properties where id = '20000000-0000-0000-0000-0000000000a1';
  if r.town is distinct from 'Lymington' then raise exception 'Owner edit of town was lost'; end if;
  if r.clean_minutes is not null or r.lat is not null or r.located_from is not null then
    raise exception 'Owner changed admin-only property fields';
  end if;
end $$;

-- Admin -----------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

do $$ declare v_id uuid; v_id2 uuid; r record; begin
  if not public.is_admin() then raise exception 'Admin not recognised'; end if;
  if (select count(*) from public.customers) <> 2 then raise exception 'Admin should see all customers'; end if;

  v_id := public.save_invoice(null, '10000000-0000-0000-0000-0000000000a1', current_date, current_date + 14,
    'September 2026', '2026-09-01', '2026-09-30', 20, 'Thanks',
    '[{"description":"Changeover – 9 Island Point","quantity":2,"unit_price":"45.50"},
      {"description":"Laundry","quantity":1,"unit_price":30}]'::jsonb);
  select * into r from public.invoices where id = v_id;
  if r.number <> 'NFEM-1001' then raise exception 'Unexpected invoice number %', r.number; end if;
  if r.subtotal <> 121.00 then raise exception 'Subtotal % should be 121.00', r.subtotal; end if;
  if r.vat_amount <> 24.20 then raise exception 'VAT % should be 24.20', r.vat_amount; end if;
  if r.total <> 145.20 then raise exception 'Total % should be 145.20', r.total; end if;

  -- edit keeps the number, replaces lines
  perform public.save_invoice(v_id, '10000000-0000-0000-0000-0000000000a1', current_date, current_date + 14,
    'September 2026', '2026-09-01', '2026-09-30', 0, null,
    '[{"description":"One line","quantity":1,"unit_price":100}]'::jsonb);
  select * into r from public.invoices where id = v_id;
  if r.number <> 'NFEM-1001' or r.total <> 100 then raise exception 'Edit failed: % %', r.number, r.total; end if;
  if (select count(*) from public.invoice_items where invoice_id = v_id) <> 1 then raise exception 'Lines not replaced'; end if;

  v_id2 := public.save_invoice(null, '10000000-0000-0000-0000-0000000000b1', current_date, current_date + 14,
    'October 2026', null, null, 0, null, '[{"description":"Bob work","quantity":1,"unit_price":50}]'::jsonb);
  if (select number from public.invoices where id = v_id2) <> 'NFEM-1002' then raise exception 'Numbering not sequential'; end if;

  -- validation
  begin
    perform public.save_invoice(null, '10000000-0000-0000-0000-0000000000a1', current_date, current_date + 14,
      null, null, null, 0, null, '[]'::jsonb);
    raise exception 'Empty invoice accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_invoice(null, '10000000-0000-0000-0000-0000000000a1', current_date, current_date - 1,
      null, null, null, 0, null, '[{"description":"x","quantity":1,"unit_price":1}]'::jsonb);
    raise exception 'Due-before-issue accepted';
  exception when invalid_parameter_value then null;
  end;

  -- paid invoices are locked
  update public.invoices set status = 'paid', paid_at = current_date where id = v_id2;
  begin
    perform public.save_invoice(v_id2, '10000000-0000-0000-0000-0000000000b1', current_date, current_date + 14,
      null, null, null, 0, null, '[{"description":"x","quantity":1,"unit_price":1}]'::jsonb);
    raise exception 'Paid invoice was edited';
  exception when invalid_parameter_value then null;
  end;

  -- mark Alice's invoice as sent so she can see it
  update public.invoices set status = 'sent', sent_at = now() where id = v_id;

  -- admins manage teams and set clean times
  if (select count(*) from public.cleaning_teams) < 1 then raise exception 'The starter cleaning team is missing'; end if;
  insert into public.cleaning_teams (name, home_postcode) values ('Team 2', 'SO41 9AA');
  update public.properties set clean_minutes = 150 where id = '20000000-0000-0000-0000-0000000000a1';
  if (select clean_minutes from public.properties where id = '20000000-0000-0000-0000-0000000000a1') <> 150 then
    raise exception 'Admin could not set the clean time';
  end if;
end $$;

reset role;

-- Alice sees her sent invoice but not Bob's, and no drafts --------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if (select count(*) from public.invoices) <> 1 then raise exception 'Alice should see exactly her 1 sent invoice'; end if;
  if (select count(*) from public.invoice_items) <> 1 then raise exception 'Alice should see her invoice lines only'; end if;
end $$;
reset role;

-- Anonymous visitors see nothing ----------------------------------------------
set role anon;
do $$ begin
  begin
    perform 1 from public.customers;
    if (select count(*) from public.customers) > 0 then raise exception 'anon can read customers'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'ALL SECURITY TESTS PASSED' as result;
rollback;
