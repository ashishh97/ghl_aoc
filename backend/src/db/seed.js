/**
 * Seed script — populates the DB with realistic demo data.
 * Run: node src/db/seed.js
 */
import { getDb } from "./database.js";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "../../data");
fs.mkdirSync(dataDir, { recursive: true });

const db = getDb();

const AGENTS = [
  {
    id: "agent-001",
    name: "Appointment Setter",
    description: "Books discovery calls for the sales team",
    script: `You are a friendly appointment setter for Apex Solar Solutions.
Goal: Book a 15-minute discovery call with a qualified homeowner.
Steps:
1. Greet warmly and introduce yourself
2. Qualify: homeowner? own or rent? interested in solar?
3. Handle objections empathetically
4. Offer two time slots for the discovery call
5. Confirm name, email, and phone
6. Thank and close the call`,
    kpis: JSON.stringify([
      "greeting_quality",
      "qualification_completion",
      "objection_handling",
      "appointment_booked",
      "contact_info_captured",
    ]),
  },
  {
    id: "agent-002",
    name: "Lead Qualifier",
    description: "Qualifies inbound leads before handing off to sales",
    script: `You are a lead qualification agent for Pinnacle Roofing.
Goal: Score the lead as hot/warm/cold and capture BANT info.
Steps:
1. Greet and confirm you reached the right person
2. Budget: do they have funds available or financing interest?
3. Authority: are they the decision maker?
4. Need: what's the roofing problem or goal?
5. Timeline: when are they looking to start?
6. Summarise and set expectations for next steps`,
    kpis: JSON.stringify([
      "greeting_quality",
      "budget_probed",
      "authority_confirmed",
      "need_identified",
      "timeline_captured",
      "lead_scored",
    ]),
  },
];

const KPI_DEFINITIONS = {
  "agent-001": [
    {
      key: "greeting_quality",
      label: "Greeting quality",
      description: "Agent introduced themselves clearly and warmly within the first 15 seconds",
      weight: 0.8,
    },
    {
      key: "qualification_completion",
      label: "Qualification completion",
      description: "Agent confirmed homeowner status and solar interest before pitching",
      weight: 1.2,
    },
    {
      key: "objection_handling",
      label: "Objection handling",
      description: "Agent addressed objections empathetically with a relevant response rather than pushing",
      weight: 1.5,
    },
    {
      key: "appointment_booked",
      label: "Appointment booked",
      description: "A specific date/time was confirmed for the discovery call",
      weight: 2.0,
    },
    {
      key: "contact_info_captured",
      label: "Contact info captured",
      description: "Agent confirmed name, email, and phone before ending the call",
      weight: 1.0,
    },
  ],
  "agent-002": [
    {
      key: "greeting_quality",
      label: "Greeting quality",
      description: "Agent confirmed they reached the right contact",
      weight: 0.8,
    },
    {
      key: "budget_probed",
      label: "Budget probed",
      description: "Agent asked about budget availability or financing interest",
      weight: 1.2,
    },
    {
      key: "authority_confirmed",
      label: "Authority confirmed",
      description: "Agent confirmed the contact is a decision maker",
      weight: 1.5,
    },
    {
      key: "need_identified",
      label: "Need identified",
      description: "Agent identified the specific roofing problem or goal",
      weight: 1.5,
    },
    {
      key: "timeline_captured",
      label: "Timeline captured",
      description: "Agent asked when they are looking to start",
      weight: 1.0,
    },
    {
      key: "lead_scored",
      label: "Lead scored",
      description: "Agent summarised findings and categorised the lead",
      weight: 1.5,
    },
  ],
};

