// Shell Key marketing agent.
//   writeDailyPosts(env)  picks today's product, asks Claude for one post per platform,
//                         saves them as drafts in the posts table.
//   publishPost(env, id)  sends an approved post to Facebook or Instagram.
//                         LinkedIn has no free automatic posting for company pages,
//                         so LinkedIn posts are copied and pasted from the CRM.
//
// Secrets / variables (Cloudflare Pages -> Settings -> Variables and Secrets):
//   ANTHROPIC_API_KEY   required to write posts (console.anthropic.com)
//   CLAUDE_MODEL        optional, default below
//   FB_PAGE_ID          Facebook Page id                          } needed for automatic
//   FB_PAGE_TOKEN       long-lived Page access token              } Facebook posting
//   IG_USER_ID          Instagram business account id (uses FB_PAGE_TOKEN)
//   AUTO_POST           "yes" = skip approval and post Facebook/Instagram as soon as written
//   AGENT_KEY           password the daily timer uses to start the agent
import { CATALOG } from "./_catalog.js";
import { BRAND } from "./_brand.js";
import { notify } from "./_lib.js";
import { linkedinStatus, postToLinkedIn } from "./_linkedin.js";

export const PLATFORMS = ["facebook", "instagram", "linkedin"];
const MODEL = "claude-sonnet-5-5";
const GRAPH = "https://graph.facebook.com/v26.0";
const SHORT = { facebook: "fb", instagram: "ig", linkedin: "li" };

// Today's date in Lafayette, not UTC, so "today's posts" means Kirby's today.
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
}

export function setupStatus(env) {
  return {
    database: !!env.DB,
    claude: !!env.ANTHROPIC_API_KEY,
    facebook: !!(env.FB_PAGE_ID && env.FB_PAGE_TOKEN),
    instagram: !!(env.IG_USER_ID && env.FB_PAGE_TOKEN),
    timer_key: !!env.AGENT_KEY,
    auto_post: String(env.AUTO_POST || "").toLowerCase() === "yes",
    model: env.CLAUDE_MODEL || MODEL,
  };
}

// ---------------------------------------------------------------- choosing what to post
// Score every product. Higher = post sooner. Products you can buy or demo today come
// first, focus products get a boost, and anything posted recently waits its turn.
async function pickProduct(db, day) {
  const last = {};
  const rows = (await db.prepare("SELECT item, MAX(day) d FROM posts WHERE status != 'rejected' GROUP BY item").all()).results;
  rows.forEach((r) => { last[r.item] = r.d; });
  const daysSince = (slug) => {
    if (!last[slug]) return 60;
    return Math.max(0, Math.round((Date.parse(day) - Date.parse(last[slug])) / 86400000));
  };
  const pool = CATALOG.filter((p) => !BRAND.never.includes(p.slug) && BRAND.post_categories.includes(p.cat));
  let best = null, bestScore = -1;
  for (const p of pool) {
    let s = 0;
    if (p.status === "available") s += p.buyable ? 30 : 15;
    else if (p.status === "quote") s += 8;
    else s += 3;                                   // coming soon: an occasional teaser, not a regular
    if (p.demo) s += 15;
    if (BRAND.focus.includes(p.slug)) s += 20;
    s += Math.min(daysSince(p.slug), 30) * 3;      // waiting time matters most
    if (daysSince(p.slug) < 7) s -= 100;           // never the same product twice in a week
    if (s > bestScore) { best = p; bestScore = s; }
  }
  return best;
}

function pickAngle(product, day) {
  const n = Math.round(Date.parse(day) / 86400000);
  let angles = BRAND.angles.slice();
  if (!product.demo) angles = angles.filter((a) => !a.startsWith("demo"));
  if (product.status !== "available") angles = angles.filter((a) => !a.startsWith("offer"));
  return angles[n % angles.length];
}

