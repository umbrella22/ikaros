import { defineConfig } from 'tsup'

export default defineConfig(({ watch }) => ({
  entry: ['src/index.ts'],
  bundle: false,
  clean: true,
  target: 'esnext',
  format: ['cjs'],
  outDir: 'dist',
  skipNodeModulesBundle: true,
  minify: !watch,
  dts: true,
}))
