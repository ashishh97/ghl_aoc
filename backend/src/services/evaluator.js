/**
 * evaluator.js
 * Orchestrates the full evaluation pipeline:
 *   call → fetch KPIs + agent script → run Claude → persist evaluation
 */

import { randomUUID } from "crypto";
import { getDb } from "../db/database.js";
import { evaluateTranscript } from "./claudeClient.js";

/**
 * Run evaluation for a single call. Idempotent — will skip if already evaluated.
 * Returns the evaluation row.
 *
 * @param {string} callId
 * @param {{ force?: boolean }} options
 */
export async function evaluateCall(callId, { force = false } = {}) {
  const db = getDb();

  const call = db.prepare("SELECT * FROM calls WHERE id = ?").get(callId);
  if (!call) throw Object.assign(new Error("Call not found"), { status: 404 });

  if (!force) {
    const existing = db
      .prepare("SELECT * FROM evaluations WHERE call_id = ?")
      .get(callId);
    if (existing) return parseEvalRow(existing);
  }

  const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(call.agent_id);
  if (!agent) throw Object.assign(new Error("Agent not found"), { status: 404 });

  const kpis = db
    .prepare("SELECT * FROM kpi_definitions WHERE agent_id = ?")
    .all(call.agent_id);

  if (kpis.length === 0) {
    throw Object.assign(
      new Error("No KPI definitions found for this agent. Add KPIs before evaluating."),
      { status: 422 }
    );
  }

  // Mark call as processing
  db.prepare("UPDATE calls SET status = 'processing' WHERE id = ?").run(callId);

  let result;
  try {
    result = await evaluateTranscript({
      transcript: call.transcript,
      agentScript: agent.script,
      kpis,
    });
  } catch (err) {
    db.prepare("UPDATE calls SET status = 'error' WHERE id = ?").run(callId);
    throw err;
  }

  // Delete any existing evaluation (for forced re-eval)
  db.prepare("DELETE FROM evaluations WHERE call_id = ?").run(callId);

  const evalId = randomUUID();
  db.prepare(`
    INSERT INTO evaluations
      (id, call_id, overall_score, kpi_scores, failures, recommendations, use_actions, model, evaluated_at)
    VALUES
      (@id, @call_id, @overall_score, @kpi_scores, @failures, @recommendations, @use_actions, @model, datetime('now'))
  `).run({
    id: evalId,
    call_id: callId,
    overall_score: result.overall_score,
    kpi_scores: JSON.stringify(result.kpi_scores),
    failures: JSON.stringify(result.failures),
    recommendations: JSON.stringify(result.recommendations),
    use_actions: JSON.stringify(result.use_actions),
    model: "claude-sonnet-4-20250514",
  });

  db.prepare("UPDATE calls SET status = 'evaluated' WHERE id = ?").run(callId);

  return result;
}

/**
 * Evaluate all pending calls for a given agent (or all agents if agentId is omitted).
 * Returns a summary { evaluated, skipped, errors }.
 *
 * @param {string|null} agentId
 */
export async function evaluatePendingCalls(agentId = null) {
  const db = getDb();

  const query = agentId
    ? db.prepare("SELECT id FROM calls WHERE status = 'pending' AND agent_id = ?")
    : db.prepare("SELECT id FROM calls WHERE status = 'pending'");

  const rows = agentId ? query.all(agentId) : query.all();

  const summary = { evaluated: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    try {
      await evaluateCall(row.id);
      summary.evaluated++;
    } catch (err) {
      summary.errors.push({ callId: row.id, message: err.message });
    }
  }

  return summary;
}

/**
 * Compute aggregate metrics for an agent across all evaluated calls.
 *
 * @param {string} agentId
 * @returns {{
 *   total_calls: number,
 *   evaluated_calls: number,
 *   avg_score: number,
 *   avg_kpi_scores: Record<string, number>,
 *   top_failures: Array<{ kpi: string, count: number }>,
 *   score_trend: Array<{ date: string, score: number }>
 * }}
 */
export function getAgentMetrics(agentId) {
  const db = getDb();

  const totalCalls = db
    .prepare("SELECT COUNT(*) AS n FROM calls WHERE agent_id = ?")
    .get(agentId).n;

  const evaluatedCalls = db
    .prepare("SELECT COUNT(*) AS n FROM calls WHERE agent_id = ? AND status = 'evaluated'")
    .get(agentId).n;

  if (evaluatedCalls === 0) {
    return {
      total_calls: totalCalls,
      evaluated_calls: 0,
      avg_score: 0,
      avg_kpi_scores: {},
      top_failures: [],
      score_trend: [],
    };
  }

  const evals = db
    .prepare(`
      SELECT e.overall_score, e.kpi_scores, e.failures, c.occurred_at
      FROM evaluations e
      JOIN calls c ON c.id = e.call_id
      WHERE c.agent_id = ?
      ORDER BY c.occurred_at ASC
    `)
    .all(agentId);

  // Average overall score
  const avgScore = evals.reduce((s, e) => s + e.overall_score, 0) / evals.length;

  // Average per-KPI scores
  const kpiSums = {};
  const kpiCounts = {};
  for (const e of evals) {
    const scores = JSON.parse(e.kpi_scores);
    for (const [key, val] of Object.entries(scores)) {
      kpiSums[key] = (kpiSums[key] ?? 0) + val;
      kpiCounts[key] = (kpiCounts[key] ?? 0) + 1;
    }
  }
  const avgKpiScores = Object.fromEntries(
    Object.entries(kpiSums).map(([k, v]) => [k, v / kpiCounts[k]])
  );

  // Top failure KPIs by frequency
  const failureCounts = {};
  for (const e of evals) {
    const failures = JSON.parse(e.failures);
    for (const f of failures) {
      failureCounts[f.kpi] = (failureCounts[f.kpi] ?? 0) + 1;
    }
  }
  const topFailures = Object.entries(failureCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([kpi, count]) => ({ kpi, count }));

  // Score trend (daily average)
  const trendMap = {};
  for (const e of evals) {
    const day = e.occurred_at.slice(0, 10);
    if (!trendMap[day]) trendMap[day] = [];
    trendMap[day].push(e.overall_score);
  }
  const scoreTrend = Object.entries(trendMap).map(([date, scores]) => ({
    date,
    score: scores.reduce((a, b) => a + b, 0) / scores.length,
  }));

  return {
    total_calls: totalCalls,
    evaluated_calls: evaluatedCalls,
    avg_score: avgScore,
    avg_kpi_scores: avgKpiScores,
    top_failures: topFailures,
    score_trend: scoreTrend,
  };
}

// --- Helpers ---

function parseEvalRow(row) {
  return {
    overall_score: row.overall_score,
    kpi_scores: JSON.parse(row.kpi_scores),
    failures: JSON.parse(row.failures),
    recommendations: JSON.parse(row.recommendations),
    use_actions: JSON.parse(row.use_actions),
  };
}
