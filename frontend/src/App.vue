<template>
  <div id="shell">
    <nav class="sidebar">
      <div class="sidebar-logo">
        <span class="logo-icon">◈</span>
        <span class="logo-text">Copilot</span>
      </div>

      <div class="nav-section">
        <span class="section-label">Observe</span>
        <router-link to="/" class="nav-item" :class="{ active: $route.path === '/' }">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          Dashboard
        </router-link>
        <router-link to="/calls" class="nav-item" :class="{ active: $route.path.startsWith('/calls') }">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Call log
        </router-link>
      </div>

      <div class="nav-section">
        <span class="section-label">Configure</span>
        <router-link to="/agents" class="nav-item" :class="{ active: $route.path.startsWith('/agents') }">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          Agents
        </router-link>
      </div>

      <div class="sidebar-footer">
        <div class="status-dot" :class="backendOnline ? 'online' : 'offline'"></div>
        <span class="mono" style="font-size:11px; color:var(--text-3)">
          {{ backendOnline ? 'API connected' : 'API offline' }}
        </span>
      </div>
    </nav>

    <main class="main-area">
      <router-view v-slot="{ Component }">
        <transition name="slide" mode="out-in">
          <component :is="Component" :key="$route.path" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/api/index.js'

const backendOnline = ref(false)
onMounted(async () => {
  try {
    await api.analyze.dashboard()
    backendOnline.value = true
  } catch { backendOnline.value = false }
})
</script>

<style scoped>
#shell { display: flex; height: 100vh; overflow: hidden; }

.sidebar {
  width: 220px; min-width: 220px;
  background: var(--bg-1);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  padding: 0 0 16px;
  gap: 0;
}

.sidebar-logo {
  display: flex; align-items: center; gap: 10px;
  padding: 22px 20px 20px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
.logo-icon { font-size: 20px; color: var(--accent); line-height: 1; }
.logo-text { font-family: var(--font-ui); font-weight: 800; font-size: 15px; letter-spacing: -.01em; }

.nav-section {
  display: flex; flex-direction: column; gap: 2px;
  padding: 16px 12px 4px;
}
.nav-section .section-label { padding: 0 8px; margin-bottom: 4px; }

.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: var(--radius);
  color: var(--text-2); font-size: 13px; font-weight: 500;
  transition: var(--transition); cursor: pointer;
}
.nav-item:hover { background: var(--bg-2); color: var(--text); }
.nav-item.active { background: var(--accent-bg); color: var(--accent); }
.nav-item.active svg { stroke: var(--accent); }

.sidebar-footer {
  margin-top: auto; padding: 0 20px;
  display: flex; align-items: center; gap: 8px;
}
.status-dot {
  width: 6px; height: 6px; border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.online  { background: var(--accent); box-shadow: 0 0 6px var(--accent); }
.status-dot.offline { background: var(--danger); }

.main-area {
  flex: 1; overflow-y: auto;
  background: var(--bg);
}
</style>
