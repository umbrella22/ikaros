import { buildRollupConfig } from "../utils/build-rollup-config";
import { buildViteConfig } from "../utils/build-vite-config";
import { getConfig } from "../utils/get-config";
import { createLogger } from "../utils/logger";
import { createServer } from "vite"

const logger = createLogger('info', { prefix: 'ikaros:runner' })

export const devRunner: (fileName?: string) => Promise<void> = async (fileName?: string) => {
  const config = await getConfig(fileName)
  const { mode, target } = config
  if (mode === 'web') {
    const viteConfig = buildViteConfig(config)
    const server = await createServer(viteConfig)
    await server.listen()
    server.printUrls()
    server.bindCLIShortcuts({ print: true })
    return
  }
}