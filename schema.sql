-- Shell Key CRM — Cloudflare D1 schema
-- Run once: Cloudflare dashboard -> Storage & Databases -> D1 -> shellkey-crm -> Console -> paste -> Execute
-- (Safe to re-run: every statement is IF NOT EXISTS.)

CREATE TABLE IF NOT EXISTS leads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  kind        TEXT NOT NULL DEFAULT 'contact',   -- contact | request | download | paypal
  status      TEXT NOT NULL DEFAULT 'new',       -- new | contacted | demo | quoted | won | lost | stop
  priority    INTEGER NOT NULL DEFAULT 0,
  name        TEXT, company TEXT, email TEXT, phone TEXT,
  address     TEXT, city TEXT, zip TEXT,
  item        TEXT, item_label TEXT, interest TEXT,
  timeframe   TEXT, message TEXT,
  page        TEXT, sid TEXT, ip_country TEXT, user_agent TEXT,
  utm_source  TEXT, utm_campaign TEXT,
  value       REAL NOT NULL DEFAULT 0,           -- expected $ (you set it in the CRM)
  notes       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS leads_email   ON leads(email);
CREATE INDEX IF NOT EXISTS leads_status  ON leads(status);
CREATE INDEX IF NOT EXISTS leads_created ON leads(created_at);

CREATE TABLE IF NOT EXISTS visits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL DEFAULT (datetime('now')),
  sid        TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'view',       -- view | checkout | download ...
  page       TEXT, item TEXT, ref TEXT,
  utm_source TEXT, utm_campaign TEXT,
  country    TEXT, city TEXT, device TEXT, ua TEXT
);
CREATE INDEX IF NOT EXISTS visits_sid ON visits(sid);
CREATE INDEX IF NOT EXISTS visits_at  ON visits(at);

CREATE TABLE IF NOT EXISTS sales (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  at           TEXT NOT NULL DEFAULT (datetime('now')),
  source       TEXT NOT NULL DEFAULT 'paypal',
  event_type   TEXT, event_id TEXT UNIQUE,
  payer_email  TEXT, payer_name TEXT,
  item         TEXT, amount REAL, currency TEXT,
  subscription_id TEXT, txn_id TEXT,
  status       TEXT, raw TEXT
);
CREATE INDEX IF NOT EXISTS sales_email ON sales(payer_email);

CREATE TABLE IF NOT EXISTS activity (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  at       TEXT NOT NULL DEFAULT (datetime('now')),
  lead_id  INTEGER NOT NULL,
  kind     TEXT NOT NULL,                        -- note | status | email | call
  body     TEXT
);
CREATE INDEX IF NOT EXISTS activity_lead ON activity(lead_id);
