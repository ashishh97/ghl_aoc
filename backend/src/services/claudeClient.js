/**
 * claudeClient.js
 * Wraps the Anthropic SDK. Exposes a single evaluateTranscript() function
 * that returns a structured EvaluationResult.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// const MODEL = "gpt-4.1-mini";
// const MODEL = "claude-sonnet-4-20250514";
const MODEL = "gemini-3.1-flash-lite";

let _client = null;

// export function getClient() {
//   if (!_client) {
//     if (!process.env.OPENAI_API_KEY) {
//       throw new Error("OPENAI_API_KEY is not set");
//     }

//     _client = new OpenAI({
//       apiKey: process.env.OPENAI_API_KEY,
//     });
//   }

//   return _client;
// }



// function getClient() {
//   if (!_client) {
//     if (!process.env.ANTHROPIC_API_KEY) {
//       throw new Error("ANTHROPIC_API_KEY is not set");
//     }
//     _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
//   }
//   return _client;
// }

function getClient() {
  if (!_client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    _client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  return _client;
}

/**
 * @typedef {Object} KpiDefinition
 * @property {string} key
 * @property {string} label
 * @property {string} description
 * @property {number} weight
 */

/**
 * @typedef {Object} EvaluationResult
 * @property {number} overall_score        - 0.0–1.0
 * @property {Record<string, number>} kpi_scores - per-KPI score 0.0–1.0
 * @property {Failure[]} failures
 * @property {string[]} recommendations
 * @property {UseAction[]} use_actions
 */

/**
 * @typedef {Object} Failure
 * @property {string} kpi         - which KPI was failed
 * @property {string} description - what went wrong
 * @property {string} [quote]     - verbatim excerpt from transcript
 * @property {string} [timestamp] - rough position in call (e.g. "00:42")
 * @property {'low'|'medium'|'high'} severity
 */

/**
 * @typedef {Object} UseAction
 * @property {string} description  - what happened that needs human review
 * @property {string} [quote]      - verbatim excerpt
 * @property {'agent_confusion'|'escalation_needed'|'missed_opportunity'|'compliance_risk'} type
 */

const SYSTEM_PROMPT = `You are an expert Voice AI quality analyst. Your job is to evaluate call transcripts against a set of KPIs and an agent script, then return a structured JSON assessment.

RULES:
- Be objective and evidence-based. Every score must be grounded in something the agent actually said or failed to say.
- Score each KPI from 0.0 (complete failure) to 1.0 (excellent).
- overall_score is the weighted average of kpi_scores, using the weights provided.
- failures must reference specific moments in the transcript.
- recommendations must be concrete and actionable — e.g. "Rewrite the objection handling prompt to include the phrase..." not "improve objection handling".
- use_actions are moments where a human agent should have intervened or where the AI confused the prospect.
- Return ONLY valid JSON matching the schema below. No preamble, no markdown fences.

OUTPUT SCHEMA:
{
  "overall_score": number,
  "kpi_scores": { "<kpi_key>": number, ... },
  "failures": [
    {
      "kpi": "<kpi_key>",
      "description": "<what went wrong>",
      "quote": "<short verbatim excerpt or empty string>",
      "timestamp": "<rough time estimate, e.g. 00:45, or empty string>",
      "severity": "low" | "medium" | "high"
    }
  ],
  "recommendations": ["<actionable recommendation>", ...],
  "use_actions": [
    {
      "description": "<what happened>",
      "quote": "<short verbatim excerpt or empty string>",
      "type": "agent_confusion" | "escalation_needed" | "missed_opportunity" | "compliance_risk"
    }
  ]
}`;

/**
 * Evaluate a call transcript against an agent's KPIs and script.
 *
 * @param {object} params
 * @param {string} params.transcript
 * @param {string} params.agentScript
 * @param {KpiDefinition[]} params.kpis
 * @returns {Promise<EvaluationResult>}
 */
