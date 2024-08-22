/// <reference types="vite/client" />
import type { GlobalCLIOptions } from '../node/cli'
interface ImportMetaBaseEnv {
  /** 命令行所指定的 mode (-m, --mode) */
  MODE?: string

  /** 路径前缀 */
  BASE?: string
}

interface ImportMetaEnv {}

interface ImportMeta {
  readonly env: Readonly<ImportMetaEnv & ImportMetaBaseEnv>
}

interface CLIOptions {
  configFile?: string
  options?: GlobalCLIOptions
}
