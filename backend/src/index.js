/**
 * index.js — Express server entry point
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import agentsRouter from "./routes/agents.js";
import transcriptsRouter from "./routes/transcripts.js";
import analyzeRouter from "./routes/analyze.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { getDb } from "./db/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists
const dataDir = path.join(__dirname, "../data");
fs.mkdirSync(dataDir, { recursive: true });

// Initialise DB (runs migrations)
getDb();

const app = express();
const PORT = process.env.PORT ?? 3001;

// ── Middleware ─────────────────────────────────────────────────────────────

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

// Rate limit the AI-heavy analyze endpoints more aggressively
const analyzeLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many evaluation requests, please wait a moment." } },
});

const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/agents", agentsRouter);
app.use("/transcripts", transcriptsRouter);
app.use("/analyze", analyzeLimiter, analyzeRouter);

// ── Error handler ──────────────────────────────────────────────────────────

app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Voice AI Observability backend running on http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV ?? "development"}`);
  console.log(`   GHL location: ${process.env.GHL_LOCATION_ID ?? "(not set — using mock data)"}`);
  console.log(`   Claude model: claude-sonnet-4-20250514\n`);
});
