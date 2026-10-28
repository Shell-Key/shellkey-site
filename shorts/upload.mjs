// ==========================================================================
// shorts/upload.mjs: uploads the finished Short to the Shell Key YouTube channel
//
//   node shorts/upload.mjs <outDir>
//
// Needs three GitHub secrets (see shorts/README.md):
//   YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN
// Without them it stops politely: the video is still saved by the GitHub job
// so Kirby can download it and upload it by hand.
// ==========================================================================
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] || "shorts-out";
const meta = JSON.parse(readFileSync(join(outDir, "youtube.json"), "utf8"));
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const PRIVACY = process.env.YT_PRIVACY || "public";   // "public", "unlisted" or "private"

if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
  console.log("YouTube isn't connected yet (YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN).");
  console.log("The video is saved with this run: Actions > this run > Artifacts > short.");
  process.exit(0);
}

async function main() {
  // 1. Fresh sign-in from the saved refresh token
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" })
  });
  const t = await tok.json();
  if (!tok.ok) throw new Error(`Google sign-in failed (${tok.status}): ${t.error_description || t.error}. Make a new refresh token (shorts/README.md).`);

  // 2. Start a resumable upload with the title and description
  const size = statSync(meta.video).size;
  const start = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      authorization: `Bearer ${t.access_token}`, "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": "video/mp4", "x-upload-content-length": String(size)
    },
    body: JSON.stringify({
      snippet: { title: meta.title, description: meta.description, tags: meta.tags, categoryId: "28" },   // 28 = Science & Technology
      status: { privacyStatus: PRIVACY, selfDeclaredMadeForKids: false }
    })
  });
  if (!start.ok) throw new Error(`YouTube upload start failed (${start.status}): ${(await start.text()).slice(0, 400)}`);
  const where = start.headers.get("location");

  // 3. Send the video
  const put = await fetch(where, { method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(size) }, body: readFileSync(meta.video) });
  const v = await put.json().catch(() => ({}));
  if (!put.ok) throw new Error(`YouTube upload failed (${put.status}): ${JSON.stringify(v).slice(0, 400)}`);
  const url = `https://youtube.com/shorts/${v.id}`;
  writeFileSync(join(outDir, "posted.json"), JSON.stringify({ id: v.id, url, title: meta.title, privacy: PRIVACY }, null, 1));
  console.log(`Posted to YouTube (${PRIVACY}): ${url}`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
