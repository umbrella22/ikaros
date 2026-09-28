import { defineConfig } from 'tsdown'

export default defineConfig(({ watch }) => ({
  entry: ['src/**/*.ts'],
  unbundle: false,
  clean: true,
  target: 'esnext',
  format: ['esm'],
  outDir: 'dist',
  deps: { neverBundle: true },
  minify: !watch,
  dts: true,
}))
