import { join } from 'node:path'
import type { UserConfig } from 'vite'
import type { RendererConfig } from '../config'
import { store } from './constants'
const { rootDir } = store
export const buildViteConfig = (userConfig: RendererConfig) => {
  const { entryDir, outputDir } = userConfig
  const root = join(rootDir, entryDir)
  const defineConfig: UserConfig = {
    mode: process.env.NODE_ENV,
    root,
    define: {},
    resolve: {
      alias: {},
    },
    base: './',
    build: {
      outDir: outputDir,
      emptyOutDir: true,
      target: 'esnext',
      minify: 'esbuild',
      cssCodeSplit: false,
    },
    server: {},
    plugins: [],
    optimizeDeps: {},
  }
  return defineConfig
}
