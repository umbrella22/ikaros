import { Command, Option } from 'commander'
import { WebCompileService } from './web-compile-service'
import { Command as BuildCommand } from './base-compile-service'
import type { CompileOptions, CompileServeParame } from './base-compile-service'
import type { ImportMetaBaseEnv } from '../../types/env'

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
export const startCompile = (parame: CompileServeParame) => {
  switch (parame.options.platform) {
    case Platform.WEB: {
      new WebCompileService(parame)
      break
    }
    default: {
      const platforms = Object.values(Platform).join(',')
      console.error(
        `No corresponding compilation service was found, platform: ${platforms}`,
      )
      process.exit(1)
    }
  }
}

export const commander = (program: Command) => {
  /** dev */
  const dev = program
    .command(BuildCommand.SERVER, { isDefault: true })
    .description('Start local develop serve')
    .action((options: CompileOptions) => {
      startCompile({
        command: BuildCommand.SERVER,
        options,
      })
    })

  /** build */
  const build = program
    .command(BuildCommand.BUILD)
    .description('Start build')
    .action((options: CompileOptions) => {
      startCompile({
        command: BuildCommand.BUILD,
        options,
      })
    })

  for (const option of compileOptions) {
    dev.addOption(option)
    build.addOption(option)
  }
}
