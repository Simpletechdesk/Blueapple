import { getStore } from "@netlify/blobs";
import crypto from "crypto";
export const MAX = 7; // admin accounts (the super user is extra)
export const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
export const isSuper = (e) => !!process.env.SUPER_ADMIN_EMAIL && e === process.env.SUPER_ADMIN_EMAIL.trim().toLowerCase();
export const getUsers = async () => (await getStore("users").get("list", { type: "json" })) || [];
export const saveUsers = (l) => getStore("users").setJSON("list", l);
export async function log(email, event, detail = "") {
  const st = getStore("activity");
  const l = (await st.get("log", { type: "json" })) || [];
  l.unshift({ t: Date.now(), email, event, detail });
  await st.setJSON("log", l.slice(0, 300));
}
export async function session(req) {
  const t = req.headers.get("x-session");
  if (!t) return null;
  const s = await getStore("sessions").get(sha(t), { type: "json" });
  if (!s || s.exp < Date.now()) return null;
  const u = (await getUsers()).find((x) => x.email === s.email);
  if (!u || u.disabled || (s.v || 0) !== (u.v || 0)) return null;
  return { email: u.email, super: isSuper(u.email) };
}
export const sessionEmail = async (req) => (await session(req))?.email ?? null;
