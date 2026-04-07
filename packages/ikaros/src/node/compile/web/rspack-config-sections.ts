import type { Configuration } from '@rspack/core'
import { escapeRegExp, isString } from 'es-toolkit'
import { join } from 'node:path'

import type { NormalizedConfig } from '../../config/normalize-config'
import {
  ASSET_PATHS,
  DEFAULT_HTML_TEMPLATE,
  DEFAULT_OUT_DIR,
  DEFAULT_PUBLIC_DIR,
  ELECTRON_DEFAULT_OUTPUT,
  ELECTRON_RENDERER_SUBDIR,
  extensions,
  resolveCLI,
} from '../../shared/constants'
import type { PackageJson } from '../compile-context'
import { Command } from '../compile-context'

function getOutDirPath(params: {
  config: NormalizedConfig
  resolveContext: (...paths: string[]) => string
}): string {
  const { config, resolveContext } = params
  const outDirName = config.build.outDirName

  if (config.isElectron) {
    const electronConfig = config.electron
    const defaultOutput = resolveContext(ELECTRON_DEFAULT_OUTPUT)

    if (electronConfig?.build?.outDir) {
      return join(
        resolveContext(electronConfig.build.outDir),
        ELECTRON_RENDERER_SUBDIR,
      )
    }

    return defaultOutput
  }

  if (isString(outDirName)) {
    return resolveContext(outDirName)
  }

  return resolveContext(DEFAULT_OUT_DIR)
}

function formatAssetsPath(assetsDir: string, path: string): string {
  return [assetsDir, path].filter(Boolean).join('/').replace(/\/+/g, '/')
}

export function createRspackTarget(
  config: NormalizedConfig,
): Configuration['target'] {
  return config.isElectron
    ? 'electron-renderer'
    : ['web', 'es2015', `browserslist:${config.browserslist}`]
}

export function createRspackResolveConfig(params: {
  config: NormalizedConfig
  resolveContext: (...paths: string[]) => string
}): Configuration['resolve'] {
  const { config, resolveContext } = params

  return {
    alias: config.resolve.alias,
    extensions: config.resolve.extensions || extensions,
    modules: [
      'node_modules',
      resolveContext('node_modules'),
      resolveCLI('node_modules'),
    ],
  }
}

export function createRspackOutputConfig(params: {
  command: Command
  contextPkg?: PackageJson
  config: NormalizedConfig
  resolveContext: (...paths: string[]) => string
}): Configuration['output'] {
  const { command, contextPkg, config, resolveContext } = params
  const isDev = command === Command.SERVER
  const assetsDir = config.build.assetsDir

  return {
    clean: !isDev,
    path: getOutDirPath({ config, resolveContext }),
    publicPath: config.isElectron && !isDev ? './' : config.base,
    filename: isDev ? '[name].js' : formatAssetsPath(assetsDir, ASSET_PATHS.js),
    chunkFilename: isDev
      ? '[name].chunk.js'
      : formatAssetsPath(assetsDir, ASSET_PATHS.jsChunk),
    cssFilename: isDev
      ? '[name].css'
      : formatAssetsPath(assetsDir, ASSET_PATHS.css),
    cssChunkFilename: isDev
      ? '[name].chunk.css'
      : formatAssetsPath(assetsDir, ASSET_PATHS.cssChunk),
    chunkLoadingGlobal: `${contextPkg?.name || 'ikaros'}_chunk`,
    pathinfo: false,
  }
}

export function createRspackDevServerConfig(params: {
  config: NormalizedConfig
  resolveContext: (...paths: string[]) => string
}): Configuration['devServer'] {
  const { config, resolveContext } = params

  return {
    hot: true,
    port: config.port,
    server: (() => {
      const https = config.server.https

      if (!https) {
        return 'http'
      }

      if (https === true) {
        return 'https'
      }

      return {
        type: 'https',
        options: https,
      }
    })(),
    allowedHosts: 'all',
    proxy: config.server.proxy,
    historyApiFallback: {
      rewrites: [
        {
          from: /\.(js|css|json|png|jpe?g|gif|svg|ico|woff2?|eot|ttf|otf|mp4|webm|ogg|mp3|wav|flac|aac|map)(\?.*)?$/,
          to: (context: { parsedUrl: { pathname: string | null } }) =>
            context.parsedUrl.pathname ?? '',
        },
        {
          from: new RegExp(`^${escapeRegExp(config.base)}`),
          to: join(config.base, DEFAULT_HTML_TEMPLATE),
        },
      ],
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    static: {
      directory: resolveContext(DEFAULT_PUBLIC_DIR),
      publicPath: config.base,
    },
    client: {
      logging: 'none',
      overlay: {
        errors: true,
        warnings: false,
        runtimeErrors: false,
      },
      webSocketURL: `auto://0.0.0.0:${config.port}/ws`,
    },
  }
}

export function createRspackWatchOptions(): Configuration['watchOptions'] {
  return {
    aggregateTimeout: 500,
    ignored: /node_modules/,
  }
}
