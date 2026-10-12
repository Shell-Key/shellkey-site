// GET /api/linkedin/callback — LinkedIn sends Kirby back here after he signs in.
import { finishSignIn, siteUrl } from "../../_linkedin.js";

const page = (title, msg, ok) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07142a;color:#fff;
font:16px/1.5 system-ui,sans-serif;padding:16px}div{max-width:460px;background:#0d2244;border:1px solid rgba(255,255,255,.12);
border-radius:14px;padding:28px;text-align:center}h1{font-size:20px;margin:0 0 8px;color:${ok ? "#7CFF00" : "#ffc857"}}
a{color:#7CFF00}</style></head><body><div><h1>${title}</h1><p>${msg}</p><p><a href="/crm.html#marketing">Back to the Marketing tab</a></p></div>
${ok ? '<script>setTimeout(function(){location.href="/crm.html#marketing"},2500)</script>' : ""}</body></html>`,
  { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (u.searchParams.get("error")) {
    return page("LinkedIn not connected", esc(u.searchParams.get("error_description") || "You cancelled the sign-in."), false);
  }
  try {
    const name = await finishSignIn(env, u.searchParams.get("code") || "", u.searchParams.get("state") || "");
    return page("LinkedIn connected", "Posts will go out on " + esc(name) + ". The Marketing tab shows how long this sign-in lasts and reminds you before it runs out.", true);
  } catch (e) {
    return page("LinkedIn not connected", esc(e.message || e), false);
  }
}
