import chalk from 'chalk'
import { logger } from '@ikaros-cli/infra-contrlibs'

/**
 * 错误级别
 * 'error' - 普通错误，会中断当前操作，但CLI进程不一定退出。
 * 'fatal' - 致命错误，会导致整个CLI进程立即退出。
 */
export type ErrorLevel = 'error' | 'fatal'

/**
 * CliError 构造函数的参数接口
 */
export interface CliErrorOptions {
  /** 错误消息 */
  message: string
  /** 唯一的错误码，便于识别和处理 */
  code: string
  /** 错误级别 */
  level?: ErrorLevel
  /** 给用户的修复建议 */
  suggestions?: string[]
  /** 原始的底层错误，用于调试 */
  cause?: unknown
}

/**
 * 结构化的构建时错误对象
 */
export class CliError extends Error {
  public readonly code: string
  public readonly level: ErrorLevel
  public readonly suggestions: string[]
  public readonly cause?: unknown

  constructor(options: CliErrorOptions) {
    super(options.message)
    this.name = 'CliError'
    this.code = options.code
    this.level = options.level ?? 'error'
    this.suggestions = options.suggestions ?? []
    this.cause = options.cause
  }
}

/**
 * 错误报告器的接口定义
 */
export interface IErrorReporter {
  report(error: CliError): Promise<void> | void
}

/**
 * 默认的控制台报告器，它将使用 LoggerSystem 来格式化输出
 */
class ConsoleReporter implements IErrorReporter {
  report(error: CliError): void {
    // 使用 logger.error 来格式化主要错误信息
    logger.error({ text: `[${error.code}] ${error.message}` })

    if (error.suggestions.length > 0) {
      console.log(chalk.yellow('Suggestions:'))
      error.suggestions.forEach((suggestion) => {
        console.log(chalk.cyan(`  - ${suggestion}`))
      })
      console.log('')
    }

    // 如果是开发模式或有详细日志标志，可以打印原始错误堆栈
    if (process.env.DEBUG && error.cause instanceof Error) {
      console.error(chalk.gray('Caused by:'))
      console.error(chalk.gray(error.cause.stack || error.cause.message))
    }
  }
}

/**
 * 统一错误处理器（单例模式）
 */
class ErrorHandler {
  private static instance: ErrorHandler
  private reporters: Set<IErrorReporter> = new Set()

  private constructor() {
    // 默认添加控制台报告器
    this.addReporter(new ConsoleReporter())
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  public addReporter(reporter: IErrorReporter) {
    this.reporters.add(reporter)
  }

  /**
   * 将未知类型的错误转换为 CliError
   * @param error 捕获到的未知错误
   * @returns 标准化的 CliError 对象
   */
  private normalizeError(error: unknown): CliError {
    if (error instanceof CliError) {
      return error
    }

    if (typeof error === 'string') {
      return new CliError({
        message: error,
        code: 'FATAL_STRING_ERROR',
        level: 'fatal',
        cause: error,
      })
    }

    if (error instanceof Error) {
      return new CliError({
        message: error.message,
        code: 'UNKNOWN_ERROR',
        level: 'fatal',
        cause: error,
      })
    }

    return new CliError({
      message: 'An unknown error occurred.',
      code: 'UNKNOWN_ERROR',
      level: 'fatal',
      cause: error,
    })
  }

  public async handle(error: unknown): Promise<void> {
    const buildError = this.normalizeError(error)

    for (const reporter of this.reporters) {
      await reporter.report(buildError)
    }

    if (buildError.level === 'fatal') {
      process.exit(1)
    }
  }
}

// 导出单例，方便在项目中任何地方使用
export const errorHandler = ErrorHandler.getInstance()
