import { defineConfig } from '@ikaros-cli/ikaros'
import { VueLoaderPlugin } from 'vue-loader'

export default defineConfig({
  bundle: {
    rspack: {
      loaders: [
        {
          test: /\.vue$/,
          loader: 'vue-loader',
          options: {
            compilerOptions: {
              preserveWhitespace: false,
            },
          },
        },
      ],
      plugins: [new VueLoaderPlugin()],
    },
  },
})
