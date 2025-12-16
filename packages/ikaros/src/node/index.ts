import { program } from 'commander'
import { version } from '../../package.json'

import * as compile from './compile/index'
export * from './user-config'

// Platform package public API
export {
  BaseCompileService,
  Command,
} from './compile/core/base-compile-service'
export type {
  CompileOptions,
  CompileServeParame,
  PackageJson,
} from './compile/core/base-compile-service'

export { WebCompileService } from './compile/web/web-compile-service'
export { prepareWebCompile } from './compile/web/prepare-web-compile'

export { LoggerSystem } from './utils/logger'
export { runRspackBuild, watchRspackBuild } from './utils/rspack-runner'
export { extensions, resolveCLI } from './utils/const'
export { CreateLoader, CreatePlugins } from './utils/loader-plugin-helper'

export { loadOptionalViteAdapter } from './utils/optional-vite'
export type { OptionalViteAdapter } from './utils/optional-vite'

import chalk from 'chalk'

/** 识别版本 */
const majorVersion = Number(process.versions.node.split('.')[0])
if (majorVersion < 22) {
  const errorTip = chalk.bgRed.white(' ERROR ')
  process.stderr.write(
    `${errorTip} Node.js version must be greater than or equal to v22!\n\n`,
  )
  process.exit(1)
}

program.version(version, '-v, --version')

compile.commander(program)

program.parse()
