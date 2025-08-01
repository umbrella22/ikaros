import {
  type RspackPluginInstance,
  type Compiler,
  rspack,
  type StatsCompilation,
  Stats,
} from '@rspack/core'
import chalk from 'chalk'
import ora from 'ora'
import os from 'node:os'
import prettyBytes from 'pretty-bytes'
import EasyTable from 'easy-table'
import cliCursor from 'cli-cursor'

import path from 'node:path'
import process from 'node:process'
import { isArray } from 'radashi'
import { name, version } from '../../../package.json'
import { logger } from '@ikaros-cli/infra-contrlibs'
import type { Pages } from '../utils/loaders-plugins-helper'

// 定义插件自己的配置接口
export interface StatsPluginOptions {
  // 只包含插件真正需要的配置项
  gzip?: boolean
  base?: string
  pages?: Pages
  // 添加插件特有的配置选项
  showTable?: boolean
  maxTableEntries?: number
}

const cliPackageJson = { name, version }
const PLUGIN_NAME = '@rspack/ikaros-stats-plugin'
const black = chalk.hex('#222222')

/** 进度插件 */
export default class StatsPlugin implements RspackPluginInstance {
  private compiler!: Compiler

  private ora: ReturnType<typeof ora>

  private config?: StatsPluginOptions

  private startCompileHrtime: ReturnType<typeof process.hrtime> | undefined =
    undefined

  private isDev?: boolean

  private lastProgressText?: string

  constructor(config?: StatsPluginOptions) {
    this.config = config

    this.ora = ora({
      color: 'cyan',
      prefixText: '',
      hideCursor: false,
    })
  }

  public apply(compiler: Compiler): void {
    this.compiler = compiler

    this.isDev = compiler.options.mode === 'development'

    new rspack.ProgressPlugin(this.progressHandler.bind(this)).apply(compiler)

    cliCursor.hide()

    if (this.isDev) {
      this.initDevHook()
    } else {
      this.initProdHook()
    }
  }

  private progressHandler(
    percentage: number,
    message: string,
    ...args: string[]
  ) {
    let text = `${(percentage * 100).toFixed(2)}%`
    text += ` ${message} `
    text += chalk.gray(args?.join(' '))

    if (this.lastProgressText === text) {
      return
    }

    this.lastProgressText = text

    if (this.isDev) {
      this.ora.text = `${text}\n`
    } else {
      console.log(text)
    }
  }

  /** 更开始计时 */
  private updateStartCompileTime() {
    this.startCompileHrtime = process.hrtime()
  }

  /** 获取结束时间 */
  private getCurrentEndCompileTime() {
    const end = process.hrtime(this.startCompileHrtime)
    return (end[0] * 1e9 + end[1]) / 1e6
  }

  private getError(stast: StatsCompilation) {
    const { errors, errorsCount = 0 } = stast

    if (!errors || errorsCount === 0) return

    return errors
      .map((item) => `${black.bgRed(' ERROR ')} ${item.message.trim()}`)
      .join('\n\n')
  }

  private getWarn(stast: StatsCompilation) {
    const { warnings, warningsCount = 0 } = stast

    if (!warnings || warningsCount === 0) return

    return warnings
      .map((item) => `${black.bgYellow(' WARN ')} ${item.message.trim()}`)
      .join('\n\n')
  }

  /**
   * 结束语
   */
  private getEndTips(stast: StatsCompilation, time: number) {
    const { gray, cyan, red, green, yellow } = chalk
    const { errorsCount = -1, warningsCount = -1 } = stast

    const timer = ((time as number) / 1000).toFixed(2)

    if (errorsCount > 0) {
      return gray(
        `${cyan(cliPackageJson.name)} compiled with${red(
          ` ${errorsCount} error`,
        )}`,
      )
    }

    if (warningsCount > 0) {
      return gray(
        `compile ${green('success')} and with ${yellow(
          `${warningsCount} warning`,
        )}, time: ${timer}s`,
      )
    }

    return gray(`compile ${green('success')}, time: ${timer}s.`)
  }

  /**
   * 获取资源表格
   */
  private getTableInfo(stast: StatsCompilation) {
    const { assets } = stast

    if (!assets || assets.length === 0) return

    const table = new EasyTable()
    const isGzip = this.config?.gzip ?? false

    let sizeTotal = 0
    let gzipTotal = 0
    let ignored = false
    let gzip = 0
    let gzipItem: StatsCompilation['StatsAsset'] | undefined

    for (let i = 0; i < assets.length; i++) {
      const { name, size, related, info } = assets[i]

      if (info.development) continue

      if (isGzip && isArray(related)) {
        gzipItem = related.find((item) => item.type === 'gzipped')
        if (gzipItem) {
          gzip = gzipItem.size
          gzipTotal += gzip
        }
      }

      sizeTotal += size

      if (assets.length > 20 && i >= 4 && i < assets.length - 1 - 4) {
        if (!ignored) {
          ignored = true
          table.cell('name', '....')
          table.cell('size', '....')
          if (isGzip && gzipItem) {
            table.cell('gzip', '....')
          }
          table.newRow()
        }
        continue
      }

      table.cell('name', name)
      table.cell('size', prettyBytes(size))
      if (isGzip && gzipItem) {
        table.cell('gzip', prettyBytes(gzip))
      }

      table.newRow()
    }

    table.pushDelimeter()

    table.cell('name', `There are ${assets.length} files`)
    table.cell('size', prettyBytes(sizeTotal))
    if (isGzip && gzipItem) {
      table.cell('gzip', prettyBytes(gzipTotal))
    }

    table.newRow()

    return chalk.cyan.dim(table.toString().trim())
  }

