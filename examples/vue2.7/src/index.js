import Vue from 'vue'
import router, { routes } from './router'
import App from './App.vue'

new Vue({
  router,
  render: (h) => h(App),
  created() {
    console.log(router, routes)
    console.log('Vue2 app created')
  },
}).$mount('#app')
