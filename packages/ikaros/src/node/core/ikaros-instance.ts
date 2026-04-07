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

const RUNTIME_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']

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

  private watchdog: WatchdogInstance | undefined
  private operation: Promise<void> = Promise.resolve()

  constructor(options: CreateIkarosOptions) {
    this.options = options
  }

  dev(): Promise<void> {
    return this.enqueue(async () => {
      await this.stopRuntime()
      await this.runCommand(Command.SERVER)
      this.ensureWatchdog()
      this.attachSignalHandlers()
    })
  }

  build(): Promise<void> {
    return this.enqueue(async () => {
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

  private async restartDevRuntime(): Promise<void> {
    await this.cleanupRegistry.run()
    await this.runCommand(Command.SERVER)
  }

  private async runCommand(command: Command): Promise<void> {
    await runCompile({
      command,
      options: this.options.options,
      configFile: this.options.configFile,
      context: this.options.context,
      onBuildStatus: this.options.onBuildStatus,
      registerCleanup: this.cleanupRegistry.register,
    })
  }

  private ensureWatchdog(): void {
    if (this.watchdog) {
      return
    }

    this.watchdog = createWatchdog({
      context: this.options.context ?? process.cwd(),
      configFile: this.options.configFile,
      mode: this.options.options.mode,
      onRestart: async () => {
        await this.enqueue(async () => {
          await this.restartDevRuntime()
        })
      },
    })
  }

  private async stopRuntime(): Promise<void> {
    const currentWatchdog = this.watchdog
    this.watchdog = undefined

    if (currentWatchdog) {
      await currentWatchdog.close()
    }

    this.detachSignalHandlers()
    await this.cleanupRegistry.run()
  }

  private attachSignalHandlers(): void {
    if (this.signalHandlers.size > 0) {
      return
    }

    for (const signal of RUNTIME_SIGNALS) {
      const handler = () => {
        void this.close()
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
