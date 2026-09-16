// CRM API — everything under /api/crm/* requires  Authorization: Bearer <CRM_KEY>
//   GET   /api/crm/stats                 headline numbers
//   GET   /api/crm/leads?status=&q=      list (newest first, max 500)
//   GET   /api/crm/lead/:id              one lead + its visits + activity
//   PATCH /api/crm/lead/:id              {status?, value?, notes?, note?}  (note = append to activity)
//   DELETE /api/crm/lead/:id
//   GET   /api/crm/visits?days=30        page-view summary + recent sessions
//   GET   /api/crm/sales                 PayPal events
//   GET   /api/crm/export.csv            all leads as CSV
import { json, bad, readJson, clean, authed } from "../../_lib.js";

const STATUSES = ["new", "contacted", "demo", "quoted", "won", "lost", "stop"];

export async function onRequest({ request, env, params }) {
  if (!authed(request, env)) return bad("Unauthorized", 401);
  if (!env.DB) return bad("Database not bound", 500);
  const db = env.DB;
  const parts = (params.path || []);
  const url = new URL(request.url);
  const route = parts[0] || "";
  const id = parseInt(parts[1] || "0", 10);

  if (route === "stats" && request.method === "GET") {
    const q = async (sql, ...b) => (await db.prepare(sql).bind(...b).first()) || {};
    const byStatus = (await db.prepare("SELECT status, COUNT(*) n FROM leads GROUP BY status").all()).results;
    return json({
      ok: true,
      leads_total: (await q("SELECT COUNT(*) n FROM leads")).n || 0,
      leads_7d: (await q("SELECT COUNT(*) n FROM leads WHERE created_at >= datetime('now','-7 days')")).n || 0,
      leads_new: (await q("SELECT COUNT(*) n FROM leads WHERE status='new'")).n || 0,
      views_7d: (await q("SELECT COUNT(*) n FROM visits WHERE type='view' AND at >= datetime('now','-7 days')")).n || 0,
      visitors_7d: (await q("SELECT COUNT(DISTINCT sid) n FROM visits WHERE at >= datetime('now','-7 days')")).n || 0,
      checkouts_7d: (await q("SELECT COUNT(*) n FROM visits WHERE type='checkout' AND at >= datetime('now','-7 days')")).n || 0,
      sales_30d: (await q("SELECT COALESCE(SUM(amount),0) s, COUNT(*) n FROM sales WHERE at >= datetime('now','-30 days') AND event_type IN ('PAYMENT.CAPTURE.COMPLETED','PAYMENT.SALE.COMPLETED','BILLING.SUBSCRIPTION.ACTIVATED')")),
      pipeline_value: (await q("SELECT COALESCE(SUM(value),0) v FROM leads WHERE status IN ('contacted','demo','quoted')")).v || 0,
      by_status: byStatus,
    });
  }

  if (route === "leads" && request.method === "GET") {
    const status = clean(url.searchParams.get("status"), 20);
    const qs = clean(url.searchParams.get("q"), 100);
    let sql = "SELECT id, created_at, updated_at, kind, status, priority, name, company, email, phone, city, item, item_label, interest, timeframe, value, page, sid, ip_country, substr(message,1,160) AS snippet FROM leads WHERE 1=1";
    const b = [];
    if (status && STATUSES.includes(status)) { sql += " AND status=?"; b.push(status); }
    if (qs) { sql += " AND (name LIKE ? OR company LIKE ? OR email LIKE ? OR item_label LIKE ? OR message LIKE ?)"; for (let i = 0; i < 5; i++) b.push("%" + qs + "%"); }
    sql += " ORDER BY id DESC LIMIT 500";
    return json({ ok: true, leads: (await db.prepare(sql).bind(...b).all()).results });
  }

  if (route === "lead" && id) {
    if (request.method === "GET") {
      const lead = await db.prepare("SELECT * FROM leads WHERE id=?").bind(id).first();
      if (!lead) return bad("Not found", 404);
      const visits = lead.sid ? (await db.prepare("SELECT at, type, page, item, ref, country, device FROM visits WHERE sid=? ORDER BY at DESC LIMIT 200").bind(lead.sid).all()).results : [];
      const activity = (await db.prepare("SELECT at, kind, body FROM activity WHERE lead_id=? ORDER BY id DESC").bind(id).all()).results;
      const sales = lead.email ? (await db.prepare("SELECT at, event_type, item, amount, currency, subscription_id FROM sales WHERE payer_email=? ORDER BY id DESC").bind(lead.email).all()).results : [];
      return json({ ok: true, lead, visits, activity, sales });
    }
    if (request.method === "PATCH") {
      const b = await readJson(request); if (!b) return bad("Expected JSON");
      const sets = [], vals = [];
      if (b.status !== undefined) { if (!STATUSES.includes(b.status)) return bad("Bad status"); sets.push("status=?"); vals.push(b.status);
        await db.prepare("INSERT INTO activity (lead_id, kind, body) VALUES (?,?,?)").bind(id, "status", "Status → " + b.status).run(); }
      if (b.value !== undefined) { sets.push("value=?"); vals.push(parseFloat(b.value) || 0); }
      if (b.notes !== undefined) { sets.push("notes=?"); vals.push(clean(b.notes, 8000)); }
      if (b.note) await db.prepare("INSERT INTO activity (lead_id, kind, body) VALUES (?,?,?)").bind(id, clean(b.note_kind, 10) || "note", clean(b.note, 4000)).run();
      if (sets.length) { sets.push("updated_at=datetime('now')"); vals.push(id);
        await db.prepare("UPDATE leads SET " + sets.join(", ") + " WHERE id=?").bind(...vals).run(); }
      return json({ ok: true });
    }
    if (request.method === "DELETE") {
      await db.prepare("DELETE FROM activity WHERE lead_id=?").bind(id).run();
      await db.prepare("DELETE FROM leads WHERE id=?").bind(id).run();
      return json({ ok: true });
    }
  }

  if (route === "visits" && request.method === "GET") {
    const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10)));
    const since = "-" + days + " days";
    const pages = (await db.prepare("SELECT page, COUNT(*) views, COUNT(DISTINCT sid) visitors FROM visits WHERE type='view' AND at >= datetime('now',?) GROUP BY page ORDER BY views DESC LIMIT 40").bind(since).all()).results;
    const daily = (await db.prepare("SELECT date(at) d, COUNT(*) views, COUNT(DISTINCT sid) visitors FROM visits WHERE type='view' AND at >= datetime('now',?) GROUP BY d ORDER BY d").bind(since).all()).results;
    const refs = (await db.prepare("SELECT CASE WHEN ref='' THEN '(direct)' ELSE ref END ref, COUNT(*) n FROM visits WHERE type='view' AND at >= datetime('now',?) GROUP BY 1 ORDER BY n DESC LIMIT 20").bind(since).all()).results;
    const countries = (await db.prepare("SELECT country, COUNT(DISTINCT sid) n FROM visits WHERE at >= datetime('now',?) GROUP BY country ORDER BY n DESC LIMIT 15").bind(since).all()).results;
    const sessions = (await db.prepare(
      `SELECT v.sid, MIN(v.at) first_at, MAX(v.at) last_at, COUNT(*) hits, SUM(v.type='checkout') checkouts,
              MAX(v.country) country, MAX(v.device) device, MAX(v.ref) ref,
              (SELECT GROUP_CONCAT(page, ' → ') FROM (SELECT page FROM visits WHERE sid=v.sid ORDER BY at LIMIT 8)) path,
              (SELECT id FROM leads WHERE leads.sid=v.sid ORDER BY id DESC LIMIT 1) lead_id,
              (SELECT COALESCE(company,name,email) FROM leads WHERE leads.sid=v.sid ORDER BY id DESC LIMIT 1) lead_name
       FROM visits v WHERE v.at >= datetime('now',?) GROUP BY v.sid ORDER BY last_at DESC LIMIT 200`).bind(since).all()).results;
    return json({ ok: true, days, pages, daily, refs, countries, sessions });
  }

  if (route === "sales" && request.method === "GET") {
    return json({ ok: true, sales: (await db.prepare("SELECT id, at, event_type, payer_email, payer_name, item, amount, currency, subscription_id, txn_id, status FROM sales ORDER BY id DESC LIMIT 500").all()).results });
  }

  if (route === "export.csv" && request.method === "GET") {
    const rows = (await db.prepare("SELECT id, created_at, status, kind, priority, name, company, email, phone, address, city, zip, item_label, interest, timeframe, value, notes, message FROM leads ORDER BY id DESC").all()).results;
    const esc = (v) => '"' + String(v === null || v === undefined ? "" : v).replace(/"/g, '""') + '"';
    const head = Object.keys(rows[0] || { id: 0 });
    const csv = [head.join(",")].concat(rows.map((r) => head.map((k) => esc(r[k])).join(","))).join("\r\n");
    return new Response(csv, { headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=shellkey-leads.csv" } });
  }

  return bad("Unknown route", 404);
}
