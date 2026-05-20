/**
 * routes/transcripts.js
 * Manage call transcripts.
 *
 * GET  /transcripts             — list calls (filterable by agent_id, status)
 * POST /transcripts             — manually ingest a transcript
 * POST /transcripts/sync        — pull latest from GHL API
 * GET  /transcripts/:id         — single call + its evaluation if exists
 * DELETE /transcripts/:id       — delete call and its evaluation
 */

import { Router } from "express";
import { randomUUID } from "crypto";
import { getDb } from "../db/database.js";
import { fetchRecentTranscripts } from "../services/ghlClient.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

// ── List ──────────────────────────────────────────────────────────────────

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { agent_id, status, limit = "50", offset = "0" } = req.query;

    let sql = `
      SELECT c.*, e.overall_score, e.evaluated_at,
             a.name as agent_name
      FROM calls c
      JOIN agents a ON a.id = c.agent_id
      LEFT JOIN evaluations e ON e.call_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (agent_id) {
      sql += " AND c.agent_id = ?";
      params.push(agent_id);
    }
    if (status) {
      sql += " AND c.status = ?";
      params.push(status);
    }

    sql += " ORDER BY c.occurred_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));

    const calls = db.prepare(sql).all(...params);

    // Total count for pagination
    let countSql = "SELECT COUNT(*) AS n FROM calls WHERE 1=1";
    const countParams = [];
    if (agent_id) { countSql += " AND agent_id = ?"; countParams.push(agent_id); }
    if (status) { countSql += " AND status = ?"; countParams.push(status); }
    const total = db.prepare(countSql).get(...countParams).n;

    res.json({ calls, total, limit: Number(limit), offset: Number(offset) });
  })
);

// ── Ingest (manual) ───────────────────────────────────────────────────────

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const {
      agent_id,
      transcript,
      contact_name = "Unknown",
      contact_phone = "",
      duration_secs = 0,
      occurred_at = new Date().toISOString(),
      ghl_call_id = null,
    } = req.body;

    if (!agent_id) return res.status(400).json({ error: { message: "agent_id is required" } });
    if (!transcript) return res.status(400).json({ error: { message: "transcript is required" } });

    const agent = db.prepare("SELECT id FROM agents WHERE id = ?").get(agent_id);
    if (!agent) return res.status(404).json({ error: { message: "Agent not found" } });

    const id = randomUUID();
    db.prepare(`
      INSERT INTO calls
        (id, agent_id, ghl_call_id, contact_name, contact_phone, duration_secs, transcript, status, occurred_at)
      VALUES
        (@id, @agent_id, @ghl_call_id, @contact_name, @contact_phone, @duration_secs, @transcript, 'pending', @occurred_at)
    `).run({ id, agent_id, ghl_call_id, contact_name, contact_phone, duration_secs, transcript, occurred_at });

    const call = db.prepare("SELECT * FROM calls WHERE id = ?").get(id);
    res.status(201).json({ call });
  })
);

// ── GHL Sync ──────────────────────────────────────────────────────────────

router.post(
  "/sync",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { agent_id, limit = 10 } = req.body;

    if (!agent_id)
      return res.status(400).json({ error: { message: "agent_id is required for sync" } });

    const agent = db.prepare("SELECT id FROM agents WHERE id = ?").get(agent_id);
    if (!agent) return res.status(404).json({ error: { message: "Agent not found" } });

    const transcripts = await fetchRecentTranscripts(Number(limit));

    const insertCall = db.prepare(`
      INSERT OR IGNORE INTO calls
        (id, agent_id, ghl_call_id, contact_name, contact_phone, duration_secs, transcript, status, occurred_at)
      VALUES
        (@id, @agent_id, @ghl_call_id, @contact_name, @contact_phone, @duration_secs, @transcript, 'pending', @occurred_at)
    `);

    let imported = 0;
    const tx = db.transaction(() => {
      for (const t of transcripts) {
        insertCall.run({
          id: randomUUID(),
          agent_id,
          ghl_call_id: t.ghlCallId,
          contact_name: t.contactName,
          contact_phone: t.contactPhone,
          duration_secs: t.durationSecs,
          transcript: t.transcript,
          occurred_at: t.occurredAt,
        });
        imported++;
      }
    });
    tx();

    res.json({ imported, message: `Imported ${imported} transcripts from GHL` });
  })
);

// ── Single call ───────────────────────────────────────────────────────────

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const call = db
      .prepare(`
        SELECT c.*, a.name AS agent_name, a.script AS agent_script
        FROM calls c
        JOIN agents a ON a.id = c.agent_id
        WHERE c.id = ?
      `)
      .get(req.params.id);

    if (!call) return res.status(404).json({ error: { message: "Call not found" } });

    const evaluation = db
      .prepare("SELECT * FROM evaluations WHERE call_id = ?")
      .get(req.params.id);

    const kpis = db
      .prepare("SELECT * FROM kpi_definitions WHERE agent_id = ?")
      .all(call.agent_id);

    res.json({
      call,
      evaluation: evaluation ? parseEval(evaluation) : null,
      kpis,
    });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const info = db.prepare("DELETE FROM calls WHERE id = ?").run(req.params.id);
    if (info.changes === 0)
      return res.status(404).json({ error: { message: "Call not found" } });
    res.json({ deleted: true });
  })
);

// ── Helpers ───────────────────────────────────────────────────────────────

function parseEval(e) {
  return {
    ...e,
    kpi_scores: JSON.parse(e.kpi_scores),
    failures: JSON.parse(e.failures),
    recommendations: JSON.parse(e.recommendations),
    use_actions: JSON.parse(e.use_actions),
  };
}

export default router;
