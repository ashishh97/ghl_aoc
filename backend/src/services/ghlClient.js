/**
 * ghlClient.js
 * Thin wrapper around the HighLevel v1 REST API.
 * All methods return plain JS objects. Errors throw with a .status property.
 */

const BASE_URL = process.env.GHL_BASE_URL || "https://services.leadconnectorhq.com";
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const API_KEY = process.env.GHL_API_KEY;

class GHLError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "GHLError";
    this.status = status;
  }
}

async function request(path, options = {}) {
  if (!API_KEY) throw new GHLError("GHL_API_KEY is not set", 500);

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new GHLError(`GHL API error ${res.status}: ${body}`, res.status);
  }

  return res.json();
}

/**
 * Fetch a page of conversations for the location.
 * @param {object} params - query params (limit, page, etc.)
 */
export async function listConversations(params = {}) {
  const qs = new URLSearchParams({
    locationId: LOCATION_ID,
    limit: "20",
    ...params,
  });
  return request(`/conversations/?${qs}`);
}

/**
 * Fetch messages (including transcript text) for one conversation.
 */
export async function getConversationMessages(conversationId) {
  return request(`/conversations/${conversationId}/messages`);
}

/**
 * Fetch all call recordings for a location.
 * GHL stores these under conversations as type=activity_call.
 */
export async function listCalls(params = {}) {
  const qs = new URLSearchParams({
    locationId: LOCATION_ID,
    type: "activity_call",
    limit: "20",
    ...params,
  });
  return request(`/conversations/?${qs}`);
}

/**
 * Fetch contact info.
 */
export async function getContact(contactId) {
  return request(`/contacts/${contactId}`);
}

/**
 * Pull transcripts from GHL and normalise them into our internal shape.
 * Returns an array of { ghlCallId, contactName, contactPhone, transcript, occurredAt, durationSecs }.
 *
 * NOTE: GHL's Voice AI transcript API is still evolving. In production this
 * would poll /conversations with type=call and extract the AI transcript body.
 * For the sandbox demo we fall back to the mock data if GHL returns nothing.
 */
export async function fetchRecentTranscripts(limit = 10) {
  try {
    const data = await listCalls({ limit: String(limit) });
    const conversations = data.conversations ?? [];

    const transcripts = [];
    for (const conv of conversations) {
      if (!conv.lastMessageBody) continue;

      // Only process conversations that have a transcript-like body
      const messages = await getConversationMessages(conv.id).catch(() => null);
      if (!messages) continue;

      const transcriptLines = (messages.messages ?? [])
        .filter((m) => m.type === "activity_call" && m.body)
        .map((m) => m.body)
        .join("\n");

      if (!transcriptLines) continue;

      transcripts.push({
        ghlCallId: conv.id,
        contactName: conv.contactName ?? "Unknown",
        contactPhone: conv.phone ?? "",
        transcript: transcriptLines,
        occurredAt: conv.dateAdded ?? new Date().toISOString(),
        durationSecs: conv.callDuration ?? 0,
      });
    }

    return transcripts;
  } catch (err) {
    // If GHL creds aren't configured, return empty — seed data covers the demo
    if (err.status === 500 || err.status === 401) return [];
    throw err;
  }
}
