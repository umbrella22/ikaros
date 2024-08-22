import type { ConfigEnvPre, IkarosUserConfig } from '..'
import { resolveConfig } from './load-config'
import { join } from 'node:path'
import { isFunction, isObject } from 'radash'
import { adapterEnv, getEnv, mergeUserConfig } from './tools'

type ConfigParams = {
  configFile?: string
  command: 'serve' | 'build'
  mode: string
}
/**
 * @description 获取配置
 * @date 2024-05-22
 * @param {ConfigParams} configParams 配置参数
 * @returns {Promise<IkarosUserConfig>}
 */

export const getConfig = async (
  configParams: ConfigParams,
): Promise<IkarosUserConfig> => {
  const { configFile = undefined, command, mode } = configParams
  const env = await getEnv(mode)
  const config: IkarosUserConfig = {
    platform: 'web',
    target: 'pc',
    entryDir: 'src',
    outputDir: 'dist',
    main: {},
    renderer: {
      viteOption: {
        define: adapterEnv(env),
      },
    },
    preload: {},
  }
  let fileConfig: IkarosUserConfig | undefined = undefined

  const tempConfig = await resolveConfig({ configFile })
  if (tempConfig) {
    if (isFunction(tempConfig)) {
      const retain: ConfigEnvPre['env'] = {}
      const opts: ConfigEnvPre = {
        mode,
        env: Object.assign(retain, env),
        command,
      }
      fileConfig = await tempConfig(opts)
    }
    if (isObject(tempConfig)) {
      if (tempConfig.platform === 'client') {
        tempConfig.outputDir = join('dist', 'client')
      }
      fileConfig = tempConfig
    }
    return mergeUserConfig(config, fileConfig ?? {})
  }

  return config
}
