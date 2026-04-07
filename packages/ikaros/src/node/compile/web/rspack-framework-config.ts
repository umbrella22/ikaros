import type { Configuration, DefinePluginOptions } from '@rspack/core'
import { rspack } from '@rspack/core'

import type { NormalizedConfig } from '../../config/normalize-config'
import { Command } from '../compile-context'

export interface VueOrReactConfig {
  noParse?: NonNullable<NonNullable<Configuration['module']>['noParse']>
  env?: DefinePluginOptions
}

export function createVueOrReactConfig(params: {
  isVue: boolean
  isReact: boolean
}): VueOrReactConfig {
  const { isVue, isReact } = params

  if (isVue) {
    return {
      noParse: /^(vue|vue-router|vuex|vuex-router-sync)$/,
    }
  }

  if (isReact) {
    return {
      noParse: (content: string) => {
        return /(react|react-dom|react-is)\.production\.min\.js$/.test(content)
      },
      env: {
        REACT_APP_ENABLE_DEVTOOLS: false,
      },
    }
  }

  return {}
}

function createRspackOptimization(
  command: Command,
): Configuration['optimization'] {
  if (command === Command.SERVER) {
    return {
      minimize: false,
      removeAvailableModules: false,
      removeEmptyChunks: false,
      splitChunks: false,
    }
  }

  return {
    minimize: true,
    minimizer: [
      new rspack.LightningCssMinimizerRspackPlugin(),
      new rspack.SwcJsMinimizerRspackPlugin(),
    ],
    splitChunks: {
      chunks: 'all',
      minSize: 30000,
      minChunks: 1,
      maxAsyncRequests: 5,
      maxInitialRequests: 3,
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          chunks: 'all',
        },
        common: {
          name: 'common',
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
  }
}

export function createRspackPerformanceConfig(params: {
  command: Command
  config: NormalizedConfig
}): Pick<Configuration, 'optimization' | 'experiments' | 'cache'> {
  const { command, config } = params

  return {
    optimization: createRspackOptimization(command),
    experiments: {
      css: true,
      ...(command !== Command.SERVER && config.build.cache
        ? {
            cache: {
              type: 'persistent',
            },
          }
        : {}),
    },
    ...(command !== Command.SERVER && config.build.cache
      ? { cache: true }
      : {}),
  }
}
