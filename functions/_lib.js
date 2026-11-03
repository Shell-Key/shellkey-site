// Shared helpers for Shell Key Pages Functions.

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

export const bad = (msg, status = 400) => json({ ok: false, error: msg }, status);

export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

export const clean = (v, max = 2000) =>
  (v === undefined || v === null) ? "" : String(v).trim().slice(0, max);

export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export function geo(request) {
  const cf = request.cf || {};
  const ua = request.headers.get("user-agent") || "";
  const device = /Mobi|Android|iPhone/i.test(ua) ? "mobile" : /iPad|Tablet/i.test(ua) ? "tablet" : "desktop";
  return { country: cf.country || "", city: cf.city || "", device, ua: ua.slice(0, 300) };
}

// CRM auth: Authorization: Bearer <CRM_KEY>. Constant-time-ish compare.
export function authed(request, env) {
  const key = env.CRM_KEY || "";
  if (!key) return false;
  const h = request.headers.get("authorization") || "";
  const given = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (given.length !== key.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------- system log
// A small table that records each morning run and each email, so the CRM can show
// "last morning run" and "last email" instead of failing silently.
export async function logEvent(env, kind, ok, detail) {
  try {
    if (!env.DB) return;
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS system_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT (datetime('now')),
      kind TEXT NOT NULL, ok INTEGER NOT NULL, detail TEXT)`).run();
    await env.DB.prepare("INSERT INTO system_log (kind, ok, detail) VALUES (?,?,?)").bind(kind, ok ? 1 : 0, String(detail || "").slice(0, 500)).run();
  } catch { /* logging never breaks anything */ }
}

export async function lastEvents(env) {
  const out = {};
  try {
    for (const kind of ["morning_run", "email"]) {
      out[kind] = await env.DB.prepare("SELECT at, ok, detail FROM system_log WHERE kind=? ORDER BY id DESC LIMIT 1").bind(kind).first();
    }
  } catch { /* table not made yet */ }
  return out;
}

// ---------------------------------------------------------------- email alerts
// Sends Kirby an email (posts ready, new lead, sale, new article).
//   RESEND_API_KEY  (resend.com, free 3,000/month) works from the server. Preferred.
//   WEB3FORMS_KEY   old way. Web3Forms' free plan refuses emails sent from a server,
//                   which is why the morning emails stopped arriving.
//   NOTIFY_TO       where alerts go (default below), NOTIFY_FROM the sender.
const NOTIFY_TO = "Kirby.Billiot@shellkey.company";
export async function notify(env, subject, lines) {
  const message = lines.join("\n");
  let ok = false, detail = "";
  try {
    if (env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          from: env.NOTIFY_FROM || "Shell Key <alerts@shellkey.company>",
          to: String(env.NOTIFY_TO || NOTIFY_TO).split(",").map((x) => x.trim()).filter(Boolean),
          subject, text: message,
        }),
      });
      const d = await r.json().catch(() => ({}));
      ok = r.ok; detail = ok ? "Sent: " + subject : "Resend refused it: " + (d.message || r.status);
    } else if (env.WEB3FORMS_KEY) {
      const r = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ access_key: env.WEB3FORMS_KEY, subject, from_name: "shellkey.company", message }),
      });
      const d = await r.json().catch(() => ({}));
      ok = r.ok && d.success !== false;
      detail = ok ? "Sent: " + subject : "Web3Forms refused it (" + r.status + "): " + (d.message || "free plan does not allow server emails");
    } else {
      detail = "No email service set up (add RESEND_API_KEY in Cloudflare)";
    }
  } catch (e) { detail = "Email error: " + (e.message || e); }   // never fail the request over a notification
  await logEvent(env, "email", ok, detail);
  return { ok, detail };
}
