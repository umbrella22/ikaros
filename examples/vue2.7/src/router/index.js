import VueRouter from 'vue-router'
import Vue from 'vue'

Vue.use(VueRouter)

/** @type {import("vue-router").RouteConfig[]} */
export const routes = [
  {
    path: '/',
    component: () => import('@/pages/index.vue'),
    beforeEnter: (to, from, next) => {
      console.log('beforeEnter')
      next()
    },
  },
]

export default new VueRouter({
  mode: 'history',
  routes,
})
