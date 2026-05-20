# `POST /analyze/call/:id` — Curl & Payload Reference

Base URL: `http://localhost:3001`

---

## Endpoint

```
POST /analyze/call/:id
```

Runs the full AI evaluation pipeline for a single call:

1. Fetches the call row (transcript, contact info) from SQLite
2. Fetches the agent's `script` and `kpi_definitions` from SQLite
3. Calls `claudeClient.evaluateTranscript()` → structured `EvaluationResult`
4. Persists a row into `evaluations` table
5. Updates `calls.status` → `'evaluated'`
6. Returns `{ evaluation: EvaluationResult }`

---

## Request

### Path parameter

| Param | Type   | Description                |
|-------|--------|----------------------------|
| `id`  | string | UUID of the call to evaluate |

### Request body (JSON)

| Field   | Type    | Required | Default | Description                                              |
|---------|---------|----------|---------|----------------------------------------------------------|
| `force` | boolean | No       | `false` | If `true`, re-evaluates even if an evaluation already exists |

```json
{
  "force": false
}
```

---

## Seed call IDs (from `npm run seed`)

| Call ID                                | Contact       | Agent         | Script focus      |
|----------------------------------------|---------------|---------------|-------------------|
| `b16768b2-a397-432d-a1eb-a13e5272973e` | James Holloway | agent-001     | Appointment Setter |
| `9cfe0250-ee44-49a1-b86c-75c641be5213` | Maria Chen    | agent-001     | Appointment Setter |
| `23d65886-d87c-4310-9080-57bd89009cc6` | Derek Osei    | agent-001     | Appointment Setter |
| `dc27e10f-6444-463c-8459-d246c80300d2` | Sandra Bloom  | agent-002     | Lead Qualifier     |
| `816eac92-389a-4de7-bff7-084827b7d451` | Tom Briggs    | agent-002     | Lead Qualifier     |

---

## Curl examples

### 1. Evaluate James Holloway's call (first-time, no body required)

```bash
curl -X POST http://localhost:3001/analyze/call/b16768b2-a397-432d-a1eb-a13e5272973e \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 2. Evaluate with explicit `force: false` (idempotent — returns cached result if already evaluated)

```bash
curl -X POST http://localhost:3001/analyze/call/b16768b2-a397-432d-a1eb-a13e5272973e \
  -H "Content-Type: application/json" \
  -d '{ "force": false }'
```

### 3. Force re-evaluation (overwrites existing evaluation row)

```bash
curl -X POST http://localhost:3001/analyze/call/b16768b2-a397-432d-a1eb-a13e5272973e \
  -H "Content-Type: application/json" \
  -d '{ "force": true }'
```

### 4. Evaluate Maria Chen's call (poor call — expect low scores + compliance_risk use_action)

```bash
curl -X POST http://localhost:3001/analyze/call/9cfe0250-ee44-49a1-b86c-75c641be5213 \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 5. Evaluate Sandra Bloom's call (agent-002 / Lead Qualifier)

```bash
curl -X POST http://localhost:3001/analyze/call/dc27e10f-6444-463c-8459-d246c80300d2 \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 6. Pretty-print the response with `jq`

```bash
curl -s -X POST http://localhost:3001/analyze/call/b16768b2-a397-432d-a1eb-a13e5272973e \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

### 7. Evaluate all 5 calls in one shot (loop)

```bash
CALL_IDS=(
  "b16768b2-a397-432d-a1eb-a13e5272973e"
  "9cfe0250-ee44-49a1-b86c-75c641be5213"
  "23d65886-d87c-4310-9080-57bd89009cc6"
  "dc27e10f-6444-463c-8459-d246c80300d2"
  "816eac92-389a-4de7-bff7-084827b7d451"
)

for ID in "${CALL_IDS[@]}"; do
  echo "▶ Evaluating $ID"
  curl -s -X POST "http://localhost:3001/analyze/call/$ID" \
    -H "Content-Type: application/json" \
    -d '{}' | jq '.evaluation.overall_score'
done
```

---

## Success response

**HTTP 200 OK**

```json
{
  "evaluation": {
    "overall_score": 0.87,
    "kpi_scores": {
      "greeting_quality": 1.0,
      "qualification_completion": 1.0,
      "objection_handling": 0.8,
      "appointment_booked": 1.0,
      "contact_info_captured": 1.0
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
      "Rewrite the objection handling prompt to open with 'I completely understand' before presenting value, rather than immediately re-pitching after a refusal."
    ],
    "use_actions": [
      {
        "description": "Prospect explicitly said 'Please don't call again' — agent should have acknowledged this clearly and logged a DNC flag.",
        "quote": "Please don't call again.",
        "type": "compliance_risk"
      }
    ]
  }
}
```

---

## Error responses

### 404 — Call not found

```json
{
  "error": {
    "message": "Call not found"
  }
}
```

```bash
curl -s -X POST http://localhost:3001/analyze/call/does-not-exist \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

### 422 — No KPI definitions for this agent

Occurs when the agent has no rows in `kpi_definitions`.

```json
{
  "error": {
    "message": "No KPI definitions found for this agent. Add KPIs before evaluating."
  }
}
```

### 429 — Rate limit exceeded

The `/analyze` prefix is limited to **20 requests / 60 s**.

```json
{
  "error": {
    "message": "Too many evaluation requests, please wait a moment."
  }
}
```

---

## Related endpoints

| Method | Path                       | Description                              |
|--------|----------------------------|------------------------------------------|
| `GET`  | `/analyze/call/:id`        | Retrieve an existing evaluation (no AI call) |
| `POST` | `/analyze/agent/:agentId`  | Batch-evaluate all pending calls for an agent |
| `GET`  | `/analyze/dashboard`       | Aggregate metrics across all agents      |

### Retrieve existing evaluation

```bash
curl -s http://localhost:3001/analyze/call/b16768b2-a397-432d-a1eb-a13e5272973e | jq .
```

### Batch evaluate all pending calls for agent-001

```bash
curl -s -X POST http://localhost:3001/analyze/agent/agent-001 \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

### Dashboard

```bash
curl -s http://localhost:3001/analyze/dashboard | jq .
```
