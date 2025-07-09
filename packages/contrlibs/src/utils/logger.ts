import chalk from 'chalk'

type LogType = 'DONE' | 'ERROR' | 'OKAY' | 'WARNING' | 'INFO'
enum LogTypeEnum {
  DONE = 'DONE',
  ERROR = 'ERROR',
  OKAY = 'OKAY',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

const typeColorMap = {
  DONE: chalk.bgGreen.white,
  ERROR: chalk.bgRed.white,
  OKAY: chalk.bgBlue.white,
  WARNING: chalk.bgYellow.white,
  INFO: chalk.bgCyan.white,
}

const textColorMap = {
  DONE: chalk.green,
  ERROR: chalk.red,
  OKAY: chalk.blue,
  WARNING: chalk.yellow,
  INFO: chalk.cyan,
}

export class LoggerSystem {
  static generateLog(type: LogType, text: string): string {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    return (
      chalk.gray(`[${timestamp}] `) +
      typeColorMap[type](` ${type} `) +
      textColorMap[type](` ${text} `) +
      '\n'
    )
  }

  public done({
    text,
    onlyText,
  }: {
    text: string
    onlyText?: boolean
  }): string | void {
    if (onlyText) {
      return LoggerSystem.generateLog(LogTypeEnum.DONE, text)
    }
    console.log(LoggerSystem.generateLog(LogTypeEnum.DONE, text))
  }

  public error({
    text,
    onlyText,
  }: {
    text: string
    onlyText?: boolean
  }): string | void {
    if (onlyText) {
      return LoggerSystem.generateLog(LogTypeEnum.ERROR, text)
    }
    console.error(LoggerSystem.generateLog(LogTypeEnum.ERROR, text))
  }

  public okay({
    text,
    onlyText,
  }: {
    text: string
    onlyText?: boolean
  }): string | void {
    if (onlyText) {
      return LoggerSystem.generateLog(LogTypeEnum.OKAY, text)
    }
    console.log(LoggerSystem.generateLog(LogTypeEnum.OKAY, text))
  }

  public warning({
    text,
    onlyText,
  }: {
    text: string
    onlyText?: boolean
  }): string | void {
    console.log(this)
    if (onlyText) {
      return LoggerSystem.generateLog(LogTypeEnum.WARNING, text)
    }
    console.warn(LoggerSystem.generateLog(LogTypeEnum.WARNING, text))
  }

  public info({
    text,
    onlyText,
  }: {
    text: string
    onlyText?: boolean
  }): string | void {
    if (onlyText) {
      return LoggerSystem.generateLog(LogTypeEnum.INFO, text)
    }
    console.info(LoggerSystem.generateLog(LogTypeEnum.INFO, text))
  }
}
