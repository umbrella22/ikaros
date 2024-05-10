import type { IkarosUserConfig } from "..";
import { buildRollupConfig } from "../utils/build-rollup-config";
import { buildViteConfig } from "../utils/build-vite-config";
import { resolveConfig } from "../utils/load-config"
import { createLogger } from "../utils/logger";

const logger = createLogger('info', { prefix: 'ikaros:runner' })

export const runner = async (fileName?: string) => {
  let config: IkarosUserConfig = {
    mode: 'web',
    target: 'web',
    entryDir: 'src',
    outputDir: 'dist',
    main: {},
    renderer: {}
  }
  if (fileName) {
    config = await resolveConfig({ configPath: process.cwd(), configName: fileName })
  }
  const { mode, target } = config
  if (mode === 'web') {
    const viteConfig = buildViteConfig(config)
    logger.info(JSON.stringify(viteConfig))
  }
}