// Word limits (not counting hashtags or the link); a post over this gets rewritten once
const LIMIT = { facebook: 40, instagram: 40, linkedin: 45 };
function words(text) {
  return String(text || "").replace(/\{LINK\}|https?:\/\/\S+|#\w+/g, " ").split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------- talking to Claude
async function askClaude(env, system, user) {
  const r = await fetch((env.ANTHROPIC_BASE_URL || "https://api.anthropic.com") + "/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL || MODEL,
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Claude API " + r.status + ": " + ((d.error && d.error.message) || "no detail"));
  return (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
}

function parseJson(text) {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Claude did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}

function systemPrompt() {
  const b = BRAND;
  return [
    `You write social media posts for ${b.company}, ${b.place}. You write as the company, in the owner's voice.`,
    "", "WHO WE ARE", ...b.who_we_are.map((x) => "- " + x),
    "", "AUDIENCES", ...b.audiences.map((x) => "- " + x),
    "", "VOICE RULES", ...b.voice.map((x) => "- " + x),
    "", "NEVER", ...b.avoid.map((x) => "- " + x),
    "", "PLATFORM RULES", ...Object.entries(b.platforms).map(([k, v]) => `- ${k}: ${v}`),
    "", `Contact: ${b.phone} · ${b.email} · ${b.site}`,
    "", "Where the link belongs, write exactly {LINK} on its own line. The system replaces it with a tracked link. Do not write any other URL except shellkey.company in the Instagram post.",
    "Reply with JSON only, no other text: {\"facebook\": \"...\", \"instagram\": \"...\", \"linkedin\": \"...\"}",
  ].join("\n");
}

// ---------------------------------------------------------------- the daily job
export async function writeDailyPosts(env, { force = false, slug = "" } = {}) {
  if (!env.DB) throw new Error("Database not bound");
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set in Cloudflare yet");
  const db = env.DB;
  const day = today();

  if (!force) {
    const have = (await db.prepare("SELECT COUNT(*) n FROM posts WHERE day=?").bind(day).first()).n;
    if (have) return { ok: true, skipped: true, day, message: "Today's posts are already written." };
  }

  const product = slug ? CATALOG.find((p) => p.slug === slug) : await pickProduct(db, day);
  if (!product) throw new Error("No product to post about");
  const angle = pickAngle(product, day);

  const recent = (await db.prepare(
    "SELECT platform, body FROM posts WHERE status != 'rejected' ORDER BY id DESC LIMIT 6").all()).results;

  const user = [
    `Today is ${day}. Write one post for each platform about this product.`,
    `Angle for today: ${angle}`,
    "",
    "PRODUCT (only use these facts):",
    JSON.stringify({
      name: product.name, tagline: product.tagline, description: product.short, highlights: product.bullets,
      price: product.price ? product.price + (product.price_note ? " " + product.price_note : "") : "",
      status: product.status === "available" ? "available now" : product.status === "quote" ? "built to order, by quote" : "coming soon, people can request it now",
      free_demo: product.demo ? "yes, free in the browser, no card, no install" : "no",
    }, null, 1),
    "",
    recent.length ? "RECENT POSTS. Do not repeat their openings or phrasing:\n" + recent.map((r) => "- " + r.body.slice(0, 160).replace(/\s+/g, " ")).join("\n") : "",
  ].join("\n");

  let out = parseJson(await askClaude(env, systemPrompt(), user));
  // Posts must stay short. If any came back long, ask once more for shorter ones.
  const tooLong = PLATFORMS.filter((pl) => words(out[pl]) > LIMIT[pl]);
  if (tooLong.length) {
    out = { ...out, ...parseJson(await askClaude(env, systemPrompt(), user +
      `\n\nYour last version was too long for: ${tooLong.join(", ")}. Rewrite ALL posts much shorter: 2 or 3 short lines each, no paragraphs.`)) };
  }
  const image = BRAND.site + "/" + (product.social || product.img);
  const created = [];
  for (const platform of PLATFORMS) {
    const text = String(out[platform] || "").trim();
    if (!text) continue;
    const r = await db.prepare(
      "INSERT INTO posts (day, platform, item, item_label, angle, body, image) VALUES (?,?,?,?,?,?,?)"
    ).bind(day, platform, product.slug, product.name, angle.split(":")[0], text, image).run();
    const id = r.meta.last_row_id;
    const campaign = "p" + id;
    const link = `${product.url}?utm_source=${platform}&utm_medium=social&utm_campaign=${campaign}`;
    const body = platform === "instagram" ? text.replace(/\{LINK\}\s*/g, "") : (text.includes("{LINK}") ? text.replace(/\{LINK\}/g, link) : text + "\n\n" + link);
    await db.prepare("UPDATE posts SET body=?, link=?, campaign=? WHERE id=?").bind(body, link, campaign, id).run();
    created.push({ id, platform });
  }

  const s = setupStatus(env);
  const li = await linkedinStatus(env);
  const connected = { facebook: s.facebook, instagram: s.instagram, linkedin: li.connected };
  const auto = s.auto_post;
  const posted = [];
  if (auto) {
    for (const c of created) {
      if (!connected[c.platform]) continue;
      try { await publishPost(env, c.id); posted.push(c.platform); } catch { /* the card shows the error */ }
    }
  }
  const lines = [
    `Today's product: ${product.name} (${angle.split(":")[0]} post)`,
    auto && posted.length ? "Posted automatically: " + posted.join(", ") + ". Anything else is waiting for you."
         : "Open the Marketing tab, read them, fix anything you want, and press Approve & Post.",
  ];
  if (li.connected && li.days_left <= 7) lines.push("", `LinkedIn sign-in runs out in ${li.days_left} day(s). Press Reconnect LinkedIn on the Marketing tab.`);
  await notify(env, `${created.length} posts ready: ${product.name}`, [...lines, "", "https://shellkey.company/crm.html#marketing"]);
  return { ok: true, day, product: product.slug, angle, created };
}

// ---------------------------------------------------------------- posting
async function graph(env, path, params) {
  const r = await fetch((env.GRAPH_URL || GRAPH) + path, { method: "POST", body: new URLSearchParams(params) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error((d.error && d.error.message) || "Facebook said " + r.status);
  return d;
}

export async function publishPost(env, id) {
  const db = env.DB;
  const p = await db.prepare("SELECT * FROM posts WHERE id=?").bind(id).first();
  if (!p) throw new Error("Post not found");
  if (p.status === "posted") return { ok: true, already: true };
  const s = setupStatus(env);
  let remote = "";
  try {
    if (p.platform === "facebook") {
      if (!s.facebook) throw new Error("Facebook is not connected yet. Copy the post, paste it on your Page, then press Mark as posted.");
      const d = await graph(env, `/${env.FB_PAGE_ID}/feed`, { message: p.body, link: p.link, access_token: env.FB_PAGE_TOKEN });
      remote = d.id || "";
    } else if (p.platform === "instagram") {
      if (!s.instagram) throw new Error("Instagram is not connected yet. Save the image, post it from your phone, then press Mark as posted.");
      const c = await graph(env, `/${env.IG_USER_ID}/media`, { image_url: p.image, caption: p.body, access_token: env.FB_PAGE_TOKEN });
      const d = await graph(env, `/${env.IG_USER_ID}/media_publish`, { creation_id: c.id, access_token: env.FB_PAGE_TOKEN });
      remote = d.id || "";
    } else if (p.platform === "linkedin") {
      remote = await postToLinkedIn(env, p);
    } else {
      throw new Error("Unknown platform " + p.platform);
    }
  } catch (e) {
    await db.prepare("UPDATE posts SET error=?, updated_at=datetime('now') WHERE id=?").bind(String(e.message).slice(0, 500), id).run();
    throw e;
  }
  await db.prepare("UPDATE posts SET status='posted', posted_at=datetime('now'), remote_id=?, error=NULL, updated_at=datetime('now') WHERE id=?")
    .bind(remote, id).run();
  return { ok: true, remote_id: remote };
}

// ---------------------------------------------------------------- results / ROI
// A visitor belongs to the campaign of the first tracked link they ever arrived on
// (first touch). Their form fills belong to that campaign, and a PayPal sale belongs to
// it when the buyer's email matches one of those leads.
export async function results(db, days) {
  const since = "-" + days + " days";
  const per = (await db.prepare(`
    WITH firsts AS (
      SELECT v.sid, v.utm_campaign AS campaign FROM visits v
      JOIN (SELECT sid, MIN(id) mid FROM visits WHERE utm_campaign != '' GROUP BY sid) f ON f.mid = v.id
    ),
    lead_c AS (
      SELECT l.id, l.email, f.campaign FROM leads l JOIN firsts f ON f.sid = l.sid
    ),
    money AS (
      SELECT s.*, COALESCE(NULLIF(s.subscription_id,''), NULLIF(s.txn_id,''), s.event_id) AS ref FROM sales s
      WHERE s.event_type IN ('PAYMENT.CAPTURE.COMPLETED','PAYMENT.SALE.COMPLETED','BILLING.SUBSCRIPTION.ACTIVATED')
    )
    SELECT p.id, p.day, p.platform, p.item, p.item_label, p.angle, p.status, p.campaign,
      (SELECT COUNT(DISTINCT sid) FROM visits WHERE utm_campaign = p.campaign) AS clicks,
      (SELECT COUNT(*) FROM visits WHERE type='checkout' AND sid IN (SELECT sid FROM firsts WHERE campaign = p.campaign)) AS checkouts,
      (SELECT COUNT(*) FROM lead_c WHERE campaign = p.campaign) AS leads,
      (SELECT COUNT(DISTINCT ref) FROM money WHERE payer_email != '' AND payer_email IN (SELECT email FROM lead_c WHERE campaign = p.campaign AND email != '')) AS sales,
      (SELECT COALESCE(SUM(amount),0) FROM money WHERE event_type LIKE 'PAYMENT.%' AND payer_email != '' AND payer_email IN (SELECT email FROM lead_c WHERE campaign = p.campaign AND email != '')) AS revenue,
      (SELECT COALESCE(SUM(amount),0) FROM spend WHERE campaign = p.campaign) AS spend
    FROM posts p
    WHERE p.status = 'posted' AND p.day >= date('now', ?)
    ORDER BY p.day DESC, p.id DESC`).bind(since).all()).results;

  const spendRows = (await db.prepare("SELECT * FROM spend WHERE day >= date('now', ?) ORDER BY day DESC, id DESC").bind(since).all()).results;
  const general = {};
  spendRows.filter((s) => !s.campaign).forEach((s) => { general[s.platform] = (general[s.platform] || 0) + s.amount; });

  const totals = {};
  const add = (k, row) => {
    const t = totals[k] || (totals[k] = { platform: k, posts: 0, clicks: 0, checkouts: 0, leads: 0, sales: 0, revenue: 0, spend: 0 });
    t.posts += row.posts == null ? 1 : row.posts;
    ["clicks", "checkouts", "leads", "sales", "revenue", "spend"].forEach((f) => { t[f] += Number(row[f]) || 0; });
  };
  per.forEach((r) => add(r.platform, r));
  Object.entries(general).forEach(([k, v]) => add(k, { posts: 0, spend: v }));
  const list = Object.values(totals);
  const all = { platform: "All", posts: 0, clicks: 0, checkouts: 0, leads: 0, sales: 0, revenue: 0, spend: 0 };
  list.forEach((t) => Object.keys(all).forEach((k) => { if (k !== "platform") all[k] += t[k]; }));
  list.push(all);
  const roi = (r) => { r.roi = r.spend > 0 ? (r.revenue - r.spend) / r.spend : null; return r; };
  return { ok: true, days, posts: per.map(roi), totals: list.map(roi), spend: spendRows };
}
