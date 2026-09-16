// POST /api/paypal/webhook — PayPal sends every payment / subscription event here.
// Set the webhook URL in PayPal Developer -> Apps -> your app -> Webhooks:
//   https://shellkey.company/api/paypal/webhook   (All events)
// Optional but recommended: set PAYPAL_CLIENT_ID, PAYPAL_SECRET and PAYPAL_WEBHOOK_ID
// as environment variables and every event is verified with PayPal before it is stored.
import { json, bad, notify } from "../../_lib.js";

async function verify(request, rawBody, env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET || !env.PAYPAL_WEBHOOK_ID) return "unverified";
  const base = env.PAYPAL_ENV === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  const tok = await fetch(base + "/v1/oauth2/token", {
    method: "POST",
    headers: { authorization: "Basic " + btoa(env.PAYPAL_CLIENT_ID + ":" + env.PAYPAL_SECRET),
               "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  }).then((r) => r.json());
  const h = (n) => request.headers.get(n) || "";
  const v = await fetch(base + "/v1/notifications/verify-webhook-signature", {
    method: "POST",
    headers: { authorization: "Bearer " + tok.access_token, "content-type": "application/json" },
    body: JSON.stringify({
      auth_algo: h("paypal-auth-algo"), cert_url: h("paypal-cert-url"),
      transmission_id: h("paypal-transmission-id"), transmission_sig: h("paypal-transmission-sig"),
      transmission_time: h("paypal-transmission-time"), webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: JSON.parse(rawBody),
    }),
  }).then((r) => r.json());
  return v.verification_status === "SUCCESS" ? "verified" : "FAILED";
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return bad("no db", 500);
  const raw = await request.text();
  let ev; try { ev = JSON.parse(raw); } catch { return bad("bad json"); }

  const status = await verify(request, raw, env);
  if (status === "FAILED") return bad("signature failed", 400);

  const res = ev.resource || {};
  const payer = res.payer || res.subscriber || {};
  const email = (payer.email_address || (res.payer && res.payer.email_address) || "").toLowerCase();
  const name = payer.name ? [payer.name.given_name, payer.name.surname].filter(Boolean).join(" ") : "";
  const amt = res.amount || (res.billing_info && res.billing_info.last_payment && res.billing_info.last_payment.amount) || {};
  const item = res.plan_id || (res.purchase_units && res.purchase_units[0] && res.purchase_units[0].description) || res.custom_id || "";
  const type = ev.event_type || "";
  const subId = res.billing_agreement_id || (type.startsWith("BILLING.SUBSCRIPTION") ? res.id : "");
  const txnId = type.startsWith("PAYMENT") ? res.id : "";

  await env.DB.prepare(
    `INSERT OR IGNORE INTO sales (source, event_type, event_id, payer_email, payer_name, item, amount, currency,
       subscription_id, txn_id, status, raw) VALUES ('paypal',?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(ev.event_type || "", ev.id || "", email, name, item, parseFloat(amt.value || amt.total || 0) || 0,
    amt.currency_code || amt.currency || "USD", subId, txnId, status + ":" + (res.status || ""), raw.slice(0, 20000)).run();

  // Money events become a lead too, so the buyer shows up in the pipeline as "won".
  const money = /^(PAYMENT\.CAPTURE\.COMPLETED|PAYMENT\.SALE\.COMPLETED|CHECKOUT\.ORDER\.APPROVED|BILLING\.SUBSCRIPTION\.ACTIVATED)$/.test(ev.event_type || "");
  if (money && email) {
    const existing = await env.DB.prepare("SELECT id FROM leads WHERE email = ? ORDER BY id DESC LIMIT 1").bind(email).first();
    if (existing) {
      await env.DB.prepare("UPDATE leads SET status='won', updated_at=datetime('now') WHERE id=?").bind(existing.id).run();
      await env.DB.prepare("INSERT INTO activity (lead_id, kind, body) VALUES (?,?,?)")
        .bind(existing.id, "status", "PayPal " + ev.event_type + " " + (amt.value || "") + " " + (amt.currency_code || "")).run();
    } else {
      await env.DB.prepare("INSERT INTO leads (kind, status, name, email, item_label, message) VALUES ('paypal','won',?,?,?,?)")
        .bind(name, email, item, "PayPal " + ev.event_type).run();
    }
    await notify(env, "SALE: " + (amt.value || "?") + " " + (amt.currency_code || "") + " — " + (name || email), [
      "Event:  " + ev.event_type, "Payer:  " + name + " <" + email + ">", "Item:   " + item,
      "Amount: " + (amt.value || "") + " " + (amt.currency_code || ""), "Verify: " + status,
      "Now go deliver it. CRM: https://shellkey.company/crm.html",
    ]);
  }
  if (/BILLING\.SUBSCRIPTION\.(CANCELLED|SUSPENDED|EXPIRED)/.test(ev.event_type || "")) {
    await notify(env, "Subscription " + ev.event_type.split(".").pop().toLowerCase() + ": " + email, ["Subscription " + res.id, "Plan " + res.plan_id]);
  }
  return json({ ok: true });
}
