import { basename, extname, join } from 'node:path'

import type {
  Configuration,
  DefinePluginOptions,
  RuleSetRule,
} from '@rspack/core'

import { Command } from '../../compile/compile-context'
import {
  ELECTRON_DEFAULT_OUTPUT,
  extensions,
  resolveCLI,
} from '../../shared/constants'
import { buildPlanToCreateConfigParams } from '../../build-plan'
import type { BuildPlan } from '../../build-plan'
import {
  CreateLoader,
  CreatePlugins,
} from './loader-plugin-helper'
import { createRspackWatchOptions } from '../../compile/web/rspack-config-sections'

function resolveMainEntry(
  plan: BuildPlan,
  resolveContext: (...paths: string[]) => string,
): string {
  const entry = plan.electron?.main?.entry
  return resolveContext(entry ?? 'src/main/index.ts')
}

function resolveMainOutputDir(
  plan: BuildPlan,
  resolveContext: (...paths: string[]) => string,
): string {
  if (plan.electron?.build?.outDir) {
    return join(resolveContext(plan.electron.build.outDir), 'main')
  }

  if (plan.electron?.main?.output) {
    return resolveContext(plan.electron.main.output)
  }

  return resolveContext('dist/electron/main')
}

function resolvePreloadOutputDir(
  plan: BuildPlan,
  resolveContext: (...paths: string[]) => string,
): string {
  if (plan.electron?.build?.outDir) {
    return join(resolveContext(plan.electron.build.outDir), 'preload')
  }

  if (plan.electron?.preload?.output) {
    return resolveContext(plan.electron.preload.output)
  }

  return resolveContext('dist/electron/preload')
}

function normalizeList<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function resolvePreloadEntries(plan: BuildPlan): Record<string, string> {
  const defaultEntry = { 'main-preload': 'src/preload/index.ts' }
  const entriesRaw = plan.electron?.preload?.entries

  if (!entriesRaw) {
    return defaultEntry
  }

  if (Array.isArray(entriesRaw)) {
    const entries: Record<string, string> = {}
    for (const entry of entriesRaw) {
      const fileBase = basename(entry, extname(entry))
      const name = fileBase === 'index' ? 'main-preload' : fileBase
      if (entries[name]) {
        throw new Error(`preload.entries 存在重复文件名导致输出冲突: ${name}`)
      }
      entries[name] = entry
    }
    return entries
  }

  return entriesRaw
}

function createElectronResolve(plan: BuildPlan): Configuration['resolve'] {
  return {
    alias: {
      '@': join(plan.context, 'src'),
      ...plan.source.alias,
    },
    extensions: plan.source.extensions || extensions,
    modules: [
      'node_modules',
      join(plan.context, 'node_modules'),
      resolveCLI('node_modules'),
    ],
  }
}

function createElectronBaseConfig(plan: BuildPlan): {
  env: 'development' | 'production'
  command: Command
  resolveContext: (...paths: string[]) => string
  rules: RuleSetRule[]
  plugins: NonNullable<Configuration['plugins']>
} {
  const params = buildPlanToCreateConfigParams(plan)
  const command = params.command === 'server' ? Command.SERVER : Command.BUILD
  const env = command === Command.SERVER ? 'development' : 'production'
  const loaderHelper = new CreateLoader({
    env,
    mode: plan.mode,
    context: plan.context,
  })
  const pluginHelper = new CreatePlugins({
    env,
    mode: plan.mode,
    context: plan.context,
  })

  return {
    env,
    command,
    resolveContext: params.resolveContext,
    rules: loaderHelper.useDefaultScriptLoader().end() as RuleSetRule[],
    plugins: pluginHelper
      .useDefaultEnvPlugin({
        env: plan.env as DefinePluginOptions,
        extEnv: plan.source.define,
      })
      .end(),
  }
}

export function createElectronMainRspackConfig(
  plan: BuildPlan,
): Configuration {
  const { env, command, resolveContext, rules, plugins } =
    createElectronBaseConfig(plan)

  return {
    mode: env,
    target: 'electron-main',
    context: plan.context,
    entry: {
      main: resolveMainEntry(plan, resolveContext),
    },
    resolve: createElectronResolve(plan),
    output: {
      clean: command === Command.BUILD,
      path: resolveMainOutputDir(plan, resolveContext),
      filename: 'main.js',
      pathinfo: false,
    },
    stats: 'none',
    watchOptions: createRspackWatchOptions(),
    module: {
      rules: [...rules, ...(plan.electron?.main?.loaders ?? [])],
    },
    plugins: [...plugins, ...normalizeList(plan.electron?.main?.plugins)],
    externals: {
      electron: 'commonjs electron',
    },
  }
}

export function createElectronPreloadRspackConfigs(
  plan: BuildPlan,
): Configuration[] {
  const { env, command, resolveContext, rules, plugins } =
    createElectronBaseConfig(plan)
  const outputDir = resolvePreloadOutputDir(plan, resolveContext)

  return Object.entries(resolvePreloadEntries(plan)).map(([name, entryPath]) => ({
    mode: env,
    target: 'electron-preload',
    context: plan.context,
    entry: {
      [name]: resolveContext(entryPath),
    },
    resolve: createElectronResolve(plan),
    output: {
      clean: command === Command.BUILD,
      path: outputDir,
      filename: `${name}.js`,
      pathinfo: false,
    },
    stats: 'none',
    watchOptions: createRspackWatchOptions(),
    module: {
      rules: [...rules, ...(plan.electron?.preload?.loaders ?? [])],
    },
    plugins: [...plugins, ...normalizeList(plan.electron?.preload?.plugins)],
    externals: {
      electron: 'commonjs electron',
    },
  }))
}

export function getDefaultElectronRendererOutput(): string {
  return ELECTRON_DEFAULT_OUTPUT
}
