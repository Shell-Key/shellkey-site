// POST /api/track — page views and checkout clicks (sendBeacon from site.js).
import { json, readJson, clean, geo } from "../_lib.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false }, 500);
  const b = await readJson(request);
  if (!b || !b.sid) return json({ ok: false }, 400);
  const page = clean(b.page, 300);
  if (page.startsWith("/crm")) return json({ ok: true }); // never count yourself
  const g = geo(request);
  await env.DB.prepare(
    `INSERT INTO visits (sid, type, page, item, ref, utm_source, utm_campaign, country, city, device, ua)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(clean(b.sid, 60), clean(b.type, 30) || "view", page, clean(b.item, 80), clean(b.ref, 300),
    clean(b.utm_source, 80), clean(b.utm_campaign, 80), g.country, g.city, g.device, g.ua).run();
  return json({ ok: true });
}
