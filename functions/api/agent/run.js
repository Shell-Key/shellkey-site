// POST /api/agent/run — the daily timer (or the CRM button) starts the marketing agent here.
// Authorization: Bearer <AGENT_KEY> (the timer) or Bearer <CRM_KEY> (you, from the CRM).
// Body (optional): {"force": true} writes another set even if today's already exist,
//                  {"slug": "bid-board"} writes about that product instead of the agent's pick.
import { json, bad, readJson, authed } from "../../_lib.js";
import { writeDailyPosts } from "../../_agent.js";

function agentKeyOk(request, env) {
  const key = env.AGENT_KEY || "";
  const h = request.headers.get("authorization") || "";
  return !!key && h === "Bearer " + key;
}

export async function onRequestPost({ request, env }) {
  if (!authed(request, env) && !agentKeyOk(request, env)) return bad("Unauthorized", 401);
  const b = (await readJson(request)) || {};
  try {
    return json(await writeDailyPosts(env, { force: !!b.force, slug: String(b.slug || "") }));
  } catch (e) {
    return bad(String(e.message || e), 500);
  }
}