  /**
   * 获取ip
   */
  private getHostList() {
    const { config, compiler } = this
    const { devServer } = compiler.options

    const userHttps =
      devServer?.server === 'https' || typeof devServer?.server === 'object'
    const userPort = Number(devServer?.port)

    let hosts: string[] = []
    let urlPaht = ''
    const networks = Object.values(os.networkInterfaces())

    if (config) {
      urlPaht = config.base ?? ''
      if (!urlPaht || urlPaht === 'auto') {
        urlPaht = '/'
      }

      const firstPage = Object.keys(config?.pages || {})[0]
      if (firstPage && firstPage !== 'index') {
        urlPaht = path.join(urlPaht, `${firstPage}.html`)
      } else if (!urlPaht.endsWith('/')) {
        urlPaht += '/'
      }
    }

    for (const item of networks) {
      const { address } = item?.find((net) => net.family === 'IPv4') || {}
      if (!address) continue
      hosts.push(address)
    }

    hosts.sort((a, b) => {
      const as = a.split('.')
      const bs = b.split('.')
      for (const [i] of as.entries()) {
        if (a[i] === bs[i]) continue
        return Number(bs[i]) - Number(a[i])
      }
      return 0
    })

    const loaclIndex = hosts.indexOf('127.0.0.1')
    if (loaclIndex !== -1) {
      hosts.splice(loaclIndex, 1)
      hosts.unshift('localhost')
    }

    hosts = hosts.map((item) => {
      if (userHttps) {
        item = `https://${item}`
        if (userPort !== 443) {
          item = item + ':' + userPort
        }
      } else {
        item = 'http://' + item
        if (userPort !== 80) {
          item = item + ':' + userPort
        }
      }
      const url = new URL(urlPaht, item)
      return url.href
    })

    return hosts
  }

  /**
   * 开发时
   */
  private initDevHook() {
    const { compiler, ora } = this

    const hosts = this.getHostList()
    const { blue, cyan, gray } = chalk

    compiler.hooks.environment.intercept({
      name: PLUGIN_NAME,
      call() {
        ora.start('Preparing resource files....')
      },
    })

    compiler.hooks.watchRun.intercept({
      name: PLUGIN_NAME,
      call: () => {
        if (!ora.isSpinning) {
          console.clear()
        }
        ora.start()
        this.updateStartCompileTime()
      },
    })

    compiler.hooks.done.intercept({
      name: PLUGIN_NAME,
      call: (stast: Stats) => {
        ora.stop()
        console.clear()

        const { eventArray } = logger

        const stastJson = stast.toJson({
          preset: 'errors-warnings',
          colors: true,
          timings: true,
        })

        const { errorsCount = 0, warningsCount = 0 } = stastJson

        if (eventArray.length > 0) {
          console.log(eventArray.map((item) => item).join('\n'))
          console.log()
        }

        if (errorsCount > 0) {
          console.log(this.getError(stastJson))
          console.log()
        } else {
          if (warningsCount > 0) {
            console.log(this.getWarn(stastJson))
            console.log()
          }

          const { name, version } = cliPackageJson
          let hostTips = `${cyan(`${name} v${version}`)} entry address:\n\n`
          for (const host of hosts) {
            hostTips += blue(`    ${host}\n`)
          }
          console.log(gray(hostTips))
        }

        console.log(this.getEndTips(stastJson, this.getCurrentEndCompileTime()))
        console.log()
      },
    })
  }

  /**
   * 生产时
   */
  private initProdHook() {
    const { compiler } = this

    let stastJson: StatsCompilation
    let isError = false

    compiler.hooks.environment.intercept({
      name: PLUGIN_NAME,
      call: () => {
        console.log(chalk.gray('start build...'))
        this.updateStartCompileTime()
      },
    })

    compiler.hooks.failed.intercept({
      name: PLUGIN_NAME,
      call: () => {
        isError = true
        console.log(chalk.red('build failed'))
        console.clear()
      },
    })

    compiler.hooks.done.intercept({
      name: PLUGIN_NAME,
      call: (stast: Stats) => {
        stastJson = stast.toJson({
          preset: 'normal',
          colors: true,
          assetsSort: 'size',
        })
        this.handleProOutput(stastJson, isError)
      },
    })
  }
  /**
   * 处理生产环境的输出
   * @param stastJson 编译结果
   * @param isError 是否有错误
   */
  private handleProOutput(stastJson: StatsCompilation, isError: boolean) {
    if (isError) {
      return
    }
    console.clear()
    const { errorsCount = 0, warningsCount = 0 } = stastJson

    console.log()

    if (errorsCount > 0) {
      console.log(this.getError(stastJson))
      console.log()
    } else {
      if (warningsCount > 0) {
        console.log(this.getWarn(stastJson))
        console.log()
      }

      if (stastJson) {
        // eslint-disable-next-line no-console
        console.log(this.getTableInfo(stastJson))
      }
      console.log()
    }

    console.log(this.getEndTips(stastJson, this.getCurrentEndCompileTime()))
  }
}
