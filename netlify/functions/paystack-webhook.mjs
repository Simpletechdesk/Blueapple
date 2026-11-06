import crypto from "crypto";
import { getStore } from "@netlify/blobs";
export default async (req) => {
  const raw = await req.text();
  const sig = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY || "").update(raw).digest("hex");
  if (sig !== req.headers.get("x-paystack-signature")) return new Response("Bad signature", { status: 401 });
  const ev = JSON.parse(raw);
  if (ev.event === "charge.success" && ev.data?.status === "success" && ev.data?.currency === "NGN") {
    const st = getStore("billing");
    const s = (await st.get("state", { type: "json" })) || { trialEndsAt: 0, paidUntil: 0 };
    if (s.lastRef === ev.data.reference) return new Response("ok");
    const yearly = ev.data.amount >= 11500000; // kobo
    const base = Math.max(Date.now(), s.paidUntil || 0);
    s.paidUntil = base + (yearly ? 366 : 31) * 864e5;
    s.lastRef = ev.data.reference;
    await st.setJSON("state", s);
  }
  return new Response("ok");
};
export const config = { path: "/api/paystack-webhook" };
