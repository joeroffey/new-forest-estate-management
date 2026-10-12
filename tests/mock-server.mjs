// Stand-in for Resend, Notion and Green-API during automated tests.
// Records every request so tests can check exactly what would have been sent.
import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.MOCK_PORT || 4010);
const requests = [];
const notionPages = new Map();
let notionProps = { Name: { id: "title", name: "Name", type: "title" } };

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw;
    }
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;

    if (path === "/__requests") {
      if (req.method === "DELETE") {
        requests.length = 0;
        return send(res, 200, { ok: true });
      }
      return send(res, 200, requests);
    }
    // Test hook: delete a Notion column, as if someone removed it in Notion.
    if (path === "/__notion/drop-column" && req.method === "POST") {
      delete notionProps[url.searchParams.get("name") ?? ""];
      return send(res, 200, { ok: true });
    }
    const entry = { method: req.method, path, query: url.search, body, at: Date.now(), status: 0 };
    requests.push(entry);
    res.on("finish", () => (entry.status = res.statusCode));

    // ---- Resend
    if (path === "/resend/emails" && req.method === "POST") return send(res, 200, { id: randomUUID() });

    // ---- Notion
    let m;
    if ((m = path.match(/^\/notion\/databases\/([^/]+)$/))) {
      if (req.method === "GET") return send(res, 200, { id: m[1], title: [{ plain_text: "Bookings" }], properties: notionProps });
      if (req.method === "PATCH") {
        for (const [name, cfg] of Object.entries(body?.properties ?? {})) {
          notionProps[name] = { id: name, name, type: Object.keys(cfg)[0] };
        }
        return send(res, 200, { id: m[1], properties: notionProps });
      }
    }
    // Like Notion, refuse pages that use a column the database doesn't have.
    const unknownProp = Object.keys(body?.properties ?? {}).find((name) => !notionProps[name]);
    if (path.startsWith("/notion/pages") && unknownProp) {
      return send(res, 400, { object: "error", code: "validation_error", message: `${unknownProp} is not a property that exists.` });
    }
    if (path === "/notion/pages" && req.method === "POST") {
      const id = randomUUID();
      notionPages.set(id, body);
      return send(res, 200, { id, object: "page" });
    }
    if ((m = path.match(/^\/notion\/pages\/([^/]+)$/)) && req.method === "PATCH") {
      if (!notionPages.has(m[1])) return send(res, 404, { object: "error", code: "object_not_found", message: "Could not find page" });
      return send(res, 200, { id: m[1], object: "page", archived: Boolean(body?.archived) });
    }

    // ---- postcodes.io (map locations): stable made-up points around the New Forest
    const spot = (key) => {
      let h = 2166136261;
      for (const ch of String(key).toUpperCase()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
      return { latitude: 50.72 + (h % 1000) / 1000 * 0.12, longitude: -1.78 + ((h >>> 10) % 1000) / 1000 * 0.25 };
    };
    if (path === "/postcodes/postcodes" && req.method === "POST") {
      const list = Array.isArray(body?.postcodes) ? body.postcodes : [];
      return send(res, 200, {
        status: 200,
        result: list.map((q) => ({ query: q, result: /^ZZ/i.test(q) ? null : { postcode: q, ...spot(q) } })),
      });
    }
    if ((m = path.match(/^\/postcodes\/outcodes\/([^/]+)$/))) {
      if (/^ZZ/i.test(m[1])) return send(res, 404, { status: 404, error: "Outcode not found" });
      return send(res, 200, { status: 200, result: { outcode: m[1], ...spot(m[1]) } });
    }
    if (path === "/postcodes/places" && req.method === "GET") {
      const q = url.searchParams.get("q") ?? "";
      return send(res, 200, { status: 200, result: q ? [{ name_1: q, county_unitary: "Hampshire", ...spot(q) }] : [] });
    }

    // ---- Green-API
    if ((m = path.match(/^\/green\/waInstance[^/]+\/([A-Za-z]+)\/[^/]+$/))) {
      const method = m[1];
      if (method === "getStateInstance") return send(res, 200, { stateInstance: "authorized" });
      if (method === "getContacts") {
        return send(res, 200, [
          { id: "447700900001-1600000000@g.us", name: "NFEM Cleaners", type: "group" },
          { id: "447700900002-1600000001@g.us", name: "Family", type: "group" },
        ]);
      }
      if (method === "sendMessage") return send(res, 200, { idMessage: randomUUID() });
    }

    send(res, 404, { message: `Mock has no route for ${req.method} ${path}` });
  });
});

server.listen(PORT, () => console.log(`mock server on ${PORT}`));
