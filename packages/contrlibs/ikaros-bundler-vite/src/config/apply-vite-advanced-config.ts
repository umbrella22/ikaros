import { isAbsolute, resolve } from 'node:path'

import { mergeConfig, type InlineConfig } from 'vite'

import type { CreateConfigParams } from '../types'

/**
 * Keep ikaros semantics as the default, while allowing an explicit native
 * Vite override for options that do not belong in the cross-bundler surface.
 */
export const applyViteAdvancedConfig = (
  generatedConfig: InlineConfig,
  params: Pick<CreateConfigParams, 'context' | 'config'>,
): InlineConfig => {
  const advancedConfig = params.config.vite?.config ?? {}
  const configFile = params.config.vite?.configFile ?? false
  const mergedConfig = mergeConfig(
    generatedConfig,
    advancedConfig as InlineConfig,
  ) as InlineConfig

  return {
    ...mergedConfig,
    configFile: configFile
      ? isAbsolute(configFile)
        ? configFile
        : resolve(params.context, configFile)
      : false,
  }
}
