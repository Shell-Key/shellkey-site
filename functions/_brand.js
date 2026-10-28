// Shell Key brand file — the marketing agent reads this every time it writes posts.
// This is the one file to edit when you want posts to sound different, push a
// different product, or stop talking about something. Plain English is fine.

export const BRAND = {
  company: "Shell Key",
  site: "https://shellkey.company",
  store: "https://shellkey.company/store.html",
  phone: "+1 (337) 254-8321",
  email: "support@shellkey.company",
  owner: "Kirby C. Billiot",
  place: "Lafayette, Louisiana",

  who_we_are: [
    "Shell Key is a Lafayette, Louisiana company built by a working project controls professional.",
    "Kirby has 32 years on refinery, LNG, steel mill and petrochemical projects from $75M to $3.8B: scheduler, turnaround planner, and inspector (API-510 / 570, NDE Level II).",
    "Every product was built to solve a real problem on a job, then made good enough to sell.",
    "Everything runs in a browser, most products have a free demo with no card and no install, and support comes from the person who built it.",
  ],

  // Who we are talking to. The agent picks the audience that fits the product.
  audiences: [
    "Project controls people: schedulers, planners, cost engineers, project managers on industrial jobs",
    "Turnaround and shutdown teams at refineries, chemical plants and steel mills",
    "Inspectors and QA/QC: API 510/570/653, API 1104 pipeline, AWS CWI, NDE companies",
    "Louisiana contractors who bid public work",
    "Families and small business owners who want simple money and website tools",
    "People who want to learn Power BI, no-code apps, or use AI to earn more",
  ],

  voice: [
    "Sound like Kirby talking to someone on the job: plain, direct, practical, a little dry humor is fine.",
    "Lead with the problem the reader has this week, then how the product fixes it.",
    "Use real job language (P6, XER, critical path, workpacks, weld map, NDE, turnaround, TAR) when the audience is industrial.",
    "Short sentences. No hype words: never 'revolutionary', 'game-changer', 'unlock', 'supercharge', 'elevate', 'seamless'.",
    "US English spelling. Write the company name as Shell Key.",
    "Never invent customers, results, testimonials, statistics, discounts or deadlines. Only use facts from the product data.",
    "Always give one clear next step: try the free demo, see the product, or call or email Kirby.",
  ],

  // How each platform should look.
  platforms: {
    facebook: "80 to 160 words. Conversational. Can open with a short question or a job-site moment. Put the link on its own line at the end. 0 to 3 hashtags.",
    instagram: "60 to 140 words. Strong first line, short paragraphs. Links are not clickable on Instagram, so end with 'Link in bio, or search shellkey.company'. 5 to 10 relevant hashtags on the last line.",
    linkedin: "100 to 220 words. Professional but still Kirby's voice. Open with a lesson from the field, then the product as the fix. Put the link on its own line at the end. 3 to 5 hashtags.",
  },

  // What kind of post to write, rotated day by day so the feed is not all ads.
  angles: [
    "tip: a useful how-to or lesson from the field related to the product, with the product mentioned as the shortcut",
    "demo: invite people to try the free demo, say exactly what they will see in the first two minutes",
    "feature: one specific feature, the problem it solves, and what it replaces (usually a spreadsheet)",
    "story: a short job-site story about the problem the product was built for",
    "offer: who it is for, what it costs, what they get, and how to start today",
  ],

  // Products to push harder. Slugs from the store. Leave empty to rotate evenly.
  focus: ["dcma-health-reviewer", "bid-board", "learn-power-bi-4-hours"],

  // Products the agent must never post about (slugs).
  never: [],

  // Things the agent must never say.
  avoid: [
    "Do not mention competitors by name.",
    "Do not mention clients, employers or project owners by name.",
    "Do not promise results, savings or certification pass rates.",
  ],
};
