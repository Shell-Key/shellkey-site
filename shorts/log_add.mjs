// shorts/log_add.mjs: adds the Short that just posted to log.json
//   node shorts/log_add.mjs <outDir> <logDir> <slot|manual>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [outDir = "shorts-out", logDir = "shorts-log", slotArg = "manual"] = process.argv.slice(2);
const postedFile = join(outDir, "posted.json");
if (!existsSync(postedFile)) { console.log("Nothing was posted; log unchanged."); process.exit(0); }

const posted = JSON.parse(readFileSync(postedFile, "utf8"));
const job = JSON.parse(readFileSync(join(outDir, "job.json"), "utf8"));
const LOG = join(logDir, "log.json");
const log = JSON.parse(readFileSync(LOG, "utf8"));
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());   // YYYY-MM-DD

log.posts.push({
  id: posted.id, url: posted.url, slug: job.slug, title: posted.title,
  slot: slotArg === "manual" || slotArg === "" ? "manual" : parseInt(slotArg, 10),
  date: today, postedAt: new Date().toISOString(), privacy: posted.privacy, views48: null,
  videoUrl: process.env.VIDEO_URL || ""   // MP4 for LinkedIn video days
});
writeFileSync(LOG, JSON.stringify(log, null, 1) + "\n");
console.log(`Logged ${job.slug} at slot ${slotArg}.`);
