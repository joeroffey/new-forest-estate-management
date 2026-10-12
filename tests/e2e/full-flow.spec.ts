import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";

/*
 * End-to-end test of the whole system against a real (local) Supabase,
 * with Resend, Notion and Green-API replaced by the mock server in tests/mock-server.mjs.
 * Runs as one ordered story: setup → settings → customer → owner bookings → invoices.
 */

const MOCK = process.env.MOCK_URL ?? "http://localhost:4010";
const ADMIN_EMAIL = process.env.ADMIN_SETUP_EMAIL ?? "admin@example.com";
const SHOTS = "ci-artifacts/screens";
fs.mkdirSync(SHOTS, { recursive: true });

type MockRequest = { method: string; path: string; body: Record<string, unknown> | null; status: number };

async function mockRequests(): Promise<MockRequest[]> {
  const res = await fetch(`${MOCK}/__requests`);
  return (await res.json()) as MockRequest[];
}

async function waitFor<T>(fn: () => Promise<T | undefined | null | false>, what: string, timeout = 20_000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

type Email = { to: string[]; cc?: string[]; subject: string; html: string; text: string; attachments?: Array<{ filename: string; content: string }> };

async function emails(): Promise<Email[]> {
  return (await mockRequests()).filter((r) => r.path === "/resend/emails").map((r) => r.body as unknown as Email);
}

async function waitForEmail(to: string, subject: RegExp): Promise<Email> {
  return waitFor(async () => (await emails()).reverse().find((e) => e.to.includes(to) && subject.test(e.subject)), `email to ${to} matching ${subject}`);
}

async function whatsappMessages(): Promise<Array<{ chatId: string; message: string }>> {
  return (await mockRequests())
    .filter((r) => /\/sendMessage\//.test(r.path))
    .map((r) => r.body as unknown as { chatId: string; message: string });
}

async function waitForWhatsApp(includes: string): Promise<string> {
  const msg = await waitFor(async () => (await whatsappMessages()).reverse().find((m) => m.message.includes(includes)), `WhatsApp message containing "${includes}"`);
  return msg.message;
}

function linkFromText(text: string, pattern: RegExp): string {
  const m = text.match(pattern);
  if (!m) throw new Error(`No link matching ${pattern} in:\n${text}`);
  return m[0];
}

function londonDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function toast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

const d10 = londonDate(10);
const d11 = londonDate(11);
const d12 = londonDate(12);
const d13 = londonDate(13);
const d15 = londonDate(15);

let admin: BrowserContext;
let adminPage: Page;
let owner: BrowserContext;
let ownerPage: Page;
let customerId = "";
let invoiceId = "";

async function newContext(browser: Browser, mobile = false) {
  const base = { locale: "en-GB", timezoneId: "Europe/London", baseURL: process.env.BASE_URL ?? "http://localhost:3000" };
  return browser.newContext(
    mobile ? { ...base, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { ...base, viewport: { width: 1360, height: 900 } },
  );
}

test.describe.serial("New Forest Estate Management", () => {
  test.beforeAll(async ({ browser }) => {
    await fetch(`${MOCK}/__requests`, { method: "DELETE" });
    admin = await newContext(browser);
    adminPage = await admin.newPage();
    owner = await newContext(browser);
    ownerPage = await owner.newPage();
    for (const p of [adminPage, ownerPage]) {
      p.on("pageerror", (err) => console.log(`[browser error] ${err.message}`));
      p.on("console", (msg) => {
        if (msg.type() === "error") console.log(`[console] ${msg.text()}`);
      });
    }
  });

  test.afterAll(async () => {
    await admin?.close();
    await owner?.close();
  });

  test("public website pages load", async ({ browser }) => {
    const page = adminPage;
    for (const [path, heading] of [
      ["/", /properly looked after/],
      ["/services", /What we look after/],
      ["/about", /It started with one holiday rental/],
      ["/contact", /Get in touch/],
      ["/privacy", /Privacy notice/],
      ["/services/holiday-rental-management", /Holiday let management in the New Forest/],
      ["/services/estate-management", /Property and estate management in the New Forest/],
      ["/services/commercial-property-management", /Commercial property management/],
      ["/areas/lymington", /in Lymington/],
      ["/areas/milford-on-sea", /in Milford on Sea/],
      ["/areas/new-milton-barton-on-sea", /in New Milton and Barton on Sea/],
      ["/areas/brockenhurst", /in Brockenhurst/],
    ] as const) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      // Every public page names its one canonical address and carries valid structured data
      await expect(page.locator('link[rel="canonical"]'), path).toHaveAttribute("href", new RegExp(`^http://localhost:3000${path === "/" ? "/?" : path}$`));
      const ldBlocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(ldBlocks.length, path).toBeGreaterThan(0);
      for (const block of ldBlocks) expect(() => JSON.parse(block), path).not.toThrow();
      expect(ldBlocks.join(" "), path).toContain('"RealEstateAgent"');
      expect(await page.title(), path).not.toMatch(/\|.*\|/);
    }
    // Old GoDaddy addresses go to their new pages
    const old = await page.request.get("/contact-us", { maxRedirects: 0 });
    expect(old.status()).toBe(308);
    expect(old.headers()["location"]).toMatch(/\/contact$/);
    expect((await page.request.get("/llms.txt")).status()).toBe(200);
    const faqs = page.locator("details");
    await page.goto("/services/holiday-rental-management");
    expect(await faqs.count()).toBeGreaterThan(3);
    await faqs.first().locator("summary").click();
    await expect(faqs.first()).toHaveAttribute("open", "");
    await shot(page, "02b-service-page");
    await page.goto("/areas/lymington");
    await shot(page, "02c-area-page");
    await page.goto("/about");
    await shot(page, "02d-about");
    await page.goto("/");
    await page.waitForTimeout(2600); // let the hero drawing finish
    await shot(page, "01-home-desktop");
    await page.goto("/services");
    await shot(page, "02-services");
    await page.goto("/contact");
    await shot(page, "03-contact");

    const mobile = await newContext(browser, true);
    const m = await mobile.newPage();
    await m.goto("/");
    await m.waitForTimeout(2600);
    await shot(m, "04-home-mobile");
    await m.getByRole("button", { name: "Open menu" }).click();
    await expect(m.getByRole("link", { name: "Owner login" }).last()).toBeVisible();
    await shot(m, "05-home-mobile-menu");
    await mobile.close();

    expect((await page.request.get("/sitemap.xml")).status()).toBe(200);
    expect((await page.request.get("/robots.txt")).status()).toBe(200);
  });

  test("signed-out visitors are sent to the login page", async () => {
    await ownerPage.goto("/admin");
    await expect(ownerPage).toHaveURL(/\/login\?next=%2Fadmin/);
    await ownerPage.goto("/portal/bookings");
    await expect(ownerPage).toHaveURL(/\/login\?next=%2Fportal%2Fbookings/);
    await shot(ownerPage, "06-login");
  });

  test("first admin is set up through an emailed link", async () => {
    const page = adminPage;
    await page.goto("/setup");
    await page.locator('input[name="full_name"]').fill("Joe Tester");
    await page.locator('input[name="email"]').fill("someone-else@example.com");
    await page.getByRole("button", { name: "Email me the setup link" }).click();
    await expect(page.getByText("Use the email address that was set as ADMIN_SETUP_EMAIL")).toBeVisible();

    await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
    await page.getByRole("button", { name: "Email me the setup link" }).click();
    await expect(page.getByText("Check your inbox")).toBeVisible();

    const mail = await waitForEmail(ADMIN_EMAIL, /admin login/);
    const link = linkFromText(mail.text, /https?:\/\/\S+\/invite\/[A-Za-z0-9_-]+/);
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "Set up your admin login" })).toBeVisible();
    await page.locator('input[name="password"]').fill("short");
    await page.locator('input[name="confirm"]').fill("short");
    await page.getByRole("button", { name: "Create my account" }).click();
    await expect(page.getByText("Use at least 8 characters")).toBeVisible();
    await page.locator('input[name="password"]').fill("Admin-password-123");
    await page.locator('input[name="confirm"]').fill("Admin-password-123");
    await page.getByRole("button", { name: "Create my account" }).click();
    await expect(page).toHaveURL(/\/admin\?welcome=1/);
    await expect(page.getByText("You're in.")).toBeVisible();

    // Setup can't be used again
    await page.goto("/setup");
    await expect(page.getByRole("heading", { name: "Setup is complete" })).toBeVisible();
  });

  test("admin fills in settings and connects WhatsApp and Notion", async () => {
    const page = adminPage;
    await page.goto("/admin/settings");

    const invoicing = page.locator("#invoicing");
    await invoicing.locator('input[name="bank_account_name"]').fill("New Forest Estate Management");
    await invoicing.locator('input[name="bank_name"]').fill("Lloyds");
    await invoicing.locator('input[name="bank_sort_code"]').fill("123");
    await invoicing.getByRole("button", { name: "Save invoice settings" }).click();
    await expect(invoicing.getByText("A sort code has 6 digits")).toBeVisible();
    await invoicing.locator('input[name="bank_sort_code"]').fill("401234");
    await invoicing.locator('input[name="bank_account_number"]').fill("12345678");
    await invoicing.getByRole("button", { name: "Save invoice settings" }).click();
    await toast(page, "Invoice settings saved");

    const notifications = page.locator("#notifications");
    await notifications.locator('textarea[name="notify_emails"]').fill("team@example.com");
    await notifications.getByRole("button", { name: "Save notification settings" }).click();
    await toast(page, "Notification settings saved");

    const wa = page.locator("#whatsapp");
    await expect(wa.getByText("Linked and ready.")).toBeVisible();
    await wa.getByRole("button", { name: "Find my groups" }).click();
    await toast(page, /Found 2 groups/);
    await wa.locator("#wa-group").selectOption({ label: "NFEM Cleaners" });
    await wa.getByLabel("Post new, changed and cancelled bookings to this group").check();
    await wa.getByRole("button", { name: "Save WhatsApp settings" }).click();
    await toast(page, "WhatsApp messages are on");
    await page.reload();
    await page.locator("#whatsapp").getByRole("button", { name: "Send a test message" }).click();
    await toast(page, /Test message sent to NFEM Cleaners/);
    const test = await waitFor(async () => (await whatsappMessages()).find((m) => m.message.includes("Test message")), "test WhatsApp");
    expect(test.chatId).toBe("447700900001-1600000000@g.us");

    const notion = page.locator("#notion");
    await notion.locator('input[name="notion_database"]').fill("not a link");
    await notion.getByRole("button", { name: "Connect Notion" }).click();
    await expect(notion.getByText("Paste the link to the Notion database")).toBeVisible();
    await notion.locator('input[name="notion_database"]').fill("https://www.notion.so/nfem/Bookings-0123456789abcdef0123456789abcdef?v=11112222333344445555666677778888");
    await notion.getByRole("button", { name: "Connect Notion" }).click();
    await toast(page, /Connected to “Bookings”/);
    const patch = await waitFor(async () => (await mockRequests()).find((r) => r.method === "PATCH" && r.path.startsWith("/notion/databases/")), "Notion database setup");
    expect(patch.path).toBe("/notion/databases/01234567-89ab-cdef-0123-456789abcdef");
    expect(Object.keys((patch.body as { properties: object }).properties)).toEqual(
      expect.arrayContaining(["Stay", "Changeover", "Status", "Same-day turnaround", "Address", "Directions", "Access", "Customer phone", "Next arrival"]),
    );

    await page.locator("#notifications").getByRole("button", { name: "Send a test email" }).click();
    await toast(page, /Test email sent to team@example.com/);
    await shot(page, "10-admin-settings");
  });

  test("admin adds a customer with a contact and property, and invites them", async () => {
    const page = adminPage;
    await page.goto("/admin/customers");
    await expect(page.getByText("No customers yet")).toBeVisible();
    await page.getByRole("link", { name: "Add customer" }).first().click();
    await expect(page).toHaveURL(/\/admin\/customers\/new/);

    await page.locator('input[name="full_name"]').fill("Alice Owner");
    await page.locator('input[name="email"]').fill("Alice@Example.com");
    await page.locator('input[name="phone"]').fill("07700 900123");
    await page.locator('input[name="address_line1"]').fill("1 Harbour Road");
    await page.locator('input[name="town"]').fill("Lymington");
    await page.locator('input[name="postcode"]').fill("so41 3aa");

    await page.getByRole("button", { name: "Add a contact" }).click();
    const contacts = page.locator("fieldset", { has: page.locator("legend", { hasText: "Other contacts" }) });
    await contacts.getByLabel("Name", { exact: true }).fill("Bob Partner");
    await contacts.getByLabel("Email", { exact: true }).fill("bob@example.com");
    await contacts.getByLabel("Copy them on invoices").check();

    await page.locator('input[name="property_name"]').fill("9 Island Point");
    await page.locator('input[name="property_town"]').fill("Lymington");
    await page.locator('textarea[name="property_standard_setup"]').fill("Bedroom 1: super king. Bedroom 2: two doubles.");
    await page.locator('textarea[name="property_access_notes"]').fill("Key safe by the side gate, code 1234");
    await shot(page, "11-admin-new-customer");
    await page.getByRole("button", { name: "Add customer" }).click();

    await expect(page).toHaveURL(/\/admin\/customers\/[0-9a-f-]{36}$/);
    customerId = page.url().split("/").pop()!;
    await toast(page, /invitation emailed to alice@example.com/);
    await expect(page.getByText("Invitation sent")).toBeVisible();
    await expect(page.getByText("9 Island Point")).toBeVisible();
    await shot(page, "12-admin-customer");

    // Duplicate email is refused
    await page.goto("/admin/customers/new");
    await page.locator('input[name="full_name"]').fill("Alice Again");
    await page.locator('input[name="email"]').fill("alice@example.com");
    await page.getByRole("button", { name: "Add customer" }).click();
    await expect(page.getByText("A customer with this email already exists.")).toBeVisible();
  });

  test("owner accepts the invitation and lands in their account", async () => {
    const mail = await waitForEmail("alice@example.com", /Set up your/);
    const link = linkFromText(mail.text, /https?:\/\/\S+\/invite\/[A-Za-z0-9_-]+/);
    await ownerPage.goto(link);
    await expect(ownerPage.locator('input[name="email_display"]')).toHaveValue("alice@example.com");
    await ownerPage.locator('input[name="password"]').fill("Owner-password-123");
    await ownerPage.locator('input[name="confirm"]').fill("Owner-password-123");
    await ownerPage.getByRole("button", { name: "Create my account" }).click();
    await expect(ownerPage).toHaveURL(/\/portal\?welcome=1/);
    await expect(ownerPage.getByText("Your account is ready.")).toBeVisible();
    await shot(ownerPage, "20-portal-home-empty");

    // The used link can't be reused
    await ownerPage.goto(link);
    await expect(ownerPage.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  });

  test("owner sends two stays at once, including a same-day turnaround", async () => {
    const page = ownerPage;
    await page.goto("/portal");
    await page.getByRole("link", { name: "Add a booking" }).first().click();
    await expect(page).toHaveURL(/\/portal\/bookings\/new/);

    await page.getByLabel("Guests arrive").nth(0).fill(d10);
    await page.getByLabel("Guests leave").nth(0).fill(d13);
    await page.getByRole("button", { name: "One more adults" }).first().click();
    await page.getByRole("button", { name: "One more dogs" }).first().click();
    await page.getByRole("radio", { name: /Something different/ }).first().check();
    await page.getByLabel("Describe the setup").fill("Bedroom 2: split the double into two singles");
    await page.getByRole("button", { name: /Extras and notes/ }).first().click();
    await page.getByText("Travel cot", { exact: true }).first().click();
    await page.getByLabel(/Notes for the team/).first().fill("Birthday weekend, balloons in the lounge please");

    await page.getByRole("button", { name: "Add another stay" }).click();
    await page.getByLabel("Guests arrive").nth(1).fill(d13);
    await page.getByLabel("Guests leave").nth(1).fill(d15);
    await expect(page.getByText(/New guests arrive on .*, the day these guests\s+leave/).first()).toBeVisible();
    await shot(page, "21-portal-booking-form");

    // Someone deletes a column in Notion: the site should put it back and still save the bookings.
    await fetch(`${MOCK}/__notion/drop-column?name=${encodeURIComponent("Customer phone")}`, { method: "POST" });

    await page.getByRole("button", { name: "Send 2 bookings" }).click();
    await expect(page).toHaveURL(/\/portal\/bookings\?sent=2/);
    await expect(page.getByText("2 bookings sent.")).toBeVisible();
    await shot(page, "22-portal-bookings");

    const msg = await waitForWhatsApp("2 new bookings");
    console.log("---- WhatsApp message ----\n" + msg + "\n--------------------------");
    for (const part of ["9 Island Point", "Same-day turnaround", "3 adults", "1 dog", "Bedroom 2: split the double", "put back to standard", "Travel cot", "Birthday weekend", "Key safe by the side gate"]) {
      expect(msg, `WhatsApp message should mention ${part}`).toContain(part);
    }
    const requests = await mockRequests();
    const pages = requests.filter((r) => r.method === "POST" && r.path === "/notion/pages" && r.status === 200);
    expect(pages.length).toBe(2);
    // The missing column was added back before retrying.
    const repair = requests.filter((r) => r.method === "PATCH" && r.path.startsWith("/notion/databases/")).at(-1);
    expect(Object.keys((repair?.body as { properties: object }).properties)).toEqual(["Customer phone"]);

    type NotionProps = Record<
      string,
      { date?: { start: string; end?: string }; rich_text?: Array<{ text: { content: string } }>; url?: string | null; phone_number?: string | null }
    >;
    const props = (pages.map((p) => p.body!.properties) as NotionProps[]).find((p) => p.Stay?.date?.start === d10);
    const textOf = (name: string) => props?.[name]?.rich_text?.map((t) => t.text.content).join("") ?? "";
    expect(props?.Stay?.date?.end).toBe(d13);
    expect(props?.Changeover?.date?.start).toBe(`${d13}T10:00:00`);
    // What the cleaners see when they open the entry
    expect(textOf("Address")).toBe("Lymington");
    expect(props?.Directions?.url).toBe("https://www.google.com/maps/search/?api=1&query=Lymington");
    expect(props?.["Customer phone"]?.phone_number).toBe("07700 900123");
    expect(textOf("Access")).toBe("Key safe by the side gate, code 1234");
    expect(textOf("Extras")).toBe("Travel cot");
    expect(textOf("Next arrival")).toMatch(/^Same day: next guests arrive \d/);
    // Its place in the day's cleaning plan
    const planned = props as unknown as Record<string, { date?: { start: string; end: string | null }; select?: { name: string } | null }>;
    expect(planned["Clean start"]?.date?.start).toBe(`${d13}T10:00:00`);
    expect(planned["Clean start"]?.date?.end).toMatch(new RegExp(`^${d13}T\\d\\d:\\d\\d:00$`));
    expect(planned.Team?.select?.name).toBe("Team 1");
    expect(textOf("Run order")).toBe("1 of 1");

    // The admin's cleaning plan shows the clean, with the same-day deadline
    await adminPage.goto(`/admin/cleaning?date=${d13}`);
    await expect(adminPage.getByRole("link", { name: "9 Island Point" })).toBeVisible();
    await expect(adminPage.getByText("Next guests 4pm")).toBeVisible();

    const confirmation = await waitForEmail("alice@example.com", /2 bookings received: 9 Island Point/);
    expect(confirmation.html).toContain("Bedroom 2: split the double into two singles");
    await waitForEmail("team@example.com", /New booking: 9 Island Point \(Alice Owner\)/);
  });

  test("overlapping dates are stopped before they're sent", async () => {
    const page = ownerPage;
    await page.goto("/portal/bookings/new");
    await page.getByLabel("Guests arrive").first().fill(d11);
    await page.getByLabel("Guests leave").first().fill(d12);
    await page.getByRole("button", { name: "Send booking" }).click();
    await expect(page.getByText(/Overlaps with an existing booking/)).toBeVisible();
    await shot(page, "23-portal-overlap");
  });

  test("owner changes a booking and the cleaners are told what changed", async () => {
    const page = ownerPage;
    await page.goto("/portal/bookings");
    await page.getByRole("link", { name: /9 Island Point/ }).first().click();
    await expect(page).toHaveURL(/\/portal\/bookings\/[0-9a-f-]{36}$/);
    await shot(page, "24-portal-booking-detail");
    await page.getByRole("link", { name: "Change booking" }).click();
    await page.getByRole("button", { name: "One more adults" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/portal\/bookings\/[0-9a-f-]{36}$/);
    await expect(page.getByText("4 adults")).toBeVisible();
    const msg = await waitForWhatsApp("Booking changed");
    expect(msg).toContain("Changed: guests");
    expect(msg).toContain("4 adults");
    await waitForEmail("alice@example.com", /Booking updated/);
  });

  test("owner cancels the second stay", async () => {
    const page = ownerPage;
    await page.goto("/portal/bookings");
    await page.getByRole("link", { name: /9 Island Point/ }).nth(1).click();
    await page.getByRole("button", { name: "Cancel booking" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel booking" }).click();
    await toast(page, "Booking cancelled");
    await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
    const msg = await waitForWhatsApp("Booking cancelled");
    expect(msg).toContain("No changeover needed");
    await waitFor(async () => (await mockRequests()).find((r) => r.method === "PATCH" && r.path.startsWith("/notion/pages/") && (r.body as { archived?: boolean })?.archived === true), "Notion archive");
  });

  test("owners can't open the admin area", async () => {
    await ownerPage.goto("/admin");
    await expect(ownerPage).toHaveURL(/\/portal/);
    await ownerPage.goto("/admin/customers");
    await expect(ownerPage).toHaveURL(/\/portal/);
  });

  test("admin sees the booking on the dashboard and calendar", async () => {
    const page = adminPage;
    await page.goto("/admin");
    await expect(page.getByText("9 Island Point").first()).toBeVisible();
    await shot(page, "13-admin-dashboard");
    await page.goto(`/admin/calendar?month=${d10.slice(0, 7)}`);
    await expect(page.getByRole("link", { name: /9 Island Point/ }).first()).toBeVisible();
    await shot(page, "14-admin-calendar");
    await page.goto("/admin/bookings");
    await shot(page, "15-admin-bookings");
    await page.getByRole("link", { name: /9 Island Point/ }).first().click();
    await expect(page.getByText("WhatsApp group")).toBeVisible();
    await expect(page.getByText(/Done /).first()).toBeVisible();
    await shot(page, "16-admin-booking-detail");
    const csv = await page.request.get("/api/bookings/export?view=upcoming");
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("9 Island Point");
  });

  test("admin plans the day's cleaning across two teams", async () => {
    const page = adminPage;
    type Patch = { properties?: Record<string, { rich_text?: Array<{ text: { content: string } }>; select?: { name: string } | null; date?: { start: string } }> };
    const text = (b: Patch, name: string) => b.properties?.[name]?.rich_text?.map((t) => t.text.content).join("") ?? "";
    const notionPatches = async () =>
      (await mockRequests()).filter((r) => r.method === "PATCH" && r.path.startsWith("/notion/pages/")).map((r) => r.body as unknown as Patch);

    // Cancelling the second stay removed the first stay's same-day deadline, and Notion was told.
    await waitFor(
      async () => (await notionPatches()).find((b) => b.properties?.Stay?.date?.start === d10 && text(b, "Next arrival") === "No booking yet"),
      "Notion update for the clean whose deadline went away",
    );

    // Add a second team
    await page.goto("/admin/settings");
    const cleaning = page.locator("#cleaning");
    await expect(cleaning.locator('input[name="name"]').first()).toHaveValue("Team 1");
    const addTeam = cleaning.locator("form", { has: page.getByRole("button", { name: "Add team" }) });
    await addTeam.locator('input[name="name"]').fill("Team 2");
    await addTeam.locator('input[name="home_postcode"]').fill("nowhere");
    await addTeam.getByRole("button", { name: "Add team" }).click();
    await expect(addTeam.getByText("Enter a full UK postcode")).toBeVisible();
    await addTeam.locator('input[name="home_postcode"]').fill("so41 9zz");
    await addTeam.getByRole("button", { name: "Add team" }).click();
    await toast(page, "Team 2 added");
    await expect(cleaning.locator('input[name="home_postcode"]').nth(1)).toHaveValue("SO41 9ZZ");
    await shot(page, "17-admin-cleaning-teams");

    // The day's plan
    await page.goto(`/admin/cleaning?date=${d13}`);
    await expect(page.getByRole("heading", { name: "Cleaning plan" })).toBeVisible();
    await expect(page.getByText("Next guests 4pm")).toHaveCount(0);
    const teamPanel = (name: string) => page.locator(`[data-team="${name}"]`);
    await expect(teamPanel("Team 1").or(teamPanel("Team 2")).getByRole("link", { name: "9 Island Point" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Route in Google Maps" }).first()).toHaveAttribute("href", /google\.com\/maps\/dir\//);

    // Move the clean to Team 2: the day is re-planned and Notion gets the new team
    await page.getByLabel("Which team cleans 9 Island Point").selectOption({ label: "Give to Team 2" });
    await toast(page, "Clean moved and the day re-planned");
    await expect(teamPanel("Team 2").getByRole("link", { name: "9 Island Point" })).toBeVisible();
    await expect(teamPanel("Team 2").getByText("Given to this team")).toBeVisible();
    await waitFor(async () => (await notionPatches()).find((b) => b.properties?.Team?.select?.name === "Team 2"), "Notion update with the new team");
    await shot(page, "18-admin-cleaning-plan");

    // Team 2 has the day off: everything goes back to Team 1
    await page.locator("label", { hasText: "Team 2" }).first().click();
    await page.getByRole("button", { name: "Save and re-plan" }).click();
    await toast(page, /Teams for .* saved/);
    await expect(teamPanel("Team 1").getByRole("link", { name: "9 Island Point" })).toBeVisible();
    await expect(teamPanel("Team 2")).toHaveCount(0);
    await page.getByRole("button", { name: "Use the usual teams" }).click();
    await toast(page, /Back to the usual teams/);

    // Send the plan to the cleaners' WhatsApp group
    await page.getByRole("button", { name: "Send to WhatsApp" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Send to WhatsApp" }).click();
    await toast(page, /sent to NFEM Cleaners/);
    const plan = await waitForWhatsApp("Cleaning plan for");
    expect(plan).toContain("9 Island Point");
    expect(plan).toContain("Route: https://www.google.com/maps/dir/");

    // How long the house takes changes the plan
    await page.goto(`/admin/customers/${customerId}`);
    await page.getByRole("link", { name: /9 Island Point/ }).first().click();
    await page.getByLabel("How long a changeover clean takes").selectOption({ label: "3 h" });
    await page.getByRole("button", { name: "Save property" }).click();
    await toast(page, "Property saved");
    await page.goto(`/admin/cleaning?date=${d13}`);
    await expect(page.getByText(/clean 3 h/)).toBeVisible();

    // The morning job needs the secret, and only sends when there are cleans that day
    expect((await page.request.get("/api/cron/cleaning-plan")).status()).toBe(401);
    const cron = await page.request.get("/api/cron/cleaning-plan", { headers: { Authorization: "Bearer test-cron-secret" } });
    expect(cron.status()).toBe(200);
    expect(await cron.json()).toMatchObject({ sent: false, reason: "No cleans today" });
  });

  test("admin invoices the month from the bookings list and sends it", async () => {
    const page = adminPage;
    await page.goto(`/admin/invoices/new?customer=${customerId}&period=${d13.slice(0, 7)}`);
    await expect(page.getByText(/Sent to alice@example.com/)).toBeVisible();
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await expect(page.getByLabel("Line 1 description")).toHaveValue(/Changeover clean, 9 Island Point/);
    await page.getByLabel("Unit price").nth(0).fill("85");
    await page.getByRole("button", { name: "Laundry and linen" }).click();
    await page.getByLabel("Unit price").nth(1).fill("25");
    await expect(page.getByText("£110.00").first()).toBeVisible();
    await shot(page, "17-admin-invoice-editor");
    await page.getByRole("button", { name: "Save and send" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Send invoice" }).click();
    await expect(page).toHaveURL(/\/admin\/invoices\/[0-9a-f-]{36}$/);
    invoiceId = page.url().split("/").pop()!;
    await expect(page.getByText("Awaiting payment").first()).toBeVisible();
    await shot(page, "18-admin-invoice");

    const mail = await waitForEmail("alice@example.com", /Invoice NFEM-1001 from New Forest Estate Management/);
    expect(mail.cc).toContain("bob@example.com");
    expect(mail.attachments?.[0]?.filename).toBe("Invoice-NFEM-1001.pdf");
    expect(mail.html).toContain("40-12-34");
    const pdfFromEmail = Buffer.from(mail.attachments![0]!.content, "base64");
    expect(pdfFromEmail.subarray(0, 4).toString()).toBe("%PDF");
    fs.writeFileSync("ci-artifacts/invoice-NFEM-1001.pdf", pdfFromEmail);

    const pdf = await page.request.get(`/api/invoices/${invoiceId}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
  });

  test("admin marks the invoice paid, then copies it for next month", async () => {
    const page = adminPage;
    await page.goto(`/admin/invoices/${invoiceId}`);
    await page.getByRole("button", { name: "Mark as paid" }).click();
    await page.getByRole("dialog").locator('input[name="payment_reference"]').fill("ALICE OWNER NFEM-1001");
    await page.getByRole("dialog").getByRole("button", { name: "Mark as paid" }).click();
    await toast(page, /NFEM-1001 marked as paid/);
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();

    await page.getByRole("link", { name: "Copy for next month" }).click();
    await expect(page.getByText("Lines copied from")).toBeVisible();
    await expect(page.getByLabel("Line 2 description")).toHaveValue("Laundry and linen");
    await page.getByRole("button", { name: "Save as draft" }).click();
    await expect(page).toHaveURL(/\/admin\/invoices\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
    await page.goto("/admin/invoices");
    await shot(page, "19-admin-invoices");
  });

  test("owner sees only sent invoices and can download the PDF", async () => {
    const page = ownerPage;
    await page.goto("/portal/invoices");
    await expect(page.getByText("NFEM-1001")).toBeVisible();
    await expect(page.getByText("NFEM-1002")).toHaveCount(0);
    await page.getByRole("link", { name: /NFEM-1001/ }).click();
    await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();
    await shot(page, "25-portal-invoice");
    const res = await page.request.get(`/api/invoices/${invoiceId}/pdf`);
    expect(res.status()).toBe(200);
  });

  test("owner resets a forgotten password", async ({ browser }) => {
    const ctx = await newContext(browser, true);
    const page = await ctx.newPage();
    await page.goto("/forgot-password");
    await page.locator('input[name="email"]').fill("alice@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("Check your inbox")).toBeVisible();
    const mail = await waitForEmail("alice@example.com", /Reset your/);
    const link = linkFromText(mail.text, /https?:\/\/\S+\/auth\/confirm\?\S+/);
    await page.goto(link);
    await expect(page).toHaveURL(/\/reset-password/);
    await page.locator('input[name="password"]').fill("New-owner-pass-456");
    await page.locator('input[name="confirm"]').fill("New-owner-pass-456");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page).toHaveURL(/\/portal\?password=updated/);
    await expect(page.getByText("Your password has been changed.")).toBeVisible();
    await shot(page, "26-portal-home-mobile");
    await page.goto("/portal/bookings/new");
    await shot(page, "27-portal-booking-form-mobile");

    // Log out and back in with the new password
    await page.getByRole("button", { name: "Log out" }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await page.locator('input[name="email"]').fill("alice@example.com");
    await page.locator('input[name="password"]').fill("Owner-password-123");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText(/don't match/).first()).toBeVisible();
    await page.locator('input[name="password"]').fill("New-owner-pass-456");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/portal/);
    await ctx.close();
  });

  test("website enquiries are emailed to the team", async () => {
    const page = adminPage;
    await page.goto("/contact");
    await page.waitForTimeout(2700);
    await page.locator('input[name="name"]').fill("Carol Prospect");
    await page.locator('input[name="email"]').fill("carol@example.com");
    await page.locator('textarea[name="message"]').fill("We have a cottage in Burley and would like help with changeovers.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Message sent")).toBeVisible();
    const mail = await waitForEmail("team@example.com", /Website enquiry: Carol Prospect/);
    expect(mail.text).toContain("cottage in Burley");
  });
});
