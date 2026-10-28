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
    "SHORT. Nobody reads paragraphs. The image does most of the work; the words just make people want to click.",
    "Shape of every post: one hook line (a question or 'Check this out'), one line on what it does, then the next step. That's it.",
    "Lead with the problem the reader has this week, in a few words.",
    "Kirby approved this example as the right length and tone (Facebook): 'Still explaining the schedule with a bar chart nobody reads? / See your P6 schedule build out on your plot plan, week by week. / Try the free demo' then the link. Match its length and shape; never copy its words.",
    "Use real job language (P6, XER, critical path, workpacks, weld map, NDE, turnaround, TAR) when the audience is industrial.",
    "No paragraphs, no long descriptions, no lists of features. Short sentences. No hype words: never 'revolutionary', 'game-changer', 'unlock', 'supercharge', 'elevate', 'seamless'.",
    "US English spelling. Write the company name as Shell Key.",
    "Never invent customers, results, testimonials, statistics, discounts or deadlines. Only use facts from the product data.",
    "Always give one clear next step: try the free demo, see the product, or call or email Kirby.",
  ],

  // How each platform should look.
  platforms: {
    facebook: "15 to 35 words, 2 or 3 short lines. Hook line, what it does, next step (for example 'Try the free demo'). Put the link on its own line at the end. 0 to 2 hashtags.",
    instagram: "15 to 35 words, 2 or 3 short lines. Hook line, what it does, next step. Links are not clickable on Instagram, so end with 'Link in bio'. 3 to 5 hashtags on the last line.",
    linkedin: "20 to 40 words, 2 or 3 short lines. Hook line, what it does, next step. Still Kirby's voice, a bit more professional. Put the link on its own line at the end. 2 or 3 hashtags.",
  },

  // What kind of post to write, rotated day by day so the feed is not all ads.
  // Every angle is still a SHORT post (see platforms above).
  angles: [
    "question: open with 'Do you need ...?' or 'Still doing ... by hand?', then the product in one line",
    "demo: 'Try this' or 'Check this out', what it does in one line, then 'Try the free demo'",
    "feature: one feature in one line and what it replaces (usually a spreadsheet)",
    "offer: who it is for and the price in one line, then how to start today",
  ],

  // Products to push harder. Slugs from the store. Leave empty to rotate evenly.
  focus: ["dcma-health-reviewer", "bid-board", "4d-schedule-sequence", "family-finance"],

  // Only post about these store sections: portals and software, dashboards (wall charts),
  // apps, and development services (built for you). No eBooks/guides, courses or free tools.
  post_categories: ["software", "wallcharts", "apps", "builds"],

  // Products the agent must never post about (slugs).
  never: [],

  // Things the agent must never say.
  avoid: [
    "Do not mention competitors by name.",
    "Do not mention clients, employers or project owners by name.",
    "Do not promise results, savings or certification pass rates.",
  ],
};
