import rspack, {
  type DefinePluginOptions,
  type LightningcssLoaderOptions,
  type RspackPluginInstance,
} from '@rspack/core'
import { config } from 'dotenv'
import { join } from 'path'
import { createRequire } from 'node:module'
import url from 'node:url'
import { isObject } from 'radash'
import fse from 'fs-extra'
import chalk from 'chalk'
import fsp from 'fs/promises'

const getEnvPath = (mode?: string) => {
  if (!mode) {
    return join(rootDir, 'env', '.env')
  }
  return join(rootDir, 'env', `.env.${mode}`)
}

const checkEnv = async (mode?: string) => {
  const hasEnvFolder = await fse.pathExists(join(rootDir, 'env'))
  if (!hasEnvFolder) {
    console.log(chalk.yellow.bold('env folder not found'))
    return false
  }
  if (mode) {
    const hasEnv = await fse.pathExists(getEnvPath(mode))
    if (!hasEnv) {
      console.log(chalk.yellow.bold(`.env.${mode} file not found`))
      return false
    }
  } else {
    const hasEnv = await fse.pathExists(getEnvPath())
    if (!hasEnv) {
      console.log(chalk.yellow.bold('.env file not found'))
      return false
    }
    return true
  }
  return true
}

export const rootDir = process.cwd()

export const getEnv = async (mode?: string) => {
  const hasEnv = await checkEnv(mode)
  if (!hasEnv) {
    return {}
  }
  if (!mode) {
    return config({ path: getEnvPath() }).parsed ?? {}
  }
  return config({ path: getEnvPath(mode) }).parsed ?? {}
}

export const createEnvPlugin = ({
  mode,
  otherEnv = {},
}: {
  mode?: string
  otherEnv?: DefinePluginOptions
}): RspackPluginInstance => {
  const baseEnv = Object.assign({}, getEnv(mode))
  const clientEnvs = Object.fromEntries(
    Object.entries(baseEnv).map(([key, val]) => {
      return [`import.meta.env.${key}`, JSON.stringify(val)]
    }),
  )
  const envs = Object.fromEntries(
    Object.entries({ ...clientEnvs, ...otherEnv }).map(([key, val]) => {
      return [key, val]
    }),
  )
  return new rspack.DefinePlugin(envs)
}

export interface CssLoaderOptions {
  lightningcssOptions?: LightningcssLoaderOptions
  sourceMap?: boolean
  lessOptions?: Record<string, unknown>
  sassOptions?: Record<string, unknown>
  stylusOptions?: Record<string, unknown>
}

const createLoader = (loader: string, options?: unknown) => ({
  loader: loader.includes('builtin') ? loader : resolveCliPath.resolve(loader),
  options,
})

const cssLoaders = (env: string, options?: CssLoaderOptions) => {
  const { lightningcssOptions, sourceMap } = options ?? {}
  const cssLoader = createLoader('css-loader', { sourceMap, esModule: false })
  const lightningcssLoader = createLoader('builtin:lightningcss-loader', {
    ...lightningcssOptions,
  })

  const generateLoaders = (loader: string, loaderOptions?: unknown) => {
    const loaders = [lightningcssLoader]

    if (env !== 'production') {
      const vueStyleLoader = createLoader('vue-style-loader', {})
      loaders.unshift(vueStyleLoader, cssLoader)
    } else {
      const miniCssLoader = createLoader(rspack.CssExtractRspackPlugin.loader)
      loaders.unshift(miniCssLoader, cssLoader)
    }
    const rawOptions =
      options && (options as Record<string, unknown>)[`${loader}Options`]
    if (loader) {
      loaders.push(
        createLoader(
          `${loader}-loader`,
          Object.assign(rawOptions ?? {}, loaderOptions, {
            sourceMap,
          }),
        ),
      )
    }

    return loaders
  }

  return {
    less: generateLoaders('less'),
    sass: generateLoaders('sass', {
      indentedSyntax: true,
      api: 'modern-compiler',
      implementation: resolveCliPath.resolve('sass-embedded'),
    }),
    scss: generateLoaders('sass', {
      api: 'modern-compiler',
      implementation: resolveCliPath.resolve('sass-embedded'),
    }),
    stylus: generateLoaders('stylus'),
    styl: generateLoaders('stylus'),
  }
}

export const buildCssLoaders = (env: string, options?: CssLoaderOptions) => {
  const loaders = cssLoaders(env, options)

  return Object.entries(loaders).map(([extension, loader]) => ({
    test: new RegExp(`\\.${extension}$`),
    use: loader,
    type: 'javascript/auto',
  }))
}

export const mergeUserConfig = <T extends Record<string, never>>(
  target: T,
  source: T,
): T => {
  for (const key in source) {
    target[key] =
      isObject(source[key]) && key in target
        ? mergeUserConfig(target[key], source[key])
        : source[key]
  }
  return target
}

/**
 * cli目录
 */
export const CLI_PATH = url.fileURLToPath(new url.URL('../', import.meta.url))

export const resolveCliPath: NodeRequire = createRequire(CLI_PATH)

/**
 * 基于cli的绝对定位
 * @param ...paths 子路径
 */
export const resolveCLI = (...paths: string[]) => join(CLI_PATH, ...paths)

/**
 * 检查指定依赖是否存在（Promise化）
 * @param {string} packageName 要检查的包名
 * @returns {Promise<boolean>} 是否存在
 */
export async function checkDependency(packageName: string): Promise<boolean> {
  try {
    const modulePath = join(process.cwd(), 'node_modules', packageName)
    await fsp.access(modulePath, fsp.constants.F_OK)
    return true
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error // 抛出非"文件不存在"的其他错误
  }
}
