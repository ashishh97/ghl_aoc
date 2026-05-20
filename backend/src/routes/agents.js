/**
 * routes/agents.js
 * CRUD for agents and their KPI definitions.
 *
 * GET  /agents                  — list all agents with summary metrics
 * POST /agents                  — create agent
 * GET  /agents/:id              — get agent + KPIs + metrics
 * PATCH /agents/:id             — update agent script / name / description
 * DELETE /agents/:id            — delete agent and all related data
 *
 * GET  /agents/:id/kpis         — list KPI definitions
 * POST /agents/:id/kpis         — add a KPI
 * PATCH /agents/:id/kpis/:kpiId — update a KPI
 * DELETE /agents/:id/kpis/:kpiId— delete a KPI
 */

import { Router } from "express";
import { randomUUID } from "crypto";
import { getDb } from "../db/database.js";
import { getAgentMetrics } from "../services/evaluator.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

// ── Agents ────────────────────────────────────────────────────────────────

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const agents = db.prepare("SELECT * FROM agents ORDER BY created_at DESC").all();

    const result = agents.map((a) => ({
      ...parseAgent(a),
      metrics: getAgentMetrics(a.id),
    }));

    res.json({ agents: result });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, description = "", script = "" } = req.body;
    if (!name) return res.status(400).json({ error: { message: "name is required" } });

    const db = getDb();
    const id = randomUUID();

    db.prepare(`
      INSERT INTO agents (id, name, description, script, kpis)
      VALUES (@id, @name, @description, @script, '[]')
    `).run({ id, name, description, script });

    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(id);
    res.status(201).json({ agent: parseAgent(agent) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id);
    if (!agent) return res.status(404).json({ error: { message: "Agent not found" } });

    const kpis = db
      .prepare("SELECT * FROM kpi_definitions WHERE agent_id = ? ORDER BY rowid")
      .all(agent.id);

    res.json({
      agent: parseAgent(agent),
      kpis,
      metrics: getAgentMetrics(agent.id),
    });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id);
    if (!agent) return res.status(404).json({ error: { message: "Agent not found" } });

    const { name, description, script } = req.body;

    db.prepare(`
      UPDATE agents
      SET name = COALESCE(@name, name),
          description = COALESCE(@description, description),
          script = COALESCE(@script, script),
          updated_at = datetime('now')
      WHERE id = @id
    `).run({ id: req.params.id, name, description, script });

    const updated = db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id);
    res.json({ agent: parseAgent(updated) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const info = db.prepare("DELETE FROM agents WHERE id = ?").run(req.params.id);
    if (info.changes === 0)
      return res.status(404).json({ error: { message: "Agent not found" } });
    res.json({ deleted: true });
  })
);

// ── KPI Definitions ───────────────────────────────────────────────────────

router.get(
  "/:id/kpis",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const kpis = db
      .prepare("SELECT * FROM kpi_definitions WHERE agent_id = ? ORDER BY rowid")
      .all(req.params.id);
    res.json({ kpis });
  })
);

router.post(
  "/:id/kpis",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const agent = db.prepare("SELECT id FROM agents WHERE id = ?").get(req.params.id);
    if (!agent) return res.status(404).json({ error: { message: "Agent not found" } });

    const { key, label, description, weight = 1.0 } = req.body;
    if (!key || !label || !description) {
      return res.status(400).json({ error: { message: "key, label, and description are required" } });
    }

    const id = randomUUID();
    db.prepare(`
      INSERT INTO kpi_definitions (id, agent_id, key, label, description, weight)
      VALUES (@id, @agent_id, @key, @label, @description, @weight)
    `).run({ id, agent_id: req.params.id, key, label, description, weight });

    const kpi = db.prepare("SELECT * FROM kpi_definitions WHERE id = ?").get(id);
    res.status(201).json({ kpi });
  })
);

router.patch(
  "/:id/kpis/:kpiId",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { label, description, weight } = req.body;

    db.prepare(`
      UPDATE kpi_definitions
      SET label = COALESCE(@label, label),
          description = COALESCE(@description, description),
          weight = COALESCE(@weight, weight)
      WHERE id = @id AND agent_id = @agent_id
    `).run({ id: req.params.kpiId, agent_id: req.params.id, label, description, weight });

    const kpi = db.prepare("SELECT * FROM kpi_definitions WHERE id = ?").get(req.params.kpiId);
    if (!kpi) return res.status(404).json({ error: { message: "KPI not found" } });

    res.json({ kpi });
  })
);

router.delete(
  "/:id/kpis/:kpiId",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const info = db
      .prepare("DELETE FROM kpi_definitions WHERE id = ? AND agent_id = ?")
      .run(req.params.kpiId, req.params.id);

    if (info.changes === 0)
      return res.status(404).json({ error: { message: "KPI not found" } });

    res.json({ deleted: true });
  })
);

// ── Helpers ───────────────────────────────────────────────────────────────

function parseAgent(a) {
  return {
    ...a,
    kpis: JSON.parse(a.kpis),
  };
}

export default router;
