import { join } from 'node:path'

import type {
  BuildPlan,
  BuildPlanEntry,
  CreateConfigParams,
  NormalizedConfig,
} from './types'

export function buildPlanToNormalizedConfig(plan: BuildPlan): NormalizedConfig {
  const entries = Object.entries(plan.entries) as Array<
    [string, BuildPlanEntry]
  >

  return {
    bundler: plan.bundler,
    quiet: false,
    pages: Object.fromEntries(
      entries.map(([name, entry]) => [
        name,
        {
          html: entry.html ?? `${name}.html`,
        },
      ]),
    ),
    enablePages: plan.dev.pages,
    define: plan.source.define as Record<string, unknown>,
    resolve: {
      alias: plan.source.alias,
      extensions: plan.source.extensions,
    },
    server: {
      port: plan.dev.port,
      proxy: plan.dev.proxy as NormalizedConfig['server']['proxy'],
      https: plan.dev.https,
    },
    build: {
      base: plan.output.base,
      assetsDir: plan.output.assetsDir,
      gzip: plan.output.gzip,
      sourceMap: plan.output.sourceMap,
      outDirName: plan.output.dir,
      outReport: plan.output.report,
      cache: plan.output.cache,
      dependencyCycleCheck: plan.output.checkCycles,
    },
    vite: {
      plugins: plan.adapterOptions.vite?.plugins as NonNullable<
        NormalizedConfig['vite']
      >['plugins'],
    },
    library: plan.library ?? null,
    base: plan.output.base,
    port: plan.dev.port,
    isElectron: plan.platform === 'desktopClient',
  }
}

export function buildPlanToCreateConfigParams(plan: BuildPlan): CreateConfigParams {
  return {
    command: plan.command,
    mode: plan.mode,
    env: plan.env,
    context: plan.context,
    config: buildPlanToNormalizedConfig(plan),
    resolveContext: (...paths: string[]) => join(plan.context, ...paths),
  }
}
