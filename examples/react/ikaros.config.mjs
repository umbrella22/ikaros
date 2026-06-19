import { defineConfig } from '@ikaros-cli/ikaros'
import { ReactRefreshPlugin } from '@rspack/plugin-react-refresh'

export default defineConfig(async ({ command }) => {
  const isDev = command === 'server'
  const plugins = []

  if (isDev) {
    plugins.push(new ReactRefreshPlugin())
  }

  return {
    bundle: {
      rspack: {
        swc: {
          jsc: {
            transform: {
              react: {
                runtime: 'automatic',
                development: isDev,
                refresh: isDev,
              },
            },
          },
        },
        plugins,
      },
    },
  }
})
