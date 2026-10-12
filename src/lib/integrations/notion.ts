import { errorMessage } from "@/lib/errors";

const NOTION_API = (process.env.NOTION_API_URL || "https://api.notion.com/v1").replace(/\/+$/, "");
const NOTION_VERSION = "2022-06-28";

export function isNotionConfigured(): boolean {
  return Boolean(process.env.NOTION_TOKEN);
}

/** Accepts a Notion database link or ID and returns the ID in dashed form, or null. */
export function parseNotionId(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = input.trim();
  // The database id is the 32 hex characters at the end of the last path segment
  // (before any "?v=" view parameter), e.g. notion.so/team/Bookings-1a2b...9f?v=...
  const beforeQuery = cleaned.split(/[?#]/)[0] ?? cleaned;
  const lastSegment = beforeQuery.split("/").filter(Boolean).pop() ?? "";
  const match = lastSegment.replace(/-/g, "").match(/([0-9a-f]{32})$/i);
  if (!match?.[1]) return null;
  const h = match[1].toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function notion<T = Record<string, unknown>>(path: string, init: { method: string; body?: unknown }): Promise<T> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("Notion isn't connected (NOTION_TOKEN missing).");
  let res: Response;
  try {
    res = await fetch(`${NOTION_API}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Couldn't reach Notion: ${errorMessage(err)}`);
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = String(json.code ?? res.status);
    if (code === "object_not_found") {
      throw new Error(
        "Notion can't find that database. Open the database in Notion, click ••• → Connections, and add your integration.",
      );
    }
    if (code === "unauthorized") throw new Error("Notion rejected the token. Check NOTION_TOKEN in Vercel.");
    throw new Error(`Notion: ${String(json.message ?? `error ${res.status}`)}`);
  }
  return json as T;
}

/** The columns this site writes to. Created automatically by prepareNotionDatabase. */
const REQUIRED_PROPERTIES: Record<string, { type: string; config: Record<string, unknown> }> = {
  Stay: { type: "date", config: { date: {} } },
  Changeover: { type: "date", config: { date: {} } },
  Property: { type: "rich_text", config: { rich_text: {} } },
  Customer: { type: "rich_text", config: { rich_text: {} } },
  Guests: { type: "rich_text", config: { rich_text: {} } },
  Dogs: { type: "number", config: { number: { format: "number" } } },
  "Bed setup": { type: "rich_text", config: { rich_text: {} } },
  Extras: { type: "rich_text", config: { rich_text: {} } },
  Notes: { type: "rich_text", config: { rich_text: {} } },
  Status: {
    type: "select",
    config: {
      select: {
        options: [
          { name: "Confirmed", color: "green" },
          { name: "Updated", color: "blue" },
        ],
      },
    },
  },
  Reference: { type: "rich_text", config: { rich_text: {} } },
  "Same-day turnaround": { type: "checkbox", config: { checkbox: {} } },
  "Portal link": { type: "url", config: { url: {} } },
  // For the cleaners: where they're going, how to get in and who to call.
  Address: { type: "rich_text", config: { rich_text: {} } },
  Directions: { type: "url", config: { url: {} } },
  Access: { type: "rich_text", config: { rich_text: {} } },
  "Cleaner notes": { type: "rich_text", config: { rich_text: {} } },
  Rooms: { type: "rich_text", config: { rich_text: {} } },
  "Next arrival": { type: "rich_text", config: { rich_text: {} } },
  "Lead guest": { type: "rich_text", config: { rich_text: {} } },
  "Customer phone": { type: "phone_number", config: { phone_number: {} } },
  "Customer email": { type: "email", config: { email: {} } },
};

/**
 * True when Notion refused a booking because a column is missing or has changed type
 * (someone deleted or renamed it in Notion, or the site added a new column since the
 * database was connected). Running prepareNotionDatabase again fixes it.
 */
export function isNotionColumnError(err: unknown): boolean {
  const message = errorMessage(err);
  return /is not a property that exists|is expected to be|property .* does not exist/i.test(message);
}

interface NotionDatabase {
  id: string;
  title?: Array<{ plain_text?: string }>;
  properties: Record<string, { id: string; type: string; name: string }>;
}

/** Checks access to the database and adds any missing columns. Returns the database title and title column. */
export async function prepareNotionDatabase(databaseId: string): Promise<{ title: string; titleProp: string; added: string[] }> {
  const db = await notion<NotionDatabase>(`/databases/${databaseId}`, { method: "GET" });
  const props = db.properties ?? {};
  const titleEntry = Object.values(props).find((p) => p.type === "title");
  const titleProp = titleEntry?.name ?? "Name";

  const toAdd: Record<string, unknown> = {};
  const conflicts: string[] = [];
  for (const [name, def] of Object.entries(REQUIRED_PROPERTIES)) {
    const existing = props[name];
    if (!existing) toAdd[name] = def.config;
    else if (existing.type !== def.type) conflicts.push(`"${name}" (should be ${def.type.replace("_", " ")})`);
  }
  if (conflicts.length) {
    throw new Error(
      `This Notion database already has columns with the wrong type: ${conflicts.join(", ")}. Rename or delete them in Notion, then try again.`,
    );
  }
  if (Object.keys(toAdd).length) {
    await notion(`/databases/${databaseId}`, { method: "PATCH", body: { properties: toAdd } });
  }
  const title = db.title?.map((t) => t.plain_text ?? "").join("") || "Untitled database";
  return { title, titleProp, added: Object.keys(toAdd) };
}

function text(content: string | null | undefined) {
  const value = (content ?? "").slice(0, 1900);
  return { rich_text: value ? [{ type: "text", text: { content: value } }] : [] };
}

export interface NotionBookingInput {
  title: string;
  arrivalDate: string;
  departureDate: string;
  checkoutTime: string;
  property: string;
  customer: string;
  guests: string;
  dogs: number;
  setup: string;
  extras: string;
  notes: string;
  /** Left out when refreshing existing entries, so "Updated" isn't reset. */
  status?: "Confirmed" | "Updated";
  reference: string;
  sameDay: boolean;
  portalUrl: string;
  address: string;
  directionsUrl: string | null;
  access: string;
  cleanerNotes: string;
  rooms: string;
  nextArrival: string;
  leadGuest: string;
  customerPhone: string | null;
  customerEmail: string | null;
}

function bookingProperties(input: NotionBookingInput, titleProp: string) {
  return {
    [titleProp]: { title: [{ type: "text", text: { content: input.title.slice(0, 1900) } }] },
    Stay: { date: { start: input.arrivalDate, end: input.departureDate } },
    Changeover: {
      date: { start: `${input.departureDate}T${input.checkoutTime.slice(0, 5)}:00`, time_zone: "Europe/London" },
    },
    Property: text(input.property),
    Customer: text(input.customer),
    Guests: text(input.guests),
    Dogs: { number: input.dogs },
    "Bed setup": text(input.setup),
    Extras: text(input.extras),
    Notes: text(input.notes),
    ...(input.status ? { Status: { select: { name: input.status } } } : {}),
    Reference: text(input.reference),
    "Same-day turnaround": { checkbox: input.sameDay },
    "Portal link": { url: input.portalUrl },
    Address: text(input.address),
    Directions: { url: input.directionsUrl || null },
    Access: text(input.access),
    "Cleaner notes": text(input.cleanerNotes),
    Rooms: text(input.rooms),
    "Next arrival": text(input.nextArrival),
    "Lead guest": text(input.leadGuest),
    "Customer phone": { phone_number: input.customerPhone?.trim() || null },
    "Customer email": { email: input.customerEmail?.trim() || null },
  };
}

export async function createNotionBooking(databaseId: string, titleProp: string, input: NotionBookingInput): Promise<string> {
  const page = await notion<{ id: string }>("/pages", {
    method: "POST",
    body: { parent: { database_id: databaseId }, properties: bookingProperties(input, titleProp) },
  });
  return page.id;
}

export async function updateNotionBooking(pageId: string, titleProp: string, input: NotionBookingInput): Promise<void> {
  await notion(`/pages/${pageId}`, {
    method: "PATCH",
    body: { archived: false, properties: bookingProperties(input, titleProp) },
  });
}

/** Cancelled bookings are moved to Notion's trash so they disappear from Notion Calendar. */
export async function archiveNotionBooking(pageId: string): Promise<void> {
  await notion(`/pages/${pageId}`, { method: "PATCH", body: { archived: true } });
}
