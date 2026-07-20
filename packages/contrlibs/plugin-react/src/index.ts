import { ReactRefreshRspackPlugin } from '@rspack/plugin-react-refresh'

import type { IkarosPlugin } from '@ikaros-cli/ikaros/plugin'

export type ReactPluginOptions = {
  refresh?: boolean
}

type PlainRecord = Record<string, unknown>

function asPlainRecord(value: unknown): PlainRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as PlainRecord)
    : {}
}

function mergeReactSwc(params: {
  swc: unknown
  isDev: boolean
  refresh: boolean
}): PlainRecord {
  const current = asPlainRecord(params.swc)
  const jsc = asPlainRecord(current.jsc)
  const transform = asPlainRecord(jsc.transform)
  const react = asPlainRecord(transform.react)

  return {
    ...current,
    jsc: {
      ...jsc,
      transform: {
        ...transform,
        react: {
          runtime: 'automatic',
          development: params.isDev,
          refresh: params.isDev && params.refresh,
          ...react,
        },
      },
    },
  }
}

/**
 * Opt-in React defaults for the Rspack adapter. Existing bundle.rspack.swc
 * values win over these defaults, so projects retain direct SWC control.
 */
export const react = (options: ReactPluginOptions = {}): IkarosPlugin => ({
  name: 'plugin-react',
  setup(api) {
    const isDev = api.command === 'server'
    const refresh = options.refresh ?? true

    api.modifyNormalizedConfig((config) => {
      if (config.bundler !== 'rspack') return config

      return {
        ...config,
        rspack: {
          ...config.rspack,
          swc: mergeReactSwc({
            swc: config.rspack.swc,
            isDev,
            refresh,
          }) as typeof config.rspack.swc,
        },
      }
    })

    if (isDev && refresh) {
      api.modifyRspackPlugins((plugins, { config }) => {
        if (config.bundler === 'rspack') {
          plugins.append('react-refresh', new ReactRefreshRspackPlugin())
        }
      })
    }
  },
})
