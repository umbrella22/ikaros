import type { BuildStatus } from '../bundler/types'
import { Command, type CompileOptions } from '../compile/compile-context'
import { runCompile } from '../compile/compile-pipeline'
import {
  inspectConfig,
  type InspectConfigParams,
  type InspectConfigResult,
} from '../inspect/inspect-config'
import {
  createCleanupRegistry,
  type CleanupRegistry,
} from '../watchdog/cleanup-registry'
import { createWatchdog, type WatchdogInstance } from '../watchdog/watchdog'
import { logger } from '../shared/logger'

const RUNTIME_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']

/** 实例级运行时错误：带 generation 归属 */
export class IkarosRuntimeError extends Error {
  readonly code: string
  readonly generation: number

  constructor(init: {
    code: string
    message: string
    generation: number
    cause?: unknown
  }) {
    super(init.message)
    this.name = 'IkarosRuntimeError'
    this.code = init.code
    this.generation = init.generation
    if (init.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = init.cause
    }
  }
}

export interface CreateIkarosOptions {
  readonly options: CompileOptions
  readonly configFile?: string
  readonly context?: string
  readonly onBuildStatus?: (status: BuildStatus) => void
}

export interface IkarosInstance {
  readonly options: CreateIkarosOptions
  dev: () => Promise<void>
  build: () => Promise<void>
  inspectConfig: (
    params?: Omit<InspectConfigParams, 'configFile' | 'context' | 'options'>,
  ) => Promise<InspectConfigResult>
  close: () => Promise<void>
}

export class DefaultIkarosInstance implements IkarosInstance {
  readonly options: CreateIkarosOptions

  private readonly cleanupRegistry: CleanupRegistry = createCleanupRegistry()
  private readonly signalHandlers = new Map<NodeJS.Signals, () => void>()
  private adapterConfigFiles: string[] = []

  private watchdog: WatchdogInstance | undefined
  private operation: Promise<void> = Promise.resolve()
  /** 每次 runCommand 递增；restart/close 安全判定用 */
  private generation = 0
  /** close() 之后为 true：迟到的 restart 不得复活旧 runtime */
  private closed = false

  constructor(options: CreateIkarosOptions) {
    this.options = options
  }

  dev(): Promise<void> {
    return this.enqueue(async () => {
      this.closed = false
      await this.stopRuntime()
      await this.runCommand(Command.SERVER)
      this.ensureWatchdog()
      this.attachSignalHandlers()
    })
  }

  build(): Promise<void> {
    return this.enqueue(async () => {
      this.closed = false
      await this.stopRuntime()
      await this.runCommand(Command.BUILD)
    })
  }

  inspectConfig(
    params: Omit<
      InspectConfigParams,
      'configFile' | 'context' | 'options'
    > = {},
  ): Promise<InspectConfigResult> {
    return this.enqueue(async () => {
      return inspectConfig({
        ...params,
        options: this.options.options,
        configFile: this.options.configFile,
        context: this.options.context,
      })
    })
  }

  close(): Promise<void> {
    return this.enqueue(async () => {
      this.closed = true
      await this.stopRuntime()
    })
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.operation.then(task, task)
    this.operation = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  /**
   * close 后迟到的 restart 回调属于旧 generation，
   * 直接忽略——不得在旧 runtime 关闭后复活新 runCommand。
   */
  private async restartDevRuntime(): Promise<void> {
    if (this.closed) {
      return
    }

    await this.runInstanceCleanup()
    await this.runCommand(Command.SERVER)
  }

  /** 运行实例级清理；失败聚合为带 code/generation 的类型化错误 */
  private async runInstanceCleanup(): Promise<void> {
    try {
      await this.cleanupRegistry.run()
    } catch (cause) {
      throw new IkarosRuntimeError({
        code: 'RUNTIME_CLEANUP_FAILED',
        message: cause instanceof Error ? cause.message : String(cause),
        generation: this.generation,
        cause,
      })
    }
  }

  private async runCommand(command: Command): Promise<void> {
    this.generation += 1
    const result = await runCompile({
      command,
      options: this.options.options,
      configFile: this.options.configFile,
      context: this.options.context,
      onBuildStatus: this.options.onBuildStatus,
      registerCleanup: this.cleanupRegistry.register,
    })
    this.adapterConfigFiles = result?.watchFiles ?? []
  }

  private ensureWatchdog(): void {
    if (this.watchdog) {
      return
    }

    // generation token：回调持有创建它的 watchdog 身份；
    // re-dev()/close() 后 this.watchdog 已更换或清空，
    // 旧 runtime 的迟到回调一律拒绝，不得清理/复活新 runtime
    const watchdog: WatchdogInstance = createWatchdog({
      context: this.options.context ?? process.cwd(),
      configFile: this.options.configFile,
      mode: this.options.options.mode,
      getAdditionalConfigFiles: () => this.adapterConfigFiles,
      onRestart: async () => {
        await this.enqueue(async () => {
          if (this.closed || this.watchdog !== watchdog) {
            return
          }
          await this.restartDevRuntime()
        })
      },
    })

    this.watchdog = watchdog
  }

  private async stopRuntime(): Promise<void> {
    const currentWatchdog = this.watchdog
    this.watchdog = undefined

    if (currentWatchdog) {
      await currentWatchdog.close()
    }

    this.detachSignalHandlers()
    await this.runInstanceCleanup()
  }

  private attachSignalHandlers(): void {
    if (this.signalHandlers.size > 0) {
      return
    }

    for (const signal of RUNTIME_SIGNALS) {
      const handler = () => {
        void this.close().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          logger.error({
            text: `关闭运行时失败: ${message}`,
          })
        })
      }
      this.signalHandlers.set(signal, handler)
      process.once(signal, handler)
    }
  }

  private detachSignalHandlers(): void {
    for (const [signal, handler] of this.signalHandlers) {
      process.removeListener(signal, handler)
    }

    this.signalHandlers.clear()
  }
}
