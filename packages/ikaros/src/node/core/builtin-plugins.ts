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
  const {
    plugins: overridePlugins,
    experiments: overrideExperiments,
    ...rest
  } = plugins: overridePlugins,
    experiments: overrideExperiments,
    ...rest
  } = overrides
  const merged: Configuration = {
    ...bundlerConfig,
    ...rest,
    experiments: overrideExperiments
      ? {
          ...(bundlerConfig.experiments ?? {}),
          ...overrideExperiments,
        }
      : bundlerConfig.experiments,
  }

  return overridePlugins === undefined
    ? merged
    : appendRspackPlugins(merged, [overridePlugins as Plugin | Plugin[]])
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

function isLibraryBuild(
  compileContext: CompileContext,
  config: NormalizedConfig,
): boolean {
  return compileContext.command === 'build' && config.library !== null
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
        const libraryBuild = isLibraryBuild(compileContext, config)
        const pluginHelper = new CreatePlugins({
          env,
          mode: compileContext.options.mode,
          context: compileContext.context,
        })
        const { env: frameworkEnv } = createVueOrReactConfig({
          isVue: config.isVue,
          isReact: config.isReact,
        })
        const warnings = [...compileContext.preWarnings]

        pluginHelper.useDefaultEnvPlugin({
          extEnv: {
            ...config.define,
          },
          frameworkEnv,
          env: compileContext.env as DefinePluginOptions,
        })

        if (!libraryBuild) {
          const mpaAssetsHelper = new CreateMpaAssets({
            pages: config.pages,
            enablePages: config.enablePages,
          })
          const { plugins: mpaPlugins } = mpaAssetsHelper.create()

          warnings.push(...mpaAssetsHelper.warnings)
          pluginHelper.useCopyPlugin().add(mpaPlugins)
        }

        pluginHelper.add(new PreWarningsPlugin(warnings, config.quiet))

        return appendRspackPlugins(bundlerConfig as Configuration, [
          pluginHelper.end(),
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
        if (isLibraryBuild(compileContext, config)) {
          return bundlerConfig
        }

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
        if (isLibraryBuild(compileContext, config)) {
          return bundlerConfig
        }

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

        if (isLibraryBuild(compileContext, config)) {
          return appendRspackPlugins(bundlerConfig as Configuration, [
            helper.createDependencyCyclePlugin(),
          ])
        }

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
