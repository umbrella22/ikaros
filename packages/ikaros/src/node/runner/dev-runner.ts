import { buildRollupConfig } from "../utils/build-rollup-config";
import { buildViteConfig } from "../utils/build-vite-config";
import { getConfig } from "../utils/get-config";
import { createLogger } from "../utils/logger";
import { createServer } from "vite"


const logger = createLogger('info', { prefix: 'ikaros-cli:runner' })

export const devRunner = async (fileName?: string): Promise<void> => {
  const config = await getConfig(fileName)
  const { mode, target } = config
  logger.info(`mode: ${mode}, target: ${target}`)
  const viteConfig = buildViteConfig(config)
  if (mode === 'web') {
    const server = await createServer({ configFile: false, ...viteConfig })
    await server.listen()
    server.printUrls()
    server.bindCLIShortcuts({ print: true })
    return
  }

}