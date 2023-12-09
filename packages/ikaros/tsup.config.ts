import { defineConfig } from 'tsup'

export default defineConfig(({ watch }) => ({
  entry: ['src/**/*.ts'],
  bundle: false,
  clean: true,
  target: 'node18',
  format: ['cjs'],
  outDir: 'dist',
  skipNodeModulesBundle: true,
  minify: !watch,
}))
