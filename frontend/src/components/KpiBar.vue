<template>
  <div class="kpi-bar-row">
    <div class="kpi-label-row">
      <span class="kpi-label">{{ label }}</span>
      <span class="kpi-score mono" :style="{ color }">{{ Math.round(score * 100) }}</span>
    </div>
    <div class="kpi-track">
      <div class="kpi-fill" :style="{ width: (score * 100) + '%', background: color }" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  label: String,
  score: { type: Number, default: 0 }
})
const color = computed(() => {
  if (props.score >= 0.75) return 'var(--accent)'
  if (props.score >= 0.5)  return 'var(--warn)'
  return 'var(--danger)'
})
</script>

<style scoped>
.kpi-bar-row { display: flex; flex-direction: column; gap: 5px; }
.kpi-label-row { display: flex; justify-content: space-between; align-items: baseline; }
.kpi-label { font-size: 12px; color: var(--text-2); }
.kpi-score { font-size: 12px; font-weight: 500; }
.kpi-track {
  height: 4px; background: var(--bg-3); border-radius: 2px; overflow: hidden;
}
.kpi-fill {
  height: 100%; border-radius: 2px;
  transition: width 700ms cubic-bezier(.4,0,.2,1);
}
</style>
