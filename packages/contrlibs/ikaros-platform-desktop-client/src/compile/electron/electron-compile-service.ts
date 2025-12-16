import { createRequire } from 'node:module'
import { join } from 'node:path'

import {
  Command,
  type CompileServeParame,
  LoggerSystem,
} from '@ikaros-cli/ikaros'

import { runDesktopClientBuild, runDesktopClientDev } from '../../runner'
import { ElectronRendererCompileService } from './renderer'
import { ElectronMainPreloadCompileService } from './electron-main-preload-compile-service.js'
import { ElectronAllRspackCompileService } from './electron-all-rspack-compile-service.js'

const { info, done, error } = LoggerSystem()

/**
 * Electron 编译服务
 * 负责协调 Electron 应用的编译流程
 */
export class ElectronCompileService {
  private parame: CompileServeParame

  constructor(parame: CompileServeParame) {
    this.parame = parame
  }

  /**
   * 启动 Electron 编译流程
   */
  static async create(parame: CompileServeParame): Promise<void> {
    const service = new ElectronCompileService(parame)

    if (parame.command === Command.SERVER) {
      await service.startDev()
    } else {
      await service.startBuild()
    }
  }

  /**
   * 开发模式启动流程
   * 1. 先启动渲染进程，获取端口
   * 2. 使用 runner 启动 Electron 主进程（包含预加载脚本）
   */
  private async startDev(): Promise<void> {
    info({ text: '🚀 开始启动 Electron 开发环境...' })

    try {
      const context = process.cwd()
      const contextRequire = createRequire(join(context, './'))
      const loadContextModule = <T>(id: string): T => contextRequire(id)

      let mainOnBuildStatus:
        | ((status: {
            success: boolean
            port?: number
            message?: string
          }) => void)
        | undefined
      let preloadOnBuildStatus:
        | ((status: {
            success: boolean
            port?: number
            message?: string
          }) => void)
        | undefined
      let mainPreloadDevPromise: Promise<unknown> | undefined

      const startMainPreloadDevOnce = () => {
        if (!mainPreloadDevPromise) {
          mainPreloadDevPromise = ElectronMainPreloadCompileService.create({
            ...this.parame,
            onBuildStatus: (status: {
              success: boolean
              port?: number
              message?: string
            }) => {
              mainOnBuildStatus?.(status)
              preloadOnBuildStatus?.(status)
            },
          })
        }
        return mainPreloadDevPromise
      }

      await runDesktopClientDev({
        entryFile: join(context, 'dist/electron/main/main.js'),
        loadContextModule,

        startRendererDev: () => this.startRendererDev(),

        startMainDev: async (options) => {
          mainOnBuildStatus = options?.onBuildStatus
          await startMainPreloadDevOnce()
        },

        startPreloadDev: async (options) => {
          preloadOnBuildStatus = options?.onBuildStatus
          await startMainPreloadDevOnce()
        },
      })

      done({ text: '🎉 Electron 开发环境启动完成！' })
    } catch (err) {
      error({ text: `❌ Electron 开发环境启动失败: ${err}` })
      throw err
    }
  }

  /**
   * 生产构建流程
   */
  private async startBuild(): Promise<void> {
    info({ text: '🔨 开始构建 Electron 应用...' })

    let triedUnionBuild = false
    let unionBuildSucceeded = false

    await runDesktopClientBuild({
      buildMain: async () => {
        // 优先：当渲染端使用 rspack 时，单次 rspack 多配置并行构建（main + preload + renderer）
        // 如果渲染端不是 rspack（比如 vite），则回退到原来的分步构建。
        triedUnionBuild = true
        try {
          await ElectronAllRspackCompileService.create(this.parame)
          unionBuildSucceeded = true
          return
        } catch {
          unionBuildSucceeded = false
        }

        // fallback：仅构建 main + preload（renderer 在 buildRenderer 中执行）
        await ElectronMainPreloadCompileService.create(this.parame)
      },
      buildPreload: async () => {
        // main+preload 已合并，这里保持兼容占位
      },
      buildRenderer: async () => {
        if (triedUnionBuild && unionBuildSucceeded) return
        await this.startRendererBuild()
      },
    })

    done({ text: '🎉 Electron 应用构建完成！' })
    return
  }

  private async startRendererDev(): Promise<number> {
    return ElectronRendererCompileService.dev(this.parame)
  }

  private async startRendererBuild(): Promise<string | undefined> {
    return ElectronRendererCompileService.build(this.parame)
  }
}
