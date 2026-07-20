import type { InlineConfig } from 'vite'

/**
 * Type-safe helper for bundle.vite.config without adding Vite as a core peer.
 */
export const defineViteConfig = (config: InlineConfig): InlineConfig => config
