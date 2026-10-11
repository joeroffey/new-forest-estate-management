import { errorMessage } from "@/lib/errors";
import type { WhatsAppProvider } from "@/lib/types";

/*
 * WhatsApp group messages.
 *  - greenapi: Green-API (free "Developer" plan works for one group). Needs GREENAPI_INSTANCE_ID,
 *    GREENAPI_API_TOKEN and optionally GREENAPI_API_URL (shown in the Green-API console).
 *  - whapi: Whapi.Cloud. Needs WHAPI_TOKEN.
 * Both link to a WhatsApp number by scanning a QR code, like WhatsApp Web.
 */

export const WHATSAPP_PROVIDERS: Record<WhatsAppProvider, { label: string; envVars: string[] }> = {
  greenapi: { label: "Green-API", envVars: ["GREENAPI_INSTANCE_ID", "GREENAPI_API_TOKEN"] },
  whapi: { label: "Whapi.Cloud", envVars: ["WHAPI_TOKEN"] },
};

export function isWhatsAppConfigured(provider: WhatsAppProvider): boolean {
  return WHATSAPP_PROVIDERS[provider].envVars.every((name) => Boolean(process.env[name]));
}

export interface WhatsAppGroup {
  id: string;
  name: string;
}

function greenBase(): string {
  const id = process.env.GREENAPI_INSTANCE_ID;
  if (!id || !process.env.GREENAPI_API_TOKEN) {
    throw new Error("Green-API isn't connected (GREENAPI_INSTANCE_ID / GREENAPI_API_TOKEN missing).");
  }
  const host = (process.env.GREENAPI_API_URL || "https://api.green-api.com").replace(/\/+$/, "");
  return `${host}/waInstance${id}`;
}

function greenToken(): string {
  return process.env.GREENAPI_API_TOKEN as string;
}

function whapiBase(): string {
  return (process.env.WHAPI_API_URL || "https://gate.whapi.cloud").replace(/\/+$/, "");
}

function whapiToken(): string {
  const token = process.env.WHAPI_TOKEN;
  if (!token) throw new Error("Whapi.Cloud isn't connected (WHAPI_TOKEN missing).");
  return token;
}

async function call<T>(url: string, init: RequestInit, label: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(12000), cache: "no-store" });
  } catch (err) {
    throw new Error(`Couldn't reach ${label}: ${errorMessage(err)}`);
  }
  const raw = await res.text();
  let json: unknown = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg =
      (json && typeof json === "object" && ("message" in json || "error" in json)
        ? String((json as Record<string, unknown>).message ?? JSON.stringify((json as Record<string, unknown>).error))
        : raw.slice(0, 200)) || `error ${res.status}`;
    if (res.status === 401 || res.status === 403) throw new Error(`${label} rejected the credentials (${msg}).`);
    if (res.status === 466) throw new Error(`${label}: plan limit reached (${msg}).`);
    throw new Error(`${label}: ${msg}`);
  }
  return json as T;
}

export async function sendWhatsAppMessage(provider: WhatsAppProvider, chatId: string, message: string): Promise<void> {
  if (!chatId) throw new Error("No WhatsApp group chosen. Pick one in Settings → WhatsApp.");
  if (provider === "greenapi") {
    await call<{ idMessage?: string }>(
      `${greenBase()}/sendMessage/${greenToken()}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId, message }) },
      "Green-API",
    );
    return;
  }
  await call<unknown>(
    `${whapiBase()}/messages/text`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${whapiToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: chatId, body: message }),
    },
    "Whapi.Cloud",
  );
}

export async function listWhatsAppGroups(provider: WhatsAppProvider): Promise<WhatsAppGroup[]> {
  if (provider === "greenapi") {
    const contacts = await call<Array<{ id: string; name?: string; contactName?: string; type?: string }>>(
      `${greenBase()}/getContacts/${greenToken()}?group=true`,
      { method: "GET" },
      "Green-API",
    );
    return (contacts ?? [])
      .filter((c) => c.id?.endsWith("@g.us"))
      .map((c) => ({ id: c.id, name: c.name || c.contactName || c.id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const res = await call<{ groups?: Array<{ id: string; name?: string }> }>(
    `${whapiBase()}/groups?count=200`,
    { method: "GET", headers: { Authorization: `Bearer ${whapiToken()}` } },
    "Whapi.Cloud",
  );
  return (res?.groups ?? [])
    .map((g) => ({ id: g.id, name: g.name || g.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Is the linked WhatsApp number signed in? */
export async function getWhatsAppStatus(provider: WhatsAppProvider): Promise<{ connected: boolean; detail: string }> {
  if (!isWhatsAppConfigured(provider)) {
    return { connected: false, detail: `Add ${WHATSAPP_PROVIDERS[provider].envVars.join(" and ")} in Vercel.` };
  }
  try {
    if (provider === "greenapi") {
      const state = await call<{ stateInstance?: string }>(
        `${greenBase()}/getStateInstance/${greenToken()}`,
        { method: "GET" },
        "Green-API",
      );
      const s = state?.stateInstance ?? "unknown";
      if (s === "authorized") return { connected: true, detail: "Linked and ready." };
      if (s === "notAuthorized") {
        return { connected: false, detail: "Not linked yet. Scan the QR code in the Green-API console with WhatsApp." };
      }
      return { connected: false, detail: `Green-API status: ${s}.` };
    }
    const health = await call<{ status?: { text?: string } }>(
      `${whapiBase()}/health`,
      { method: "GET", headers: { Authorization: `Bearer ${whapiToken()}` } },
      "Whapi.Cloud",
    );
    const s = health?.status?.text ?? "unknown";
    if (s === "AUTH") return { connected: true, detail: "Linked and ready." };
    return { connected: false, detail: `Whapi.Cloud status: ${s}. Scan the QR code in the Whapi dashboard.` };
  } catch (err) {
    return { connected: false, detail: errorMessage(err) };
  }
}
