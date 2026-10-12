# Marketing agent — setup

Every morning the agent picks one Shell Key product, asks Claude to write a Facebook, Instagram and LinkedIn post about it, and puts them in the **Marketing** tab of your CRM (`shellkey.company/crm.html`). You read them, fix anything, and press **Approve & Post**. The **Results** tab shows clicks, leads, sales, money spent and return for every post.

Everything runs on Cloudflare (free plan) and GitHub. The only cost is the Claude API, which is pay as you go.

Do the steps in order. Steps 1 to 3 get you posting today by copy and paste. Step 4 lets the agent post to Facebook and Instagram itself. Step 5 makes it run every morning on its own.

---

## Step 1. Add the marketing tables to your database (2 min)

1. Cloudflare dashboard → **Storage & Databases → D1 → shellkey-crm → Console**.
2. Open `schema.sql` on GitHub, copy everything from the line `-- Marketing agent (added Oct 2026)` down to the end, paste it in the console, press **Execute**.
3. The Tables tab now shows `posts` and `spend` next to your other tables. Nothing in your existing tables changes.

## Step 2. Give the agent a Claude API key (10 min)

1. Go to **console.anthropic.com** and sign in (or create an account).
2. **Billing** → add a payment method and a small amount of credit. Set a **monthly spend limit** so it can never surprise you.
3. **API Keys → Create Key** → name it `shellkey-marketing` → copy the key. You only see it once.
4. Cloudflare → **Workers & Pages → shellkey-site → Settings → Variables and Secrets → Add**. Type: **Secret**. Name: `ANTHROPIC_API_KEY`. Value: paste the key. Save.
5. **Deployments** → latest → **⋯ → Retry deployment** so the site picks up the key.

Never paste the key into a chat, an email or a file in GitHub.

## Step 3. Write your first posts (1 min)

1. Open `shellkey.company/crm.html` → **Marketing** tab.
2. The green chips at the top show what is connected. Marketing tables and Claude writer should be green now.
3. Press **Write today's posts**. In about 30 seconds three posts appear.
4. For each one: read it, fix it in the box, press **Copy**, paste it on that site (use the **Image** button to save the picture), then press **Mark as posted**. Marking it posted is what lets the Results tab track it.

## Step 4. Let the agent post to Facebook and Instagram itself (30–45 min, once)

You need a Facebook **Page** for Shell Key, not a personal profile. Software is not allowed to post on personal profiles. If you don't have a Page yet: facebook.com/pages/create → name it Shell Key → category Software company.

For Instagram, the account must be a **professional** account (Business or Creator) and linked to that Page. In the Instagram app: Settings → Account type and tools → Switch to professional account. Then in the Page's settings → Linked accounts → Instagram → Connect.

### 4a. Make a developer app

1. Go to **developers.facebook.com** and log in with your normal Facebook login. The first time it asks you to register as a developer: accept, verify by phone or email.
2. **My Apps → Create App**. Name: `Shell Key Marketing`. Contact email: yours.
3. When it asks what the app is for, pick the option about **managing your Page** (the wording changes now and then; look for Pages or "Manage everything on your Page"). Add Instagram when it offers it.
4. You can leave the app in **Development** mode. As the app's admin, you can post to your own Page without Meta reviewing the app.

### 4b. Get the Page id and a token that doesn't expire

1. Open **developers.facebook.com/tools/explorer** (Graph API Explorer).
2. Top right: pick your app **Shell Key Marketing**. Under **Permissions** add:
   `pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish, business_management`
3. Press **Generate Access Token** and approve the pop-up. Choose your Shell Key Page and Instagram account when asked.
4. Click the little **ⓘ** next to the token → **Open in Access Token Tool** → **Extend Access Token** at the bottom → copy the long token it shows.
5. Back in the Explorer, paste that long token in the token box, type `me/accounts` in the request box, press **Submit**.
6. Find your Shell Key Page in the result. Copy its `id` (that's your **Page id**) and its `access_token` (that's your **Page token**; this one does not expire).
7. For Instagram, put the Page token in the box, type `YOUR_PAGE_ID?fields=instagram_business_account` and Submit. Copy the `id` inside `instagram_business_account`.

