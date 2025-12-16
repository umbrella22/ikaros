import { Command, Option } from 'commander'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { WebCompileService } from './web'
import { Command as BuildCommand } from './core/base-compile-service'
import type {
  CompileOptions,
  CompileServeParame,
} from './core/base-compile-service'
import type { ImportMetaBaseEnv } from '../../types/env'

type DesktopClientCompiler = {
  startDesktopClientCompile: (parame: CompileServeParame) => Promise<void>
}

type DesktopClientCompilerModule =
  | DesktopClientCompiler
  | {
      default?: DesktopClientCompiler
    }

const createMissingDesktopClientCompilerError = (): Error => {
  const pkg = '@ikaros-cli/ikaros-platform-desktop-client'
  const lines = [
    `你启用了 platform='desktopClient'，但未安装可选依赖 ${pkg}。`,
    '',
    '请安装后重试：',
    `  pnpm add -D ${pkg}`,
  ]
  return new Error(lines.join('\n'))
}

const loadDesktopClientCompilerFromContext =
  async (): Promise<DesktopClientCompiler> => {
    const pkg = '@ikaros-cli/ikaros-platform-desktop-client'
    try {
      const context = process.cwd()
      const contextRequire = createRequire(join(context, './'))
      const resolved = contextRequire.resolve(pkg)
      const mod = (await import(
        pathToFileURL(resolved).href
      )) as DesktopClientCompilerModule

      const api =
        (mod as { default?: DesktopClientCompiler }).default ??
        (mod as DesktopClientCompiler)

      if (typeof api?.startDesktopClientCompile !== 'function') {
        throw createMissingDesktopClientCompilerError()
      }

      return api
    } catch {
      throw createMissingDesktopClientCompilerError()
    }
  }

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

/** 启动编译 */
export const startCompile = async (
  parame: CompileServeParame,
): Promise<void> => {
  try {
    switch (parame.options.platform) {
      case Platform.WEB: {
        await WebCompileService.create(parame)
        return
      }
      case Platform.DESKTOPCLIENT: {
        const compiler = await loadDesktopClientCompilerFromContext()
        await compiler.startDesktopClientCompile(parame)
        return
      }
      default: {
        const platforms = Object.values(Platform).join(',')
        throw new Error(
          `No corresponding compilation service was found, platform: ${platforms}`,
        )
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // 避免未捕获异常导致 Node 打印一整行压缩产物源码
    process.stderr.write(`${message}\n`)
    process.exit(1)
  }
}

export const commander = (program: Command) => {
  /** dev */
  const dev = program
    .command(BuildCommand.SERVER, { isDefault: true })
    .description('Start local develop serve')
    .action(async (options: CompileOptions) => {
      await startCompile({
        command: BuildCommand.SERVER,
        options,
      })
    })

  /** build */
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
