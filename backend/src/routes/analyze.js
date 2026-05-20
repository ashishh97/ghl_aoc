/**
 * routes/analyze.js
 * Evaluation endpoints.
 *
 * POST /analyze/call/:id         — evaluate a single call
 * POST /analyze/agent/:agentId   — evaluate all pending calls for an agent
 * GET  /analyze/call/:id         — retrieve evaluation for a call
 * GET  /analyze/dashboard        — aggregate metrics across all agents
 */

import { Router } from "express";
import { getDb } from "../db/database.js";
import { evaluateCall, evaluatePendingCalls, getAgentMetrics } from "../services/evaluator.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

// ── Evaluate single call ──────────────────────────────────────────────────

router.post(
  "/call/:id",
  asyncHandler(async (req, res) => {
    const { force = false } = req.body;
    const result = await evaluateCall(req.params.id, { force });
    res.json({ evaluation: result });
  })
);

// ── Retrieve evaluation ───────────────────────────────────────────────────

router.get(
  "/call/:id",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM evaluations WHERE call_id = ?")
      .get(req.params.id);

    if (!row) return res.status(404).json({ error: { message: "No evaluation found for this call" } });

    res.json({
      evaluation: {
        ...row,
        kpi_scores: JSON.parse(row.kpi_scores),
        failures: JSON.parse(row.failures),
        recommendations: JSON.parse(row.recommendations),
        use_actions: JSON.parse(row.use_actions),
      },
    });
  })
);

// ── Batch evaluate agent ──────────────────────────────────────────────────

router.post(
  "/agent/:agentId",
  asyncHandler(async (req, res) => {
    const summary = await evaluatePendingCalls(req.params.agentId);
    res.json({ summary });
  })
);

// ── Dashboard aggregate ───────────────────────────────────────────────────

router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const agents = db.prepare("SELECT id, name, description FROM agents").all();

    const agentSummaries = agents.map((a) => ({
      agent: a,
      metrics: getAgentMetrics(a.id),
    }));

    // Global numbers
    const totals = db
      .prepare(`
        SELECT
          COUNT(*) AS total_calls,
          SUM(CASE WHEN status = 'evaluated' THEN 1 ELSE 0 END) AS evaluated_calls,
          SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) AS pending_calls,
          SUM(CASE WHEN status = 'error'     THEN 1 ELSE 0 END) AS error_calls
        FROM calls
      `)
      .get();

    const avgScoreRow = db
      .prepare("SELECT AVG(overall_score) AS avg FROM evaluations")
      .get();

    // Recent failures across all agents (last 20)
    const recentFailures = db
      .prepare(`
        SELECT e.failures, e.evaluated_at, c.contact_name, c.agent_id, a.name AS agent_name
        FROM evaluations e
        JOIN calls c ON c.id = e.call_id
        JOIN agents a ON a.id = c.agent_id
        ORDER BY e.evaluated_at DESC
        LIMIT 20
      `)
      .all()
      .flatMap((row) =>
        JSON.parse(row.failures).map((f) => ({
          ...f,
          contact_name: row.contact_name,
          agent_name: row.agent_name,
          evaluated_at: row.evaluated_at,
        }))
      )
      .filter((f) => f.severity === "high")
      .slice(0, 10);

    res.json({
      totals: {
        ...totals,
        avg_score: avgScoreRow.avg ?? 0,
      },
      agents: agentSummaries,
      recent_high_severity_failures: recentFailures,
    });
  })
);

export default router;
