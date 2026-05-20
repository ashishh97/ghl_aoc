<template>
  <div class="score-ring" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <circle
        :cx="c" :cy="c" :r="r"
        fill="none" stroke="var(--bg-3)" :stroke-width="stroke"
      />
      <circle
        :cx="c" :cy="c" :r="r"
        fill="none" :stroke="color" :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        style="transition: stroke-dashoffset 800ms cubic-bezier(.4,0,.2,1)"
      />
    </svg>
    <div class="val" :style="{ fontSize: size * 0.22 + 'px', color }">
      {{ Math.round(score * 100) }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  score: { type: Number, default: 0 },  // 0–1
  size:  { type: Number, default: 64 },
  stroke:{ type: Number, default: 5 }
})

const c = computed(() => props.size / 2)
const r = computed(() => c.value - props.stroke - 2)
const circumference = computed(() => 2 * Math.PI * r.value)
const dashOffset = computed(() => circumference.value * (1 - props.score))
const color = computed(() => {
  if (props.score >= 0.75) return 'var(--accent)'
  if (props.score >= 0.5)  return 'var(--warn)'
  return 'var(--danger)'
})
</script>
