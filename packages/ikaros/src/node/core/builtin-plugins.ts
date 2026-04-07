import type { Configuration, DefinePluginOptions, Plugin } from '@rspack/core'

import {
  CreateMpaAssets,
  CreatePlugins,
} from '../bundler/rspack/loader-plugin-helper'
import { CreatePluginHelper } from '../bundler/rspack/plugin-factory'
import type { CompileContext } from '../compile/compile-context'
import {
  createRspackPerformanceConfig,
  createVueOrReactConfig,
} from '../compile/web/rspack-framework-config'
import type { NormalizedConfig } from '../config/normalize-config'
import type { IkarosPlugin } from '../config/user-config'
import { createCdnExternals } from '../plugins/cdn-plugin'
import { PreWarningsPlugin } from '../plugins/pre-warnings-plugin'
import StatsPlugin from '../plugins/stats-plugin'

function toPluginList(plugin: Plugin | Plugin[] | undefined): Plugin[] {
  if (!plugin) {
    return []
  }

  return Array.isArray(plugin) ? plugin : [plugin]
}

function appendRspackPlugins(
  bundlerConfig: Configuration,
  plugins: Array<Plugin | Plugin[] | undefined>,
): Configuration {
  const nextPlugins = [...(bundlerConfig.plugins ?? [])]

  for (const plugin of plugins) {
    nextPlugins.push(...toPluginList(plugin))
  }

  return {
    ...bundlerConfig,
    plugins: nextPlugins,
  }
}

function mergeRspackConfig(
  bundlerConfig: Configuration,
  overrides: Partial<Configuration>,
): Configuration {
  const nextPlugins =
    overrides.plugins === undefined
      ? bundlerConfig.plugins
      : [
          ...(bundlerConfig.plugins ?? []),
          ...toPluginList(overrides.plugins as Plugin | Plugin[] | undefined),
        ]

  return {
    ...bundlerConfig,
    ...overrides,
    plugins: nextPlugins,
    experiments: overrides.experiments
      ? {
          ...(bundlerConfig.experiments ?? {}),
          ...overrides.experiments,
        }
      : bundlerConfig.experiments,
  }
}

function createPluginHelper(
  compileContext: CompileContext,
  config: NormalizedConfig,
): CreatePluginHelper {
  return new CreatePluginHelper({
    command: compileContext.command,
    config,
    isDev: compileContext.command === 'server',
    assetsDir: config.build.assetsDir,
    context: compileContext.context,
  })
}

function createRspackCoreFrameworkPlugin(
  compileContext: CompileContext,
): IkarosPlugin {
  return {
    name: 'ikaros:rspack-core',
    setup(api) {
      api.modifyRspackConfig((bundlerConfig, { config }) => {
        const isDev = compileContext.command === 'server'
        const env = isDev ? 'development' : 'production'
        const pluginHelper = new CreatePlugins({
          env,
          mode: compileContext.options.mode,
          context: compileContext.context,
        })
        const mpaAssetsHelper = new CreateMpaAssets({
          pages: config.pages,
          enablePages: config.enablePages,
        })
        const { plugins: mpaPlugins } = mpaAssetsHelper.create()
        const { env: frameworkEnv } = createVueOrReactConfig({
          isVue: config.isVue,
          isReact: config.isReact,
        })
        const warnings = [
          ...compileContext.preWarnings,
          ...mpaAssetsHelper.warnings,
        ]

        return appendRspackPlugins(bundlerConfig as Configuration, [
          pluginHelper
            .useDefaultEnvPlugin({
              extEnv: {
                ...config.define,
              },
              frameworkEnv,
              env: compileContext.env as DefinePluginOptions,
            })
            .useCopyPlugin()
            .add(mpaPlugins)
            .add(new PreWarningsPlugin(warnings, config.quiet))
            .end(),
        ])
      })
    },
  }
}

function createRspackPerformanceFrameworkPlugin(
  compileContext: CompileContext,
): IkarosPlugin {
  return {
    name: 'ikaros:rspack-performance',
    setup(api) {
      api.modifyRspackConfig((bundlerConfig, { config }) => {
        return mergeRspackConfig(
          bundlerConfig as Configuration,
          createRspackPerformanceConfig({
            command: compileContext.command,
            config,
          }),
        )
      })
    },
  }
}

function createRspackStatsFrameworkPlugin(): IkarosPlugin {
  return {
    name: 'ikaros:rspack-stats',
    setup(api) {
      api.modifyRspackConfig((bundlerConfig, { config }) => {
        return appendRspackPlugins(bundlerConfig as Configuration, [
          new StatsPlugin(config),
        ])
      })
    },
  }
}

function createRspackOutputFrameworkPlugin(
  compileContext: CompileContext,
): IkarosPlugin {
  return {
    name: 'ikaros:rspack-output',
    setup(api) {
      api.modifyRspackConfig((bundlerConfig, { config }) => {
        const helper = createPluginHelper(compileContext, config)

        return appendRspackPlugins(bundlerConfig as Configuration, [
          helper.createSourceMapPlugin(),
          helper.createCssExtractPlugin(),
          helper.createDoctorPlugin(),
          helper.createGzipPlugin(),
        ])
      })
    },
  }
}

function createRspackCdnFrameworkPlugin(
  compileContext: CompileContext,
): IkarosPlugin {
  return {
    name: 'ikaros:rspack-cdn',
    setup(api) {
      api.modifyRspackConfig((bundlerConfig, { config }) => {
        const helper = createPluginHelper(compileContext, config)
        const cdnModules = config.rspack.cdnOptions.modules
        const nextConfig = appendRspackPlugins(bundlerConfig as Configuration, [
          helper.createCdnPlugin(),
        ])

        if (cdnModules.length === 0) {
          return nextConfig
        }

        return {
          ...nextConfig,
          externals: createCdnExternals(cdnModules),
        }
      })
    },
  }
}

function createRspackEcosystemFrameworkPlugin(
  compileContext: CompileContext,
): IkarosPlugin {
  return {
    name: 'ikaros:rspack-ecosystem',
    setup(api) {
      api.modifyRspackConfig((bundlerConfig, { config }) => {
        const helper = createPluginHelper(compileContext, config)

        return appendRspackPlugins(bundlerConfig as Configuration, [
          helper.createModuleFederationPlugin(),
          helper.createDependencyCyclePlugin(),
          config.rspack.plugins,
        ])
      })
    },
  }
}

export function createBuiltinPlugins(
  compileContext: CompileContext,
): IkarosPlugin[] {
  return [
    createRspackCoreFrameworkPlugin(compileContext),
    createRspackPerformanceFrameworkPlugin(compileContext),
    createRspackStatsFrameworkPlugin(),
    createRspackOutputFrameworkPlugin(compileContext),
    createRspackCdnFrameworkPlugin(compileContext),
    createRspackEcosystemFrameworkPlugin(compileContext),
  ]
}
