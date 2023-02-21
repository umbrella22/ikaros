import { cac } from 'cac'
import type { LogLevel } from './node/logger'
import { createLogger } from './node/logger'
import { VERSION } from './node/constants'

const cli = cac('ikaros')

cli
  .option('-m , --mode <mode>', '[dev | prod | test | sit | ...] 环境模式 ')
  .option('dev, server', '开发环境启动,允许衔接m[mode]参数来控制当前环境')
  .option('build', '打包模式，')

interface GlobalCLIOptions {
  '--': string[]
  m: string
  mode: string
}
cli
  .command('[config-file]', 'start dev server')
  .alias('dev')
  .alias('server')
  .action(async (configFile: undefined | string, options: GlobalCLIOptions) => {
    console.log('dev mode', options, configFile)
  })

cli
  .command('build [root]', 'build app with mode')
  .alias('build')
  .action(async (options: GlobalCLIOptions) => {
    console.log('build mode', options)
  })

cli.help()
cli.version(VERSION)
cli.parse()
