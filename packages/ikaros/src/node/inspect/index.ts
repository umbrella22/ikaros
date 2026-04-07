import { Command, Option } from 'commander'

import { createIkaros } from '../core/create-ikaros'
import { Command as IkarosCommand } from '../compile/compile-context'
import {
  addCommonCompileOptions,
  type CompileCliOptions,
} from '../compile/index'
import { LoggerSystem } from '../shared/logger'

export {
  inspectConfig,
  type InspectEnvDiagnostics,
  type InspectConfigParams,
  type InspectConfigResult,
  type InspectHookDiagnostics,
  type InspectWatchDiagnostics,
} from './inspect-config'
export {
  serializeConfig,
  type SerializedInspectValue,
} from './serialize-config'

type InspectCliOptions = CompileCliOptions & {
  command: IkarosCommand
  output?: string
}

export async function startInspect(options: InspectCliOptions): Promise<void> {
  try {
    const ikaros = await createIkaros({
      options: {
        mode: options.mode,
        platform: options.platform,
      },
      configFile: options.config,
    })

    const result = await ikaros.inspectConfig({
      command: options.command,
      writeToDisk: true,
      outputFile: options.output,
    })

    LoggerSystem().done({
      text: `inspect 配置已写入 ${result.outputFile}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exit(1)
  }
}

export function commander(program: Command): void {
  const inspect = program

    .command('inspect')
    .description('Inspect resolved config')

  inspect.addOption(
    new Option('--command <type>', 'inspect as server or build mode')
      .choices([IkarosCommand.SERVER, IkarosCommand.BUILD])
      .default(IkarosCommand.BUILD),
  )
  inspect.option('-o, --output <file>', 'write inspect result to file')
  addCommonCompileOptions(inspect)

  inspect.action(async (options: InspectCliOptions) => {
    await startInspect(options)
  })
}
