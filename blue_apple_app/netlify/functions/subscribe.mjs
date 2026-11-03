import { sessionEmail } from "./lib.mjs";
export default async (req) => {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!(await sessionEmail(req))) return new Response("Unauthorized", { status: 401 });
  const { email, plan } = await req.json();
  const code = plan === "yearly" ? process.env.PAYSTACK_PLAN_YEARLY : process.env.PAYSTACK_PLAN_MONTHLY;
  if (!key || !code || !/^\S+@\S+\.\S+$/.test(email || "")) return new Response(JSON.stringify({ error: "Setup incomplete or bad email" }), { status: 400 });
  const r = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, plan: code, callback_url: new URL(req.url).origin + "/admin.html" }),
  });
  const d = await r.json();
  return new Response(JSON.stringify({ url: d?.data?.authorization_url, error: d.status ? null : d.message }), { headers: { "Content-Type": "application/json" } });
};
export const config = { path: "/api/subscribe" };
