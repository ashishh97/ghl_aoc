<template>
  <div class="page">
    <PageHeader title="Agents" subtitle="Manage Voice AI agents and their KPI definitions">
      <button class="btn btn-primary" @click="showCreate = true">+ New agent</button>
    </PageHeader>

    <div v-if="loading && !agents.length" class="loading-grid">
      <div v-for="i in 3" :key="i" class="skeleton-card" />
    </div>

    <EmptyState v-else-if="!agents.length"
      icon="◉" title="No agents yet"
      subtitle="Create an agent to start monitoring Voice AI call performance">
      <button class="btn btn-primary" style="margin-top:12px" @click="showCreate = true">
        Create first agent
      </button>
    </EmptyState>

    <div v-else class="agents-list">
      <div
        v-for="row in agents" :key="row.agent.id"
        class="agent-row card"
        @click="$router.push(`/agents/${row.agent.id}`)"
      >
        <div class="agent-row-main">
          <ScoreRing :score="row.metrics.avg_score" :size="48" :stroke="4" />
          <div class="agent-row-info">
            <div class="agent-name">{{ row.agent.name }}</div>
            <div class="agent-desc">{{ row.agent.description }}</div>
          </div>
          <div class="agent-row-stats">
            <div class="mini-stat">
              <span class="mono">{{ row.metrics.total_calls }}</span>
              <span>calls</span>
            </div>
            <div class="mini-stat">
              <span class="mono">{{ row.metrics.evaluated_calls }}</span>
              <span>evaluated</span>
            </div>
          </div>
          <div style="margin-left:auto">
            <span v-if="row.metrics.top_failures.length" class="tag tag-danger">
              {{ row.metrics.top_failures.length }} failure types
            </span>
            <span v-else class="tag tag-green">All KPIs passing</span>
          </div>
          <svg width="16" height="16" fill="none" stroke="var(--text-3)" stroke-width="1.5" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Create modal -->
    <div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false">
      <div class="modal card">
        <div class="modal-header">
          <h2>New agent</h2>
          <button class="btn btn-ghost" style="padding:4px 8px" @click="showCreate = false">✕</button>
        </div>
        <div class="form-field">
          <label>Name</label>
          <input v-model="form.name" placeholder="e.g. Appointment Setter" class="input" />
        </div>
        <div class="form-field">
          <label>Description</label>
          <input v-model="form.description" placeholder="What does this agent do?" class="input" />
        </div>
        <div class="form-field">
          <label>Script / Goal</label>
          <textarea v-model="form.script" placeholder="Paste the agent's goal or prompt script…" class="input" rows="6" />
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showCreate = false">Cancel</button>
          <button class="btn btn-primary" @click="createAgent" :disabled="!form.name || creating">
            {{ creating ? 'Creating…' : 'Create agent' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api/index.js'
import { useAsync } from '@/composables/useAsync.js'
import ScoreRing from '@/components/ScoreRing.vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const agents = ref([])
const { loading, run } = useAsync()
const showCreate = ref(false)
const creating = ref(false)
const form = reactive({ name: '', description: '', script: '' })

async function load() {
  await run(async () => {
    const res = await api.agents.list()
    // API returns a flat array: [{ id, name, description, script, metrics, ... }]
    // Normalise into { agent, metrics } shape expected by the template
    agents.value = res.agents.map(({ metrics, ...agent }) => ({ agent, metrics }))
  })
}
onMounted(load)

async function createAgent() {
  if (!form.name) return
  creating.value = true
  try {
    const res = await api.agents.create({ ...form })
    router.push(`/agents/${res.agent.id}`)
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.page { padding: 32px 36px; max-width: 900px; }
.agents-list { display: flex; flex-direction: column; gap: 10px; }
.agent-row { cursor: pointer; transition: var(--transition); }
.agent-row:hover { border-color: var(--border-hi); background: var(--bg-2); }
.agent-row-main {
  display: flex; align-items: center; gap: 16px;
}
.agent-row-info { flex: 1; min-width: 0; }
.agent-name { font-weight: 700; font-size: 14px; }
.agent-desc { font-size: 12px; color: var(--text-2); margin-top: 2px; }
.agent-row-stats { display: flex; gap: 20px; flex-shrink: 0; }
.mini-stat { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.mini-stat span:first-child { font-size: 14px; font-weight: 500; }
.mini-stat span:last-child  { font-size: 10px; color: var(--text-3); }

/* modal */
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.7);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal { width: 520px; display: flex; flex-direction: column; gap: 16px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; }
.modal-header h2 { font-size: 16px; font-weight: 700; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field label { font-size: 12px; color: var(--text-2); font-weight: 600; }
.input {
  background: var(--bg-2); border: 1px solid var(--border-m);
  border-radius: var(--radius); padding: 8px 12px;
  color: var(--text); font-family: var(--font-ui); font-size: 13px;
  outline: none; resize: vertical;
  transition: border-color var(--transition);
}
.input:focus { border-color: var(--accent); }

.loading-grid { display: flex; flex-direction: column; gap: 10px; }
.skeleton-card { height: 72px; border-radius: var(--radius-lg); background: var(--bg-1); animation: shimmer 1.4s infinite; background-size: 200%; background-image: linear-gradient(90deg, var(--bg-1) 25%, var(--bg-2) 50%, var(--bg-1) 75%); }
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
</style>
