import { createRouter, createWebHistory } from 'vue-router'

/** @type {import('vue-router').RouteRecordRaw} */
export const routes = [
  {
    path: '/',
    component: () => import('../pages/index.vue'),
  },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
