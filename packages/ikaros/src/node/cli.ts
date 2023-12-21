import { cac } from 'cac'
import { cliPackageJson } from './utils'
import { resolveConfig } from './utils/load-config'
import { buildViteConfig } from './utils/build-vite-config'
import { buildRollupConfig } from './utils/build-rollup-config'

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
    resolveConfig({ configPath: process.cwd(), configName: configFile })
      .then((config) => {
        console.log(buildViteConfig(config))
        console.log(buildRollupConfig(config))
      })
      .catch((e) => {
        console.log(e)
      })
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
