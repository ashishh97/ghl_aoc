<template>
  <div class="page">
    <PageHeader title="Call log" subtitle="All ingested transcripts and their evaluation status">
      <button class="btn btn-ghost" @click="showIngest = true">+ Ingest transcript</button>
    </PageHeader>

    <!-- Filters -->
    <div class="filters">
      <select v-model="filters.agent_id" class="select" @change="load">
        <option value="">All agents</option>
        <option v-for="a in agentOptions" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
      <select v-model="filters.status" class="select" @change="load">
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="evaluated">Evaluated</option>
        <option value="processing">Processing</option>
        <option value="error">Error</option>
      </select>
      <button class="btn btn-ghost" @click="load">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Refresh
      </button>
      <span class="mono" style="font-size:11px;color:var(--text-3);margin-left:auto">
        {{ total }} call{{ total !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Table -->
    <div v-if="loading && !calls.length" class="skeleton-list">
      <div v-for="i in 6" :key="i" class="skeleton-row" />
    </div>

    <EmptyState v-else-if="!calls.length"
      icon="◌" title="No calls found"
      subtitle="Ingest a transcript or adjust the filters above" />

    <div v-else class="calls-table">
      <div class="table-head">
        <span>Contact</span>
        <span>Agent</span>
        <span>Duration</span>
        <span>Date</span>
        <span>Status</span>
        <span>Score</span>
        <span></span>
      </div>
      <div
        v-for="call in calls" :key="call.id"
        class="table-row"
        @click="$router.push(`/calls/${call.id}`)"
      >
        <div class="contact-cell">
          <div class="contact-name">{{ call.contact_name }}</div>
          <div class="contact-phone mono">{{ call.contact_phone }}</div>
        </div>
        <span class="agent-name-cell">{{ call.agent_name }}</span>
        <span class="mono" style="font-size:12px">{{ formatDuration(call.duration_secs) }}</span>
        <span class="date-cell mono">{{ formatDate(call.occurred_at) }}</span>
        <span class="tag" :class="statusTag(call.status)">{{ call.status }}</span>
        <div class="score-cell">
          <template v-if="call.overall_score != null">
            <div class="score-pill" :style="{ background: scoreColor(call.overall_score) + '22', color: scoreColor(call.overall_score) }">
              {{ Math.round(call.overall_score * 100) }}
            </div>
          </template>
          <span v-else class="mono" style="color:var(--text-3);font-size:12px">—</span>
        </div>
        <svg width="14" height="14" fill="none" stroke="var(--text-3)" stroke-width="1.5" viewBox="0 0 24 24">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="pagination">
      <button class="btn btn-ghost" :disabled="offset === 0" @click="prev">← Prev</button>
      <span class="mono" style="font-size:12px;color:var(--text-2)">
        {{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}
      </span>
      <button class="btn btn-ghost" :disabled="offset + limit >= total" @click="next">Next →</button>
    </div>

    <!-- Ingest modal -->
    <div v-if="showIngest" class="modal-backdrop" @click.self="showIngest = false">
      <div class="modal card">
        <div class="modal-header">
          <h2>Ingest transcript</h2>
          <button class="btn btn-ghost" style="padding:4px 8px" @click="showIngest = false">✕</button>
        </div>
        <div class="form-field">
          <label>Agent</label>
          <select v-model="ingestForm.agent_id" class="select" style="width:100%">
            <option value="">Select an agent…</option>
            <option v-for="a in agentOptions" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
        <div class="form-field">
          <label>Contact name</label>
          <input v-model="ingestForm.contact_name" class="input" placeholder="Jane Smith" />
        </div>
        <div class="form-field">
          <label>Transcript</label>
          <textarea v-model="ingestForm.transcript" class="input" rows="8"
            placeholder="Agent: Hello, this is…&#10;Prospect: Hi, who is this?" />
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showIngest = false">Cancel</button>
          <button class="btn btn-primary" @click="ingest"
            :disabled="!ingestForm.agent_id || !ingestForm.transcript || ingesting">
            {{ ingesting ? 'Ingesting…' : 'Ingest' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api/index.js'
import { useAsync } from '@/composables/useAsync.js'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'

const route  = useRoute()
const router = useRouter()
const { loading, run } = useAsync()

const calls   = ref([])
const total   = ref(0)
const limit   = 20
const offset  = ref(0)

const agentOptions = ref([])
const filters = reactive({
  agent_id: route.query.agent_id ?? '',
  status:   ''
})

const showIngest = ref(false)
const ingesting  = ref(false)
const ingestForm = reactive({ agent_id: filters.agent_id, contact_name: '', transcript: '' })

async function load() {
  await run(async () => {
    const params = { limit, offset: offset.value }
    if (filters.agent_id) params.agent_id = filters.agent_id
    if (filters.status)   params.status   = filters.status
    const res = await api.transcripts.list(params)
    calls.value = res.calls
    total.value = res.total
  })
}

async function loadAgents() {
  try {
    const res = await api.agents.list()
    agentOptions.value = res.agents.map(({ metrics, ...agent }) => agent)
  } catch (e) {
    console.warn('Failed to load agents for filter:', e.message)
  }
}

onMounted(async () => { await loadAgents(); await load() })

function prev() { offset.value = Math.max(0, offset.value - limit); load() }
function next() { offset.value += limit; load() }

async function ingest() {
  ingesting.value = true
  try {
    const res = await api.transcripts.create({ ...ingestForm, occurred_at: new Date().toISOString() })
    showIngest.value = false
    router.push(`/calls/${res.call.id}`)
  } finally { ingesting.value = false }
}

function formatDuration(secs) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function scoreColor(s) {
  if (s >= 0.75) return 'var(--accent)'
  if (s >= 0.5)  return 'var(--warn)'
  return 'var(--danger)'
}
function statusTag(s) {
  return { evaluated: 'tag-green', pending: 'tag-muted', processing: 'tag-info', error: 'tag-danger' }[s] ?? 'tag-muted'
}
</script>

<style scoped>
.page { padding: 32px 36px; max-width: 1000px; }

.filters {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 20px;
}
.select {
  background: var(--bg-1); border: 1px solid var(--border-m);
  border-radius: var(--radius); padding: 7px 12px;
  color: var(--text); font-family: var(--font-ui); font-size: 13px;
  outline: none; cursor: pointer;
}
.select:focus { border-color: var(--accent); }

.calls-table {
  background: var(--bg-1); border: 1px solid var(--border);
  border-radius: var(--radius-lg); overflow: hidden;
}
.table-head {
  display: grid;
  grid-template-columns: 180px 1fr 80px 140px 100px 60px 24px;
  gap: 12px; padding: 10px 16px;
  background: var(--bg-2); border-bottom: 1px solid var(--border);
  font-size: 10px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--text-3);
  font-family: var(--font-mono);
}
.table-row {
  display: grid;
  grid-template-columns: 180px 1fr 80px 140px 100px 60px 24px;
  gap: 12px; padding: 12px 16px; align-items: center;
  border-bottom: 1px solid var(--border);
  cursor: pointer; transition: var(--transition);
}
.table-row:last-child { border-bottom: none; }
.table-row:hover { background: var(--bg-2); }

.contact-name { font-size: 13px; font-weight: 600; }
.contact-phone { font-size: 11px; color: var(--text-3); margin-top: 1px; }
.agent-name-cell { font-size: 12px; color: var(--text-2); }
.date-cell { font-size: 11px; color: var(--text-2); }

.score-pill {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 22px; border-radius: 4px;
  font-size: 12px; font-weight: 600; font-family: var(--font-mono);
}

.pagination {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; padding: 20px 0;
}

/* skeleton */
.skeleton-list { display: flex; flex-direction: column; gap: 2px; }
.skeleton-row {
  height: 52px; border-radius: var(--radius);
  background: var(--bg-1); animation: shimmer 1.4s infinite;
  background-image: linear-gradient(90deg, var(--bg-1) 25%, var(--bg-2) 50%, var(--bg-1) 75%);
  background-size: 200%;
}
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* modal */
.modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:100; }
.modal { width:520px;display:flex;flex-direction:column;gap:14px; }
.modal-header { display:flex;justify-content:space-between;align-items:center; }
.modal-header h2 { font-size:16px;font-weight:700; }
.modal-footer { display:flex;justify-content:flex-end;gap:8px;margin-top:4px; }
.form-field { display:flex;flex-direction:column;gap:6px; }
.form-field label { font-size:12px;color:var(--text-2);font-weight:600; }
.input { background:var(--bg-2);border:1px solid var(--border-m);border-radius:var(--radius);padding:8px 12px;color:var(--text);font-family:var(--font-ui);font-size:13px;outline:none;resize:vertical;transition:border-color var(--transition); }
.input:focus { border-color:var(--accent); }
</style>
