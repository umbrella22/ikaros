import { defineConfig } from '@ikaros-cli/ikaros'
import { VueLoaderPlugin } from 'rspack-vue-loader'

export default defineConfig({
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
