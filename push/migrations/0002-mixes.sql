-- Additive, SLR-owned mix storage. Ordinary Notion Sessions are never written here.
CREATE TABLE IF NOT EXISTS slr_mix_experiments (
 id TEXT PRIMARY KEY, author_subject TEXT NOT NULL, author_name TEXT NOT NULL,
 operation_id TEXT NOT NULL, request_hash TEXT NOT NULL,
 title TEXT NOT NULL, ingredients TEXT NOT NULL, created INTEGER NOT NULL,
 UNIQUE(author_subject,operation_id)
);
CREATE INDEX IF NOT EXISTS slr_mix_recent ON slr_mix_experiments(created DESC,id DESC);
CREATE TABLE IF NOT EXISTS slr_mix_participants (
 experiment_id TEXT NOT NULL REFERENCES slr_mix_experiments(id),
 subject TEXT NOT NULL, name TEXT NOT NULL,
 PRIMARY KEY(experiment_id,subject)
);
CREATE INDEX IF NOT EXISTS slr_mix_member ON slr_mix_participants(subject,experiment_id);
CREATE TABLE IF NOT EXISTS slr_mix_results (
 experiment_id TEXT NOT NULL, subject TEXT NOT NULL,
 name TEXT NOT NULL, operation_id TEXT NOT NULL, request_hash TEXT NOT NULL,
 overall INTEGER CHECK(overall BETWEEN 1 AND 5), effects TEXT NOT NULL,
 notes TEXT NOT NULL, created INTEGER NOT NULL,
 PRIMARY KEY(experiment_id,subject), UNIQUE(subject,operation_id),
 FOREIGN KEY(experiment_id,subject) REFERENCES slr_mix_participants(experiment_id,subject)
);
CREATE INDEX IF NOT EXISTS slr_mix_result_owner ON slr_mix_results(subject,experiment_id);
CREATE TABLE IF NOT EXISTS slr_reward_history (
 subject TEXT NOT NULL, badge_id TEXT NOT NULL, rank INTEGER NOT NULL,
 xp INTEGER NOT NULL, created INTEGER NOT NULL,
 PRIMARY KEY(subject,badge_id,rank)
);
CREATE INDEX IF NOT EXISTS slr_reward_recent ON slr_reward_history(subject,created DESC);
