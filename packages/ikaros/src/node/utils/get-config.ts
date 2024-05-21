import { join } from "node:path"
import { pathExists } from 'fs-extra'
import type { IkarosUserConfig } from ".."
import { resolveConfig } from "./load-config"

export const getConfig = async (configFile?: string): Promise<IkarosUserConfig> => {
  const config: IkarosUserConfig = {
    mode: 'web',
    target: 'web',
    entryDir: 'src',
    outputDir: 'dist',
    main: {},
    renderer: {}
  }
  let fileConfig: IkarosUserConfig | undefined = undefined

  fileConfig = await resolveConfig({ configFile });
  if (fileConfig) {
    return fileConfig
  }
  return config;
}