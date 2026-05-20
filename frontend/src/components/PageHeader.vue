<template>
  <div class="page-header">
    <div class="page-header-left">
      <h1>{{ title }}</h1>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div class="page-header-actions"><slot /></div>
  </div>
</template>
<script setup>
defineProps({ title: String, subtitle: String })
</script>
<style scoped>
.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; margin-bottom: 28px;
}
.page-header-left h1 {
  font-size: 22px; font-weight: 800; letter-spacing: -.02em; line-height: 1.2;
}
.page-header-left p { color: var(--text-2); font-size: 13px; margin-top: 3px; }
.page-header-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
</style>
