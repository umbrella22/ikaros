import { mergeUserConfig } from '../shared/common'

export function mergeConfig<T extends Record<string, unknown>>(
  base: T,
  overrides?: Partial<T>,
): T {
  if (!overrides) {
    return { ...base }
  }

  return mergeUserConfig(base, overrides as T)
}
