import type { NormalizedConfig } from '../config/normalize-config'
import { getAdapterCapabilities } from './adapter-capabilities'
import type { BuildPlan, BuildTargetKind } from './types'

function resolveFramework(config: NormalizedConfig): BuildPlan['source']['framework'] {
  if (config.isReact && config.isVue) return 'mixed'
  if (config.isReact) return 'react'
  if (config.isVue) return 'vue'
  return 'none'
}

export interface CreateBuildPlanParams {
  id: string
  command: 'server' | 'build'
  platform: 'web' | 'desktopClient'
  target: BuildTargetKind
  bundler?: BuildPlan['bundler']
  mode?: string
  context: string
  contextPkg?: BuildPlan['contextPkg']
  env: Record<string, unknown>
  config: NormalizedConfig
}

export function createBuildPlan(params: CreateBuildPlanParams): BuildPlan {
  const { id, command, platform, target, mode, context, env, config } = params
  const entries = Object.fromEntries(
    Object.entries(config.pages).map(([name, page]) => [
      name,
      {
        import: page.entry,
        html: page.html,
        library: page.library,
        options: page.options,
      },
    ]),
  )

  return {
    id,
    command,
    platform,
    target,
    bundler: params.bundler ?? config.bundler,
    mode,
    context,
    contextPkg: params.contextPkg,
    env,
    entries,
    source: {
      define: config.define,
      alias: config.resolve.alias,
      extensions: config.resolve.extensions,
      framework: resolveFramework(config),
      browserslist: config.browserslist,
    },
    dev: {
      port: config.port,
      proxy: config.server.proxy,
      https: config.server.https,
      pages: config.enablePages,
    },
    output: {
      base: config.base,
      dir: config.build.outDirName,
      assetsDir: config.build.assetsDir,
      gzip: config.build.gzip,
      sourceMap: config.build.sourceMap,
      report: config.build.outReport,
      cache: config.build.cache,
      checkCycles: config.build.dependencyCycleCheck,
    },
    library: config.library ?? undefined,
    electron: config.electron,
    adapterOptions: {
      rspack: {
        plugins: config.rspack.plugins,
        swc: config.rspack.swc,
        loaders: config.rspack.loaders,
        experiments: config.rspack.experiments,
        moduleFederation: config.rspack.moduleFederation,
        cdn: config.rspack.cdnOptions,
        css: config.rspack.css,
      },
      vite: {
        plugins: config.vite.plugins,
        config: config.vite.config,
        configFile: config.vite.configFile,
      },
    },
    capabilities: getAdapterCapabilities({
      bundler: params.bundler ?? config.bundler,
    }),
    provenance: [
      {
        source: 'platform.createPlans',
        operation: 'create',
        path: id,
        message: `created ${target} build plan`,
      },
    ],
    diagnostics: [],
  }
}
