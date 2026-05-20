<template>
  <div class="page">
    <div v-if="loading && !agent" class="loading-block">
      <div class="skeleton" style="height:32px;width:200px" />
      <div class="skeleton" style="height:16px;width:300px;margin-top:8px" />
    </div>

    <template v-else-if="agent">
      <div class="breadcrumb">
        <router-link to="/agents">Agents</router-link>
        <span>›</span>
        <span>{{ agent.name }}</span>
      </div>

      <PageHeader :title="agent.name" :subtitle="agent.description">
        <button class="btn btn-ghost" @click="loadCalls('/calls?agent_id=' + agent.id)">View calls</button>
        <button class="btn btn-primary" @click="batchEvaluate" :disabled="evaluating">
          {{ evaluating ? 'Evaluating…' : '▶ Evaluate pending' }}
        </button>
      </PageHeader>

      <!-- Batch result banner -->
      <transition name="fade">
        <div v-if="batchResult" class="banner" :class="batchResult.errors.length ? 'banner-warn' : 'banner-ok'">
          Evaluated {{ batchResult.evaluated }} call(s).
          <span v-if="batchResult.errors.length">{{ batchResult.errors.length }} error(s).</span>
          <button class="banner-close" @click="batchResult = null">✕</button>
        </div>
      </transition>

      <div class="layout">
        <!-- Left column: metrics -->
        <div class="col-main">
          <!-- Stat strip -->
          <div class="metrics-strip card">
            <div class="met">
              <ScoreRing :score="metrics.avg_score" :size="72" :stroke="6" />
              <div>
                <div class="met-label">Avg score</div>
                <div class="met-sub">across {{ metrics.evaluated_calls }} calls</div>
              </div>
            </div>
            <div class="met-divider" />
            <div class="met-col">
              <div class="met-stat">
                <span class="mono">{{ metrics.total_calls }}</span>
                <span>Total calls</span>
              </div>
              <div class="met-stat">
                <span class="mono" style="color:var(--warn)">{{ metrics.total_calls - metrics.evaluated_calls }}</span>
                <span>Pending eval</span>
              </div>
            </div>
          </div>

          <!-- KPI score breakdown -->
          <div v-if="Object.keys(metrics.avg_kpi_scores).length" class="card" style="margin-top:16px">
            <div class="section-label" style="margin-bottom:14px">KPI performance</div>
            <div class="kpi-grid">
              <div v-for="kpi in kpis" :key="kpi.key">
                <KpiBar
                  :label="kpi.label"
                  :score="metrics.avg_kpi_scores[kpi.key] ?? 0"
                />
                <div class="kpi-def">{{ kpi.description }}</div>
              </div>
            </div>
          </div>

          <!-- Top failure KPIs -->
          <div v-if="metrics.top_failures.length" class="card" style="margin-top:16px">
            <div class="section-label" style="margin-bottom:14px">Most failed KPIs</div>
            <div class="failure-kpi-list">
              <div v-for="f in metrics.top_failures" :key="f.kpi" class="failure-kpi-row">
                <span class="failure-kpi-name">{{ formatKey(f.kpi) }}</span>
                <div class="failure-kpi-bar-wrap">
                  <div class="failure-kpi-bar" :style="{ width: (f.count / metrics.top_failures[0].count * 100) + '%' }" />
                </div>
                <span class="mono" style="font-size:12px;color:var(--danger)">{{ f.count }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right column: KPI config + script -->
        <div class="col-side">
          <!-- KPI definitions -->
          <div class="card">
            <div class="kpi-header">
              <span class="section-label">KPI definitions</span>
              <button class="btn btn-ghost" style="padding:4px 10px;font-size:12px" @click="showAddKpi = true">+ Add</button>
            </div>
            <EmptyState v-if="!kpis.length" icon="◌" title="No KPIs" subtitle="Add KPIs to start evaluating this agent" />
            <div v-else class="kpi-def-list">
              <div v-for="kpi in kpis" :key="kpi.id" class="kpi-def-item">
                <div class="kpi-def-top">
                  <span class="kpi-def-label">{{ kpi.label }}</span>
                  <div class="kpi-def-actions">
                    <span class="tag tag-muted mono">w:{{ kpi.weight }}</span>
                    <button class="icon-btn" @click="deleteKpi(kpi.id)" title="Delete KPI">✕</button>
                  </div>
                </div>
                <span class="kpi-def-key mono">{{ kpi.key }}</span>
                <p class="kpi-def-desc">{{ kpi.description }}</p>
              </div>
            </div>
          </div>

          <!-- Agent script -->
          <div class="card" style="margin-top:16px">
            <div class="section-label" style="margin-bottom:10px">Agent script</div>
            <textarea
              v-model="editScript"
              class="script-editor"
              rows="12"
              placeholder="Paste the agent goal / prompt script here…"
            />
            <button
              class="btn btn-ghost" style="margin-top:8px;width:100%"
              @click="saveScript" :disabled="savingScript"
            >
              {{ savingScript ? 'Saving…' : 'Save script' }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Add KPI modal -->
    <div v-if="showAddKpi" class="modal-backdrop" @click.self="showAddKpi = false">
      <div class="modal card">
        <div class="modal-header">
          <h2>Add KPI</h2>
          <button class="btn btn-ghost" style="padding:4px 8px" @click="showAddKpi = false">✕</button>
        </div>
        <div class="form-field">
          <label>Key (snake_case)</label>
          <input v-model="kpiForm.key" placeholder="e.g. objection_handling" class="input" />
        </div>
        <div class="form-field">
          <label>Label</label>
          <input v-model="kpiForm.label" placeholder="e.g. Objection handling" class="input" />
        </div>
        <div class="form-field">
          <label>Definition</label>
          <textarea v-model="kpiForm.description" placeholder="What must the agent do to pass this KPI?" class="input" rows="3" />
        </div>
        <div class="form-field">
          <label>Weight (importance multiplier)</label>
          <input v-model.number="kpiForm.weight" type="number" min="0.1" max="5" step="0.1" class="input" />
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showAddKpi = false">Cancel</button>
          <button class="btn btn-primary" @click="addKpi" :disabled="!kpiForm.key || !kpiForm.label">
            Add KPI
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
import ScoreRing from '@/components/ScoreRing.vue'
import KpiBar from '@/components/KpiBar.vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'

const route  = useRoute()
const router = useRouter()
const { loading, run } = useAsync()

const agent   = ref(null)
const kpis    = ref([])
const metrics = ref({ avg_score:0, total_calls:0, evaluated_calls:0, avg_kpi_scores:{}, top_failures:[], score_trend:[] })

const evaluating  = ref(false)
const batchResult = ref(null)
const editScript  = ref('')
const savingScript= ref(false)
const showAddKpi  = ref(false)
const kpiForm = reactive({ key:'', label:'', description:'', weight:1.0 })

async function load() {
  await run(async () => {
    const res = await api.agents.get(route.params.id)
    agent.value   = res.agent
    kpis.value    = res.kpis
    metrics.value = res.metrics
    editScript.value = res.agent.script ?? ''
  })
}
onMounted(load)

async function batchEvaluate() {
  evaluating.value = true
  batchResult.value = null
  try {
    const res = await api.analyze.evaluateAgent(route.params.id)
    batchResult.value = res.summary
    await load()
  } finally { evaluating.value = false }
}

async function saveScript() {
  savingScript.value = true
  try { await api.agents.update(route.params.id, { script: editScript.value }) }
  finally { savingScript.value = false }
}

async function addKpi() {
  await api.agents.kpis.create(route.params.id, { ...kpiForm })
  showAddKpi.value = false
  Object.assign(kpiForm, { key:'', label:'', description:'', weight:1.0 })
  await load()
}

async function deleteKpi(kpiId) {
  if (!confirm('Delete this KPI? Existing evaluations will retain the old data.')) return
  await api.agents.kpis.delete(route.params.id, kpiId)
  await load()
}

function formatKey(k) { return k.replace(/_/g, ' ') }
function loadCalls(path) { router.push(path) }
</script>

<style scoped>
.page { padding: 32px 36px; max-width: 1080px; }
.breadcrumb {
  display: flex; gap: 8px; font-size: 12px; color: var(--text-3);
  margin-bottom: 16px; align-items: center;
}
.breadcrumb a:hover { color: var(--text); }

.layout { display: grid; grid-template-columns: 1fr 340px; gap: 20px; }

.metrics-strip { display: flex; align-items: center; gap: 24px; }
.met { display: flex; align-items: center; gap: 16px; }
.met-label { font-size: 13px; font-weight: 600; }
.met-sub { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.met-divider { width: 1px; height: 48px; background: var(--border); }
.met-col { display: flex; gap: 24px; }
.met-stat { display: flex; flex-direction: column; gap: 2px; }
.met-stat span:first-child { font-size: 20px; font-weight: 500; }
.met-stat span:last-child  { font-size: 11px; color: var(--text-3); }

.kpi-grid { display: flex; flex-direction: column; gap: 14px; }
.kpi-def { font-size: 11px; color: var(--text-3); margin-top: 3px; line-height: 1.4; }

.failure-kpi-list { display: flex; flex-direction: column; gap: 10px; }
.failure-kpi-row { display: flex; align-items: center; gap: 12px; }
.failure-kpi-name { font-size: 12px; color: var(--text-2); width: 140px; flex-shrink: 0; }
.failure-kpi-bar-wrap { flex: 1; height: 4px; background: var(--bg-3); border-radius: 2px; overflow: hidden; }
.failure-kpi-bar { height: 100%; background: var(--danger); border-radius: 2px; transition: width 700ms; }

/* KPI config panel */
.kpi-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.kpi-def-list { display: flex; flex-direction: column; gap: 10px; }
.kpi-def-item {
  padding: 10px 12px; border-radius: var(--radius);
  background: var(--bg-2); border: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 3px;
}
.kpi-def-top { display: flex; justify-content: space-between; align-items: center; }
.kpi-def-label { font-size: 13px; font-weight: 600; }
.kpi-def-actions { display: flex; align-items: center; gap: 6px; }
.kpi-def-key { font-size: 10px; color: var(--text-3); }
.kpi-def-desc { font-size: 11px; color: var(--text-2); line-height: 1.4; margin-top: 2px; }
.icon-btn { background: none; border: none; color: var(--text-3); cursor: pointer; font-size: 12px; padding: 2px 4px; }
.icon-btn:hover { color: var(--danger); }

.script-editor {
  width: 100%; background: var(--bg-2); border: 1px solid var(--border-m);
  border-radius: var(--radius); padding: 10px 12px;
  color: var(--text); font-family: var(--font-mono); font-size: 11px;
  line-height: 1.6; outline: none; resize: vertical;
  transition: border-color var(--transition);
}
.script-editor:focus { border-color: var(--accent); }

/* banner */
.banner {
  padding: 10px 14px; border-radius: var(--radius);
  font-size: 13px; margin-bottom: 16px;
  display: flex; align-items: center; gap: 10px;
}
.banner-ok   { background: var(--accent-bg); border: 1px solid #4fffb030; color: var(--accent); }
.banner-warn { background: var(--warn-bg);   border: 1px solid #ffb34730; color: var(--warn); }
.banner-close { margin-left: auto; background: none; border: none; cursor: pointer; color: inherit; }

/* modal */
.modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:100; }
.modal { width:480px;display:flex;flex-direction:column;gap:14px; }
.modal-header { display:flex;justify-content:space-between;align-items:center; }
.modal-header h2 { font-size:16px;font-weight:700; }
.modal-footer { display:flex;justify-content:flex-end;gap:8px;margin-top:4px; }
.form-field { display:flex;flex-direction:column;gap:6px; }
.form-field label { font-size:12px;color:var(--text-2);font-weight:600; }
.input { background:var(--bg-2);border:1px solid var(--border-m);border-radius:var(--radius);padding:8px 12px;color:var(--text);font-family:var(--font-ui);font-size:13px;outline:none;resize:vertical;transition:border-color var(--transition); }
.input:focus { border-color:var(--accent); }

.loading-block { display:flex;flex-direction:column;gap:8px; }
.skeleton { background:var(--bg-1);border-radius:6px;animation:shimmer 1.4s infinite;background-image:linear-gradient(90deg,var(--bg-1) 25%,var(--bg-2) 50%,var(--bg-1) 75%);background-size:200%; }
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
</style>
