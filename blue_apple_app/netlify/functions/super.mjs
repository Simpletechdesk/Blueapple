import { getStore } from "@netlify/blobs";
import crypto from "crypto";
import { session, getUsers, saveUsers, log, isSuper } from "./lib.mjs";
import { billing } from "./menu.mjs";
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default async (req) => {
  const me = await session(req);
  if (!me) return J({ error: "Please log in" }, 401);
  if (!me.super) return J({ error: "Super user only" }, 403);
  const list = await getUsers();

  if (req.method === "GET") {
    const b = await billing();
    return J({
      users: list.map((u) => ({ email: u.email, created: u.created, lastLogin: u.lastLogin || 0, disabled: !!u.disabled, super: isSuper(u.email) })),
      activity: (await getStore("activity").get("log", { type: "json" })) || [],
      billing: { trialEndsAt: b.trialEndsAt, paidUntil: b.paidUntil, access: b.access },
    });
  }
  if (req.method !== "POST") return J({ error: "Method not allowed" }, 405);
  const { action, email, newPassword } = await req.json().catch(() => ({}));
  const u = list.find((x) => x.email === email);
  if (!u) return J({ error: "User not found" }, 404);
  if (isSuper(u.email) && action !== "logout") return J({ error: "Can't change the super user this way" }, 400);

  if (action === "disable") { u.disabled = true; u.v = (u.v || 0) + 1; }
  else if (action === "enable") { u.disabled = false; }
  else if (action === "logout") { u.v = (u.v || 0) + 1; }
  else if (action === "resetpw") {
    if (String(newPassword || "").length < 8) return J({ error: "Password must be at least 8 characters" }, 400);
    u.salt = crypto.randomBytes(16).toString("hex");
    u.hash = crypto.scryptSync(newPassword, u.salt, 64).toString("hex");
    u.v = (u.v || 0) + 1;
  } else if (action === "delete") { list.splice(list.indexOf(u), 1); }
  else return J({ error: "Unknown action" }, 400);

  await saveUsers(list);
  await log(me.email, "super_" + action, email);
  return J({ ok: true });
};
export const config = { path: "/api/super" };
