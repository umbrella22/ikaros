import chalk from 'chalk'
import { detect } from 'detect-port'

import type { UserConfig } from '../../user-config'
import type { Pages } from '../../utils/loader-plugin-helper'
import { checkDependency } from '../../utils/common-tools'
import { Command } from '../core/base-compile-service'

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
  resolveContext: (...paths: string[]) => string
  getUserConfig: () => Promise<UserConfig | undefined>
  isElectron?: boolean
}

const resolveBrowserslist = (target: WebPreConfig['target']): string => {
  const isMobile = target === 'mobile'

  const bl = ['defaults']

  if (isMobile) {
    bl.push('IOS >= 16', 'Chrome >= 80')
  } else {
    bl.push(
      '>0.2%',
      'Chrome >= 90',
      'Safari >= 16',
      'last 2 versions',
      'not dead',
    )
  }

  return bl.join(',')
}

const resolveDefaultPages = (
  resolveContext: ResolveWebPreConfigParams['resolveContext'],
  isElectron: boolean,
): Pages => {
  if (isElectron) {
    return {
      index: {
        html: resolveContext('src/renderer/index.html'),
        entry: resolveContext('src/renderer/index'),
      },
    }
  }

  return {
    index: {
      html: resolveContext('index.html'),
      entry: resolveContext('src/index'),
    },
  }
}

export const resolveWebPreConfig = async (
  params: ResolveWebPreConfigParams,
): Promise<WebPreConfig> => {
  const { command, resolveContext, getUserConfig, isElectron } = params

  const userConfig = await getUserConfig()

  const base = userConfig?.build?.base ?? '/'

  if (command === Command.SERVER && /^https?:/.test(base)) {
    const optsText = chalk.cyan('build.base')
    throw new Error(`本地开发时 ${optsText} 不应该为外部 Host!`)
  }

  const target = userConfig?.target ?? 'pc'

  const pages =
    userConfig?.pages ??
    resolveDefaultPages(resolveContext, Boolean(isElectron))

  const port = userConfig?.server?.port ?? (await detect('8080'))

  let isVue = false
  let isReact = false
  try {
    const [hasReact, hasVue] = await Promise.all([
      checkDependency('react'),
      checkDependency('vue'),
    ])
    isVue = hasVue
    isReact = hasReact
  } catch {
    // ignore dependency check errors
  }

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
