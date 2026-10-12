// Shell Key marketing timer — a tiny Cloudflare Worker that wakes the agent every morning.
// It does nothing else. All the work happens on the website at /api/agent/run.
//
// Setup (Cloudflare dashboard, about 5 minutes — full steps in MARKETING-SETUP.md):
//   1. Workers & Pages -> Create -> Worker -> name it shellkey-marketing-timer -> Deploy
//   2. Edit code -> paste this whole file over the sample -> Deploy
//   3. Settings -> Variables and Secrets -> add Secret AGENT_KEY (same value as on the website)
//   4. Settings -> Trigger Events -> Add -> Cron Triggers -> 0 12 * * *
//      (12:00 UTC = 7:00 AM Lafayette in summer, 6:00 AM in winter)

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(run(env));
  },
  // Opening the worker's own address shows whether it is set up. It never starts the agent.
  async fetch(request, env) {
    return new Response(env.AGENT_KEY ? "Shell Key marketing timer is set up." : "AGENT_KEY secret is missing.",
      { headers: { "content-type": "text/plain" } });
  },
};

async function run(env) {
  const site = env.SITE || "https://shellkey.company";
  const r = await fetch(site + "/api/agent/run", {
    method: "POST",
    headers: { authorization: "Bearer " + env.AGENT_KEY, "content-type": "application/json" },
    body: "{}",
  });
  console.log("agent run:", r.status, await r.text());
}
