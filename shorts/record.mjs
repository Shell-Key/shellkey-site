// ==========================================================================
// shorts/record.mjs — records one portal demo for a YouTube Short
//
//   node shorts/record.mjs [slug] [outDir]
//
// 1. Picks the product (the slug you give, or the next one in line by date).
// 2. Makes the voice for each scene with Cloudflare Workers AI (Deepgram Aura,
//    a natural woman's voice). Needs CF_ACCOUNT_ID and CF_AI_TOKEN; without
//    them the video is made with captions only.
// 3. Opens the free demo, clicks through the screens, and records it. Each
//    scene stays on screen as long as its voice line takes.
// 4. Writes outDir/job.json for shorts/compose.py.
//
// Kirby's rule: every video is 10 to 30 seconds. Scenes are dropped from
// the end until it fits.
// ==========================================================================
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CONFIG = JSON.parse(readFileSync(join(HERE, "products.json"), "utf8"));
const MAX_SECONDS = 30, MIN_SECONDS = 10, END_CARD = 3.5, MIN_SCENE = 3.0;
const END_LINE = "Try the free demo at shellkey dot company.";

const slugArg = process.argv[2] && process.argv[2] !== "auto" ? process.argv[2] : "";
const outDir = process.argv[3] || join(ROOT, "shorts-out");
mkdirSync(outDir, { recursive: true });

// ---------- which product today: rotate through the list by date ----------
function pickProduct() {
  if (slugArg) {
    const p = CONFIG.products.find(x => x.slug === slugArg);
    if (!p) throw new Error(`No product "${slugArg}" in shorts/products.json`);
    return p;
  }
  const day = Math.floor(Date.now() / 86400000);
  return CONFIG.products[day % CONFIG.products.length];
}

// ---------- voice: Cloudflare Workers AI, Deepgram Aura ----------
const FAKE = !!process.env.SHORTS_FAKE_VOICE;   // testing only: a tone the length of the line
const voiceOn = FAKE || !!(process.env.CF_ACCOUNT_ID && process.env.CF_AI_TOKEN);
async function speak(text, file) {
  if (FAKE) {
    const len = (text.split(/\s+/).length * 0.36).toFixed(2);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", `sine=frequency=330:duration=${len}`, "-ac", "1", file]);
    return seconds(file);
  }
  const voice = process.env.SHORTS_VOICE || CONFIG.voice || "asteria";
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/deepgram/aura-1`;
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CF_AI_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ text, speaker: voice, encoding: "mp3" })
  });
  const type = res.headers.get("content-type") || "";
  if (!res.ok || type.includes("json")) {
    const body = await res.text();
    throw new Error(`Cloudflare voice failed (${res.status}): ${body.slice(0, 300)}`);
  }
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return seconds(file);
}
function seconds(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim();
  const s = parseFloat(out);
  if (!(s > 0)) throw new Error(`Couldn't read the length of ${file}`);
  return s;
}

// ---------- a tiny web server for the repo, so demos load like the live site ----------
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2" };
function serve() {
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = join(ROOT, p);
    if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" });
    res.end(readFileSync(f));
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r(server)));
}

