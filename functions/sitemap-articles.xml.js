// GET /sitemap-articles.xml: tells Google about every published weekly article
import { ensureArticlesTable } from "./_articles.js";
export async function onRequestGet({ env }) {
  await ensureArticlesTable(env.DB);
  const rows = (await env.DB.prepare("SELECT slug, created_at FROM articles WHERE status='published' ORDER BY id DESC").all()).results || [];
  const urls = [`<url><loc>https://shellkey.company/articles</loc></url>`]
    .concat(rows.map((r) => `<url><loc>https://shellkey.company/articles/${r.slug}</loc><lastmod>${r.created_at.slice(0, 10)}</lastmod></url>`));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>\n`,
    { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
