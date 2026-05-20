<template>
  <div class="empty">
    <div class="empty-icon">{{ icon }}</div>
    <div class="empty-title">{{ title }}</div>
    <div class="empty-sub">{{ subtitle }}</div>
    <slot />
  </div>
</template>
<script setup>
defineProps({ icon: { default: '◌' }, title: String, subtitle: String })
</script>
<style scoped>
.empty {
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; padding: 60px 20px; text-align: center;
}
.empty-icon { font-size: 32px; color: var(--text-3); margin-bottom: 4px; }
.empty-title { font-size: 15px; font-weight: 600; color: var(--text-2); }
.empty-sub { font-size: 13px; color: var(--text-3); max-width: 280px; line-height: 1.5; }
</style>
