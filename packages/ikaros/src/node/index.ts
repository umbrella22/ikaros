import { program } from 'commander'
import { version } from '../../package.json'

import * as compile from './compile/index'
export * from './config/user-config'

// ─── CompileContext + Pipeline ──────────────────────────────────────────────
export {
  createCompileContext,
  Command,
  type CompileContext,
  type CompileOptions,
  type CompileServeParams,
  type PackageJson,
} from './compile/compile-context'
export { runCompile } from './compile/compile-pipeline'

// ─── PlatformAdapter ────────────────────────────────────────────────────────
export {
  createPlatformAdapter,
  WebPlatformAdapter,
  type PlatformAdapter,
  type PlatformPreConfig,
  type PlatformCompileParams,
} from './platform'
export {
  resolveWebPreConfig,
  type WebPreConfig,
  type ResolveWebPreConfigParams,
} from './compile/web/resolve-web-preconfig'

export { LoggerSystem } from './shared/logger'
export {
  runRspackBuild,
  watchRspackBuild,
} from './bundler/rspack/rspack-runner'
export { extensions, resolveCLI } from './shared/constants'
export {
  CreateLoader,
  CreatePlugins,
} from './bundler/rspack/loader-plugin-helper'

// ─── Bundler Adapter (P0 新增) ──────────────────────────────────────────────
export { createBundlerAdapter } from './bundler/bundler-factory'
export type { CreateBundlerAdapterParams } from './bundler/bundler-factory'
export { RspackAdapter } from './bundler/rspack'
export { ViteAdapterLoader } from './bundler/vite'
export type {
  BundlerAdapter,
  CreateConfigParams,
  BundlerDevOptions,
  BundlerBuildOptions,
  BuildStatus,
} from './bundler/types'

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
