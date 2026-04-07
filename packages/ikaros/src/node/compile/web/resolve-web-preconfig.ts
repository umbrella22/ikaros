import {
  normalizeConfig,
  type NormalizedConfig,
} from '../../config/normalize-config'
import type { UserConfig } from '../../config/user-config'
import { Command } from '../compile-context'

export type WebPreConfig = NormalizedConfig

export type ResolveWebPreConfigParams = {
  command: Command
  context?: string
  resolveContext: (...paths: string[]) => string
  getUserConfig: () => Promise<UserConfig | undefined>
  isElectron?: boolean
}

export async function resolveWebPreConfig(
  params: ResolveWebPreConfigParams,
): Promise<WebPreConfig> {
  const { command, context, resolveContext, getUserConfig, isElectron } = params

  return normalizeConfig({
    command,
    context: context ?? process.cwd(),
    resolveContext,
    userConfig: await getUserConfig(),
    isElectron,
  })
}
