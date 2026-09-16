// GET /api/stats — public, cached 5 min. Real numbers only, per product slug:
//   views  = product page views in the last 30 days
//   demos  = demo starts in the last 30 days
//   sales  = completed PayPal payments / activated subscriptions, all time
import { json } from "../_lib.js";

export async function onRequestGet({ request, env }) {
  const cache = caches.default;
  const key = new Request(new URL(request.url).origin + "/api/stats", { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;
  if (!env.DB) return json({ ok: false }, 500);

  const views = (await env.DB.prepare(
    `SELECT substr(page, instr(page, '/products/') + 10) AS slug, COUNT(*) n
       FROM visits WHERE type='view' AND page LIKE '%/products/%.html' AND at >= datetime('now','-30 days')
      GROUP BY slug`).all()).results;
  const demos = (await env.DB.prepare(
    `SELECT item AS slug, COUNT(DISTINCT sid) n FROM visits
      WHERE type='demo_open' AND item != '' AND at >= datetime('now','-30 days') GROUP BY item`).all()).results;
  const sales = (await env.DB.prepare(
    `SELECT item, COUNT(DISTINCT COALESCE(NULLIF(subscription_id,''), NULLIF(txn_id,''), event_id)) n FROM sales
      WHERE event_type IN ('PAYMENT.CAPTURE.COMPLETED','PAYMENT.SALE.COMPLETED','BILLING.SUBSCRIPTION.ACTIVATED')
      GROUP BY item`).all()).results;

  const out = {};
  const bump = (slug, k, n) => { slug = String(slug || "").replace(/\.html$/, ""); if (!slug) return; (out[slug] = out[slug] || { views: 0, demos: 0, sales: 0 })[k] += n; };
  views.forEach((r) => bump(r.slug, "views", r.n));
  const impressions = (await env.DB.prepare(
    `SELECT item AS slug, COUNT(*) n FROM visits WHERE type='impression' AND item != '' AND at >= datetime('now','-30 days') GROUP BY item`).all()).results;
  impressions.forEach((r) => bump(r.slug, "views", r.n));
  demos.forEach((r) => bump(r.slug, "demos", r.n));
  // sales.item holds the PayPal plan id / button description; the page maps it to a slug
  const salesByRef = {}; sales.forEach((r) => { if (r.item) salesByRef[r.item] = r.n; });

  const res = json({ ok: true, products: out, sales_by_ref: salesByRef, generated: new Date().toISOString() },
    200, { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" });
  await cache.put(key, res.clone());
  return res;
}
