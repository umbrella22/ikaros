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
 * 每次调用返回同一组方法，事件数组内聚在闭包内，避免模块级可变状态。
 * 注意：多次调用 LoggerSystem() 会创建独立的事件数组。
 * 如需共享状态，请在模块级缓存调用结果。
 */
export const LoggerSystem = /* @__PURE__ */ (() => {
  const eventArray: string[] = []

  const done = createLogMethod('DONE', console.log)
  const error = createLogMethod('ERROR', console.error)
  const okay = createLogMethod('OKAY', console.log)
  const warning = createLogMethod('WARNING', console.warn)
  const info = createLogMethod('INFO', console.info)

  const emitEvent = (event: string) => {
    const timestamp = new Date()
      .toLocaleTimeString('en-US', { hour12: false })
      .split(' ')[0]
    eventArray.push(`[${timestamp}] ${event}`)
  }

  const clearEventArray = () => {
    eventArray.length = 0
  }

  const instance = {
    done,
    error,
    okay,
    warning,
    info,
    emitEvent,
    clearEventArray,
    eventArray,
  }

  // 返回工厂函数，始终返回同一实例（单例）
  return () => instance
})()
