import chalk from 'chalk'

type LogType = 'DONE' | 'ERROR' | 'OKAY' | 'WARNING' | 'INFO'
const eventArray: string[] = []
export const LoggerSystem = () => {
  const generateLog = (type: LogType, text: string) => {
    const colorMap = {
      DONE: chalk.bgGreen.white,
      ERROR: chalk.bgRed.white,
      OKAY: chalk.bgBlue.white,
      WARNING: chalk.bgYellow.white,
      INFO: chalk.bgCyan.white,
    }
    return colorMap[type](` ${type} `) + ` ${text}`
  }
  const done = ({ text, onlyText }: { text: string; onlyText?: boolean }) => {
    if (onlyText) {
      return generateLog('DONE', text)
    }
    console.log(generateLog('DONE', text))
  }
  const error = ({ text, onlyText }: { text: string; onlyText?: boolean }) => {
    if (onlyText) {
      return generateLog('ERROR', text)
    }
    console.error(generateLog('ERROR', text))
  }

  const okay = ({ text, onlyText }: { text: string; onlyText?: boolean }) => {
    if (onlyText) {
      return generateLog('OKAY', text)
    }
    console.log(generateLog('OKAY', text))
  }
  const warning = ({
    text,
    onlyText,
  }: {
    text: string
    onlyText?: boolean
  }) => {
    if (onlyText) {
      return generateLog('WARNING', text)
    }
    console.warn(generateLog('WARNING', text))
  }
  const info = ({ text, onlyText }: { text: string; onlyText?: boolean }) => {
    if (onlyText) {
      return generateLog('INFO', text)
    }
    console.info(generateLog('INFO', text))
  }
  const emitEvent = (event: string) => {
    const timestamp = new Date()
      .toLocaleTimeString('en-US', { hour12: false }) // 生成hh:mm:ss格式
      .split(' ')[0] // 移除时区信息
    eventArray.push(`[${timestamp}] ${event}`)
  }
  const clearEventArray = () => {
    eventArray.length = 0
  }
  return {
    done,
    error,
    okay,
    warning,
    info,
    emitEvent,
    clearEventArray,
    eventArray,
  }
}
