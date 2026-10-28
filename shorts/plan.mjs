// ==========================================================================
// shorts/plan.mjs: decides whether to post a Short right now, and when
// the best posting times are.
//
//   node shorts/plan.mjs <logDir>
//
// Runs every hour (GitHub job). Three Shorts a day go out, one per slot.
//
// TESTING: until every time slot has MIN_SAMPLES Shorts with 2-day views,
//   each day uses the 3 least-tried slots, so all times get a fair test.
// BEST TIMES: after that, each day uses the 3 slots with the most views
//   per Short 2 days after posting, in order (best first). One day a week
//   the 3rd slot is swapped for the least recently tried one, in case
//   habits change.
//
// It also looks up 2-day views for posted Shorts (needs YT_API_KEY), writes
// a table of results on the run page, and saves everything to log.json on
// the shorts-log branch.
//
// Output for the next steps (GITHUB_OUTPUT): post=true|false, slot, product
// ==========================================================================
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const logDir = process.argv[2] || "shorts-log";
const LOG = join(logDir, "log.json");
const CONFIG = JSON.parse(readFileSync(join(HERE, "products.json"), "utf8"));

// ---------- settings: change here ----------
const SLOTS = [6, 8, 11, 12, 15, 17, 19, 21];   // posting hours to test, Central time (minute :41 not needed; any time in the hour)
const PER_DAY = 3;                              // Shorts per day
const MIN_SAMPLES = 3;                          // Shorts per slot before ranking
const VIEWS_AFTER_HOURS = 48;                   // measure views this long after posting
const TZ = "America/Chicago";

const log = JSON.parse(readFileSync(LOG, "utf8"));
log.posts ||= []; log.days ||= {};
let changed = false;

const out = (k, v) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); console.log(`${k}=${v}`); };
const summary = (s) => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, s + "\n"); };

// Chicago date and hour right now
const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
  .formatToParts(new Date()).map(p => [p.type, p.value]));
const today = `${parts.year}-${parts.month}-${parts.day}`;
const hour = parseInt(parts.hour, 10);
const weekday = parts.weekday;

// ---------- 1. look up 2-day views ----------
async function updateViews() {
  const key = process.env.YT_API_KEY;
  const due = log.posts.filter(p => p.id && p.slot !== "manual" && p.views48 == null &&
    Date.now() - Date.parse(p.postedAt) >= VIEWS_AFTER_HOURS * 3600e3);
  if (!due.length) return;
  if (!key) { console.log(`::warning title=Views not measured::Add the YT_API_KEY secret so the job can find the best posting times (${due.length} Shorts waiting).`); return; }
  for (let i = 0; i < due.length; i += 50) {
    const batch = due.slice(i, i + 50);
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.map(p => p.id).join(",")}&key=${key}`);
    const j = await r.json();
    if (!r.ok) { console.log(`::warning title=Views lookup failed::${r.status} ${JSON.stringify(j).slice(0, 200)}`); return; }
    const views = Object.fromEntries((j.items || []).map(it => [it.id, parseInt(it.statistics?.viewCount || "0", 10)]));
    for (const p of batch) { p.views48 = views[p.id] ?? 0; p.measuredAt = new Date().toISOString(); changed = true; }
  }
}

// ---------- 2. rank the time slots ----------
function slotStats() {
  return SLOTS.map(s => {
    const done = log.posts.filter(p => p.slot === s && p.views48 != null);
    const tried = log.posts.filter(p => p.slot === s);
    return { slot: s, measured: done.length, tried: tried.length,
      avg: done.length ? done.reduce((a, p) => a + p.views48, 0) / done.length : null,
      last: tried.length ? tried[tried.length - 1].postedAt : "" };
  });
}

function chooseToday(stats) {
  const testing = stats.some(s => s.measured < MIN_SAMPLES);
  let pick, mode;
  if (testing) {
    // least-tried first; ties broken by rotating with the date so every slot gets turns
    const day = Math.floor(Date.parse(today) / 86400000);
    pick = [...stats].sort((a, b) => a.tried - b.tried || ((SLOTS.indexOf(a.slot) - day % SLOTS.length + SLOTS.length) % SLOTS.length) - ((SLOTS.indexOf(b.slot) - day % SLOTS.length + SLOTS.length) % SLOTS.length))
      .slice(0, PER_DAY).map(s => s.slot);
    mode = "testing";
  } else {
    const ranked = [...stats].sort((a, b) => b.avg - a.avg);
    pick = ranked.slice(0, PER_DAY).map(s => s.slot);
    mode = "best times";
    if (weekday === "Sun") {   // weekly re-check of a time not in the top 3
      const other = stats.filter(s => !pick.includes(s.slot)).sort((a, b) => a.last.localeCompare(b.last))[0];
      if (other) { pick[PER_DAY - 1] = other.slot; mode = "best times + weekly re-check"; }
    }
  }
  return { slots: pick, mode, ranked: !testing };
}

const fmtHour = h => `${((h + 11) % 12) + 1}${h < 12 ? " AM" : " PM"}`;

await updateViews();
const stats = slotStats();
// Plan the day on its first run; only times that haven't passed yet can be picked
if (!log.days[today]) { log.days[today] = chooseToday(stats.filter(s => s.slot >= hour - 1)); changed = true; }
const plan = log.days[today];

// Post now if this hour (or the hour before, in case GitHub started late) is one of today's slots and it hasn't gone out
const postedToday = log.posts.filter(p => p.date === today).map(p => p.slot);
const slotNow = [hour, hour - 1].find(h => plan.slots.includes(h) && !postedToday.includes(h));
const nextProduct = CONFIG.products[log.posts.length % CONFIG.products.length].slug;

// Results table on the run page
const ranked = [...stats].sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
summary(`### YouTube Shorts posting times (${plan.mode})\n\nToday (${today}): ${plan.slots.map(fmtHour).join(", ")} Central\n`);
summary("| Time (Central) | Shorts posted | Measured at 2 days | Avg views at 2 days |\n|---|---|---|---|");
for (const s of ranked) summary(`| ${fmtHour(s.slot)}${plan.slots.includes(s.slot) ? " ✓ today" : ""} | ${s.tried} | ${s.measured} | ${s.avg == null ? "–" : s.avg.toFixed(1)} |`);

if (changed) writeFileSync(LOG, JSON.stringify(log, null, 1) + "\n");
out("changed", changed);
out("post", slotNow != null);
out("slot", slotNow ?? "");
out("product", nextProduct);
console.log(`Today ${today} (${plan.mode}): ${plan.slots.map(fmtHour).join(", ")}. Now ${fmtHour(hour)}: ${slotNow != null ? `post ${nextProduct}` : "nothing to post"}.`);
