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

/**
 * 日志系统
 *
 * 提供统一的格式化日志输出方法。
 */
export const LoggerSystem = /* @__PURE__ */ (() => {
  const done = createLogMethod('DONE', console.log)
  const error = createLogMethod('ERROR', console.error)
  const okay = createLogMethod('OKAY', console.log)
  const warning = createLogMethod('WARNING', console.warn)
  const info = createLogMethod('INFO', console.info)

  const instance = {
    done,
    error,
    okay,
    warning,
    info,
  }

  // 返回工厂函数，始终返回同一实例（单例）
  return () => instance
})()
