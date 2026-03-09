import { Command, Option } from 'commander'

import { runCompileWithWatchdog } from './compile-pipeline'
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

/** 编译选项 */
const compileOptions = [
  new Option('-m, --mode <name>', 'Environment variable'),
  new Option('-p, --platform <type>', 'build platform type')
    .default(Platform.WEB)
    .choices(Object.values(Platform)),
]

/**
 * 启动编译
 *
 * P3 重构后统一委托给 runCompile() 管线处理，
 * 不再在此处按 platform 手动分发到不同的 CompileService 类。
 */
export async function startCompile(params: CompileServeParams): Promise<void> {
  try {
    await runCompileWithWatchdog(params)
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
    .action(async (options: CompileOptions) => {
      await startCompile({
        command: BuildCommand.SERVER,
        options,
      })
    })

  const build = program
    .command(BuildCommand.BUILD)
    .description('Start build')
    .action(async (options: CompileOptions) => {
      await startCompile({
        command: BuildCommand.BUILD,
        options,
      })
    })

  for (const option of compileOptions) {
    dev.addOption(option)
    build.addOption(option)
  }
}
