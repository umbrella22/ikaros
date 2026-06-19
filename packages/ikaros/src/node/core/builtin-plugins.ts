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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function mergeRspackExternals(
  current: Configuration['externals'],
  next: Record<string, string>,
): Configuration['externals'] {
  if (current === undefined) {
    return next
  }

  if (isPlainRecord(current)) {
    return {
      ...current,
      ...next,
    } as Configuration['externals']
  }

  return current
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
      api.modifyRspackPlugins((plugins, { config }) => {
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
          pluginHelper.useCopyPlugin()
          for (const [index, plugin] of mpaPlugins.entries()) {
            pluginHelper.addPlugin(`html:mpa:${index}`, plugin)
          }
        }

        pluginHelper.addPlugin(
          'pre-warnings',
          new PreWarningsPlugin(warnings, config.quiet),
        )

        for (const item of pluginHelper.endWithIds()) {
          plugins.append(item.id, item.value)
        }
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
      api.modifyRspackPlugins((plugins, { config }) => {
        plugins.append('stats', new StatsPlugin(config))
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
      api.modifyRspackPlugins((plugins, { config }) => {
        const helper = createPluginHelper(compileContext, config)

        plugins.append('sourcemap', helper.createSourceMapPlugin())
        plugins.append('css-extract', helper.createCssExtractPlugin())
        plugins.append('doctor', helper.createDoctorPlugin())
        plugins.append('gzip', helper.createGzipPlugin())
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
      api.modifyRspackPlugins((plugins, { config }) => {
        if (isLibraryBuild(compileContext, config)) {
          return
        }

        const helper = createPluginHelper(compileContext, config)
        plugins.append('cdn', helper.createCdnPlugin())
      })

      api.modifyRspackConfig((bundlerConfig, { config }) => {
        if (isLibraryBuild(compileContext, config)) {
          return bundlerConfig
        }

        const cdnModules = config.rspack.cdnOptions.modules
        if (cdnModules.length === 0) {
          return bundlerConfig
        }

        return {
          ...bundlerConfig,
          externals: mergeRspackExternals(
            bundlerConfig.externals,
            createCdnExternals(cdnModules),
          ),
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
      api.modifyRspackPlugins((plugins, { config }) => {
        const helper = createPluginHelper(compileContext, config)

        if (isLibraryBuild(compileContext, config)) {
          plugins.append(
            'dependency-cycle',
            helper.createDependencyCyclePlugin(),
          )
          return
        }

        plugins.append(
          'module-federation',
          helper.createModuleFederationPlugin(),
        )
        plugins.append('dependency-cycle', helper.createDependencyCyclePlugin())
        plugins.append('user:rspack-plugins', config.rspack.plugins)
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
