<template>
  <div class="page">
    <div class="breadcrumb">
      <router-link to="/calls">Call log</router-link>
      <span>›</span>
      <span>{{ call?.contact_name ?? '…' }}</span>
    </div>

    <div v-if="loading && !call" class="skeleton-block">
      <div class="skeleton" style="height:28px;width:220px" />
      <div class="skeleton" style="height:16px;width:340px;margin-top:8px" />
    </div>

    <template v-else-if="call">
      <PageHeader :title="call.contact_name" :subtitle="call.agent_name">
        <span class="tag" :class="statusTag(call.status)">{{ call.status }}</span>
        <button
          v-if="call.status !== 'evaluated' || true"
          class="btn btn-primary"
          @click="evaluate"
          :disabled="evaluating"
        >
          {{ evaluating ? 'Evaluating…' : call.status === 'evaluated' ? '↺ Re-evaluate' : '▶ Evaluate' }}
        </button>
      </PageHeader>

      <!-- Meta strip -->
      <div class="meta-strip">
        <div class="meta-item">
          <span class="meta-label">Duration</span>
          <span class="mono">{{ formatDuration(call.duration_secs) }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Phone</span>
          <span class="mono">{{ call.contact_phone || '—' }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Date</span>
          <span class="mono">{{ formatDate(call.occurred_at) }}</span>
        </div>
        <div v-if="evaluation" class="meta-item">
          <span class="meta-label">Evaluated</span>
          <span class="mono">{{ formatDate(evaluation.evaluated_at) }}</span>
        </div>
      </div>

      <div class="layout">

        <!-- LEFT: transcript + use actions -->
        <div class="col-main">
          <!-- Use actions callouts (if any) -->
          <div v-if="evaluation?.use_actions?.length" class="use-actions-block">
            <div class="use-actions-header">
              <svg width="14" height="14" fill="none" stroke="var(--warn)" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style="font-size:12px;font-weight:700;color:var(--warn)">Use Actions — Human intervention flagged</span>
            </div>
            <div v-for="(ua, i) in evaluation.use_actions" :key="i" class="use-action-item">
              <span class="tag tag-warn" style="flex-shrink:0">{{ formatType(ua.type) }}</span>
              <div class="use-action-body">
                <div class="use-action-desc">{{ ua.description }}</div>
                <blockquote v-if="ua.quote" class="quote mono">"{{ ua.quote }}"</blockquote>
              </div>
            </div>
          </div>

          <!-- Transcript -->
          <div class="transcript-card card">
            <div class="section-label" style="margin-bottom:14px">Transcript</div>
            <div class="transcript-body">
              <div
                v-for="(line, i) in parsedTranscript"
                :key="i"
                class="transcript-line"
                :class="line.speaker === 'Agent' ? 'line-agent' : 'line-prospect'"
              >
                <span class="speaker-tag mono">{{ line.speaker }}</span>
                <span class="line-text">{{ line.text }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: score + KPIs + failures + recommendations -->
        <div class="col-side">

          <!-- Overall score -->
          <div v-if="evaluation" class="score-card card">
            <div class="score-card-inner">
              <ScoreRing :score="evaluation.overall_score" :size="80" :stroke="7" />
              <div>
                <div class="score-label">Overall score</div>
                <div class="score-sub">{{ scoreVerdict(evaluation.overall_score) }}</div>
              </div>
            </div>
          </div>

          <!-- Evaluating spinner -->
          <div v-else-if="evaluating" class="card eval-pending">
            <div class="spinner" />
            <span style="font-size:13px;color:var(--text-2)">Analysing with Claude…</span>
          </div>

          <!-- No eval yet -->
          <div v-else class="card eval-pending" style="cursor:pointer" @click="evaluate">
            <div style="font-size:28px;color:var(--text-3)">◌</div>
            <span style="font-size:13px;color:var(--text-2)">Click Evaluate to analyse this call</span>
          </div>

          <!-- KPI scores -->
          <div v-if="evaluation && kpis.length" class="card" style="margin-top:14px">
            <div class="section-label" style="margin-bottom:14px">KPI scores</div>
            <div class="kpi-list">
              <div v-for="kpi in kpis" :key="kpi.key">
                <KpiBar :label="kpi.label" :score="evaluation.kpi_scores[kpi.key] ?? 0" />
              </div>
            </div>
          </div>

          <!-- Failures -->
          <div v-if="evaluation?.failures?.length" class="card" style="margin-top:14px">
            <div class="failures-header">
              <div class="section-label">Failures detected</div>
              <span class="tag tag-danger">{{ evaluation.failures.length }}</span>
            </div>
            <div class="failure-list">
              <div v-for="(f, i) in evaluation.failures" :key="i" class="failure-item">
                <div class="failure-top">
                  <SeverityTag :severity="f.severity" />
                  <span class="failure-kpi-name">{{ formatKey(f.kpi) }}</span>
                  <span v-if="f.timestamp" class="mono" style="font-size:10px;color:var(--text-3);margin-left:auto">{{ f.timestamp }}</span>
                </div>
                <p class="failure-desc">{{ f.description }}</p>
                <blockquote v-if="f.quote" class="quote mono">"{{ f.quote }}"</blockquote>
              </div>
            </div>
          </div>

          <!-- Recommendations -->
          <div v-if="evaluation?.recommendations?.length" class="card" style="margin-top:14px">
            <div class="section-label" style="margin-bottom:14px">AI recommendations</div>
            <div class="rec-list">
              <div v-for="(r, i) in evaluation.recommendations" :key="i" class="rec-item">
                <div class="rec-num mono">{{ String(i + 1).padStart(2, '0') }}</div>
                <p class="rec-text">{{ r }}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/api/index.js'
import { useAsync } from '@/composables/useAsync.js'
import ScoreRing from '@/components/ScoreRing.vue'
import KpiBar from '@/components/KpiBar.vue'
import SeverityTag from '@/components/SeverityTag.vue'
import PageHeader from '@/components/PageHeader.vue'

const route = useRoute()
const { loading, run } = useAsync()

const call       = ref(null)
const evaluation = ref(null)
const kpis       = ref([])
const evaluating = ref(false)

async function load() {
  await run(async () => {
    const res = await api.transcripts.get(route.params.id)
    call.value       = res.call
    evaluation.value = res.evaluation
    kpis.value       = res.kpis
  })
}
onMounted(load)

async function evaluate() {
  evaluating.value = true
  try {
    const force = call.value?.status === 'evaluated'
    const res = await api.analyze.evaluateCall(route.params.id, force)
    evaluation.value = res.evaluation
    call.value.status = 'evaluated'
  } catch (e) {
    alert('Evaluation failed: ' + e.message)
  } finally {
    evaluating.value = false
  }
}

// Parse "Agent: ..." / "Prospect: ..." lines into structured objects
const parsedTranscript = computed(() => {
  if (!call.value?.transcript) return []
  return call.value.transcript
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const m = line.match(/^(Agent|Prospect|Caller|Customer|Rep|AI):\s*(.+)/i)
      if (m) return { speaker: m[1], text: m[2] }
      return { speaker: '—', text: line }
    })
})

function formatDuration(secs) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function scoreColor(s) {
  if (s >= 0.75) return 'var(--accent)'
  if (s >= 0.5)  return 'var(--warn)'
  return 'var(--danger)'
}
function scoreVerdict(s) {
  if (s >= 0.85) return 'Excellent call'
  if (s >= 0.7)  return 'Good performance'
  if (s >= 0.5)  return 'Needs improvement'
  return 'Poor — review required'
}
function statusTag(s) {
  return { evaluated:'tag-green', pending:'tag-muted', processing:'tag-info', error:'tag-danger' }[s] ?? 'tag-muted'
}
function formatKey(k) { return (k ?? '').replace(/_/g, ' ') }
function formatType(t) {
  return { agent_confusion:'Agent confused', escalation_needed:'Escalation needed', missed_opportunity:'Missed opportunity', compliance_risk:'Compliance risk' }[t] ?? t
}
</script>

<style scoped>
.page { padding: 32px 36px; max-width: 1080px; }
.breadcrumb {
  display: flex; gap: 8px; font-size: 12px; color: var(--text-3);
  margin-bottom: 16px; align-items: center;
}
.breadcrumb a:hover { color: var(--text); }

.meta-strip {
  display: flex; gap: 28px; margin-bottom: 24px;
  padding: 12px 16px; background: var(--bg-1);
  border: 1px solid var(--border); border-radius: var(--radius);
}
.meta-item { display: flex; flex-direction: column; gap: 2px; }
.meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-3); font-family: var(--font-mono); }
.meta-item .mono { font-size: 13px; }

