// POST /api/lead — every form on the site lands here.
import { json, bad, readJson, clean, isEmail, geo, notify } from "../_lib.js";

const RATE = new Map(); // per-isolate soft limit: 10 submissions / 10 min / IP

export async function onRequestPost({ request, env }) {
  if (!env.DB) return bad("Database not bound (add D1 binding named DB).", 500);
  const body = await readJson(request);
  if (!body) return bad("Expected JSON.");

  // Honeypot + rate limit
  if (body.website) return json({ ok: true });
  const ip = request.headers.get("cf-connecting-ip") || "?";
  const now = Date.now();
  const hits = (RATE.get(ip) || []).filter((t) => now - t < 600000);
  if (hits.length >= 10) return bad("Too many submissions. Please call us instead.", 429);
  hits.push(now); RATE.set(ip, hits);

  const lead = {
    kind: clean(body.kind, 20) || "contact",
    priority: body.priority ? 1 : 0,
    name: clean(body.name, 120), company: clean(body.company, 160),
    email: clean(body.email, 160).toLowerCase(), phone: clean(body.phone, 40),
    address: clean(body.address, 200), city: clean(body.city, 120), zip: clean(body.zip, 20),
    item: clean(body.item, 80), item_label: clean(body.item_label, 160),
    interest: clean(body.interest, 80), timeframe: clean(body.timeframe, 60),
    message: clean(body.message, 4000), page: clean(body.page, 300), sid: clean(body.sid, 60),
    utm_source: clean(body.utm_source, 80), utm_campaign: clean(body.utm_campaign, 80),
  };
  if (!lead.name && !lead.email && !lead.message) return bad("Nothing to send.");
  if (lead.email && !isEmail(lead.email)) return bad("That email address does not look right.");

  const g = geo(request);
  const r = await env.DB.prepare(
    `INSERT INTO leads (kind, priority, name, company, email, phone, address, city, zip, item, item_label,
       interest, timeframe, message, page, sid, ip_country, user_agent, utm_source, utm_campaign)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(lead.kind, lead.priority, lead.name, lead.company, lead.email, lead.phone, lead.address, lead.city,
    lead.zip, lead.item, lead.item_label, lead.interest, lead.timeframe, lead.message, lead.page, lead.sid,
    g.country, g.ua, lead.utm_source, lead.utm_campaign).run();

  const id = r.meta && r.meta.last_row_id;
  const what = lead.item_label || lead.interest || lead.kind;
  await notify(env, (lead.priority ? "PRIORITY " : "") + "New lead: " + (lead.company || lead.name) + " — " + what, [
    "Lead #" + id + " (" + lead.kind + ")",
    "Name:     " + lead.name, "Company:  " + lead.company, "Email:    " + lead.email, "Phone:    " + lead.phone,
    "Wants:    " + what, "When:     " + lead.timeframe, "Priority: " + (lead.priority ? "YES" : "no"),
    "Address:  " + [lead.address, lead.city, lead.zip].filter(Boolean).join(", "),
    "From:     " + lead.page + "  (" + g.country + ", " + g.device + ")", "",
    lead.message, "",
    "Open the CRM: https://shellkey.company/crm.html#lead=" + id,
  ]);

  return json({ ok: true, id });
}
