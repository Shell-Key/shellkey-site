// GET /api/links — public. The products behind the most recent social posts, newest first,
// for the Instagram bio page (links.html). Only public product info goes out.
// Each product carries the campaign tag of its latest Instagram post, so clicks from the
// bio page are credited to that post on the Results tab.
import { json } from "../_lib.js";
import { CATALOG } from "../_catalog.js";
import { BRAND } from "../_brand.js";

export async function onRequestGet({ request, env }) {
  const cache = caches.default;
  const key = new Request(new URL(request.url).origin + "/api/links", { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;

  const bySlug = Object.fromEntries(CATALOG.map((p) => [p.slug, p]));
  const out = [], seen = new Set();
  const add = (slug, campaign, day) => {
    const p = bySlug[slug];
    if (!p || seen.has(slug) || BRAND.never.includes(slug)) return;
    seen.add(slug);
    out.push({ slug, name: p.name, tagline: p.tagline, price: p.price, price_note: p.price_note,
      status: p.status, demo: p.demo, image: p.social || p.img, campaign: campaign || "bio", day: day || "" });
  };

  if (env.DB) {
    try {
      const rows = (await env.DB.prepare(
        `SELECT item, MAX(day) day,
                (SELECT campaign FROM posts q WHERE q.item = p.item AND q.platform = 'instagram' AND q.status = 'posted'
                  ORDER BY q.id DESC LIMIT 1) ig_campaign
           FROM posts p WHERE status = 'posted' AND item != ''
          GROUP BY item ORDER BY MAX(posted_at) DESC LIMIT 12`).all()).results;
      rows.forEach((r) => add(r.item, r.ig_campaign, r.day));
    } catch { /* marketing tables missing: fall through to the focus list */ }
  }
  // Always fill out the page with the products we push hardest, then anything with a demo.
  BRAND.focus.forEach((s) => add(s));
  CATALOG.filter((p) => p.status === "available" && p.demo).forEach((p) => add(p.slug));

  const res = json({ ok: true, items: out.slice(0, 12) }, 200, { "cache-control": "public, max-age=300" });
  await cache.put(key, res.clone());
  return res;
}
