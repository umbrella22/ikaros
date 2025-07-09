import { Command, Option } from 'commander'
import { CompileService } from './start-compile-service'
import { Command as BuildCommand } from './base-compile-service'
import type { CompileOptions, CompileServeParams } from './base-compile-service'
import type { ImportMetaBaseEnv } from '../../types/env'
import { LoggerSystem } from '@ikaros-cli/infra-contrlibs'

const Platform: Record<string, ImportMetaBaseEnv['PLATFORM']> = {
  WEB: 'web',
}

/** 编译选项 */
const compileOptions = [
  new Option('-m, --mode <name>', 'Environment variable'),
  new Option('-p, --platform <type>', 'build platform type')
    .default(Platform.WEB)
    .choices(Object.values(Platform)),
]

/** 启动编译 */
export const startCompile = async (params: CompileServeParams) => {
  const { error } = new LoggerSystem()
  let _serviceInstance = null
  try {
    switch (params.options.platform) {
      case Platform.WEB: {
        _serviceInstance = new CompileService(params)
        break
      }
      default: {
        const platforms = Object.values(Platform).join(',')
        error({
          text: `No corresponding compilation service was found, platform: ${platforms}`,
        })
        throw new Error(
          `No corresponding compilation service was found, platform: ${params.options.platform}`,
        )
      }
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error))
  }
  return _serviceInstance
}

export const commander = (program: Command) => {
  /** dev */
  const dev = program
    .command(BuildCommand.SERVER, { isDefault: true })
    .description('Start local develop serve')
    .action(async (options: CompileOptions) => {
      const serviceInstance = await startCompile({
        command: BuildCommand.SERVER,
        options,
      })
      serviceInstance.dev()
    })

  /** build */
  const build = program
    .command(BuildCommand.BUILD)
    .description('Start build')
    .action(async (options: CompileOptions) => {
      const serviceInstance = await startCompile({
        command: BuildCommand.BUILD,
        options,
      })
      serviceInstance.build()
    })

  for (const option of compileOptions) {
    dev.addOption(option)
    build.addOption(option)
  }
}
