export interface ImportMetaBaseEnv {
  /** 命令行所指定的 mode (-m, --mode) */
  MODE?: string
  /** 路径前缀 */
  BASE?: string
  /** 平台 */
  PLATFORM: 'web'
}

export type ImportMetaEnv = unknown

export interface ImportMeta {
  readonly env: Readonly<ImportMetaEnv & ImportMetaBaseEnv>
}

export interface CLIOptions {
  configFile?: string
}
