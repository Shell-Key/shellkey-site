// LinkedIn posting for Kirby's personal profile (the free, self-serve "Share on LinkedIn" product).
//
// LinkedIn gives small apps a sign-in that lasts 60 days and no way to renew it in the
// background. So the CRM has a "Connect LinkedIn" button: Kirby signs in once, the token is
// kept in the settings table, and the Marketing tab warns him when it is close to running out.
//
// Secrets (Cloudflare Pages -> Settings -> Variables and Secrets):
//   LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET   from the LinkedIn developer app's Auth tab
// The app's Authorized redirect URL must be exactly:  https://shellkey.company/api/linkedin/callback
//
// Company Page posting needs LinkedIn's Community Management API, which LinkedIn must approve.

const SCOPES = "openid profile w_member_social";
const OAUTH = (env) => env.LINKEDIN_OAUTH_URL || "https://www.linkedin.com";   // overridable only for local testing
const API = (env) => env.LINKEDIN_API_URL || "https://api.linkedin.com";

export function siteUrl(env) {
  return (env.SITE_URL || "https://shellkey.company").replace(/\/$/, "");
}
export function redirectUri(env) {
  return siteUrl(env) + "/api/linkedin/callback";
}

export async function getSetting(db, k) {
  try {
    const r = await db.prepare("SELECT v FROM settings WHERE k=?").bind(k).first();
    return r ? r.v : null;
  } catch { return null; }   // settings table not created yet
}
export async function setSetting(db, k, v) {
  await db.prepare("INSERT INTO settings (k, v, updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at")
    .bind(k, v).run();
}

// What the CRM shows: is LinkedIn set up, connected, and for how much longer.
export async function linkedinStatus(env) {
  const out = { app: !!(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET), connected: false, days_left: null, name: "" };
  if (!env.DB) return out;
  const raw = await getSetting(env.DB, "linkedin");
  if (!raw) return out;
  try {
    const li = JSON.parse(raw);
    const left = Math.floor((li.expires_at - Date.now()) / 86400000);
    out.connected = !!li.token && li.expires_at > Date.now();
    out.days_left = Math.max(0, left);
    out.name = li.name || "";
  } catch { /* bad row: treat as not connected */ }
  return out;
}

// Step 1: the CRM asks for a sign-in link. A one-time "state" value guards against forged replies.
export async function startUrl(env) {
  if (!env.LINKEDIN_CLIENT_ID) throw new Error("LINKEDIN_CLIENT_ID is not set in Cloudflare yet");
  const state = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await setSetting(env.DB, "linkedin_state", JSON.stringify({ state, at: Date.now() }));
  const q = new URLSearchParams({
    response_type: "code", client_id: env.LINKEDIN_CLIENT_ID, redirect_uri: redirectUri(env), state, scope: SCOPES,
  });
  return OAUTH(env) + "/oauth/v2/authorization?" + q.toString();
}

// Step 2: LinkedIn sends Kirby back here with a code. Trade it for a token and remember it.
export async function finishSignIn(env, code, state) {
  const saved = JSON.parse((await getSetting(env.DB, "linkedin_state")) || "{}");
  if (!saved.state || saved.state !== state || Date.now() - saved.at > 15 * 60000) {
    throw new Error("That sign-in link expired. Go back to the CRM and press Connect LinkedIn again.");
  }
  await setSetting(env.DB, "linkedin_state", "{}");
  const t = await fetch(OAUTH(env) + "/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code, redirect_uri: redirectUri(env),
      client_id: env.LINKEDIN_CLIENT_ID, client_secret: env.LINKEDIN_CLIENT_SECRET,
    }),
  }).then((r) => r.json());
  if (!t.access_token) throw new Error("LinkedIn did not give a token: " + (t.error_description || t.error || "no detail"));
  const me = await fetch(API(env) + "/v2/userinfo", { headers: { authorization: "Bearer " + t.access_token } }).then((r) => r.json());
  if (!me.sub) throw new Error("LinkedIn did not say who signed in. Check the app has 'Sign In with LinkedIn using OpenID Connect'.");
  await setSetting(env.DB, "linkedin", JSON.stringify({
    token: t.access_token, urn: "urn:li:person:" + me.sub, name: me.name || "",
    expires_at: Date.now() + (t.expires_in || 5184000) * 1000,
  }));
  return me.name || "your profile";
}

// Post one approved LinkedIn post as Kirby, with the product link as a preview card.
export async function postToLinkedIn(env, p) {
  const raw = await getSetting(env.DB, "linkedin");
  const li = raw ? JSON.parse(raw) : null;
  if (!li || !li.token || li.expires_at < Date.now()) {
    throw new Error("LinkedIn is not connected, or the 60-day sign-in ran out. Press Connect LinkedIn on the Marketing tab, then try again.");
  }
  const media = p.link ? [{ status: "READY", originalUrl: p.link, title: { text: p.item_label || "Shell Key" } }] : [];
  const r = await fetch(API(env) + "/v2/ugcPosts", {
    method: "POST",
    headers: { authorization: "Bearer " + li.token, "content-type": "application/json", "X-Restli-Protocol-Version": "2.0.0" },
    body: JSON.stringify({
      author: li.urn,
      lifecycleState: "PUBLISHED",
      specificContent: { "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: p.body },
        shareMediaCategory: media.length ? "ARTICLE" : "NONE",
        ...(media.length ? { media } : {}),
      } },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  if (r.status === 401) throw new Error("LinkedIn sign-in is no longer valid. Press Connect LinkedIn on the Marketing tab, then try again.");
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error("LinkedIn said " + r.status + ": " + (d.message || "no detail"));
  }
  return r.headers.get("x-restli-id") || "";
}
