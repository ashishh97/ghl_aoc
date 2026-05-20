<template>
  <div class="page">
    <PageHeader title="Dashboard" subtitle="Observability across all Voice AI agents">
      <button class="btn btn-ghost" @click="load" :disabled="loading">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Refresh
      </button>
    </PageHeader>

    <div v-if="loading && !data" class="loading-grid">
      <div v-for="i in 4" :key="i" class="skeleton-card" />
    </div>

    <div v-else-if="error" class="error-banner">⚠ {{ error }}</div>

    <template v-else-if="data">
      <!-- Global stat strip -->
      <div class="stat-strip">
        <div class="stat">
          <span class="stat-val mono">{{ data.totals.total_calls }}</span>
          <span class="stat-label">Total calls</span>
        </div>
        <div class="stat-divider" />
        <div class="stat">
          <span class="stat-val mono">{{ data.totals.evaluated_calls }}</span>
          <span class="stat-label">Evaluated</span>
        </div>
        <div class="stat-divider" />
        <div class="stat">
          <span class="stat-val mono" :style="{ color: scoreColor(data.totals.avg_score) }">
            {{ Math.round(data.totals.avg_score * 100) }}
          </span>
          <span class="stat-label">Avg score</span>
        </div>
        <div class="stat-divider" />
        <div class="stat">
          <span class="stat-val mono" style="color:var(--warn)">{{ data.totals.pending_calls }}</span>
          <span class="stat-label">Pending eval</span>
        </div>
      </div>

      <!-- Agent cards grid -->
      <div class="agents-grid">
        <div
          v-for="row in data.agents" :key="row.agent.id"
          class="agent-card card"
          @click="$router.push(`/agents/${row.agent.id}`)"
        >
          <div class="agent-card-top">
            <div class="agent-info">
              <div class="agent-name">{{ row.agent.name }}</div>
              <div class="agent-desc">{{ row.agent.description }}</div>
            </div>
            <ScoreRing :score="row.metrics.avg_score" :size="56" />
          </div>

          <div class="agent-stats">
            <div class="mini-stat">
              <span class="mono">{{ row.metrics.total_calls }}</span>
              <span>calls</span>
            </div>
            <div class="mini-stat">
              <span class="mono">{{ row.metrics.evaluated_calls }}</span>
              <span>evaluated</span>
            </div>
            <div class="mini-stat">
              <span class="mono" style="color:var(--danger)">{{ row.metrics.top_failures.length }}</span>
              <span>failure types</span>
            </div>
          </div>

          <!-- KPI bars preview -->
          <div v-if="Object.keys(row.metrics.avg_kpi_scores).length" class="kpi-preview">
            <div
              v-for="(score, key) in topKpis(row.metrics.avg_kpi_scores)"
              :key="key"
            >
              <KpiBar :label="formatKey(key)" :score="score" />
            </div>
          </div>

          <!-- Score trend sparkline -->
          <div v-if="row.metrics.score_trend.length > 1" class="sparkline-wrap">
            <svg class="sparkline" viewBox="0 0 120 28" preserveAspectRatio="none">
              <polyline
                :points="sparkPoints(row.metrics.score_trend)"
                fill="none" stroke="var(--accent)" stroke-width="1.5"
                stroke-linejoin="round" stroke-linecap="round"
              />
            </svg>
          </div>

          <div class="agent-card-footer">
            <span class="section-label">view agent →</span>
          </div>
        </div>
      </div>

      <!-- High severity failures -->
      <div v-if="data.recent_high_severity_failures.length" class="section-block">
        <div class="section-head">
          <span class="section-label">High severity issues</span>
          <span class="tag tag-danger">{{ data.recent_high_severity_failures.length }}</span>
        </div>
        <div class="failure-list">
          <div v-for="(f, i) in data.recent_high_severity_failures" :key="i" class="failure-row">
            <div class="failure-kpi tag tag-danger">{{ formatKey(f.kpi) }}</div>
            <div class="failure-body">
              <div class="failure-desc">{{ f.description }}</div>
              <div class="failure-meta">
                <span class="mono" style="color:var(--text-3)">{{ f.agent_name }}</span>
                <span style="color:var(--text-3)">·</span>
                <span style="color:var(--text-3)">{{ f.contact_name }}</span>
              </div>
              <blockquote v-if="f.quote" class="failure-quote mono">"{{ f.quote }}"</blockquote>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/api/index.js'
