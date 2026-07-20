import { createRequire } from 'node:module'

import { VizePlugin } from '@vizejs/rspack-plugin'

import type { IkarosPlugin } from '@ikaros-cli/ikaros/plugin'

const require = createRequire(import.meta.url)
const VIZE_LOADER = '@vizejs/rspack-plugin/loader'
const VIZE_LOADER_ALIASES = Object.fromEntries(
  [
    VIZE_LOADER,
    '@vizejs/rspack-plugin/jsx-loader',
    '@vizejs/rspack-plugin/style-loader',
    '@vizejs/rspack-plugin/scope-loader',
  ].map((loader) => [loader, require.resolve(loader)]),
)
const VIZE_LOADER_PATH = VIZE_LOADER_ALIASES[VIZE_LOADER]

const hasVizeLoader = (loaders: unknown[]): boolean =>
  loaders.some(
    (loader) =>
      loader &&
      typeof loader === 'object' &&
      'loader' in loader &&
      (loader.loader === VIZE_LOADER || loader.loader === VIZE_LOADER_PATH),
  )

/**
 * Opt-in Vue SFC support for the Rspack adapter, powered by Vize. The loader
 * is only appended when the project has not already supplied its own rule.
 */
export const vue = (): IkarosPlugin => ({
  name: 'plugin-vue',
  setup(api) {
    api.modifyNormalizedConfig((config) => {
      if (config.bundler !== 'rspack') return config

      const loaders = config.rspack.loaders
      if (hasVizeLoader(loaders)) return config

      return {
        ...config,
        rspack: {
          ...config.rspack,
          loaders: [
            ...loaders,
            {
              test: /\.vue$/,
              loader: VIZE_LOADER_PATH,
            },
          ],
        },
      }
    })

    api.modifyRspackPlugins((plugins, { config }) => {
      if (config.bundler === 'rspack') {
        plugins.append('vue:vize', new VizePlugin())
      }
    })

    api.modifyRspackConfig((config) => {
      const existingAliases = config.resolveLoader?.alias

      return {
        ...config,
        resolveLoader: {
          ...config.resolveLoader,
          alias: {
            ...VIZE_LOADER_ALIASES,
            ...(existingAliases && typeof existingAliases === 'object'
              ? existingAliases
              : {}),
          },
        },
      }
    })
  },
})
