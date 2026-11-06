import { getStore } from "@netlify/blobs";
import crypto from "crypto";
import defaults from "./default-menu.mjs";
import { sessionEmail, log } from "./lib.mjs";

const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const same = (a = "", b = "") => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const txt = (v, n) => String(v ?? "").replace(/[<>]/g, "").slice(0, n);
const tag = (v, n) => txt(v, n).replace(/['"`\\]/g, "").trim();

export async function billing() {
  const st = getStore("billing");
  let s = await st.get("state", { type: "json" });
  if (!s) { s = { trialEndsAt: Date.now() + 5 * 864e5, paidUntil: 0 }; await st.setJSON("state", s); }
  const now = Date.now();
  return { ...s, access: now < s.trialEndsAt || now < s.paidUntil, onTrial: now < s.trialEndsAt && now >= (s.paidUntil || 0) };
}

export default async (req) => {
  const store = getStore("menu");
  const me = await sessionEmail(req);
  const authed = !!me;
  const url = new URL(req.url);

  if (req.method === "GET") {
    if (url.searchParams.get("defaults")) return J(defaults);
    return J((await store.get("items", { type: "json" })) || []);
  }
  if (!authed) { await new Promise(r => setTimeout(r, 800)); return J({ error: "Please log in" }, 401); }

  if (req.method === "POST") { // login check
    const b = await billing();
    return J({ ok: true, access: b.access, onTrial: b.onTrial, trialEndsAt: b.trialEndsAt, paidUntil: b.paidUntil });
  }
  if (req.method === "PUT") {
    const b = await billing();
    if (!b.access) return J({ error: "Subscription expired" }, 402);
    let body; try { body = await req.json(); } catch { return J({ error: "Invalid JSON" }, 400); }
    if (!Array.isArray(body)) return J({ error: "Menu must be a list" }, 400);
    const cats = ["breakfast", "food", "drinks"];
    const clean = body.map((i, n) => ({
      id: String(i.id || "i" + Date.now() + n).replace(/[^\w-]/g, "").slice(0, 40) || "i" + Date.now() + n,
      title: txt(i.title, 120).trim(),
      price: Math.max(0, Math.round(Number(i.price) || 0)),
      category: cats.includes(i.category) ? i.category : "food",
      subcategory: tag(i.subcategory, 40) || "Other",
      description: txt(i.description, 300),
    })).filter(i => i.title);
    await store.setJSON("items", clean);
    await log(me, "menu_save", clean.length + " items");
    return J({ ok: true, count: clean.length });
  }
  return J({ error: "Method not allowed" }, 405);
};
export const config = { path: "/api/menu" };
