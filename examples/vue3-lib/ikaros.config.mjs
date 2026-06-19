import { defineConfig } from '@ikaros-cli/ikaros'
import { VueLoaderPlugin } from 'rspack-vue-loader'

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
  bundle: {
    rspack: {
      loaders: [
        {
          test: /\.vue$/,
          loader: 'rspack-vue-loader',
        },
      ],
      plugins: [new VueLoaderPlugin()],
    },
  },
})
