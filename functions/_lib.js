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

// Email notification through Web3Forms (free). Silent no-op when no key is set.
export async function notify(env, subject, lines) {
  if (!env.WEB3FORMS_KEY) return;
  try {
    await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        access_key: env.WEB3FORMS_KEY,
        subject,
        from_name: "shellkey.company",
        message: lines.join("\n"),
      }),
    });
  } catch { /* never fail the request over a notification */ }
}
