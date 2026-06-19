import {
  normalizeConfig,
  type NormalizedConfig,
} from '../../config/normalize-config'
import type { UserConfig } from '../../config/user-config'
import { Command } from '../compile-context'
import { detect } from 'detect-port'
import { DEFAULT_PORT } from '../../shared/constants'

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
  const userConfig = await getUserConfig()
  const resolvedPort =
    userConfig?.dev?.port ??
    (command === Command.SERVER ? await detect(DEFAULT_PORT) : DEFAULT_PORT)

  return normalizeConfig({
    command,
    context: context ?? process.cwd(),
    resolveContext,
    userConfig,
    isElectron,
    resolvedPort,
  })
}
