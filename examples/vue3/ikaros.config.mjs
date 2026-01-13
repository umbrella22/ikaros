import { defineConfig } from '@ikaros-cli/ikaros'
import { VueLoaderPlugin } from 'rspack-vue-loader'

export default defineConfig(() => {
  return {
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
  }
})
