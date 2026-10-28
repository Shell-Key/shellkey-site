# Daily YouTube Shorts

GitHub posts **3 YouTube Shorts a day** (10 to 30 seconds each), made from the free portal demos, and learns the best times to post.

**Best times:** it first tests 8 times of day (6, 8, 11 AM, 12, 3, 5, 7, 9 PM Central), 3 per day, until each time has 3 Shorts with 2-day view counts. Then it posts at the 3 times with the most views per Short, best first, and re-checks one other time every Sunday. Open any run under Actions to see the table of times and views. The log lives on the `shorts-log` branch. Settings are at the top of `shorts/plan.mjs`. Each Short has:

- the demo screens being clicked,
- a caption and a natural woman's voice for each screen (Cloudflare Workers AI, Deepgram Aura),
- a "Try the free demo" end card,
- a description with the demo link (tracked as `utm_source=youtube`).

It only uses GitHub, Cloudflare and YouTube.

## Files

| File | What it does |
|---|---|
| `shorts/products.json` | The portals, in posting order. For each screen: what to click, the caption, and what the voice says. |
| `shorts/record.mjs` | Makes the voice, opens the demo, clicks through it, and records it. Keeps every video between 10 and 30 seconds. |
| `shorts/compose.py` | Builds the upright 1080x1920 video with the logo, captions, voice and end card. |
| `shorts/upload.mjs` | Posts the video to YouTube. |
| `shorts/plan.mjs` | Every hour: decides whether this hour is a posting time, measures 2-day views, ranks the times. |
| `shorts/log_add.mjs` | Adds each posted Short to the log. |
| `.github/workflows/daily-youtube-short.yml` | Runs every hour at :41 and posts when the plan says so. |

## One-time setup: five secrets in GitHub

Add each one in GitHub under **shellkey-site > Settings > Secrets and variables > Actions > New repository secret**.

### The voice (Cloudflare)

1. **CF_ACCOUNT_ID**: in the Cloudflare dashboard, open **Account home**. Click the three dots next to your account name and choose **Copy account ID**.
2. **CF_AI_TOKEN**: in the Cloudflare dashboard, open **My Profile > API Tokens > Create Token**. Pick the **Workers AI** template, then click **Continue to summary** and **Create Token**. Copy the token.

### YouTube (Google)

1. Go to **console.cloud.google.com**, signed in as the Google account that owns the Shell Key channel. Create a new project named `Shell Key Shorts`.
2. Open **APIs & Services > Library**, search **YouTube Data API v3**, and click **Enable**.
3. Open **Google Auth Platform**. This was called the OAuth consent screen.
   - Choose **External**, name the app `Shell Key Shorts`, and use your shellkey.company email.
   - Under **Audience**, click **Publish app**. If you skip this, the YouTube sign-in stops working after 7 days.
4. Open **Clients > Create client**. Choose **Web application**. Under **Authorized redirect URIs**, add `https://developers.google.com/oauthplayground`, then click **Create**.
   - **YT_CLIENT_ID** = the Client ID.
   - **YT_CLIENT_SECRET** = the Client secret.
5. Go to **developers.google.com/oauthplayground**.
   1. Click the gear icon at the top right. Tick **Use your own OAuth credentials**, then paste the Client ID and secret.
   2. In the box on the left, type `https://www.googleapis.com/auth/youtube.upload` and click **Authorize APIs**.
   3. Sign in and pick the **Shell Key** channel.
   4. Google says the app isn't verified. Click **Advanced**, then **Go to Shell Key Shorts**, then **Continue**.
   5. Click **Exchange authorization code for tokens**.
   - **YT_REFRESH_TOKEN** = the Refresh token.

### Views (for finding the best times)

- **YT_API_KEY**: in Google Cloud (project Shell Key Shorts) open **APIs & Services > Credentials > Create credentials > API key**. Restrict it to **YouTube Data API v3**. Without it the Shorts still post, but every time gets tested evenly and nothing is ranked.

## Try it

Go to GitHub **Actions > Daily YouTube Short > Run workflow**. Set privacy to `unlisted` for a first test, then click **Run workflow**. After about 3 minutes:

- the run log shows the YouTube link,
- the video is also under the run's **Artifacts**.

Each part works without the others:

- Without the Cloudflare secrets, the video has captions only, no voice.
- Without the YouTube secrets, the video is made and saved under Artifacts, but not posted.

## Changing things

- **Different words or screens:** edit `shorts/products.json`. Keep voice lines to about 8 words. Any scenes that push a video past 30 seconds are dropped from the end.
- **Add a portal:** add an entry with the demo's slug (the file name in `demos/`).
- **Different voice:** set `"voice"` in `products.json`. Women's voices: `asteria`, `luna`, `athena`, `hera`, `stella`.
- **Different time:** change the `cron` line in the workflow file. It uses UTC time.

## Test on a computer without the voice service

```
SHORTS_FAKE_VOICE=1 node shorts/record.mjs family-finance shorts-out
python3 shorts/compose.py shorts-out
```
