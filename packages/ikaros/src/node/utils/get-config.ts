import type { IkarosUserConfig } from '..'
import { resolveConfig } from './load-config'
import { join } from 'node:path'

export const getConfig = async (
  configFile?: string,
): Promise<IkarosUserConfig> => {
  const config: IkarosUserConfig = {
    mode: 'web',
    target: 'pc',
    entryDir: 'src',
    outputDir: 'dist',
    main: {},
    renderer: {},
  }
  let fileConfig: IkarosUserConfig | undefined = undefined

  fileConfig = await resolveConfig({ configFile })
  if (fileConfig) {
    if (fileConfig.mode === 'client') {
      fileConfig.outputDir = join('dist', 'client')
    }
    return fileConfig
  }

  return config
}
