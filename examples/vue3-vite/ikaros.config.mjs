import { defineConfig } from '@ikaros-cli/ikaros'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ env }) => {
  return {
    bundler: 'vite',
    vite: {
      plugins: [vue()],
    },
    server: {
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
