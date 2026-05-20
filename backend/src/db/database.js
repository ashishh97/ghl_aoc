import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../data/observability.db");

let _db = null;

export function getDb() {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  migrate(_db);
  return _db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      script      TEXT,
      kpis        TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS calls (
      id            TEXT PRIMARY KEY,
      agent_id      TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      ghl_call_id   TEXT UNIQUE,
      contact_name  TEXT,
      contact_phone TEXT,
      duration_secs INTEGER,
      transcript    TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      occurred_at   TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id              TEXT PRIMARY KEY,
      call_id         TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
      overall_score   REAL NOT NULL,
      kpi_scores      TEXT NOT NULL DEFAULT '{}',
      failures        TEXT NOT NULL DEFAULT '[]',
      recommendations TEXT NOT NULL DEFAULT '[]',
      use_actions     TEXT NOT NULL DEFAULT '[]',
      raw_response    TEXT,
      model           TEXT NOT NULL,
      evaluated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kpi_definitions (
      id          TEXT PRIMARY KEY,
      agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      key         TEXT NOT NULL,
      label       TEXT NOT NULL,
      description TEXT NOT NULL,
      weight      REAL NOT NULL DEFAULT 1.0,
      UNIQUE(agent_id, key)
    );

    CREATE INDEX IF NOT EXISTS idx_calls_agent    ON calls(agent_id);
    CREATE INDEX IF NOT EXISTS idx_calls_status   ON calls(status);
    CREATE INDEX IF NOT EXISTS idx_evals_call     ON evaluations(call_id);
  `);
}

export default getDb;
