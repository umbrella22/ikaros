import { defineConfig } from 'tsdown'

export default defineConfig(({ watch }) => ({
  entry: ['src/index.ts'],
  bundle: false,
  clean: true,
  target: 'esnext',
  format: ['esm'],
  outDir: 'dist',
  skipNodeModulesBundle: true,
  minify: !watch,
  dts: true,
}))
