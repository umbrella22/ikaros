import { defineConfig } from '@ikaros-cli/ikaros'
import { react } from '@ikaros-cli/plugin-react'

export default defineConfig({
  plugins: [react()],
  pages: {
    index: {
      html: './index.html',
      entry: './src/dev.jsx',
    },
  },
  library: {
    entry: 'src/index.jsx',
    name: 'IkarosReactLib',
    formats: ['es', 'umd'],
    fileName: 'ikaros-react-lib-example',
    externals: ['react', 'react-dom', /^react\//],
    globals: {
      react: 'React',
      'react-dom': 'ReactDOM',
    },
  },
})
