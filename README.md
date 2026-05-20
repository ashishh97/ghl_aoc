# Voice AI Observability Copilot — Backend

Node.js / Express REST API powering the observability pipeline.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node 18+ (ESM) | Native `fetch`, top-level await, clean module system |
| Web framework | Express 4 | Minimal, well-understood, easy to extend |
| Database | SQLite via `better-sqlite3` | Zero-config, sync API, ideal for single-server deployment |
| AI evaluation | Anthropic SDK → `claude-sonnet-4-20250514` | Best instruction-following + JSON reliability |
| Validation | Zod (route-level) | Runtime schema safety without heavy ORM |

---

## Quick start

```bash
# 1. Copy and fill in credentials
cp .env.example .env

# 2. Install
npm install

# 3. Seed demo data (creates data/observability.db)
npm run seed

# 4. Start dev server (hot-reload)
npm run dev
```

The server listens on `http://localhost:3001` by default.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `GHL_API_KEY` | For live sync | HighLevel private integration key |
| `GHL_LOCATION_ID` | For live sync | Your GHL location/sub-account ID |
| `GHL_BASE_URL` | No | Defaults to `https://services.leadconnectorhq.com` |
| `PORT` | No | Defaults to `3001` |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |

Without GHL credentials, the server runs fine on seed data — evaluation and dashboard all work.

---

## API reference

### Agents

| Method | Path | Description |
|---|---|---|
| `GET` | `/agents` | List all agents with summary metrics |
| `POST` | `/agents` | Create an agent |
| `GET` | `/agents/:id` | Agent detail + KPIs + metrics |
| `PATCH` | `/agents/:id` | Update name / description / script |
| `DELETE` | `/agents/:id` | Delete agent and all related data |
| `GET` | `/agents/:id/kpis` | List KPI definitions |
| `POST` | `/agents/:id/kpis` | Add a KPI |
| `PATCH` | `/agents/:id/kpis/:kpiId` | Update a KPI |
| `DELETE` | `/agents/:id/kpis/:kpiId` | Delete a KPI |

### Transcripts

| Method | Path | Description |
|---|---|---|
| `GET` | `/transcripts` | List calls (filter: `agent_id`, `status`, `limit`, `offset`) |
| `POST` | `/transcripts` | Manually ingest a transcript |
| `POST` | `/transcripts/sync` | Pull latest from GHL API |
| `GET` | `/transcripts/:id` | Single call + evaluation |
| `DELETE` | `/transcripts/:id` | Delete call |

### Analyze (AI evaluation)

| Method | Path | Description |
|---|---|---|
| `POST` | `/analyze/call/:id` | Evaluate a single call (body: `{ force: bool }`) |
| `GET` | `/analyze/call/:id` | Retrieve existing evaluation |
| `POST` | `/analyze/agent/:agentId` | Evaluate all pending calls for agent |
| `GET` | `/analyze/dashboard` | Aggregate metrics across all agents |

### Health

```
GET /health → { status: "ok", timestamp }
```

---

## Architecture

```
src/
├── index.js               Entry point — Express + middleware wiring
├── db/
│   ├── database.js        SQLite init + schema migration
│   └── seed.js            Demo data (2 agents, 5 calls with realistic transcripts)
├── middleware/
│   └── errorHandler.js    Central error handler + asyncHandler wrapper
├── routes/
│   ├── agents.js          Agent + KPI CRUD
│   ├── transcripts.js     Transcript ingestion + GHL sync
│   └── analyze.js         Evaluation triggers + dashboard aggregation
└── services/
    ├── claudeClient.js    Anthropic SDK wrapper — evaluateTranscript()
    ├── evaluator.js       Pipeline orchestrator — evaluateCall(), metrics
    └── ghlClient.js       HighLevel REST API wrapper
```

### Evaluation pipeline

```
POST /analyze/call/:id
  → evaluateCall()
  → fetch call + agent script + KPI definitions from DB
  → claudeClient.evaluateTranscript()
      → builds structured prompt with transcript + KPIs
      → calls claude-sonnet-4-20250514
      → parses + validates JSON response
  → persists evaluation row
  → marks call as 'evaluated'
  → returns EvaluationResult
```

### EvaluationResult shape

```json
{
  "overall_score": 0.87,
  "kpi_scores": {
    "greeting_quality": 1.0,
    "appointment_booked": 1.0,
    "objection_handling": 0.8
  },
  "failures": [
    {
      "kpi": "objection_handling",
      "description": "Agent pushed back after prospect said not interested instead of empathising first",
      "quote": "Are you sure? We have great deals right now.",
      "timestamp": "00:42",
      "severity": "medium"
    }
  ],
  "recommendations": [
    "Rewrite the objection handling prompt to open with 'I completely understand' before presenting value..."
  ],
  "use_actions": [
    {
      "description": "Prospect explicitly said do not call again — agent should have acknowledged this clearly",
      "quote": "Please don't call again.",
      "type": "compliance_risk"
    }
  ]
}
```

---

## What's real vs mocked

| Feature | Status |
|---|---|
| Transcript ingestion (manual POST) | ✅ Real |
| Claude AI evaluation | ✅ Real |
| SQLite persistence | ✅ Real |
| Aggregate metrics / dashboard | ✅ Real |
| GHL API sync (`POST /transcripts/sync`) | ⚠️ Real API calls, but GHL Voice AI transcript API is evolving — falls back to empty if creds missing |
| Real-time webhook ingestion | 📋 Designed (would use GHL workflow webhooks → `POST /transcripts`) |

---

## Team of One — ownership notes

**Product**: Defined the two core loops (Monitor + Analyze) from the spec and mapped them directly to the `/transcripts` and `/analyze` routes. Kept scope tight — no auth, no multi-tenancy for the demo.

**Design**: API shape designed for the Vue dashboard to consume with minimal transformation. Evaluation result is flat JSON — no nested parsing needed on the frontend.

**Engineering**: ESM throughout, `asyncHandler` wrapper so no try/catch noise in routes, single migration on startup (no migration runner needed at this scale), seed script idempotent via `INSERT OR REPLACE`.

**QA**: Smoke-tested all routes with seed data. Claude evaluator prompt validated against all 5 seed transcripts — scores match expected quality (James: high, Maria: low, Derek: high, Sandra: high, Tom: medium).
