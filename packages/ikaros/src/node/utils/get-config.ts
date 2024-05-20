import type { IkarosUserConfig } from ".."
import { resolveConfig } from "./load-config"

export const getConfig = async (fileName?: string): Promise<IkarosUserConfig> => {
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
  return config
}