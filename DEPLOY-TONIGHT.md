# Deploy tonight — shellkey.company on Cloudflare Pages with CRM

Total clicking time: about 45 minutes. Steps 1–6 get the site live with the store, working forms, tracking and the CRM. Steps 7–9 are money and polish; do them tonight if you have the energy, tomorrow if not.

What's new in this zip compared to your repo:

| File | What it is |
|---|---|
| `build_store.py` | Four new products in a **Software Subscriptions** section (Bid Board wired to your live PayPal plan; Inspection System, AI Website Studio, Inspector Training with placeholders); privacy + terms pages; footer links; analytics hooks |
| `store.html`, `products/*.html`, `request.html`, `privacy.html`, `terms.html`, `sitemap.xml`, `robots.txt` | Regenerated |
| `index.html` | Contact form is now a real "Request a Demo" form (company, phone, interest); footer links |
| `assets/site.js` | Forms POST to the CRM (mail-app fallback only when the API is down); first-party visitor tracking; checkout-click tracking |
| `assets/store.css` | Styles for the above |
| `assets/img/covers/` | Four new cover images |
| `functions/` | The backend — Cloudflare Pages Functions: `/api/lead`, `/api/track`, `/api/paypal/webhook`, `/api/crm/*` |
| `schema.sql` | The CRM database (4 tables) |
| `crm.html` | Your CRM: pipeline, visitors, sales. Key-protected, not indexed |
| `_headers` | Keeps `crm.html` and `/api/` out of search engines and caches |

---

## 1. Put the new files in the repo (5 min)

Easiest: on GitHub open **Shell-Key/shellkey-site → Add file → Upload files**, drag the *contents* of this zip in (everything, including the `functions` folder), commit message "Cloudflare + CRM + subscriptions". Uploading over existing files replaces them.

Or with git on your PC:

```
git clone https://github.com/Shell-Key/shellkey-site.git
(copy the zip contents over it)
git add -A && git commit -m "Cloudflare + CRM + subscriptions" && git push
```

## 2. Create the Pages project (5 min)

1. dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** → pick **Shell-Key/shellkey-site**.
2. Project name: `shellkey` (the preview URL becomes `shellkey.pages.dev`).
3. Framework preset: **None**. Build command: *leave blank*. Build output directory: `/`
4. **Save and Deploy**. In about a minute you'll have `https://shellkey.pages.dev` — open it and confirm the store and the Software Subscriptions section are there.

## 3. Create the CRM database (5 min)

1. **Storage & Databases → D1 → Create database** → name `shellkey-crm` → Create.
2. Open it → **Console** tab → paste the whole contents of `schema.sql` → **Execute**. You should see the four tables in the Tables tab.
3. Back to **Workers & Pages → shellkey → Settings → Bindings → Add → D1 database**. Variable name: `DB` (capitals, exactly). Database: `shellkey-crm`. Save.

## 4. Set the secrets (5 min)

**Settings → Variables and Secrets → Add** (type *Secret* for each):

| Name | Value |
|---|---|
| `CRM_KEY` | A long password you make up — 20+ characters. This is the CRM login. |
| `WEB3FORMS_KEY` | Go to web3forms.com, enter `support@shellkey.company`, click Create Access Key; it's emailed to you. This is what emails you every lead and sale. |

Then **Deployments → (latest) → ⋯ → Retry deployment** so the bindings and secrets take effect.

**Test now:** open `https://shellkey.pages.dev/request.html`, submit a request with your own email. You should get an email within seconds, and `https://shellkey.pages.dev/crm.html` (enter your CRM_KEY) shows the lead with the pages you visited before submitting.

## 5. Point shellkey.company at it (15 min + DNS wait)

Your DNS is at GoDaddy. Cloudflare needs to manage the domain to serve the root (`shellkey.company` without `www`). That's free and also gives you the analytics and DDoS protection.

1. Cloudflare dashboard → **Add a domain** → `shellkey.company` → Free plan → Continue.
2. Cloudflare scans your GoDaddy records and shows them. **Check that the MX records for your email are listed** (support@shellkey.company must keep working). If you see MX records, good. If not, add them from GoDaddy's DNS page before continuing.
3. Cloudflare shows two nameservers like `ada.ns.cloudflare.com` / `bob.ns.cloudflare.com`.
4. GoDaddy → My Products → shellkey.company → **DNS → Nameservers → Change → Enter my own nameservers** → paste the two → Save. (GoDaddy may ask you to confirm by email.)
5. Wait — usually 15–60 minutes, sometimes a few hours. Cloudflare emails you when the domain is active.
6. Back in **Workers & Pages → shellkey → Custom domains → Set up a custom domain** → `shellkey.company` → Activate. Do the same for `www.shellkey.company`. Cloudflare creates the DNS records itself.
7. In Cloudflare DNS, **delete** the old `A` records pointing at GitHub (185.199.108–111.153) and any `CNAME` to `shell-key.github.io` — otherwise they fight with Pages.

