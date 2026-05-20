import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/',              name: 'Dashboard',  component: () => import('@/views/Dashboard.vue') },
  { path: '/agents',        name: 'Agents',     component: () => import('@/views/Agents.vue') },
  { path: '/agents/:id',    name: 'AgentDetail',component: () => import('@/views/AgentDetail.vue') },
  { path: '/calls',         name: 'Calls',      component: () => import('@/views/Calls.vue') },
  { path: '/calls/:id',     name: 'CallDetail', component: () => import('@/views/CallDetail.vue') },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})
