import { defineConfig } from '@ikaros-cli/ikaros'
import { VueLoaderPlugin } from 'rspack-vue-loader'

export default defineConfig(() => {
  return {
    // ── 库模式配置 ──────────────────────────────────────────
    library: {
      entry: 'src/index.js',
      name: 'IkarosVueLib',
      formats: ['es', 'umd'],
      fileName: 'ikaros-vue3-lib-example',
      externals: ['vue'],
      globals: { vue: 'Vue' },
    },

    // ── Rspack Vue3 loader（bundler = rspack 时生效）────────
    rspack: {
      loaders: [
        {
          test: /\.vue$/,
          loader: 'rspack-vue-loader',
          options: {
            prettify: false,
            experimentalInlineMatchResource: true,
          },
        },
      ],
      plugins: [new VueLoaderPlugin()],
    },
  }
})