import { useAsync } from '@/composables/useAsync.js'
import ScoreRing from '@/components/ScoreRing.vue'
import KpiBar from '@/components/KpiBar.vue'
import PageHeader from '@/components/PageHeader.vue'

const data = ref(null)
const { loading, error, run } = useAsync()

async function load() {
  await run(async () => { data.value = await api.analyze.dashboard() })
}
onMounted(load)

function scoreColor(s) {
  if (s >= 0.75) return 'var(--accent)'
  if (s >= 0.5)  return 'var(--warn)'
  return 'var(--danger)'
}

function formatKey(k) {
  return k.replace(/_/g, ' ')
}

function topKpis(scores) {
  return Object.fromEntries(Object.entries(scores).slice(0, 3))
}

function sparkPoints(trend) {
  if (!trend.length) return ''
  const scores = trend.map(t => t.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores) || 1
  const w = 120, h = 28, pad = 3
  return trend.map((t, i) => {
    const x = pad + (i / (trend.length - 1 || 1)) * (w - pad * 2)
    const y = h - pad - ((t.score - min) / (max - min || 1)) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
}
</script>

<style scoped>
.page { padding: 32px 36px; max-width: 1100px; }

.stat-strip {
  display: flex; align-items: center; gap: 0;
  background: var(--bg-1); border: 1px solid var(--border);
  border-radius: var(--radius-lg); margin-bottom: 28px; overflow: hidden;
}
.stat {
  display: flex; flex-direction: column; align-items: center;
  gap: 3px; padding: 18px 32px; flex: 1;
}
.stat-val { font-size: 26px; font-weight: 500; line-height: 1; }
.stat-label { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: .08em; }
.stat-divider { width: 1px; height: 40px; background: var(--border); flex-shrink: 0; }

.agents-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px; margin-bottom: 32px;
}

.agent-card {
  cursor: pointer; transition: var(--transition);
  display: flex; flex-direction: column; gap: 14px;
}
.agent-card:hover {
  border-color: var(--border-hi);
  background: var(--bg-2);
  transform: translateY(-1px);
}

.agent-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.agent-info { flex: 1; min-width: 0; }
.agent-name { font-weight: 700; font-size: 15px; margin-bottom: 3px; }
.agent-desc { font-size: 12px; color: var(--text-2); line-height: 1.4; }

.agent-stats { display: flex; gap: 16px; }
.mini-stat { display: flex; flex-direction: column; gap: 1px; }
.mini-stat span:first-child { font-size: 16px; font-weight: 500; }
.mini-stat span:last-child  { font-size: 11px; color: var(--text-3); }

.kpi-preview { display: flex; flex-direction: column; gap: 8px; }

.sparkline-wrap { height: 28px; }
.sparkline { width: 100%; height: 28px; }

.agent-card-footer { margin-top: auto; }
.agent-card-footer .section-label { color: var(--accent); letter-spacing: .08em; }

/* failures section */
.section-block { margin-top: 8px; }
.section-head {
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
}
.failure-list { display: flex; flex-direction: column; gap: 2px; }
.failure-row {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 12px 14px; border-radius: var(--radius);
  background: var(--bg-1); border: 1px solid var(--border);
}
.failure-kpi { flex-shrink: 0; margin-top: 1px; }
.failure-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.failure-desc { font-size: 13px; line-height: 1.4; }
.failure-meta { display: flex; gap: 6px; font-size: 11px; font-family: var(--font-mono); }
.failure-quote {
  font-size: 11px; color: var(--text-3); font-family: var(--font-mono);
  border-left: 2px solid var(--danger); padding-left: 8px; margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* loading skeleton */
.loading-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.skeleton-card {
  height: 240px; border-radius: var(--radius-lg);
  background: linear-gradient(90deg, var(--bg-1) 25%, var(--bg-2) 50%, var(--bg-1) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

.error-banner {
  padding: 16px; border-radius: var(--radius);
  background: var(--danger-bg); border: 1px solid #ff575730;
  color: var(--danger); font-size: 13px;
}
</style>