// export async function evaluateTranscript({ transcript, agentScript, kpis }) {
//   const client = getClient();

//   const userMessage = buildUserMessage({ transcript, agentScript, kpis });

//   const message = await client.messages.create({
//     model: MODEL,
//     max_tokens: 2048,
//     system: SYSTEM_PROMPT,
//     messages: [{ role: "user", content: userMessage }],
//   });

//   const rawText = message.content
//     .filter((b) => b.type === "text")
//     .map((b) => b.text)
//     .join("");

//   return parseEvaluationResponse(rawText, kpis);
// }
// export async function evaluateTranscript({
//   transcript,
//   agentScript,
//   kpis,
// }) {
//   const client = getClient();

//   const userMessage = buildUserMessage({
//     transcript,
//     agentScript,
//     kpis,
//   });

//   const response = await client.chat.completions.create({
//     model: MODEL,
//     messages: [
//       {
//         role: "system",
//         content: SYSTEM_PROMPT,
//       },
//       {
//         role: "user",
//         content: userMessage,
//       },
//     ],
//     temperature: 0,
//   });

//   const rawText =
//     response.choices[0]?.message?.content ?? "";

//   return parseEvaluationResponse(rawText, kpis);
// }

export async function evaluateTranscript({
  transcript,
  agentScript,
  kpis,
}) {
  const genAI = getClient();

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  });

  const userMessage = buildUserMessage({
    transcript,
    agentScript,
    kpis,
  });

  const result = await model.generateContent(userMessage);

  const response = await result.response;

  const rawText = response.text();

  return parseEvaluationResponse(rawText, kpis);
}

function buildUserMessage({ transcript, agentScript, kpis }) {
  const kpiBlock = kpis
    .map(
      (k) => `- ${k.key} (weight: ${k.weight}): ${k.label}\n  Definition: ${k.description}`
    )
    .join("\n");

  return `AGENT SCRIPT / GOAL:
${agentScript}

KPIs TO EVALUATE (key: label, weight, definition):
${kpiBlock}

CALL TRANSCRIPT:
${transcript}

Evaluate this transcript and return your JSON assessment.`;
}

function parseEvaluationResponse(rawText, kpis) {
  // Strip any accidental markdown fences
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude returned non-JSON response: ${rawText.slice(0, 200)}`);
  }

  // Validate and normalise the shape
  const kpiKeys = new Set(kpis.map((k) => k.key));

  const kpiScores = {};
  for (const k of kpis) {
    const raw = parsed.kpi_scores?.[k.key];
    kpiScores[k.key] = typeof raw === "number" ? clamp(raw) : 0;
  }

  // Compute weighted overall if Claude got it wrong
  const totalWeight = kpis.reduce((s, k) => s + k.weight, 0);
  const weightedSum = kpis.reduce((s, k) => s + kpiScores[k.key] * k.weight, 0);
  const overallScore =
    typeof parsed.overall_score === "number"
      ? clamp(parsed.overall_score)
      : totalWeight > 0
        ? weightedSum / totalWeight
        : 0;

  return {
    overall_score: overallScore,
    kpi_scores: kpiScores,
    failures: (parsed.failures ?? []).map((f) => ({
      kpi: kpiKeys.has(f.kpi) ? f.kpi : "unknown",
      description: String(f.description ?? ""),
      quote: String(f.quote ?? ""),
      timestamp: String(f.timestamp ?? ""),
      severity: ["low", "medium", "high"].includes(f.severity) ? f.severity : "medium",
    })),
    recommendations: (parsed.recommendations ?? []).map(String),
    use_actions: (parsed.use_actions ?? []).map((a) => ({
      description: String(a.description ?? ""),
      quote: String(a.quote ?? ""),
      type: ["agent_confusion", "escalation_needed", "missed_opportunity", "compliance_risk"].includes(
        a.type
      )
        ? a.type
        : "missed_opportunity",
    })),
  };
}

function clamp(n) {
  return Math.max(0, Math.min(1, n));
}
