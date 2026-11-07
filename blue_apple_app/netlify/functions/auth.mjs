import { getStore } from "@netlify/blobs";
import crypto from "crypto";
import { MAX, sha, isSuper, getUsers, saveUsers, log } from "./lib.mjs";
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 64);
const wait = () => new Promise((r) => setTimeout(r, 800));

export default async (req) => {
  const ss = getStore("sessions");
  const list = await getUsers();
  const count = list.filter((u) => !isSuper(u.email)).length;
  if (req.method === "GET") return J({ users: count, max: MAX, full: count >= MAX });
  if (req.method !== "POST") return J({ error: "Method not allowed" }, 405);

  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").trim().toLowerCase();

  const issue = async (u) => {
    const tok = crypto.randomBytes(32).toString("hex");
    await ss.setJSON(sha(tok), { email: u.email, exp: Date.now() + 7 * 864e5, v: u.v || 0 });
    u.lastLogin = Date.now();
    await saveUsers(list);
    return J({ ok: true, token: tok, email: u.email, super: isSuper(u.email) });
  };

  if (b.action === "logout") {
    const t = req.headers.get("x-session") || b.token;
    if (t) await ss.delete(sha(t));
    return J({ ok: true });
  }

  if (b.action === "forgot") {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return J({ error: "Please enter a valid email address" }, 400);
    const u = list.find((x) => x.email === email);
    if (u && !u.disabled) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resets = getStore("resets");
      await resets.setJSON(sha(resetToken), { email: u.email, exp: Date.now() + 15 * 60 * 1000 });
      await log(email, "forgot_password_request");
      const origin = new URL(req.url).origin;
      const resetLink = `${origin}/admin.html?reset_token=${resetToken}&email=${encodeURIComponent(u.email)}`;
      return J({ ok: true, message: "Reset link dispatched to email.", resetLink });
    }
    return J({ ok: true, message: "If account exists, a reset link has been dispatched." });
  }

  if (b.action === "reset") {
    const token = String(b.token || "").trim();
    const newPassword = String(b.newPassword || "").trim();
    if (!token) return J({ error: "Missing reset token" }, 400);
    if (newPassword.length < 8) return J({ error: "Password must be at least 8 characters" }, 400);

    const resets = getStore("resets");
    const record = await resets.get(sha(token), { type: "json" });
    if (!record || record.exp < Date.now()) {
      return J({ error: "Invalid or expired reset link" }, 400);
    }

    const u = list.find((x) => x.email === record.email);
    if (!u) return J({ error: "User account not found" }, 404);

    u.salt = crypto.randomBytes(16).toString("hex");
    u.hash = hash(newPassword, u.salt).toString("hex");
    u.v = (u.v || 0) + 1;

    await saveUsers(list);
    await resets.delete(sha(token));
    await log(u.email, "password_reset_success");
    return J({ ok: true, message: "Password updated successfully. Please log in." });
  }

  if (b.action === "register") {
    const invite = process.env.ADMIN_PASSWORD || "";
    const a = Buffer.from(String(b.code || "")), c = Buffer.from(invite);
    if (!invite || a.length !== c.length || !crypto.timingSafeEqual(a, c)) { await wait(); return J({ error: "Wrong invite code" }, 401); }
    if (count >= MAX && !isSuper(email)) return J({ error: `Maximum of ${MAX} admin accounts reached` }, 403);
    if (!/^\S+@\S+\.\S+$/.test(email)) return J({ error: "Enter a valid email" }, 400);
    if (String(b.password || "").length < 8) return J({ error: "Password must be at least 8 characters" }, 400);
    if (list.some((u) => u.email === email)) return J({ error: "That email already has an account" }, 409);
    const salt = crypto.randomBytes(16).toString("hex");
    const u = { email, salt, hash: hash(b.password, salt).toString("hex"), created: Date.now(), v: 0 };
    list.push(u);
    await log(email, "register");
    return issue(u);
  }

  if (b.action === "login") {
    const u = list.find((x) => x.email === email);
    const ok = u && crypto.timingSafeEqual(hash(String(b.password || ""), u.salt), Buffer.from(u.hash, "hex"));
    if (!ok) { await log(email || "?", "login_failed"); await wait(); return J({ error: "Wrong email or password" }, 401); }
    if (u.disabled) { await log(email, "login_blocked", "account disabled"); return J({ error: "This account has been disabled" }, 403); }
    await log(email, "login");
    return issue(u);
  }

  return J({ error: "Unknown action" }, 400);
};
export const config = { path: "/api/auth" };
