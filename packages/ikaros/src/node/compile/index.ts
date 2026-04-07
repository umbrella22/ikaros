import { Command, Option } from 'commander'

import { createIkaros } from '../core/create-ikaros'
import {
  Command as BuildCommand,
  type CompileOptions,
  type CompileServeParams,
} from './compile-context'

import type { ImportMetaBaseEnv } from '../../types/env'

const Platform: Record<string, ImportMetaBaseEnv['PLATFORM']> = {
  WEB: 'web',
  DESKTOPCLIENT: 'desktopClient',
  ELECTRON: 'desktopClient', // 别名，与文档保持一致
}

export type CompileCliOptions = CompileOptions & {
  config?: string
}

function createCommonCompileOptions(): Option[] {
  return [
    new Option('-m, --mode <name>', 'Environment variable'),
    new Option('-p, --platform <type>', 'build platform type')
      .default(Platform.WEB)
      .choices(Object.values(Platform)),
    new Option('-c, --config <file>', 'config file path'),
  ]
}

export function addCommonCompileOptions(command: Command): void {
  for (const option of createCommonCompileOptions()) {
    command.addOption(option)
  }
}

/**
 * 启动编译
 *
 * P3 重构后统一委托给 runCompile() 管线处理，
 * 不再在此处按 platform 手动分发到不同的 CompileService 类。
 */
export async function startCompile(params: CompileServeParams): Promise<void> {
  try {
    const ikaros = await createIkaros({
      options: params.options,
      configFile: params.configFile,
      context: params.context,
      onBuildStatus: params.onBuildStatus,
    })

    if (params.command === BuildCommand.SERVER) {
      await ikaros.dev()
      return
    }

    await ikaros.build()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`${message}\n`)
    process.exit(1)
  }
}

export function commander(program: Command): void {
  const dev = program
    .command(BuildCommand.SERVER, { isDefault: true })
    .description('Start local develop serve')
    .action(async (options: CompileCliOptions) => {
      await startCompile({
        command: BuildCommand.SERVER,
        options: {
          mode: options.mode,
          platform: options.platform,
        },
        configFile: options.config,
      })
    })

  const build = program
    .command(BuildCommand.BUILD)
    .description('Start build')
    .action(async (options: CompileCliOptions) => {
      await startCompile({
        command: BuildCommand.BUILD,
        options: {
          mode: options.mode,
          platform: options.platform,
        },
        configFile: options.config,
      })
    })

  addCommonCompileOptions(dev)
  addCommonCompileOptions(build)
}
