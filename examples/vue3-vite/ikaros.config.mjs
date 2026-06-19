import { defineConfig } from '@ikaros-cli/ikaros'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ env }) => {
  return {
    bundle: {
      adapter: 'vite',
      vite: {
        plugins: [vue()],
      },
    },
    dev: {
      proxy: {
        '/gw': {
          target: env.API_HOST ?? 'https://dev.example.com',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
