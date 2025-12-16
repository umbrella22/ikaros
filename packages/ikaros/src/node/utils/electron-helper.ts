import { join } from 'node:path'
import { basename, extname } from 'node:path'
import { type Configuration } from '@rspack/core'
import type { UserConfig } from '../user-config'
import { extensions, resolveCLI } from './const'
import { CreateLoader, CreatePlugins } from './loader-plugin-helper'

export class ElectronCompileHelper {
  /**
   * 获取Electron默认配置
   */
  static getDefaultElectronConfig(): Required<UserConfig>['electron'] {
    return {
      main: {
        entry: 'src/main/index.ts',
        output: 'dist/electron/main',
      },
      preload: {
        entries: ['src/preload/index.ts'],
        output: 'dist/electron/main',
      },
      renderer: {},
      build: {
        hotReload: true,
        debug: true,
        outDir: 'dist/electron',
      },
    }
  }

  /**
   * 合并用户配置和默认配置
   */
  static mergeElectronConfig(
    userConfig?: UserConfig,
  ): Required<UserConfig>['electron'] {
    const defaultConfig = this.getDefaultElectronConfig()
    const userElectronConfig = userConfig?.electron || {}

    return {
      main: {
        ...defaultConfig.main,
        ...userElectronConfig.main,
      },
      preload: {
        ...defaultConfig.preload,
        ...userElectronConfig.preload,
      },
      renderer: {
        ...defaultConfig.renderer,
        ...userElectronConfig.renderer,
      },
      build: {
        ...defaultConfig.build,
        ...userElectronConfig.build,
      },
    }
  }

  /**
   * 创建Electron基础配置
   */
  static createBaseConfig(
    context: string,
    env: 'development' | 'production',
    userConfig?: UserConfig,
  ): Partial<Configuration> {
    const loaderHelper = new CreateLoader({ env })
    const pluginHelper = new CreatePlugins({ env })

    const rules = loaderHelper
      .useDefaultScriptLoader()
      .add(userConfig?.loaders)
      .end()

    const plugins = pluginHelper
      .useDefaultEnvPlugin({
        env: {},
        extEnv: userConfig?.define,
      })
      .add(userConfig?.plugins)
      .end()

    return {
      mode: env,
      context,
      resolve: {
        alias: {
          '@': join(context, 'src'),
          ...userConfig?.resolve?.alias,
        },
        extensions: userConfig?.resolve?.extensions || extensions,
        modules: [
          'node_modules',
          join(context, 'node_modules'),
          resolveCLI('node_modules'),
        ],
      },
      stats: 'none',
      watchOptions: {
        aggregateTimeout: 500,
        ignored: /node_modules/,
      },
      module: {
        rules,
      },
      plugins,
      externals: {
        electron: 'commonjs electron',
      },
    }
  }

  /**
   * 获取Electron输出目录
   */
  static getElectronOutputDir(
    context: string,
    electronConfig: Required<UserConfig>['electron'],
    type: 'main' | 'preload' | 'renderer',
  ): string {
    const baseDir = electronConfig.build!.outDir!
    const typeDir = type === 'renderer' ? 'renderer' : 'main'

    if (type === 'main' && electronConfig.main?.output) {
      return join(context, electronConfig.main.output)
    }

    if (type === 'preload' && electronConfig.preload?.output) {
      return join(context, electronConfig.preload.output)
    }

    return join(context, baseDir, typeDir)
  }

  /**
   * 格式化预加载脚本入口
   */
  static formatPreloadEntries(
    entries: string[] | Record<string, string>,
  ): Record<string, string> {
    if (Array.isArray(entries)) {
      const formatted: Record<string, string> = {}
      entries.forEach((entry) => {
        const fileBase = basename(entry, extname(entry))
        const name = `preload-${fileBase}`
        if (formatted[name]) {
          throw new Error(`preload.entries 存在重复文件名导致输出冲突: ${name}`)
        }

        formatted[name] = entry
      })
      return formatted
    }
    return entries
  }

  /**
   * 检查是否为Electron平台
   */
  static isElectronPlatform(platform: string): boolean {
    return platform === 'electron' || platform === 'electron-renderer'
  }

  /**
   * 获取开发环境端口
   */
  static async getDevPort(defaultPort: number = 9080): Promise<number> {
    try {
      const { detect } = await import('detect-port')
      return await detect(defaultPort)
    } catch {
      return defaultPort
    }
  }
}