const SAMPLE_TRANSCRIPTS = [
  {
    agentId: "agent-001",
    contactName: "James Holloway",
    contactPhone: "+15551230001",
    durationSecs: 187,
    occurredAt: "2025-05-15T10:22:00Z",
    transcript: `Agent: Hi there, this is Alex calling from Apex Solar Solutions. Am I speaking with James?
Prospect: Yeah, that's me. What's this about?
Agent: Great James! I'm reaching out because many homeowners in your area have been saving significantly on their electric bills with solar. Quick question — do you own your home?
Prospect: Yeah I do, but I'm not sure I'm interested in solar right now.
Agent: Totally understand, and I'm not here to sell you anything today. A lot of people feel that way before they see the numbers. Can I ask — are your electricity bills higher than you'd like?
Prospect: Well yeah, who isn't? They've been going up every month.
Agent: Exactly, you're not alone. Many homeowners are surprised to find they can lock in a lower rate for 25 years. Would it be worth 15 minutes to just see what the numbers look like for your specific home?
Prospect: I guess 15 minutes wouldn't hurt.
Agent: Perfect. I have openings this Thursday at 2 PM or Friday at 10 AM — which works better for you?
Prospect: Thursday works.
Agent: Great! And just to confirm, your name is James Holloway — can I get your email and best callback number?
Prospect: Sure, it's james.holloway@gmail.com and this number is fine.
Agent: Wonderful. You're all set for Thursday at 2 PM, James. Our solar consultant will walk you through everything. Have a great day!
Prospect: You too, thanks.`,
  },
  {
    agentId: "agent-001",
    contactName: "Maria Chen",
    contactPhone: "+15551230002",
    durationSecs: 94,
    occurredAt: "2025-05-15T11:05:00Z",
    transcript: `Agent: Hello, is this Maria?
Prospect: Yes?
Agent: Hi Maria, I'm calling about solar panels for your home. Are you interested?
Prospect: Not really, no.
Agent: Oh okay, well solar can save you a lot of money. Do you want to schedule a call?
Prospect: I said I'm not interested.
Agent: Are you sure? We have great deals right now.
Prospect: Please don't call again.
Agent: Okay, sorry to bother you. Bye.`,
  },
  {
    agentId: "agent-001",
    contactName: "Derek Osei",
    contactPhone: "+15551230003",
    durationSecs: 243,
    occurredAt: "2025-05-15T14:30:00Z",
    transcript: `Agent: Good afternoon! This is Alex from Apex Solar Solutions. Am I speaking with Derek Osei?
Prospect: Yes, speaking.
Agent: Hi Derek, I'm reaching out because we've been helping homeowners in your zip code eliminate their electric bills through solar. Do you own your home?
Prospect: I do, yes. I've actually been thinking about solar lately.
Agent: That's great timing! A lot of our clients were in exactly that spot — curious but not sure where to start. What's been making you think about it?
Prospect: My bills have been insane. Last month was over $300.
Agent: $300 a month — that's a significant expense. Most of our clients in similar situations end up paying $0 on their electric bill after going solar, and many get a tax credit too. Would it be valuable to get a free assessment for your home specifically?
Prospect: Yeah, I'd be open to that.
Agent: Perfect. I have Thursday at 3 PM or Monday at 11 AM available for a quick 15-minute Zoom. Which works better?
Prospect: Monday's better for me.
Agent: Excellent. Just to confirm — Derek Osei, and what's the best email for the calendar invite?
Prospect: derek.osei@yahoo.com
Agent: Got it. You're booked for Monday at 11 AM. Our energy consultant will walk you through the numbers — no obligation at all. Anything else before I let you go?
Prospect: No, that's great. Thanks a lot.
Agent: Thank you Derek, enjoy your afternoon!`,
  },
  {
    agentId: "agent-002",
    contactName: "Sandra Bloom",
    contactPhone: "+15551230010",
    durationSecs: 210,
    occurredAt: "2025-05-16T09:15:00Z",
    transcript: `Agent: Hi, is this Sandra Bloom?
Prospect: Speaking.
Agent: Hi Sandra, I'm calling from Pinnacle Roofing. You submitted a request on our website about a roof inspection — is this a good time?
Prospect: Sure, go ahead.
Agent: Great. So just to understand your situation better — what's going on with your roof right now?
Prospect: We've got some shingles that came off in the last storm and there's a small leak in the corner of one bedroom.
Agent: That sounds urgent. Have you had anyone look at it yet?
Prospect: No, you're the first call I've made.
Agent: Good thing you called. Just a couple of quick questions — are you the homeowner and decision maker on this?
Prospect: Yes, my husband and I own the house together but I handle this stuff.
Agent: Perfect. And roughly do you have a budget in mind, or would you need to know the scope of work first?
Prospect: I'd need to see what we're dealing with. We have some savings set aside for home repairs — probably $5 to $10k.
Agent: That's helpful context. And timeline — is this something urgent given the leak, or are you planning for later in the season?
Prospect: Urgent, definitely. We had to put a bucket down.
Agent: Understood. Sandra, based on what you've told me — urgent leak, active damage, clear decision authority, and budget in place — I'm going to flag you as a priority lead for our project manager. You can expect a call within the next two hours to schedule an on-site assessment. Does that work?
Prospect: Yes, that would be amazing.
Agent: You're all set. Thanks for your time Sandra, and we'll get this sorted out for you.`,
  },
  {
    agentId: "agent-002",
    contactName: "Tom Briggs",
    contactPhone: "+15551230011",
    durationSecs: 145,
    occurredAt: "2025-05-16T10:40:00Z",
    transcript: `Agent: Hi, can I speak with Tom Briggs?
Prospect: Yeah that's me.
Agent: Hi Tom, calling from Pinnacle Roofing about your inquiry. So what's the issue with your roof?
Prospect: It's pretty old. Maybe 20 years. Thinking about replacing it at some point.
Agent: Got it. Do you have a budget for that?
Prospect: Not yet, still figuring it out.
Agent: Okay. Are you looking to do this soon?
Prospect: Probably next year maybe. No rush.
Agent: Alright, I'll have someone reach out when you're closer to ready.
Prospect: Sure.
Agent: Okay thanks.`,
  },
];

// --- Run seed ---

console.log("🌱 Seeding database...");

const insertAgent = db.prepare(`
  INSERT OR REPLACE INTO agents (id, name, description, script, kpis)
  VALUES (@id, @name, @description, @script, @kpis)
`);

const insertKpi = db.prepare(`
  INSERT OR REPLACE INTO kpi_definitions (id, agent_id, key, label, description, weight)
  VALUES (@id, @agent_id, @key, @label, @description, @weight)
`);

const insertCall = db.prepare(`
  INSERT OR REPLACE INTO calls (id, agent_id, contact_name, contact_phone, duration_secs, transcript, status, occurred_at)
  VALUES (@id, @agent_id, @contact_name, @contact_phone, @duration_secs, @transcript, @status, @occurred_at)
`);

const seedTx = db.transaction(() => {
  for (const agent of AGENTS) {
    insertAgent.run(agent);
    console.log(`  ✓ Agent: ${agent.name}`);

    for (const kpi of KPI_DEFINITIONS[agent.id]) {
      insertKpi.run({
        id: randomUUID(),
        agent_id: agent.id,
        ...kpi,
      });
    }
  }

  for (const call of SAMPLE_TRANSCRIPTS) {
    insertCall.run({
      id: randomUUID(),
      agent_id: call.agentId,
      contact_name: call.contactName,
      contact_phone: call.contactPhone,
      duration_secs: call.durationSecs,
      transcript: call.transcript,
      status: "pending",
      occurred_at: call.occurredAt,
    });
    console.log(`  ✓ Call: ${call.contactName}`);
  }
});

seedTx();

console.log("\n✅ Seed complete. Run `npm run dev` to start the server.");
