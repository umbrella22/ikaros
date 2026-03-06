// bundler/rspack/create-library-rspack-config.ts — Rspack 库模式配置生成

import type { Configuration, ExternalItemValue } from '@rspack/core'
import { rspack } from '@rspack/core'

import type { LibraryConfig, LibraryFormat } from '../../config/user-config'
import type { CreateConfigParams } from '../types'
import { DEFAULT_OUT_DIR, extensions } from '../../shared/constants'

// ─── Format Mapping ─────────────────────────────────────────────────────────

/**
 * 将统一的 LibraryFormat 映射为 Rspack output.library.type
 */
const mapFormatToRspackLibraryType = (
  format: LibraryFormat,
): 'module' | 'commonjs2' | 'umd' | 'iife' => {
  switch (format) {
    case 'es':
      return 'module'
    case 'cjs':
      return 'commonjs2'
    case 'umd':
      return 'umd'
    case 'iife':
      return 'iife'
  }
}

/**
 * 根据格式推断输出文件扩展名
 */
const getFormatExtension = (format: LibraryFormat): string => {
  switch (format) {
    case 'es':
      return '.mjs'
    case 'cjs':
      return '.cjs'
    case 'umd':
      return '.umd.cjs'
    case 'iife':
      return '.iife.js'
  }
}

// ─── Entry Resolution ───────────────────────────────────────────────────────

const resolveEntry = (
  entry: LibraryConfig['entry'],
  resolveContext: (...paths: string[]) => string,
): Record<string, string> | string => {
  if (typeof entry === 'string') {
    return resolveContext(entry)
  }

  if (Array.isArray(entry)) {
    if (entry.length === 1) {
      return resolveContext(entry[0])
    }
    return Object.fromEntries(
      entry.map((e, i) => [`entry${i}`, resolveContext(e)]),
    )
  }

  // Record<string, string>
  return Object.fromEntries(
    Object.entries(entry).map(([name, path]) => [name, resolveContext(path)]),
  )
}

const isMultiEntry = (entry: LibraryConfig['entry']): boolean => {
  if (typeof entry === 'string') return false
  if (Array.isArray(entry)) return entry.length > 1
  return Object.keys(entry).length > 1
}

// ─── Externals Resolution ───────────────────────────────────────────────────

const resolveExternals = (
  externals: LibraryConfig['externals'],
  globals: LibraryConfig['globals'],
  format: LibraryFormat,
): Configuration['externals'] | undefined => {
  if (!externals?.length) return undefined

  // 对于 UMD/IIFE 格式，需要映射到全局变量
  if ((format === 'umd' || format === 'iife') && globals) {
    const result: Record<string, ExternalItemValue> = {}
    for (const ext of externals) {
      if (typeof ext === 'string') {
        const globalName = globals[ext]
        if (globalName) {
          result[ext] = {
            root: globalName,
            commonjs: ext,
            commonjs2: ext,
            amd: ext,
          }
        } else {
          result[ext] = ext
        }
      }
      // RegExp externals 通过另一种方式处理
    }

    // 收集 RegExp externals
    const regexExternals = externals.filter(
      (ext): ext is RegExp => ext instanceof RegExp,
    )

    if (regexExternals.length > 0) {
      return [result, ...regexExternals]
    }

    return result
  }

  // 对于 ES/CJS 格式，直接使用字符串和正则
  return externals.map((ext) => (typeof ext === 'string' ? ext : ext))
}

// ─── File Name Resolution ───────────────────────────────────────────────────

const resolveFileName = (
  fileName: LibraryConfig['fileName'],
  format: LibraryFormat,
  entryName: string,
  pkgName?: string,
): string => {
  if (typeof fileName === 'function') {
    return fileName(format, entryName)
  }

  const baseName = fileName ?? pkgName ?? 'index'

  return `${baseName}${getFormatExtension(format)}`
}

// ─── Output Path ────────────────────────────────────────────────────────────

const getOutDirPath = (
  params: Pick<CreateConfigParams, 'userConfig' | 'resolveContext'>,
): string => {
  const { userConfig, resolveContext } = params
  const outDirName = userConfig?.build?.outDirName

  if (typeof outDirName === 'string' && outDirName) {
    return resolveContext(outDirName)
  }

  return resolveContext(DEFAULT_OUT_DIR)
}

// ─── Single Format Config ───────────────────────────────────────────────────

const createSingleFormatConfig = (params: {
  format: LibraryFormat
  library: LibraryConfig
  configParams: CreateConfigParams
}): Configuration => {
  const { format, library, configParams } = params
  const { context, contextPkg, userConfig, browserslist, resolveContext } =
    configParams

  const isEsm = format === 'es'
  const entry = resolveEntry(library.entry, resolveContext)
  const outDir = getOutDirPath({ userConfig, resolveContext })
  const needsName = format === 'umd' || format === 'iife'

  const fileName = resolveFileName(
    library.fileName,
    format,
    typeof entry === 'string' ? 'index' : Object.keys(entry)[0],
    contextPkg?.name,
  )

  return {
    mode: 'production',
    context,
    entry,
    target: isEsm
      ? ['web', 'es2015']
      : ['web', 'es2015', `browserslist:${browserslist}`],
    resolve: {
      alias: {
        '@': resolveContext('src'),
        ...userConfig?.resolve?.alias,
      },
      extensions: userConfig?.resolve?.extensions || extensions,
    },
    output: {
      clean: true,
      path: outDir,
      filename: fileName,
      ...(isEsm ? { module: true } : {}),
      library: {
        ...(needsName && library.name ? { name: library.name } : {}),
        type: mapFormatToRspackLibraryType(format),
      },
      globalObject: format === 'umd' ? 'this' : undefined,
    },
    externals: resolveExternals(library.externals, library.globals, format),
    externalsType: isEsm ? 'module' : undefined,
    optimization: {
      minimize: true,
      minimizer: [
        new rspack.LightningCssMinimizerRspackPlugin(),
        new rspack.SwcJsMinimizerRspackPlugin(),
      ],
    },
    plugins: [
      ...(userConfig?.define
        ? [new rspack.DefinePlugin(userConfig.define as Record<string, string>)]
        : []),
      ...(userConfig?.plugins
        ? Array.isArray(userConfig.plugins)
          ? userConfig.plugins
          : [userConfig.plugins]
        : []),
    ],
    module: {
      rules: [
        {
          test: /\.(j|t)sx?$/,
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'typescript',
                    tsx: true,
                  },
                },
              },
            },
          ],
          type: 'javascript/auto',
        },
      ],
    },
    experiments: {
      ...(isEsm ? { outputModule: true } : {}),
      css: true,
    },
    devtool: userConfig?.build?.sourceMap ? 'source-map' : false,
    stats: 'none',
  } as Configuration
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * 为 Rspack 库模式创建一组配置（每个格式一个配置）
 *
 * @returns 如果只有一个格式返回单个 Configuration，多格式返回 Configuration[]
 */
export const createLibraryRspackConfigs = (
  params: CreateConfigParams,
): Configuration | Configuration[] => {
  const library = params.userConfig?.library
  if (!library) {
    throw new Error('[ikaros] library config is required for library mode')
  }

  const multi = isMultiEntry(library.entry)
  const formats = library.formats ?? (multi ? ['es', 'cjs'] : ['es', 'umd'])

  const configs = formats.map((format) =>
    createSingleFormatConfig({
      format,
      library,
      configParams: params,
    }),
  )

  return configs.length === 1 ? configs[0] : configs
}
