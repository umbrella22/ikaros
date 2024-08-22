// import type { RollupOptions } from 'rollup'
// import { buildRollupConfig } from '../utils/build-rollup-config'
import type { CLIOptions } from '../../types/env'
import { buildViteConfig } from '../utils/build-vite-config'
import { getConfig } from '../utils/get-config'
import { createLogger } from '../utils/logger'
import { build, type UserConfig } from 'vite'

const logger = createLogger('info', { prefix: 'ikaros-cli:builder' })

export const buildRunner = async (parames?: CLIOptions): Promise<void> => {
  const { configFile = undefined, options = undefined } = parames ?? {}
  let viteConfig: UserConfig | undefined = undefined
  // const rollupConfig: RollupOptions | undefined = undefined
  const config = await getConfig({
    configFile,
    command: 'build',
    mode: options?.mode ?? 'production',
  })
  const { platform, target } = config
  logger.info(`platform: ${platform}, target: ${target}`)
  viteConfig = buildViteConfig(config)
  //TODO: 这里需要创建一个用来聚合vite和rollup的服务
  if (platform === 'web') {
    await build({ configFile: false, ...viteConfig })
    return
  }
  // rollupConfig = buildRollupConfig(config)
}
