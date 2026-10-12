# New Forest Estate Management

The public website, owner portal and admin CRM for New Forest Estate Management.

- **Public site**: home, services, about, contact (enquiries are emailed to the team).
- **Owner portal** (`/portal`): owners send bookings (one stay or a whole season at once), change or cancel them, manage their property details and see their invoices.
- **Admin CRM** (`/admin`): dashboard, calendar, bookings, customers, invoices (with "copy last month", PDF, email, paid/unpaid/void), settings.
- **Automations**: each new, changed or cancelled booking updates Notion, posts to the cleaners' WhatsApp group, and emails the owner and the team.

Built with Next.js 15, Supabase (database and logins), Resend (email), Notion API and Green-API / Whapi.Cloud (WhatsApp). Hosted on Vercel.

---

## Setting it up (one time)

Do these in order. Each step says exactly where to click.

### 1. Supabase (database and logins)

1. Go to [supabase.com](https://supabase.com), create a project. Choose region **London (eu-west-2)**. Save the database password somewhere safe.
2. Open **SQL Editor → New query**. Paste the whole of `supabase/migrations/20261011120000_initial_schema.sql` and press **Run**. You should see "Success". (It's safe to run again.)
3. Open **Authentication → Sign In / Providers → Email** and turn **off** "Allow new users to sign up". Accounts are only ever created by invitation from the admin area.
4. Open **Authentication → URL Configuration** and set **Site URL** to `https://www.newforestestatemanagement.co.uk`.
5. Open **Project Settings → API keys**. You'll need the **Project URL**, the **anon / publishable** key and the **service_role / secret** key in step 3.

### 2. Resend (emails)

1. Create an account at [resend.com](https://resend.com).
2. **Domains → Add domain** → `newforestestatemanagement.co.uk`. Resend shows some DNS records; add them where the domain is managed (currently GoDaddy), then press **Verify**. This can take up to an hour.
3. **API Keys → Create API key** (Sending access). Copy it.
4. While the domain is still verifying, you can set `EMAIL_FROM` to `onboarding@resend.dev` in Vercel. Resend then only delivers to your own Resend account email, which is enough to create your admin login. Switch it back once the domain shows **Verified**.

### 3. Vercel (hosting)

The Vercel project **new-forest-estate-management** is already created and connected to this GitHub repo: every push to `main` deploys automatically. `EMAIL_FROM` and `GREENAPI_API_URL` are already filled in.

Open the project in Vercel → **Settings → Environment Variables** and add these (tick Production, Preview and Development):

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role / secret key (**keep private**, mark as Sensitive) |
| `ADMIN_SETUP_EMAIL` | The email address for the first admin login |
| `RESEND_API_KEY` | From Resend (mark as Sensitive) |

Then **Deployments → the latest one → ••• → Redeploy**. Until the domain is switched over you can use the site at `https://new-forest-estate-management.vercel.app` while logged in to Vercel.

**Going live on your domain:** both addresses are already added in Vercel (**Settings → Domains**): `www.newforestestatemanagement.co.uk` is the main address and `newforestestatemanagement.co.uk` redirects to it. In GoDaddy's DNS, change only these two records (leave the MX, email and Resend records alone):

| Type | Name | Value |
|---|---|---|
| A | `@` | `216.198.79.1` (delete the old A records first) |
| CNAME | `www` | `4d27d369d0cce0b4.vercel-dns-017.com` |

If GoDaddy won't let you edit the `@` record, disconnect the old GoDaddy Website Builder site from the domain first. The old site stops showing once DNS switches over (usually within an hour). Then verify the domain in Google Search Console, submit `https://www.newforestestatemanagement.co.uk/sitemap.xml`, and update the website link on the Google Business Profile.

### 4. Your admin login

1. Visit `/setup` on the site (for example `https://www.newforestestatemanagement.co.uk/setup`).
2. Enter your name and the `ADMIN_SETUP_EMAIL` address. You'll get an email with a link to choose your password.
3. In the admin area, open **Settings** and fill in the business details, **bank details** (printed on every invoice) and who should be emailed about new bookings.
4. To add colleagues: **Settings → Team → Invite someone**.

### 5. WhatsApp group messages (free with Green-API)

1. Get a cheap pay-as-you-go SIM and set up WhatsApp on a spare phone with that number. Add that number to the cleaners' WhatsApp group. (Using a spare number means your main number is never at risk.)
2. Sign up at [green-api.com](https://green-api.com) and create an instance on the free **Developer** plan.
3. In the Green-API console, scan the QR code with the spare phone: **WhatsApp → Settings → Linked devices → Link a device**.
4. Copy `idInstance`, `apiTokenInstance` and `apiUrl` into Vercel as `GREENAPI_INSTANCE_ID`, `GREENAPI_API_TOKEN` and `GREENAPI_API_URL`, then redeploy.
5. In the admin area: **Settings → WhatsApp → Find my groups**, choose the cleaners' group, tick "Post new, changed and cancelled bookings", **Save**, then **Send a test message**.

Keep the spare phone charged and connected now and then: WhatsApp unlinks devices if the phone is offline for about two weeks. The free plan covers up to three chats, so one group is fine. Green-API is an unofficial WhatsApp connection; if it is ever blocked, switch to Whapi.Cloud (add `WHAPI_TOKEN`, choose it under Settings → WhatsApp) without changing anything else.

### 6. Notion calendar

1. Go to [notion.so/profile/integrations](https://www.notion.so/profile/integrations) → **New integration** → type **Internal**, name it "Website bookings". Copy the **Internal integration secret** into Vercel as `NOTION_TOKEN`, then redeploy.
2. In Notion, create a new page with a **full-page database** called "Bookings".
3. On that database, open **••• → Connections** and add "Website bookings".
4. Copy the database link (**Share → Copy link**). In the admin area: **Settings → Notion**, paste it and press **Connect Notion**. The columns are added automatically.
5. In **Notion Calendar**, add the Bookings database. Each booking has two dates: **Stay** (arrival to departure) and **Changeover** (departure day and time). If Notion Calendar asks which date to show, pick the one you prefer.

Cancelled bookings are moved to Notion's trash, so they disappear from the calendar.

Each entry carries what the cleaners need: property address with a Google Maps link, access notes, cleaner notes, rooms, guests, dogs, bed setup, extras, notes, when the next guests arrive, and the owner's phone and email. Give cleaners **Can view** access to the parent page (so they also see the Bookings database it contains).

If a column is deleted in Notion, the site adds it back the next time it sends a booking. When new columns are added in a site update, press **Reconnect and check columns** in **Settings → Notion**. That also refreshes every upcoming booking.

### 7. Add your first customer

**Customers → Add customer**. Leave "Email them an invitation" ticked and they'll get a link to set up their account. If someone loses the email, they can go to `/register` and enter their address to get a new link, or you can press **Resend invitation** on their page.

---

## How it works day to day

**Owners** log in at `/login` and press **New booking**. They pick the property and enter each stay: arrival and departure dates (nights are worked out), check-out time, adults, children, infants, dogs, bed setup ("Standard" or a description, with "put it back to standard after this stay"), extras and notes. Several stays can be sent at once. The form stops overlapping dates and points out same-day turnarounds and very late bookings.

**When a booking is sent**, in this order:

1. It is saved. The database itself refuses double bookings for the same property.
2. A Notion page is created (or updated or trashed for changes and cancellations).
3. One WhatsApp message per property goes to the cleaners' group. It includes the changeover day and time, whether the next guests arrive the same day, guests, dogs, beds, extras, notes and access details.
4. The owner gets a confirmation email and the team gets a notification email.

If Notion or WhatsApp fails, the booking is still saved. The dashboard's **Needs attention** box shows it, with a **Resend** button.

**Cleaning plan** (**Cleaning plan** in the admin menu): each day's changeovers are shared between the cleaning teams working that day and put in order. Every house is ready before the next guests arrive, nobody works past the end of the day if it can be avoided, and the driving is kept as short as possible. It re-plans itself whenever a booking, a property or a team changes.

- **Set up**: **Settings → Cleaning teams**. Add each team with the postcode they set off from. Untick "Usually works" for a team that only helps on busy days. Set when teams set off and when they should finish by.
- **How long each house takes**: on each property's page (admins only). Until you set it, it's estimated from the bedrooms and bathrooms.
- **On the day's page** you can tick which teams are working, move a clean to a particular team (the rest is re-planned around it), open each team's route in Google Maps, and send the plan to the WhatsApp group.
- **Each morning (around 7am)** the day's plan is posted to the cleaners' WhatsApp group automatically, once per day. Turn this off in Settings. For extra protection, add a `CRON_SECRET` environment variable in Vercel (any long random text); Vercel then signs its morning call with it.
- **In Notion**, each booking gets **Clean start** (the planned time), **Team**, **Run order** ("2 of 4"), **Drive** and a **Day route** link. The Cleaning calendar uses Clean start, so the day reads in order.

Drive times are estimated from the distance between postcodes (looked up free from postcodes.io), allowing for winding roads and parking.

**Invoices**: **Invoices → New invoice**, choose the customer and the month. Press **Copy last invoice** to reuse last month's lines, or add that month's changeovers from the list on the right, then fill in the prices. **Save and send** emails a PDF to the customer (and any contacts marked "copy on invoices"). Mark invoices as paid when the money arrives; overdue invoices are flagged automatically. The dashboard shows which customers still need an invoice for last month.

---

## For developers

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

- Database schema: `supabase/migrations/20261011120000_initial_schema.sql` (row level security on every table).
- Security tests: run `supabase/tests/supabase_stub.sql`, the migration, then `supabase/tests/rls_test.sql` against a scratch Postgres 16 database.
- Server actions live in `src/lib/**/actions.ts` and `src/lib/admin/*.ts`; every one re-checks who is signed in.
- Booking side effects: `src/lib/bookings/sync.ts`. WhatsApp message wording: `src/lib/bookings/messages.ts`.
- Public site copy: `src/app/(site)/services/content.ts` and `src/lib/site.ts`.
