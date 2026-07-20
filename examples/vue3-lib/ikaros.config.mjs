import { defineConfig } from '@ikaros-cli/ikaros'
import { vue } from '@ikaros-cli/plugin-vue'

export default defineConfig({
  pages: {
    index: {
      html: './index.html',
      entry: './src/dev.js',
    },
  },
  library: {
    entry: 'src/index.js',
    name: 'IkarosVueLib',
    formats: ['es', 'umd'],
    fileName: 'ikaros-vue3-lib-example',
    externals: ['vue'],
    globals: { vue: 'Vue' },
  },
  plugins: [vue()],
})
