import { getStore } from "@netlify/blobs";

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const { inviteCode } = body;

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return json({ error: "Server configuration error" }, 500);
  }

  if (inviteCode === adminPassword) {
    return json({ valid: true });
  } else {
    return json({ valid: false }, 401);
  }
};