## 6. Turn off the two GitHub Pages sites (2 min)

So nothing old ever shows again:

1. The old root repo (the one serving the old store): **Settings → Pages → Custom domain → Remove**, then set **Source → None**. Or just archive/delete the repo.
2. **Shell-Key/shellkey-site → Settings → Pages → Source → None** (Cloudflare serves it now).

Tracking: **Analytics & Logs → Web Analytics → Add a site** → `shellkey.company` → copy the token → paste into `CF_BEACON_TOKEN` in `build_store.py`, run `python build_store.py`, and paste the same `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" ...>` tag into the `<head>` of `index.html` (the comment shows where). Commit. Your own CRM tracking already works without this; Cloudflare's adds bot-filtered traffic charts.

---

## 7. PayPal: make every button live (15 min)

Bid Board already works — the Subscribe button uses your live plan `P-1MD1072905987273YNKSDYIY`.

The other three show **Order by Request** until you paste links. In PayPal Business:

| Product | Where | Paste into `build_store.py` |
|---|---|---|
| Inspection System $2,000/yr | Pay & Get Paid → Subscriptions → Products & Plans → Create plan "Shell Key Inspection System — Annual", $2,000 / year. Copy the plan ID (`P-…`). | `PAYPAL_INSPECTION = "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-…"` |
| AI Website Studio $50 | Pay & Get Paid → PayPal buttons → Buy Now, $50 "AI Website Studio — start". Copy the link (`https://www.paypal.com/ncp/payment/…`). | `PAYPAL_WEBSITE_START` |
| Training $39 / $99 | Two Buy Now buttons. | `PAYPAL_TRAINING_COURSE`, `PAYPAL_TRAINING_ALL` — and change the training product's `status="soon"` to `"available"` when a course is ready to deliver |

Then `python build_store.py`, commit, push. Cloudflare redeploys automatically.

**Webhook (so sales land in the CRM):** developer.paypal.com → Apps & Credentials → **Live** → your app → Webhooks → Add → URL `https://shellkey.company/api/paypal/webhook`, events: **All events**. Copy the Webhook ID. Optional but recommended, add three more secrets in Cloudflare: `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` (from the same app page), `PAYPAL_WEBHOOK_ID`. With those set, every event is verified with PayPal before it's stored; without them, events are stored as "unverified".

## 8. Use the CRM

`https://shellkey.company/crm.html` — bookmark it on your phone.

- **Pipeline**: every form and every PayPal buyer. Click a row → change status, set expected $, write notes, log calls. The **Email** and **Call** buttons work on the phone. Search box up top, a filter box under every column header, click a header to sort. Export CSV any time.
- **Visitors**: page views and unique visitors per day, top pages, referrers, countries, and a sessions list showing the path each visitor took. Sessions that turned into a lead show the company name — click to open.
- **Sales**: every PayPal event.
- Statuses: new → contacted → demo → quoted → won / lost. Use **stop** for "do not contact."

A lead you export to CSV can go straight into the outreach sheet (the Apps Script kit from the last session) as segment `inbound`.

## 9. Money checklist for the first week

1. Reply to every lead the same business day — the email tells you the lead number; the link opens it in the CRM.
2. When Bid Board or the Inspection System sells, PayPal emails you AND the CRM marks the lead Won. Deliver access within the hour and log it as a note.
3. Watch the **Checkout clicks** tile. Clicks without sales = people hesitating at PayPal; call the ones who left a form.
4. Once the domain is live, submit `https://shellkey.company/sitemap.xml` in Google Search Console and claim the Google Business Profile for Shell Key, Lafayette.

---

## If something's off

| Symptom | Fix |
|---|---|
| Form says "did not go through" | The `DB` binding is missing or the deployment predates it. Settings → Bindings, then Retry deployment. |
| CRM says key refused | `CRM_KEY` secret not set, or set after the last deployment. Retry deployment. |
| No email on new leads | `WEB3FORMS_KEY` missing, or the key's email isn't verified — check the Web3Forms confirmation email. Leads are still in the CRM regardless. |
| `shellkey.company` still shows the old site | Nameserver change not propagated yet (check at whatsmydns.net), or the old GitHub A records are still in Cloudflare DNS (step 5.7). |
| Email stopped working after the DNS move | MX records didn't transfer. Add them in Cloudflare DNS exactly as they were in GoDaddy (grey cloud / DNS only). |
