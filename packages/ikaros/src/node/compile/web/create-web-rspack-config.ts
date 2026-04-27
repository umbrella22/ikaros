import type { Configuration } from '@rspack/core'

import {
  CreateLoader,
  CreateMpaAssets,
} from '../../bundler/rspack/loader-plugin-helper'
import {
  createRspackDevServerConfig,
  createRspackOutputConfig,
  createRspackResolveConfig,
  createRspackTarget,
  createRspackWatchOptions,
} from './rspack-config-sections'
import { createVueOrReactConfig } from './rspack-framework-config'
import type { NormalizedConfig } from '../../config/normalize-config'
import type { PackageJson } from '../compile-context'
import { Command } from '../compile-context'

export type CreateWebRspackConfigParams = {
  command: Command
  mode?: string
  context: string
  contextPkg?: PackageJson
  config: NormalizedConfig
  resolveContext: (...paths: string[]) => string
}

export function createWebRspackConfig(
  params: CreateWebRspackConfigParams,
): Configuration {
  const { command, mode, context, contextPkg, config, resolveContext } = params

  const isDev = command === Command.SERVER
  const env = isDev ? 'development' : 'production'
  const rspackConfig = config.rspack

  const loaderHelper = new CreateLoader({
    env,
    mode,
    context,
  })

  const mpaAssetsHelper = new CreateMpaAssets({
    pages: config.pages,
    enablePages: config.enablePages,
  })

  const { entry } = mpaAssetsHelper.create()
  const { noParse } = createVueOrReactConfig({
    isVue: config.isVue,
    isReact: config.isReact,
  })

  const rules = loaderHelper
    .useDefaultResourceLoader()
    .useDefaultScriptLoader(rspackConfig?.experiments)
    .useDefaultCssLoader({
      ...rspackConfig?.css,
      lightningcss: {
        targets: config.browserslist,
        ...rspackConfig?.css?.lightningcss,
      },
    })
    .add(rspackConfig?.loaders)
    .end()

  return {
    mode: env,
    context,
    entry,
    target: createRspackTarget(config),
    resolve: createRspackResolveConfig({ config, resolveContext }),
    output: createRspackOutputConfig({
      command,
      contextPkg,
      config,
      resolveContext,
    }),
    stats: 'none',
    watchOptions: createRspackWatchOptions(),
    module: {
      rules,
      noParse,
    },
    plugins: [],
    devServer: createRspackDevServerConfig({ config, resolveContext }),
  } satisfies Configuration
}
