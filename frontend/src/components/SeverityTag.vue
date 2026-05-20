<template>
  <span class="tag" :class="cls">{{ severity }}</span>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ severity: String })
const cls = computed(() => ({
  high:   'tag-danger',
  medium: 'tag-warn',
  low:    'tag-muted'
}[props.severity] ?? 'tag-muted'))
</script>
