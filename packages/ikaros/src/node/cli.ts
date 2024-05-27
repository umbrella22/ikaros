import { cac } from 'cac'
import { cliPackageJson } from './utils/tools'
import { devRunner } from './runner/dev-runner'

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
    devRunner(configFile)
  })

cli
  .command('build [root]', 'build app with mode')
  .alias('build')
  .action(async (options: GlobalCLIOptions) => {
    console.log('build mode', options)
  })

cli.help()
cli.version(cliPackageJson.version)
cli.parse()