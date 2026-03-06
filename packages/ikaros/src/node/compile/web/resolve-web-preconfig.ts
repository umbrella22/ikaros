import chalk from 'chalk'
import { detect } from 'detect-port'

import type { UserConfig } from '../../config/user-config'
import type { Pages } from '../../bundler/rspack/loader-plugin-helper'
import { checkDependency } from '../../shared/common'
import {
  BROWSERSLIST,
  DEFAULT_BASE_PATH,
  DEFAULT_ENTRY_PATH,
  DEFAULT_HTML_TEMPLATE,
  DEFAULT_PORT,
} from '../../shared/constants'
import { Command } from '../compile-context'

export type WebPreConfig = {
  userConfig?: UserConfig
  base: string
  target: Exclude<UserConfig['target'], undefined>
  pages: Exclude<UserConfig['pages'], undefined>
  port: number
  browserslist: string
  isVue: boolean
  isReact: boolean
}

export type ResolveWebPreConfigParams = {
  command: Command
  context?: string
  resolveContext: (...paths: string[]) => string
  getUserConfig: () => Promise<UserConfig | undefined>
  isElectron?: boolean
}

const resolveBrowserslist = (target: WebPreConfig['target']): string => {
  const list = target === 'mobile' ? BROWSERSLIST.mobile : BROWSERSLIST.pc
  return list.join(',')
}

const resolveDefaultPages = (
  resolveContext: ResolveWebPreConfigParams['resolveContext'],
  isElectron: boolean,
): Pages => {
  if (isElectron) {
    return {
      index: {
        html: resolveContext(`src/renderer/${DEFAULT_HTML_TEMPLATE}`),
        entry: resolveContext('src/renderer/index'),
      },
    }
  }

  return {
    index: {
      html: resolveContext(DEFAULT_HTML_TEMPLATE),
      entry: resolveContext(DEFAULT_ENTRY_PATH),
    },
  }
}

export const resolveWebPreConfig = async (
  params: ResolveWebPreConfigParams,
): Promise<WebPreConfig> => {
  const { command, context, resolveContext, getUserConfig, isElectron } = params

  const userConfig = await getUserConfig()

  const base = userConfig?.build?.base ?? DEFAULT_BASE_PATH

  if (command === Command.SERVER && /^https?:/.test(base)) {
    const optsText = chalk.cyan('build.base')
    throw new Error(`本地开发时 ${optsText} 不应该为外部 Host!`)
  }

  const target = userConfig?.target ?? 'pc'

  const pages =
    userConfig?.pages ??
    resolveDefaultPages(resolveContext, Boolean(isElectron))

  const port = userConfig?.server?.port ?? (await detect(String(DEFAULT_PORT)))

  const isReact = checkDependency('react', context)
  const isVue = checkDependency('vue', context)

  const browserslist = resolveBrowserslist(target)

  return {
    userConfig,
    base,
    target,
    pages,
    port,
    browserslist,
    isVue,
    isReact,
  }
}
