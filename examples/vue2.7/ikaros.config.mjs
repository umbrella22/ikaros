import { defineConfig } from '@ikaros-cli/ikaros'
import { VueLoaderPlugin } from 'vue-loader'

export default defineConfig(() => {
  return {
    loaders: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          prettify: false,
          experimentalInlineMatchResource: true,
        },
      },
    ],
    plugins: [new VueLoaderPlugin()],
  }
})
