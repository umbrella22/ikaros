import { defineConfig } from '@ikaros-cli/ikaros'
import ReactRefreshPlugin from '@rspack/plugin-react-refresh'

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  return {
    loaders: [
      {
        test: /\.[jt]sx?$/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'ecmascript',
              jsx: true,
            },
            transform: {
              react: {
                runtime: 'automatic',
                development: isDev,
                refresh: isDev,
              },
            },
          },
        },
      },
    ],
    plugins: [isDev && new ReactRefreshPlugin()],
  }
})
