// import type { RollupOptions } from 'rollup'
// import { buildRollupConfig } from '../utils/build-rollup-config'
import { buildViteConfig } from '../utils/build-vite-config'
import { getConfig } from '../utils/get-config'
import { createLogger } from '../utils/logger'
import { createServer, type UserConfig } from 'vite'

const logger = createLogger('info', { prefix: 'ikaros-cli:runner' })

export const devRunner = async (fileName?: string): Promise<void> => {
  let viteConfig: UserConfig | undefined = undefined
  // const rollupConfig: RollupOptions | undefined = undefined
  const config = await getConfig(fileName)
  const { mode, target } = config
  logger.info(`mode: ${mode}, target: ${target}`)
  viteConfig = buildViteConfig(config)
  //TODO: 这里需要创建一个用来聚合vite和rollup的服务
  if (mode === 'web') {
    const server = await createServer({ configFile: false, ...viteConfig })
    await server.listen()
    server.printUrls()
    server.bindCLIShortcuts({ print: true })
    return
  }
  // rollupConfig = buildRollupConfig(config)
}
