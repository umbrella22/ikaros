import { join } from 'node:path'

import type { CreateConfigParams } from '../bundler/types'
import { Command } from '../compile/compile-context'
import type { NormalizedConfig } from '../config/normalize-config'
import type { BuildPlan } from './types'

export function buildPlanToNormalizedConfig(plan: BuildPlan): NormalizedConfig {
  return {
    bundler: plan.bundler,
    plugins: [],
    quiet: false,
    target: 'pc',
    pages: Object.fromEntries(
      Object.entries(plan.entries).map(([name, entry]) => [
        name,
        {
          html: entry.html ?? `${name}.html`,
          entry: entry.import,
          library: entry.library,
          options: entry.options as NonNullable<
            NormalizedConfig['pages'][string]['options']
          >,
        },
      ]),
    ),
    enablePages: plan.dev.pages,
    define: plan.source.define,
    rspack: {
      plugins: plan.adapterOptions.rspack?.plugins ?? [],
      swc: plan.adapterOptions.rspack?.swc,
      loaders: plan.adapterOptions.rspack?.loaders ?? [],
      experiments: plan.adapterOptions.rspack?.experiments ?? {
        transformImport: [],
      },
      moduleFederation: plan.adapterOptions.rspack?.moduleFederation ?? [],
      cdnOptions: plan.adapterOptions.rspack?.cdn ?? { modules: [] },
      css: plan.adapterOptions.rspack?.css ?? {},
    },
    vite: {
      plugins: plan.adapterOptions.vite?.plugins ?? [],
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
    resolve: {
      alias: plan.source.alias,
      extensions: plan.source.extensions,
    },
    library: plan.library ?? null,
    electron: plan.electron ?? {},
    base: plan.output.base,
    port: plan.dev.port,
    browserslist: plan.source.browserslist,
    isVue: plan.source.framework === 'vue' || plan.source.framework === 'mixed',
    isReact:
      plan.source.framework === 'react' || plan.source.framework === 'mixed',
    isElectron: plan.platform === 'desktopClient',
  }
}

export function buildPlanToCreateConfigParams(plan: BuildPlan): CreateConfigParams {
  return {
    command: plan.command === 'server' ? Command.SERVER : Command.BUILD,
    mode: plan.mode,
    env: plan.env,
    context: plan.context,
    contextPkg: plan.contextPkg,
    config: buildPlanToNormalizedConfig(plan),
    resolveContext: (...paths: string[]) => join(plan.context, ...paths),
  }
}
