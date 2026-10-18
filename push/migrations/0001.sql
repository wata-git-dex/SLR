PRAGMA foreign_keys = ON;
CREATE TABLE subscriptions (
 id TEXT PRIMARY KEY, app TEXT NOT NULL, subject TEXT NOT NULL,
 endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
 account_enabled INTEGER NOT NULL DEFAULT 1 CHECK(account_enabled IN (0,1)),
 achievement_enabled INTEGER NOT NULL DEFAULT 1 CHECK(achievement_enabled IN (0,1)),
 created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE INDEX subscription_owner ON subscriptions(app,subject);
CREATE TABLE events (
 id TEXT PRIMARY KEY, app TEXT NOT NULL, subject TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('account','test','achievement')),
 created INTEGER NOT NULL, read_at INTEGER
);
CREATE INDEX event_inbox ON events(app,subject,created DESC);
CREATE TABLE deliveries (
 event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
 attempts INTEGER NOT NULL DEFAULT 0, due INTEGER NOT NULL, lease TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
 PRIMARY KEY(event_id,subscription_id)
);
CREATE INDEX delivery_due ON deliveries(status,due);

CREATE TABLE achievement_progress (subject TEXT PRIMARY KEY, ranks TEXT NOT NULL, pending INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0);

CREATE TABLE achievement_receipts (subject TEXT NOT NULL, session_id TEXT NOT NULL, PRIMARY KEY(subject,session_id));
