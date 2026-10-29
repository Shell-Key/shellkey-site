// Shell Key weekly articles: one how-to article a week about a Shell Key portal or service:
// what it does, how it helps a team, and where it saves time and money. Published on
// shellkey.company/articles/<slug> so Google can send searchers to it for years.
//
//   writeWeeklyArticle(env, {force, slug})  called by the morning agent run (Mondays) or the CRM button
//   renderArticle / renderIndex            used by functions/articles/*.js
//
// Rules: plain English, real job language, no invented customers, numbers, savings figures,
// testimonials or deadlines. Savings are explained (what takes hours today, what replaces it),
// never promised as percentages.
import { CATALOG } from "./_catalog.js";
import { BRAND } from "./_brand.js";
import { notify } from "./_lib.js";

const MODEL = "claude-sonnet-5-5";
const WEEKDAY = "Mon";                                     // the day new articles are written
const CATEGORIES = BRAND.post_categories || ["software", "wallcharts", "apps", "builds"];

export async function ensureArticlesTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    slug TEXT NOT NULL UNIQUE,
    item TEXT, item_label TEXT,
    title TEXT NOT NULL, description TEXT NOT NULL,
    body TEXT NOT NULL,                       -- JSON: {lede, sections:[{heading, paragraphs[], bullets[]}]}
    status TEXT NOT NULL DEFAULT 'published'  -- published | hidden
  )`).run();
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

async function askClaude(env, system, user) {
  const r = await fetch((env.ANTHROPIC_BASE_URL || "https://api.anthropic.com") + "/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env.CLAUDE_MODEL || MODEL, max_tokens: 4000, system, messages: [{ role: "user", content: user }] }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Claude API " + r.status + ": " + ((d.error && d.error.message) || "no detail"));
  const text = (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("Claude did not return JSON");
  return JSON.parse(text.slice(a, b + 1));
}

function todayParts() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, weekday: p.weekday };
}

export async function writeWeeklyArticle(env, { force = false, slug = "" } = {}) {
  const db = env.DB;
  await ensureArticlesTable(db);
  const { weekday } = todayParts();
  if (!force) {
    if (weekday !== WEEKDAY) return { ok: true, skipped: true, message: "Articles are written on Mondays." };
    const recent = await db.prepare("SELECT COUNT(*) n FROM articles WHERE created_at >= datetime('now','-6 days')").first();
    if (recent.n) return { ok: true, skipped: true, message: "This week's article is already written." };
  }
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set in Cloudflare yet");

  // Which product: the one written about least recently (portals, dashboards, apps, development services)
  const pool = CATALOG.filter((p) => CATEGORIES.includes(p.cat) && !(BRAND.never || []).includes(p.slug));
  const last = {};
  ((await db.prepare("SELECT item, MAX(created_at) d FROM articles GROUP BY item").all()).results || []).forEach((r) => { last[r.item] = r.d; });
  const product = slug ? CATALOG.find((p) => p.slug === slug) : pool.sort((a, b) => (last[a.slug] || "").localeCompare(last[b.slug] || ""))[0];
  if (!product) throw new Error("No product to write about");
  const pastTitles = ((await db.prepare("SELECT title FROM articles ORDER BY id DESC LIMIT 20").all()).results || []).map((r) => r.title);

  const system = [
    `You write helpful articles for ${BRAND.company}'s website (${BRAND.site}), ${BRAND.place}, in the owner's voice.`,
    "", "WHO WE ARE", ...BRAND.who_we_are.map((x) => "- " + x),
    "", "AUDIENCES", ...BRAND.audiences.map((x) => "- " + x),
    "", "RULES",
    "- Write for a busy reader who found this on Google. Plain English, short paragraphs (2-3 sentences), US spelling.",
    "- Teach something useful first: the problem, why it costs the team time and money, and how to fix it. The product is the shortcut, not the whole article.",
    "- Explain savings concretely (hours spent re-keying spreadsheets, rework from late information, idle crews, missed bid dates), but NEVER invent numbers, percentages, customers, testimonials, results or deadlines.",
    "- Use real job language where it fits (P6, XER, critical path, workpacks, turnaround, NDE, weld map).",
    ...BRAND.avoid.map((x) => "- " + x),
    "- 700 to 1000 words total. 4 to 6 sections. A section may have a short bullet list.",
    "- Title: what someone would type into Google, under 65 characters, no clickbait. Description: one sentence under 155 characters.",
    "", 'Reply with JSON only: {"title":"...","description":"...","lede":"one or two sentences","sections":[{"heading":"...","paragraphs":["..."],"bullets":["..."]}]}',
  ].join("\n");
  const user = [
    "Write this week's article about this product: how it helps a team, where it saves time and money, and who it is for.",
    "PRODUCT (only use these facts):",
    JSON.stringify({ name: product.name, tagline: product.tagline, description: product.short, highlights: product.bullets,
      price: product.price ? product.price + (product.price_note ? " " + product.price_note : "") : "",
      free_demo: product.demo ? "yes, free in the browser, no card, no install" : "no" }, null, 1),
    pastTitles.length ? "\nEarlier article titles (pick a different angle):\n" + pastTitles.map((t) => "- " + t).join("\n") : "",
  ].join("\n");

  const a = await askClaude(env, system, user);
  if (!a.title || !Array.isArray(a.sections) || !a.sections.length) throw new Error("The article came back incomplete; try again.");
  let s = slugify(a.title) || slugify(product.name);
  if (await db.prepare("SELECT 1 FROM articles WHERE slug=?").bind(s).first()) s += "-" + Date.now().toString(36);
  const body = JSON.stringify({ lede: a.lede || "", sections: a.sections });
  await db.prepare("INSERT INTO articles (slug, item, item_label, title, description, body) VALUES (?,?,?,?,?,?)")
    .bind(s, product.slug, product.name, String(a.title).slice(0, 120), String(a.description || a.lede || "").slice(0, 200), body).run();

  const url = `${BRAND.site}/articles/${s}`;
  await notify(env, `New article published: ${a.title}`, [
    `This week's article is live on your website (about ${product.name}):`, url, "",
    "Read it. If you want it taken down, press Hide on the Marketing tab in the CRM.",
    "Share it on LinkedIn: it's the kind of post your audience saves.",
  ]);
  return { ok: true, slug: s, url, title: a.title, product: product.slug };
}