### 4c. Put them in Cloudflare

Workers & Pages → shellkey-site → Settings → Variables and Secrets → add each as a **Secret**:

| Name | Value |
|---|---|
| `FB_PAGE_ID` | Page id from 4b step 6 |
| `FB_PAGE_TOKEN` | Page token from 4b step 6 |
| `IG_USER_ID` | Instagram id from 4b step 7 |

Retry deployment. In the CRM, the Facebook and Instagram chips turn green and **Approve & Post** sends the post for you.

If you ever change your Facebook password or remove the app, the token stops working. Posting will show the error on the card; repeat 4b and paste the new token.

## Step 5. Run it every morning on its own (5 min)

1. Make up a long password (20+ characters). Add it on **shellkey-site** as a Secret named `AGENT_KEY`. Retry deployment.
2. **Workers & Pages → Create → Worker** → name it `shellkey-marketing-timer` → Deploy.
3. **Edit code** → delete the sample, paste the whole of `workers/marketing-timer/worker.js` → **Deploy**.
4. The timer worker → **Settings → Variables and Secrets** → add Secret `AGENT_KEY` with the same password.
5. **Settings → Trigger Events → Add → Cron Triggers** → `0 12 * * *` → Add. That is 7 AM Lafayette in summer, 6 AM in winter.

Now the posts are waiting for you each morning, and you get an email when they're ready (through the same email notice the site already uses for new leads).

## Step 6. LinkedIn automatic posting (20 min once, then a sign-in every 60 days)

LinkedIn lets small apps post on **your personal profile** for free. Posting on the **Shell Key company page** needs LinkedIn's Community Management API, which LinkedIn must approve; until then, company page posts are copy and paste. Personal posts usually reach more people anyway.

**6a. Add the settings table** (D1 → shellkey-crm → Console → paste → Execute):

```sql
CREATE TABLE IF NOT EXISTS settings (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**6b. Make the LinkedIn app**

1. Go to **linkedin.com/developers/apps** → **Create app**.
2. App name `Shell Key Marketing`. LinkedIn Page: pick your **Shell Key** company page. Upload the Shell Key logo. Tick the agreement → **Create app**.
3. **Settings** tab → next to the company page, **Verify** → open the link it gives you and approve it (you are the page admin).
4. **Products** tab → **Request access** on **Share on LinkedIn** and on **Sign In with LinkedIn using OpenID Connect**. Both are normally granted right away.
5. **Auth** tab → **Authorized redirect URLs for your app** → add exactly `https://shellkey.company/api/linkedin/callback` → Update.
6. On the same Auth tab, copy the **Client ID** and the **Primary Client Secret**.

**6c. Put them in Cloudflare** (shellkey-site → Settings → Variables and Secrets → Add, type Secret): `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`. Retry deployment.

**6d. Connect.** CRM → Marketing → **Connect LinkedIn** → sign in → **Allow**. You land back on the Marketing tab and the LinkedIn chip turns green with the days left. LinkedIn makes you do this again every 60 days; the button turns green and the morning email reminds you a week ahead.

## Later: skip the approval step

Once you trust the posts, add a variable `AUTO_POST` = `yes` on shellkey-site and retry deployment. Every connected platform then posts the moment the agent writes it.

## Changing what the agent says

Edit `functions/_brand.js` on GitHub. It holds the voice rules, audiences, which products to push (`focus`), which to never post (`never`), and what never to say. Commit, and the next set of posts follows the new rules.

When you add or change products: run `python build_store.py` and `python make_social_images.py`, then commit. The agent reads the same product list as the store.

## How results are counted

- Every post link carries a tag (`utm_campaign=p12`). A visitor belongs to the first tagged link they ever arrived on.
- **Leads** are form fills from those visitors.
- **Sales** are PayPal payments whose email matches one of those leads. Someone who pays without ever filling a form can't be matched to a post; they still show on the Sales tab.
- **Return** = (revenue − money spent) ÷ money spent. Add boost money on the Results tab, either against one post or as general spend for a platform.