async function main() {
  const product = pickProduct();
  console.log(`Product: ${product.title} (${product.slug})`);

  // Voice first, so each scene can stay up exactly as long as its line
  let scenes = [];
  for (const [i, s] of product.scenes.entries()) {
    let audio = null, talk = 0;
    if (voiceOn) { audio = join(outDir, `say${i}.mp3`); talk = await speak(s.say, audio); }
    const dur = Math.max(MIN_SCENE, talk + 0.6) + (s.hold || 0);
    scenes.push({ ...s, audio, dur });
  }
  let endAudio = null, endDur = END_CARD;
  if (voiceOn) { endAudio = join(outDir, "say_end.mp3"); endDur = Math.max(END_CARD, (await speak(END_LINE, endAudio)) + 0.6); }

  // 10–30 seconds: drop scenes from the end until it fits, stretch the end card if too short
  const total = () => scenes.reduce((a, s) => a + s.dur, 0) + endDur;
  while (total() > MAX_SECONDS && scenes.length > 2) scenes.pop();
  if (total() > MAX_SECONDS) throw new Error(`Even 2 scenes run ${total().toFixed(1)}s. Shorten the voice lines for ${product.slug}.`);
  if (total() < MIN_SECONDS) endDur += MIN_SECONDS - total();
  console.log(`Video length: ${total().toFixed(1)}s, ${scenes.length} scenes, voice ${voiceOn ? "on" : "off (captions only)"}`);

  // Record
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const rawDir = join(outDir, "raw");
  const t0 = Date.now();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } } });
  const page = await ctx.newPage();
  page.on("dialog", d => d.dismiss().catch(() => {}));
  await page.addInitScript(() => {   // a visible cursor so viewers can follow the clicks
    addEventListener("DOMContentLoaded", () => {
      const c = document.createElement("div");
      c.style.cssText = "position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgba(124,255,0,.55);border:2px solid #fff;box-shadow:0 0 0 4px rgba(124,255,0,.25);pointer-events:none;left:-50px;top:-50px;transform:translate(-50%,-50%);transition:transform .08s";
      document.body.appendChild(c);
      addEventListener("mousemove", e => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; });
      addEventListener("mousedown", () => { c.style.transform = "translate(-50%,-50%) scale(.7)"; });
      addEventListener("mouseup", () => { c.style.transform = "translate(-50%,-50%)"; });
    });
  });
  await page.goto(`${base}/demos/${product.slug}.html`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  await page.mouse.move(640, 360);

  // Find a visible button/link/tab by its words (exact match first, then "contains")
  async function findByText(text) {
    return page.evaluate((want) => {
      const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
      const w = norm(want);
      const els = [...document.querySelectorAll("button, a, [role=tab], [role=button], nav li, [data-view], [data-tab], [data-page]")]
        .filter(e => { const r = e.getBoundingClientRect(); return e.offsetParent && r.width > 0 && r.height > 0 && r.top >= 0 && r.top < innerHeight; });
      const strip = s => norm(s).replace(/^[^a-z0-9]+/, "").replace(/\d+$/, "").trim();
      const hit = els.find(e => strip(e.textContent) === w) || els.find(e => norm(e.textContent).includes(w));
      if (!hit) return null;
      const r = hit.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, text);
  }
  async function clickText(text, required) {
    const at = await findByText(text);
    if (!at) { if (required) console.log(`  (couldn't find "${text}" on screen; staying put)`); return false; }
    await page.mouse.move(at.x, at.y, { steps: 18 });
    await page.waitForTimeout(150);
    await page.mouse.click(at.x, at.y);
    return true;
  }

  // Get past welcome / "who is using this" screens: fill any empty required choice, then click through
  for (const s of product.start || []) {
    await page.evaluate(() => {
      document.querySelectorAll("select").forEach(sel => {
        if (sel.offsetParent && !sel.value) {
          const opt = [...sel.options].find(o => o.value); if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event("change", { bubbles: true })); }
        }
      });
    });
    if (await clickText(s, false)) await page.waitForTimeout(1500);
  }

  const marks = [];
  for (const s of scenes) {
    marks.push((Date.now() - t0) / 1000);
    const sceneStart = Date.now();
    if (s.click) await clickText(s.click, true);
    else await page.mouse.move(720, 380, { steps: 18 });
    const left = s.dur * 1000 - (Date.now() - sceneStart);
    if (left > 0) await page.waitForTimeout(left);
  }
  const end = (Date.now() - t0) / 1000;
  await ctx.close(); await browser.close(); server.close();

  const raw = join(rawDir, readdirSync(rawDir).find(f => f.endsWith(".webm")));
  const job = {
    slug: product.slug, title: product.title, tagline: product.tagline, hashtags: product.hashtags || "",
    url: `shellkey.company/products/${product.slug}`,
    raw, start: marks[0], end, voice: voiceOn,
    scenes: scenes.map((s, i) => ({ caption: s.caption, say: s.say, audio: s.audio, t: marks[i] - marks[0], until: (marks[i + 1] ?? end) - marks[0] })),
    endCard: { audio: endAudio, dur: endDur }
  };
  writeFileSync(join(outDir, "job.json"), JSON.stringify(job, null, 1));
  console.log(`Recorded ${(end - marks[0]).toFixed(1)}s of demo -> ${join(outDir, "job.json")}`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