// ---------------------------------------------------------------- pages
async function shell(env, request) {
  const r = await env.ASSETS.fetch(new URL("/article-template.html", request.url));
  if (!r.ok) throw new Error("article-template.html is missing; run build_store.py");
  return r.text();
}
const fill = (tpl, v) => tpl.replaceAll("{{TITLE}}", esc(v.title)).replaceAll("{{DESC}}", esc(v.desc)).replaceAll("{{PATH}}", v.path).replace("{{BODY}}", v.body);
const page = (html, status = 200) => new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=600" } });

export async function renderArticle(env, request, slug) {
  await ensureArticlesTable(env.DB);
  const a = await env.DB.prepare("SELECT * FROM articles WHERE slug=? AND status='published'").bind(slug).first();
  const tpl = await shell(env, request);
  if (!a) return page(fill(tpl, { title: "Article not found | Shell Key", desc: "", path: "articles", body: '<div class="article"><h1>Article not found</h1><p><a href="/articles">See all articles</a></p></div>' }), 404);
  const b = JSON.parse(a.body);
  const product = CATALOG.find((p) => p.slug === a.item);
  const link = product ? `${product.url}?utm_source=article&utm_medium=web&utm_campaign=a${a.id}` : BRAND.store;
  const sections = (b.sections || []).map((s) => `<h2>${esc(s.heading)}</h2>` +
    (s.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join("") +
    ((s.bullets || []).length ? `<ul>${s.bullets.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "")).join("\n");
  const date = new Date(a.created_at.replace(" ", "T") + "Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
  const schema = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: a.title, description: a.description,
    datePublished: a.created_at.replace(" ", "T") + "Z", author: { "@type": "Person", name: BRAND.owner }, publisher: { "@type": "Organization", name: "Shell Key", url: BRAND.site } }).replace(/</g, "\\u003c")}</script>`;
  const body = `<article class="article">
  <p class="meta"><a href="/articles">Articles</a> · ${esc(date)} · ${esc(BRAND.owner)}</p>
  <h1>${esc(a.title)}</h1>
  ${b.lede ? `<p class="lede">${esc(b.lede)}</p>` : ""}
  ${sections}
  ${product ? `<div class="cta"><h2 style="margin-top:0">See it for yourself</h2><p>${esc(product.name)}: ${esc(product.tagline || "")}</p>
  <p><a class="btn btn-primary" href="${esc(link)}">${product.demo ? "Try the free demo" : "See " + esc(product.name)}</a></p></div>` : ""}
</article>${schema}`;
  return page(fill(tpl, { title: `${a.title} | Shell Key`, desc: a.description, path: `articles/${a.slug}`, body }));
}

export async function renderIndex(env, request) {
  await ensureArticlesTable(env.DB);
  const rows = (await env.DB.prepare("SELECT slug, title, description, created_at FROM articles WHERE status='published' ORDER BY id DESC LIMIT 200").all()).results || [];
  const tpl = await shell(env, request);
  const body = `<div class="article"><h1>Articles</h1><p class="lede">Practical guides for project controls, turnarounds, inspection and contractors, from 32 years on the job.</p></div>
<ul class="article-list">${rows.map((r) => `<li><a href="/articles/${esc(r.slug)}"><b>${esc(r.title)}</b><span class="meta">${esc(r.description)}</span></a></li>`).join("") || '<li class="meta">The first article is coming soon.</li>'}</ul>`;
  return page(fill(tpl, { title: "Articles | Shell Key", desc: "Practical guides for project controls, turnarounds, inspection and contractors.", path: "articles", body }));
}

export async function listArticles(db) {
  await ensureArticlesTable(db);
  return (await db.prepare("SELECT id, slug, title, item_label, status, created_at FROM articles ORDER BY id DESC LIMIT 100").all()).results || [];
}
