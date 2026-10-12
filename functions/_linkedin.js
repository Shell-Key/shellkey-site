// LinkedIn posting to the Shell Key COMPANY PAGE (never Kirby's personal profile).
//
// Needs LinkedIn's Community Management API, which LinkedIn approves for registered businesses.
// Until it is approved, LinkedIn posts are copied and pasted from the Marketing tab.
//
// Once approved, Kirby (a Page admin) presses "Connect LinkedIn" in the CRM once. The token is kept
// in the settings table. If LinkedIn also hands back a refresh token, the agent renews the sign-in
// by itself; if not, the Marketing tab and the morning email remind Kirby a week before it runs out.
//
// Secrets (Cloudflare Pages -> Settings -> Variables and Secrets):
//   LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET   from the LinkedIn developer app's Auth tab
//   LINKEDIN_ORG_ID                              the Shell Key company page number (from its admin URL)
// Optional: LINKEDIN_SCOPES (default below), LINKEDIN_VERSION (YYYYMM, default below)
// The app's Authorized redirect URL must be exactly:  https://shellkey.company/api/linkedin/callback

const DEFAULT_SCOPES = "w_organization_social";
const DEFAULT_VERSION = "202609";
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

async function tokenRequest(env, params) {
  const t = await fetch(OAUTH(env) + "/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, client_id: env.LINKEDIN_CLIENT_ID, client_secret: env.LINKEDIN_CLIENT_SECRET }),
  }).then((r) => r.json()).catch(() => ({}));
  if (!t.access_token) throw new Error("LinkedIn did not give a token: " + (t.error_description || t.error || "no detail"));
  return t;
}

function saveFromToken(t, old = {}) {
  const now = Date.now();
  return {
    token: t.access_token,
    expires_at: now + (t.expires_in || 5184000) * 1000,
    refresh: t.refresh_token || old.refresh || "",
    refresh_expires_at: t.refresh_token ? now + (t.refresh_token_expires_in || 31536000) * 1000 : (old.refresh_expires_at || 0),
  };
}

async function loadToken(env) {
  const raw = await getSetting(env.DB, "linkedin");
  let li = null;
  try { li = raw ? JSON.parse(raw) : null; } catch { li = null; }
  if (!li || !li.token) return null;
  // Renew quietly when fewer than 7 days are left and LinkedIn gave us a refresh token.
  if (li.expires_at - Date.now() < 7 * 86400000 && li.refresh && li.refresh_expires_at > Date.now()) {
    try {
      li = saveFromToken(await tokenRequest(env, { grant_type: "refresh_token", refresh_token: li.refresh }), li);
      await setSetting(env.DB, "linkedin", JSON.stringify(li));
    } catch { /* keep the old token; the reminder still shows */ }
  }
  return li;
}

// What the CRM shows: is LinkedIn set up, connected, and for how much longer.
export async function linkedinStatus(env) {
  const out = { app: !!(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET && env.LINKEDIN_ORG_ID), connected: false, days_left: null, name: "Shell Key page" };
  if (!env.DB) return out;
  const li = await loadToken(env);
  if (!li) return out;
  const renews = li.refresh && li.refresh_expires_at > Date.now();
  const end = renews ? li.refresh_expires_at : li.expires_at;
  out.connected = li.expires_at > Date.now() && !!env.LINKEDIN_ORG_ID;
  out.days_left = Math.max(0, Math.floor((end - Date.now()) / 86400000));
  return out;
}

// Step 1: the CRM asks for a sign-in link. A one-time "state" value guards against forged replies.
export async function startUrl(env) {
  if (!env.LINKEDIN_CLIENT_ID) throw new Error("LINKEDIN_CLIENT_ID is not set in Cloudflare yet");
  if (!env.LINKEDIN_ORG_ID) throw new Error("LINKEDIN_ORG_ID (the Shell Key company page number) is not set in Cloudflare yet");
  const state = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await setSetting(env.DB, "linkedin_state", JSON.stringify({ state, at: Date.now() }));
  const q = new URLSearchParams({
    response_type: "code", client_id: env.LINKEDIN_CLIENT_ID, redirect_uri: redirectUri(env), state,
    scope: env.LINKEDIN_SCOPES || DEFAULT_SCOPES,
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
  const t = await tokenRequest(env, { grant_type: "authorization_code", code, redirect_uri: redirectUri(env) });
  await setSetting(env.DB, "linkedin", JSON.stringify(saveFromToken(t)));
  return "the Shell Key company page";
}

// Post one approved LinkedIn post as the Shell Key company page, with the product link as a preview card.
export async function postToLinkedIn(env, p) {
  if (!env.LINKEDIN_ORG_ID) throw new Error("LINKEDIN_ORG_ID is not set in Cloudflare yet.");
  const li = await loadToken(env);
  if (!li || li.expires_at < Date.now()) {
    throw new Error("LinkedIn is not connected, or the sign-in ran out. Press Connect LinkedIn on the Marketing tab, then try again.");
  }
  const body = {
    author: "urn:li:organization:" + String(env.LINKEDIN_ORG_ID).replace(/\D/g, ""),
    commentary: p.body,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (p.link) body.content = { article: { source: p.link, title: p.item_label || "Shell Key" } };
  const r = await fetch(API(env) + "/rest/posts", {
    method: "POST",
    headers: {
      authorization: "Bearer " + li.token, "content-type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0", "LinkedIn-Version": env.LINKEDIN_VERSION || DEFAULT_VERSION,
    },
    body: JSON.stringify(body),
  });
  if (r.status === 401) throw new Error("LinkedIn sign-in is no longer valid. Press Connect LinkedIn on the Marketing tab, then try again.");
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error("LinkedIn said " + r.status + ": " + (d.message || "no detail"));
  }
  return r.headers.get("x-restli-id") || r.headers.get("x-linkedin-id") || "";
}
