import { createApp } from 'vue'
import { RouterView } from 'vue-router'
import router from './router/index.js'

const app = createApp(RouterView)

app.use(router)

app.mount('#app')
