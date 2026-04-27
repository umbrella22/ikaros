// shared/logger.ts — 日志系统
/* eslint-disable no-console */

import chalk from 'chalk'

type LogType = 'DONE' | 'ERROR' | 'OKAY' | 'WARNING' | 'INFO'

const colorMap: Record<LogType, (text: string) => string> = {
  DONE: chalk.bgGreen.white,
  ERROR: chalk.bgRed.white,
  OKAY: chalk.bgBlue.white,
  WARNING: chalk.bgYellow.white,
  INFO: chalk.bgCyan.white,
}

const formatLog = (type: LogType, text: string): string => {
  return colorMap[type](` ${type} `) + ` ${text}`
}

const createLogMethod =
  (type: LogType, consoleFn: typeof console.log) =>
  ({ text, onlyText }: { text: string; onlyText?: boolean }) => {
    const formatted = formatLog(type, text)
    if (onlyText) return formatted
    consoleFn(formatted)
  }

const loggerInstance = {
  done: createLogMethod('DONE', console.log),
  error: createLogMethod('ERROR', console.error),
  okay: createLogMethod('OKAY', console.log),
  warning: createLogMethod('WARNING', console.warn),
  info: createLogMethod('INFO', console.info),
}

/**
 * 日志系统
 *
 * 提供统一的格式化日志输出方法。在调用侧以 `LoggerSystem()` 返回单例。
 */
export function LoggerSystem(): typeof loggerInstance {
  return loggerInstance
}
