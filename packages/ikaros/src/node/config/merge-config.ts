import { mergeUserConfig } from '../shared/common'

export function mergeConfig<T extends object>(
  base: T,
  overrides?: Partial<T>,
): T {
  if (!overrides) {
    return { ...base }
  }

  return mergeUserConfig(
    base as unknown as Record<string, unknown>,
    overrides as unknown as Record<string, unknown>,
  ) as unknown as T
}