.layout { display: grid; grid-template-columns: 1fr 320px; gap: 20px; }

/* use actions */
.use-actions-block {
  background: var(--warn-bg); border: 1px solid #ffb34730;
  border-radius: var(--radius-lg); padding: 14px 16px;
  margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px;
}
.use-actions-header { display: flex; align-items: center; gap: 8px; }
.use-action-item { display: flex; gap: 10px; align-items: flex-start; }
.use-action-body { display: flex; flex-direction: column; gap: 4px; }
.use-action-desc { font-size: 12px; line-height: 1.4; }

/* transcript */
.transcript-card { }
.transcript-body { display: flex; flex-direction: column; gap: 10px; }
.transcript-line { display: flex; gap: 10px; align-items: flex-start; }
.speaker-tag {
  font-size: 10px; font-weight: 500; padding: 2px 7px;
  border-radius: 4px; flex-shrink: 0; margin-top: 1px;
  text-transform: uppercase; letter-spacing: .05em;
  width: 70px; text-align: center;
}
.line-agent   .speaker-tag { background: var(--accent-bg); color: var(--accent); border: 1px solid #4fffb025; }
.line-prospect .speaker-tag { background: var(--bg-3); color: var(--text-2); border: 1px solid var(--border); }
.line-text { font-size: 13px; line-height: 1.55; padding-top: 1px; }

/* score card */
.score-card { }
.score-card-inner { display: flex; align-items: center; gap: 16px; }
.score-label { font-size: 15px; font-weight: 700; }
.score-sub { font-size: 12px; color: var(--text-2); margin-top: 3px; }

.eval-pending {
  display: flex; flex-direction: column; align-items: center;
  gap: 10px; padding: 32px; text-align: center;
}
.spinner {
  width: 28px; height: 28px; border: 2px solid var(--border-hi);
  border-top-color: var(--accent); border-radius: 50%;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* KPI list */
.kpi-list { display: flex; flex-direction: column; gap: 12px; }

/* failures */
.failures-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.failure-list { display: flex; flex-direction: column; gap: 10px; }
.failure-item {
  padding: 10px 12px; border-radius: var(--radius);
  background: var(--danger-bg); border: 1px solid #ff575720;
  display: flex; flex-direction: column; gap: 5px;
}
.failure-top { display: flex; align-items: center; gap: 8px; }
.failure-kpi-name { font-size: 12px; font-weight: 600; }
.failure-desc { font-size: 12px; color: var(--text-2); line-height: 1.4; }

/* quote */
.quote {
  font-size: 11px; color: var(--text-3);
  border-left: 2px solid var(--border-hi);
  padding-left: 8px; margin-top: 2px; line-height: 1.5;
}

/* recommendations */
.rec-list { display: flex; flex-direction: column; gap: 12px; }
.rec-item { display: flex; gap: 12px; align-items: flex-start; }
.rec-num {
  font-size: 11px; color: var(--accent); font-weight: 500;
  min-width: 24px; padding-top: 1px;
}
.rec-text { font-size: 12px; color: var(--text-2); line-height: 1.55; }

/* skeleton */
.skeleton-block { display: flex; flex-direction: column; gap: 8px; }
.skeleton {
  background: var(--bg-1); border-radius: 6px;
  animation: shimmer 1.4s infinite;
  background-image: linear-gradient(90deg, var(--bg-1) 25%, var(--bg-2) 50%, var(--bg-1) 75%);
  background-size: 200%;
}
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
</style>
