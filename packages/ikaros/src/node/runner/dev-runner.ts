// import type { RollupOptions } from 'rollup'
// import { buildRollupConfig } from '../utils/build-rollup-config'
import type { CLIOptions } from '../../types/env'
import { buildViteConfig } from '../utils/build-vite-config'
import { getConfig } from '../utils/get-config'
import { createLogger } from '../utils/logger'
import { createServer, type UserConfig } from 'vite'

const logger = createLogger('info', { prefix: 'ikaros-cli:runner' })

export const devRunner = async (parames?: CLIOptions): Promise<void> => {
  const { configFile = undefined, options = undefined } = parames ?? {}
  let viteConfig: UserConfig | undefined = undefined
  // const rollupConfig: RollupOptions | undefined = undefined
  const config = await getConfig({
    configFile,
    command: 'serve',
    mode: options?.mode ?? 'development',
  })
  const { platform, target } = config
  logger.info(`platform: ${platform}, target: ${target}`)
  viteConfig = buildViteConfig(config)
  //TODO: 这里需要创建一个用来聚合vite和rollup的服务
  if (platform === 'web') {
    const server = await createServer({ configFile: false, ...viteConfig })
    await server.listen()
    server.printUrls()
    server.bindCLIShortcuts({ print: true })
    return
  }
  // rollupConfig = buildRollupConfig(config)
}
